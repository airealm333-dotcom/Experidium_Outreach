import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { ContactStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isLinkedInAuthor } from "@/lib/linkedin-authors";

const CONTACT_STATUSES = new Set<string>(Object.values(ContactStatus));

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

function prismaErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: string }).message);
  }
  return String(error);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const data: Prisma.ContactUpdateInput = {};

    if ("firstName" in body) {
      if (typeof body.firstName !== "string" || !body.firstName.trim()) {
        return NextResponse.json({ error: "firstName is required" }, { status: 400 });
      }
      data.firstName = body.firstName.trim();
    }

    if ("lastName" in body) {
      data.lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    }

    if ("email" in body) {
      if (typeof body.email !== "string" || !body.email.trim()) {
        return NextResponse.json({ error: "email is required" }, { status: 400 });
      }
      data.email = body.email.trim().toLowerCase();
    }

    if ("position" in body) {
      data.position =
        typeof body.position === "string" && body.position.trim()
          ? body.position.trim()
          : null;
    }

    if ("seniority" in body) {
      data.seniority =
        typeof body.seniority === "string" && body.seniority.trim()
          ? body.seniority.trim()
          : null;
    }

    if ("linkedinUrl" in body) {
      data.linkedinUrl =
        typeof body.linkedinUrl === "string" && body.linkedinUrl.trim()
          ? body.linkedinUrl.trim()
          : null;
    }

    if ("country" in body) {
      data.country =
        typeof body.country === "string" && body.country.trim()
          ? body.country.trim()
          : null;
    }

    if ("state" in body) {
      data.state =
        typeof body.state === "string" && body.state.trim() ? body.state.trim() : null;
    }

    if ("status" in body) {
      if (typeof body.status !== "string" || !CONTACT_STATUSES.has(body.status)) {
        return NextResponse.json({ error: "Invalid contact status" }, { status: 400 });
      }
      data.status = body.status as ContactStatus;
    }

    if ("author" in body) {
      const author = body.author;
      if (author === null || author === "") {
        data.author = null;
      } else if (typeof author === "string" && isLinkedInAuthor(author)) {
        data.author = author;
      } else {
        return NextResponse.json(
          { error: "Invalid author. Must be adithyan, adarsh, or vishnu." },
          { status: 400 }
        );
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.update({
      where: { id },
      data,
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Contact update error:", error);

    if (isUniqueViolation(error)) {
      return NextResponse.json(
        {
          error: "Email already belongs to another contact",
          details: prismaErrorMessage(error),
        },
        { status: 409 }
      );
    }

    const message = prismaErrorMessage(error);
    const schemaHint = message.includes("author")
      ? "Database may be missing the author column. Run: npx prisma db push && npx prisma generate, then restart the dev server."
      : undefined;

    return NextResponse.json(
      {
        error: "Failed to update contact",
        details: schemaHint ?? message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.contact.delete({ where: { id } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Contact delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete contact", details: String(error) },
      { status: 500 }
    );
  }
}
