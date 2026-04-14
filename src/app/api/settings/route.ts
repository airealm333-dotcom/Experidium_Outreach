import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const template = await prisma.emailTemplate.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      promptTemplate: template?.promptTemplate || "",
      templateId: template?.id || null,
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
    const { promptTemplate } = body;

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

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save settings", details: String(error) },
      { status: 500 }
    );
  }
}
