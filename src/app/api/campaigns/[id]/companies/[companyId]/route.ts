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
  { params }: { params: Promise<{ id: string; companyId: string }> }
) {
  try {
    const { id: campaignId, companyId } = await params;

    await prisma.campaignCompany.delete({
      where: { campaignId_companyId: { campaignId, companyId } },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json(
        { error: "Company is not attached to this campaign" },
        { status: 404 }
      );
    }
    console.error("Campaign company detach error:", error);
    return NextResponse.json(
      { error: "Failed to detach company", details: String(error) },
      { status: 500 }
    );
  }
}
