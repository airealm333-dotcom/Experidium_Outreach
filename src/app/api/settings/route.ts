import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_DELAY_SECONDS = 2;
const DEFAULT_MAX_EMAILS_PER_DAY = 100;

function toSafeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseStoredInt(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET() {
  try {
    const prismaAny = prisma as unknown as Record<string, unknown>;
    const appSettingsDelegate = prismaAny.appSettings as
      | { findUnique: (args: { where: { id: string } }) => Promise<{ delayBetweenEmailsSeconds: number; maxEmailsPerDay: number } | null> }
      | undefined;

    const [template, appSettings] = await Promise.all([
      prisma.emailTemplate.findFirst({
        orderBy: { updatedAt: "desc" },
      }),
      appSettingsDelegate?.findUnique
        ? appSettingsDelegate.findUnique({ where: { id: "default" } })
        : Promise.resolve(null),
    ]);

    const fallbackDelay = parseStoredInt(
      template?.subjectTemplate,
      DEFAULT_DELAY_SECONDS
    );
    const fallbackMaxPerDay = parseStoredInt(
      template?.bodyTemplate,
      DEFAULT_MAX_EMAILS_PER_DAY
    );

    return NextResponse.json({
      promptTemplate: template?.promptTemplate || "",
      templateId: template?.id || null,
      delayBetweenEmailsSeconds:
        appSettings?.delayBetweenEmailsSeconds ?? fallbackDelay,
      maxEmailsPerDay: appSettings?.maxEmailsPerDay ?? fallbackMaxPerDay,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load settings", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      promptTemplate,
      delayBetweenEmailsSeconds: rawDelayBetweenEmailsSeconds,
      maxEmailsPerDay: rawMaxEmailsPerDay,
    } = body;

    if (promptTemplate !== undefined) {
      const existing = await prisma.emailTemplate.findFirst({
        orderBy: { updatedAt: "desc" },
      });

      if (existing) {
        await prisma.emailTemplate.update({
          where: { id: existing.id },
          data: { promptTemplate },
        });
      } else {
        await prisma.emailTemplate.create({
          data: {
            name: "Default Cold Email",
            promptTemplate,
          },
        });
      }
    }

    const delayBetweenEmailsSeconds = toSafeInt(rawDelayBetweenEmailsSeconds);
    const maxEmailsPerDay = toSafeInt(rawMaxEmailsPerDay);
    const hasPacingPatch =
      rawDelayBetweenEmailsSeconds !== undefined || rawMaxEmailsPerDay !== undefined;

    if (rawDelayBetweenEmailsSeconds !== undefined) {
      if (delayBetweenEmailsSeconds === null || delayBetweenEmailsSeconds < 0 || delayBetweenEmailsSeconds > 3600) {
        return NextResponse.json(
          { error: "delayBetweenEmailsSeconds must be an integer between 0 and 3600" },
          { status: 400 }
        );
      }
    }

    if (rawMaxEmailsPerDay !== undefined) {
      if (maxEmailsPerDay === null || maxEmailsPerDay < 1 || maxEmailsPerDay > 100000) {
        return NextResponse.json(
          { error: "maxEmailsPerDay must be an integer between 1 and 100000" },
          { status: 400 }
        );
      }
    }

    if (hasPacingPatch) {
      const prismaAny = prisma as unknown as Record<string, unknown>;
      const appSettingsDelegate = prismaAny.appSettings as
        | {
            upsert: (args: {
              where: { id: string };
              create: {
                id: string;
                delayBetweenEmailsSeconds: number;
                maxEmailsPerDay: number;
              };
              update: Record<string, number>;
            }) => Promise<unknown>;
          }
        | undefined;

      if (appSettingsDelegate?.upsert) {
        await appSettingsDelegate.upsert({
          where: { id: "default" },
          create: {
            id: "default",
            delayBetweenEmailsSeconds:
              delayBetweenEmailsSeconds ?? DEFAULT_DELAY_SECONDS,
            maxEmailsPerDay: maxEmailsPerDay ?? DEFAULT_MAX_EMAILS_PER_DAY,
          },
          update: {
            ...(delayBetweenEmailsSeconds !== null
              ? { delayBetweenEmailsSeconds }
              : {}),
            ...(maxEmailsPerDay !== null ? { maxEmailsPerDay } : {}),
          },
        });
      } else {
        const existing = await prisma.emailTemplate.findFirst({
          orderBy: { updatedAt: "desc" },
        });
        const finalDelay = delayBetweenEmailsSeconds ?? DEFAULT_DELAY_SECONDS;
        const finalMaxPerDay = maxEmailsPerDay ?? DEFAULT_MAX_EMAILS_PER_DAY;
        if (existing) {
          await prisma.emailTemplate.update({
            where: { id: existing.id },
            data: {
              subjectTemplate: String(finalDelay),
              bodyTemplate: String(finalMaxPerDay),
            },
          });
        } else {
          await prisma.emailTemplate.create({
            data: {
              name: "Default Cold Email",
              promptTemplate: "",
              subjectTemplate: String(finalDelay),
              bodyTemplate: String(finalMaxPerDay),
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save settings", details: String(error) },
      { status: 500 }
    );
  }
}
