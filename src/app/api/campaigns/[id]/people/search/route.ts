import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  searchApolloPeople,
  type ApolloFilterPayload,
  type ImportRow,
} from "@/lib/apollo-import-handler";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const body = (await req.json()) as {
      companyIds?: string[];
      filters?: ApolloFilterPayload;
      pageLimit?: number;
      perPage?: number;
      hasEmailOnly?: boolean;
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

    const requestedCompanyIds = Array.isArray(body.companyIds) ? body.companyIds : [];
    let organizationIds: string[] = [];
    if (requestedCompanyIds.length > 0) {
      const campaignCompanies = await prisma.campaignCompany.findMany({
        where: { campaignId, companyId: { in: requestedCompanyIds } },
        include: { company: { select: { apolloOrganizationId: true } } },
      });
      organizationIds = campaignCompanies
        .map((cc) => cc.company.apolloOrganizationId)
        .filter((v): v is string => Boolean(v));

      if (organizationIds.length === 0) {
        return NextResponse.json(
          {
            error:
              "None of the selected companies have an Apollo organization id yet — search and add them via Apollo first.",
          },
          { status: 400 }
        );
      }
    }

    const searchResult = await searchApolloPeople(
      { ...body.filters, organizationIds },
      {
        pageLimit: body.pageLimit,
        perPage: body.perPage,
        hasEmailOnly: body.hasEmailOnly,
      }
    );

    if (!searchResult.ok) {
      return NextResponse.json(
        { error: searchResult.error, debug: searchResult.debug },
        { status: searchResult.status }
      );
    }

    const { rows, ...rest } = searchResult.result;
    const apolloPersonIds = rows.map((r) => r.apolloPersonId).filter((v): v is string => Boolean(v));

    const [existingContacts, existingCampaignContacts] = await Promise.all([
      prisma.contact.findMany({
        where: { apolloPersonId: { in: apolloPersonIds } },
        select: { id: true, apolloPersonId: true },
      }),
      prisma.campaignContact.findMany({
        where: { campaignId },
        include: { contact: { select: { apolloPersonId: true } } },
      }),
    ]);
    const contactIdByApolloId = new Map(
      existingContacts
        .filter((c) => c.apolloPersonId)
        .map((c) => [c.apolloPersonId as string, c.id])
    );
    const inCampaignApolloIds = new Set(
      existingCampaignContacts
        .map((cc) => cc.contact.apolloPersonId)
        .filter((v): v is string => Boolean(v))
    );

    const people = rows.map((row: ImportRow) => ({
      ...row,
      alreadyContact: Boolean(row.apolloPersonId && contactIdByApolloId.has(row.apolloPersonId)),
      alreadyInCampaign: Boolean(row.apolloPersonId && inCampaignApolloIds.has(row.apolloPersonId)),
    }));

    return NextResponse.json({ people, ...rest });
  } catch (error) {
    console.error("Campaign people search error:", error);
    return NextResponse.json(
      { error: "Failed to search people", details: String(error) },
      { status: 500 }
    );
  }
}
