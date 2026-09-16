import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/apollo-shared";
import {
  searchApolloCompanies,
  type ApolloCompanyFilterPayload,
} from "@/lib/apollo-company-search";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const body = (await req.json()) as {
      filters?: ApolloCompanyFilterPayload;
      page?: number;
      perPage?: number;
    };

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!body.filters || typeof body.filters !== "object") {
      return NextResponse.json(
        { error: "filters payload is required" },
        { status: 400 }
      );
    }

    const searchResult = await searchApolloCompanies(body.filters, {
      page: body.page,
      perPage: body.perPage,
    });

    if (!searchResult.ok) {
      return NextResponse.json(
        { error: searchResult.error, debug: searchResult.debug },
        { status: searchResult.status }
      );
    }

    const existing = await prisma.campaignCompany.findMany({
      where: { campaignId },
      include: { company: { select: { id: true, apolloOrganizationId: true } } },
    });
    const existingOrgIds = new Set(
      existing
        .map((e) => e.company.apolloOrganizationId)
        .filter((v): v is string => Boolean(v))
    );
    const existingCompanyIds = new Set(existing.map((e) => e.companyId));

    const companies = searchResult.result.companies.map((c) => ({
      ...c,
      alreadyInCampaign:
        existingOrgIds.has(c.apolloOrgId) ||
        existingCompanyIds.has(`company-${slugify(c.name)}`),
    }));

    return NextResponse.json({ ...searchResult.result, companies });
  } catch (error) {
    console.error("Campaign company search error:", error);
    return NextResponse.json(
      { error: "Failed to search companies", details: String(error) },
      { status: 500 }
    );
  }
}
