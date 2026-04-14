import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contactId, type, subject, body: activityBody, dueDate } = body;

    if (!contactId || !type) {
      return NextResponse.json(
        { error: "contactId and type are required" },
        { status: 400 }
      );
    }

    const activity = await prisma.activity.create({
      data: {
        contactId,
        type,
        subject: subject || null,
        body: activityBody || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    return NextResponse.json(activity);
  } catch (error) {
    console.error("Activity creation error:", error);
    return NextResponse.json(
      { error: "Failed to create activity" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, completed } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const activity = await prisma.activity.update({
      where: { id },
      data: { completed },
    });

    return NextResponse.json(activity);
  } catch (error) {
    console.error("Activity update error:", error);
    return NextResponse.json(
      { error: "Failed to update activity" },
      { status: 500 }
    );
  }
}
