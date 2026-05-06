import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";

const DEFAULT_DELAY_SECONDS = 2;
const DEFAULT_MAX_EMAILS_PER_DAY = 100;

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

    const prismaAny = prisma as unknown as Record<string, unknown>;
    const appSettingsDelegate = prismaAny.appSettings as
      | { findUnique: (args: { where: { id: string } }) => Promise<{ delayBetweenEmailsSeconds: number; maxEmailsPerDay: number } | null> }
      | undefined;
    const [appSettings, templateFallback] = await Promise.all([
      appSettingsDelegate?.findUnique
        ? appSettingsDelegate.findUnique({ where: { id: "default" } })
        : Promise.resolve(null),
      prisma.emailTemplate.findFirst({ orderBy: { updatedAt: "desc" } }),
    ]);
    const fallbackDelay = Number.parseInt(templateFallback?.subjectTemplate || "", 10);
    const fallbackMaxPerDay = Number.parseInt(templateFallback?.bodyTemplate || "", 10);

    const delayBetweenEmailsSeconds =
      appSettings?.delayBetweenEmailsSeconds ??
      (Number.isFinite(fallbackDelay) ? fallbackDelay : DEFAULT_DELAY_SECONDS);
    const maxEmailsPerDay =
      appSettings?.maxEmailsPerDay ??
      (Number.isFinite(fallbackMaxPerDay)
        ? fallbackMaxPerDay
        : DEFAULT_MAX_EMAILS_PER_DAY);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const sentToday = await prisma.emailSend.count({
      where: {
        sentAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (sentToday + drafts.length > maxEmailsPerDay) {
      const remainingToday = Math.max(maxEmailsPerDay - sentToday, 0);
      return NextResponse.json(
        {
          error: `Daily send limit reached. Remaining today: ${remainingToday}, requested: ${drafts.length}, limit: ${maxEmailsPerDay}.`,
        },
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
        const data = await sendEmail({
          to: draft.contact.email,
          subject: draft.subject,
          text: draft.body,
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

        if (drafts.length > 1 && delayBetweenEmailsSeconds > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, delayBetweenEmailsSeconds * 1000)
          );
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
