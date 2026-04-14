import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  try {
    const result = await prisma.emailDraft.deleteMany({});
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to clear drafts", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { status } = await req.json();

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { error: "status must be APPROVED or REJECTED" },
        { status: 400 }
      );
    }

    const result = await prisma.emailDraft.updateMany({
      where: { status: "PENDING_REVIEW" },
      data: { status },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to bulk update", details: String(error) },
      { status: 500 }
    );
  }
}
