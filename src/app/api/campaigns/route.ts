import { NextRequest, NextResponse } from "next/server";
import { CampaignStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isTeamMember } from "@/lib/team-members";

const CAMPAIGN_STATUSES = new Set<string>(Object.values(CampaignStatus));

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const assignedTo = searchParams.get("assignedTo");

    const campaigns = await prisma.campaign.findMany({
      where: {
        ...(status && CAMPAIGN_STATUSES.has(status)
          ? { status: status as CampaignStatus }
          : {}),
        ...(assignedTo ? { assignedTo } : {}),
      },
      include: {
        _count: { select: { companies: true, contacts: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Campaign list error:", error);
    return NextResponse.json(
      { error: "Failed to list campaigns", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    let assignedTo: string | null = null;
    if ("assignedTo" in body && body.assignedTo !== null && body.assignedTo !== "") {
      if (typeof body.assignedTo !== "string" || !isTeamMember(body.assignedTo)) {
        return NextResponse.json(
          { error: "Invalid assignedTo. Must be adithyan, adarsh, or vishnu." },
          { status: 400 }
        );
      }
      assignedTo = body.assignedTo;
    }

    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;

    const campaign = await prisma.campaign.create({
      data: {
        name: body.name.trim(),
        description,
        assignedTo,
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error("Campaign create error:", error);
    return NextResponse.json(
      { error: "Failed to create campaign", details: String(error) },
      { status: 500 }
    );
  }
}
