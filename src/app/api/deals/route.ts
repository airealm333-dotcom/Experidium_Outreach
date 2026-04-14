import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { title, contactId, companyId, stageId, value } = await req.json();

    if (!title || !contactId || !stageId) {
      return NextResponse.json(
        { error: "title, contactId, and stageId are required" },
        { status: 400 }
      );
    }

    const deal = await prisma.deal.create({
      data: {
        title,
        contactId,
        companyId: companyId || null,
        stageId,
        value: value ? parseFloat(value) : null,
      },
    });

    return NextResponse.json(deal);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create deal", details: String(error) },
      { status: 500 }
    );
  }
}
