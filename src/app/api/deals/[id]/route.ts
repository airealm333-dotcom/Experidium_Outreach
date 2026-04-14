import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.stageId) updateData.stageId = body.stageId;
    if (body.status) updateData.status = body.status;
    if (body.title) updateData.title = body.title;
    if (body.value !== undefined) updateData.value = body.value;

    const deal = await prisma.deal.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(deal);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update deal", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.deal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete deal", details: String(error) },
      { status: 500 }
    );
  }
}
