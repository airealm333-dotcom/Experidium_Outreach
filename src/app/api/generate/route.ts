import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmailCopy, buildPrompt } from "@/lib/ai";

const DELAY_BETWEEN_CALLS_MS = 2100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const { contactIds } = await req.json();

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "contactIds array is required" },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!template) {
      return NextResponse.json(
        { error: "No email template found. Go to Settings to configure one, or run: npm run db:seed" },
        { status: 400 }
      );
    }

    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      include: { company: true },
    });

    const results: { contactId: string; draftId: string; subject: string }[] = [];
    const errors: { contactId: string; name: string; error: string }[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i] as unknown as {
        id: string;
        firstName: string;
        lastName: string;
        position: string | null;
        company: {
          name: string | null;
          industry: string | null;
          employeeCount: number | null;
          description: string | null;
        } | null;
      };

      try {
        const prompt = buildPrompt(
          template.promptTemplate,
          contact,
          contact.company
        );

        const { subject, body } = await generateEmailCopy(prompt);

        const draft = await prisma.emailDraft.create({
          data: {
            contactId: contact.id,
            subject,
            body,
            status: "PENDING_REVIEW",
            generatedBy: "groq-llama-3.3-70b",
          },
        });

        results.push({
          contactId: contact.id,
          draftId: draft.id,
          subject,
        });
      } catch (err) {
        const errStr = String(err);
        const isQuotaError = errStr.includes("429") || errStr.includes("rate_limit") || errStr.includes("quota");

        errors.push({
          contactId: contact.id,
          name: `${contact.firstName} ${contact.lastName}`,
          error: isQuotaError
            ? "Groq API rate limit exceeded. Wait a minute and try again."
            : errStr,
        });

        if (isQuotaError) {
          for (let j = i + 1; j < contacts.length; j++) {
            const c = contacts[j] as unknown as { id: string; firstName: string; lastName: string };
            errors.push({
              contactId: c.id,
              name: `${c.firstName} ${c.lastName}`,
              error: "Skipped — Groq API rate limit exceeded.",
            });
          }
          break;
        }
      }

      if (i < contacts.length - 1) {
        await sleep(DELAY_BETWEEN_CALLS_MS);
      }
    }

    return NextResponse.json({
      generated: results.length,
      failed: errors.length,
      total: contacts.length,
      results,
      errors: errors.map((e) => ({ contactId: e.contactId, name: e.name, error: e.error.slice(0, 200) })),
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate emails", details: String(error) },
      { status: 500 }
    );
  }
}
