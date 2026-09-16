import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/apollo-shared";
import type { ApolloCompanyResult } from "@/lib/apollo-company-search";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const body = (await req.json()) as {
      companies?: ApolloCompanyResult[];
      searchCriteria?: unknown;
    };

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const companies = Array.isArray(body.companies) ? body.companies : [];
    const uniqueByOrgId = new Map<string, ApolloCompanyResult>();
    for (const c of companies) {
      if (
        c &&
        typeof c.apolloOrgId === "string" &&
        c.apolloOrgId.trim() &&
        typeof c.name === "string" &&
        c.name.trim()
      ) {
        uniqueByOrgId.set(c.apolloOrgId, c);
      }
    }
    const deduped = Array.from(uniqueByOrgId.values());
    if (deduped.length === 0) {
      return NextResponse.json({ error: "No valid companies provided" }, { status: 400 });
    }

    const upserted: { companyId: string; apolloOrgId: string }[] = [];
    for (const c of deduped) {
      const companyId = `company-${slugify(c.name)}`;
      const company = await prisma.company.upsert({
        where: { id: companyId },
        create: {
          id: companyId,
          name: c.name,
          website: c.website,
          linkedinUrl: c.linkedinUrl,
          industry: c.industry,
          description: c.description,
          employeeCount: c.employeeCount,
          country: c.country,
          state: c.state,
          apolloOrganizationId: c.apolloOrgId,
        },
        update: {
          apolloOrganizationId: c.apolloOrgId,
        },
      });
      upserted.push({ companyId: company.id, apolloOrgId: c.apolloOrgId });
    }

    const searchCriteria = body.searchCriteria as Prisma.InputJsonValue | undefined;

    const result = await prisma.campaignCompany.createMany({
      data: upserted.map((u) => ({
        campaignId,
        companyId: u.companyId,
        apolloOrgId: u.apolloOrgId,
        ...(searchCriteria !== undefined ? { searchCriteria } : {}),
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      attached: result.count,
      alreadyPresent: upserted.length - result.count,
      companyIds: upserted.map((u) => u.companyId),
    });
  } catch (error) {
    console.error("Campaign company attach error:", error);
    return NextResponse.json(
      { error: "Failed to attach companies", details: String(error) },
      { status: 500 }
    );
  }
}
