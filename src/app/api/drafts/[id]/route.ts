import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const draft = await prisma.emailDraft.findUnique({
      where: { id },
      include: {
        contact: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json(draft);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch draft", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { status, subject, body: draftBody } = body;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (subject !== undefined) updateData.subject = subject;
    if (draftBody !== undefined) updateData.body = draftBody;

    const draft = await prisma.emailDraft.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(draft);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update draft", details: String(error) },
      { status: 500 }
    );
  }
}
