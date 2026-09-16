import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2025"
  );
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const { id: campaignId, contactId } = await params;

    await prisma.campaignContact.delete({
      where: { campaignId_contactId: { campaignId, contactId } },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json(
        { error: "Contact is not attached to this campaign" },
        { status: 404 }
      );
    }
    console.error("Campaign contact detach error:", error);
    return NextResponse.json(
      { error: "Failed to detach contact", details: String(error) },
      { status: 500 }
    );
  }
}
