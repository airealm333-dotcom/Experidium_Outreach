import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const EVENT_MAP: Record<string, string> = {
  "email.delivered": "DELIVERED",
  "email.opened": "OPENED",
  "email.clicked": "CLICKED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
};

function parseProviderTimestamp(payload: Record<string, unknown>): Date {
  const candidates = [
    payload.created_at,
    payload.createdAt,
    (payload.data as Record<string, unknown> | undefined)?.created_at,
    (payload.data as Record<string, unknown> | undefined)?.createdAt,
    (payload.data as Record<string, unknown> | undefined)?.timestamp,
  ];

  for (const value of candidates) {
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return new Date();
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("svix-signature");
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (webhookSecret && webhookSecret !== "your-resend-webhook-secret" && signature) {
      const svixId = req.headers.get("svix-id") || "";
      const svixTimestamp = req.headers.get("svix-timestamp") || "";
      const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;

      const secretBytes = Buffer.from(
        webhookSecret.replace("whsec_", ""),
        "base64"
      );
      const computedSignature = crypto
        .createHmac("sha256", secretBytes)
        .update(signedContent)
        .digest("base64");

      const signatures = signature.split(" ");
      const isValid = signatures.some((sig) => {
        const sigValue = sig.split(",")[1];
        return sigValue === computedSignature;
      });

      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.type;
    const mappedType = EVENT_MAP[eventType];

    if (!mappedType) {
      console.info(`Webhook skipped unknown event type: ${String(eventType)}`);
      return NextResponse.json({ received: true, skipped: true });
    }

    const emailId =
      payload.data?.email_id || payload.data?.messageId || payload.data?.id;

    if (!emailId) {
      return NextResponse.json({ received: true, skipped: true });
    }

    const emailSend = await prisma.emailSend.findFirst({
      where: { resendMessageId: emailId },
    });

    if (!emailSend) {
      return NextResponse.json({ received: true, skipped: true });
    }

    const providerTimestamp = parseProviderTimestamp(payload as Record<string, unknown>);
    const eventHash = crypto
      .createHash("sha256")
      .update(`${emailSend.id}:${eventType}:${rawBody}`)
      .digest("hex");

    const existing = await prisma.emailEvent.findUnique({
      where: { eventHash },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ received: true, deduplicated: true });
    }

    await prisma.emailEvent.create({
      data: {
        sendId: emailSend.id,
        type: mappedType as "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "COMPLAINED",
        eventHash,
        payload: rawBody,
        timestamp: providerTimestamp,
      },
    });

    if (mappedType === "BOUNCED") {
      await prisma.contact.update({
        where: { id: emailSend.contactId },
        data: { status: "BOUNCED" },
      });
    } else if (mappedType === "COMPLAINED") {
      await prisma.contact.update({
        where: { id: emailSend.contactId },
        data: { status: "UNSUBSCRIBED" },
      });
    }

    return NextResponse.json({ received: true, eventType: mappedType });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
