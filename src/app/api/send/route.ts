import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isShortStandaloneLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  if (/^(hi|hello|hey|dear)\b/i.test(trimmed)) return true;
  if (/^(best|regards|thanks|cheers|sincerely|warm regards)\b/i.test(trimmed)) {
    return true;
  }

  const words = trimmed.split(/\s+/).length;
  return words <= 6 && trimmed.endsWith(",");
}

function formatBodyParagraphs(body: string): string[] {
  const normalized = body
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return ["Hi there,"];

  const lines = normalized.split("\n");
  const paragraphs: string[] = [];
  let buffer: string[] = [];

  const pushBuffer = () => {
    if (buffer.length > 0) {
      paragraphs.push(buffer.join(" "));
      buffer = [];
    }
  };

  for (const line of lines) {
    if (!line) {
      pushBuffer();
      continue;
    }

    if (isShortStandaloneLine(line)) {
      pushBuffer();
      paragraphs.push(line);
      continue;
    }

    buffer.push(line);
  }
  pushBuffer();

  return paragraphs.length > 0 ? paragraphs : [normalized];
}

function renderEmailHtml(body: string): string {
  const paragraphs = formatBodyParagraphs(body);
  const bodyHtml = paragraphs
    .map((paragraph) => {
      const safeParagraph = escapeHtml(paragraph).replace(/\n/g, "<br />");
      return `<p style="margin:0 0 14px 0;">${safeParagraph}</p>`;
    })
    .join("");

  return `
    <div style="background:#f8fafc;padding:24px 12px;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:26px 24px;color:#0f172a;font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.65;">
        ${bodyHtml}
        <div style="margin-top:22px;padding-top:14px;border-top:1px solid #e2e8f0;color:#334155;">
          <p style="margin:0 0 2px 0;font-weight:600;">Alex</p>
          <p style="margin:0;">Experidium</p>
        </div>
      </div>
    </div>
  `.trim();
}

export async function POST(req: NextRequest) {
  try {
    const { draftIds } = await req.json();

    if (!draftIds || !Array.isArray(draftIds) || draftIds.length === 0) {
      return NextResponse.json(
        { error: "draftIds array is required" },
        { status: 400 }
      );
    }

    const drafts = await prisma.emailDraft.findMany({
      where: { id: { in: draftIds }, status: "APPROVED" },
      include: {
        contact: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (drafts.length === 0) {
      return NextResponse.json(
        { error: "No approved drafts found" },
        { status: 400 }
      );
    }

    const results: { draftId: string; messageId: string }[] = [];
    const errors: { draftId: string; error: string }[] = [];

    for (const draft of drafts as unknown as {
      id: string;
      subject: string;
      body: string;
      contact: { id: string; email: string; firstName: string; lastName: string };
    }[]) {
      try {
        const htmlBody = renderEmailHtml(draft.body);

        const data = await sendEmail({
          to: draft.contact.email,
          subject: draft.subject,
          html: htmlBody,
        });

        const messageId = data?.id || "unknown";

        await prisma.emailSend.create({
          data: {
            draftId: draft.id,
            contactId: draft.contact.id,
            resendMessageId: messageId,
            fromAddress: "alex@experidium.online",
          },
        });

        await prisma.emailDraft.update({
          where: { id: draft.id },
          data: { status: "SENT" },
        });

        await prisma.contact.update({
          where: { id: draft.contact.id },
          data: { status: "CONTACTED" },
        });

        await prisma.activity.create({
          data: {
            contactId: draft.contact.id,
            type: "EMAIL",
            subject: `Sent: ${draft.subject}`,
            body: `Email sent to ${draft.contact.email}`,
          },
        });

        results.push({ draftId: draft.id, messageId });

        if (drafts.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (err) {
        errors.push({ draftId: draft.id, error: String(err) });
      }
    }

    return NextResponse.json({
      sent: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (error) {
    console.error("Send error:", error);
    return NextResponse.json(
      { error: "Failed to send emails", details: String(error) },
      { status: 500 }
    );
  }
}
