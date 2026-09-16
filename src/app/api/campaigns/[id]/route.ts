import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { CampaignStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isTeamMember } from "@/lib/team-members";

const CAMPAIGN_STATUSES = new Set<string>(Object.values(CampaignStatus));

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        companies: { include: { company: true }, orderBy: { createdAt: "desc" } },
        contacts: {
          include: { contact: { include: { company: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Campaign detail error:", error);
    return NextResponse.json(
      { error: "Failed to load campaign", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const data: Prisma.CampaignUpdateInput = {};

    if ("name" in body) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
      }
      data.name = body.name.trim();
    }

    if ("description" in body) {
      data.description =
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null;
    }

    if ("status" in body) {
      if (typeof body.status !== "string" || !CAMPAIGN_STATUSES.has(body.status)) {
        return NextResponse.json({ error: "Invalid campaign status" }, { status: 400 });
      }
      data.status = body.status as CampaignStatus;
    }

    if ("assignedTo" in body) {
      const assignedTo = body.assignedTo;
      if (assignedTo === null || assignedTo === "") {
        data.assignedTo = null;
      } else if (typeof assignedTo === "string" && isTeamMember(assignedTo)) {
        data.assignedTo = assignedTo;
      } else {
        return NextResponse.json(
          { error: "Invalid assignedTo. Must be adithyan, adarsh, or vishnu." },
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

    const campaign = await prisma.campaign.update({ where: { id }, data });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Campaign update error:", error);
    return NextResponse.json(
      { error: "Failed to update campaign", details: String(error) },
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

    await prisma.campaign.delete({ where: { id } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Campaign delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete campaign", details: String(error) },
      { status: 500 }
    );
  }
}
