import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { enrichImportedContacts } from "@/lib/apollo-enrich";
import { persistImportRows, type ImportRow } from "@/lib/apollo-import-handler";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const body = (await req.json()) as {
      people?: ImportRow[];
      companyId?: string;
      searchCriteria?: unknown;
    };

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const rows = Array.isArray(body.people) ? body.people : [];
    const validRows = rows.filter(
      (r) => r && typeof r.email === "string" && r.email.trim() && r.apolloPersonId
    );
    if (validRows.length === 0) {
      return NextResponse.json({ error: "No valid people provided" }, { status: 400 });
    }

    const { createdCount, attempted, skippedExistingInDb, contactIdByApolloId, newApolloIds } =
      await persistImportRows(validRows, "import-campaign");

    const searchCriteria = body.searchCriteria as Prisma.InputJsonValue | undefined;
    const companyId = typeof body.companyId === "string" ? body.companyId : undefined;

    const campaignContactData = validRows
      .map((r) => {
        const contactId = r.apolloPersonId ? contactIdByApolloId.get(r.apolloPersonId) : undefined;
        if (!contactId) return null;
        return {
          campaignId,
          contactId,
          companyId: companyId ?? null,
          wasExisting: !newApolloIds.includes(r.apolloPersonId!),
          ...(searchCriteria !== undefined ? { searchCriteria } : {}),
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    const linkResult = await prisma.campaignContact.createMany({
      data: campaignContactData,
      skipDuplicates: true,
    });

    // Assign the campaign's team member as author, but never overwrite an
    // existing assignment on a contact that already had one.
    if (campaign.assignedTo && newApolloIds.length > 0) {
      const newContactIds = newApolloIds
        .map((id) => contactIdByApolloId.get(id))
        .filter((id): id is string => Boolean(id));
      if (newContactIds.length > 0) {
        await prisma.contact.updateMany({
          where: { id: { in: newContactIds }, author: null },
          data: { author: campaign.assignedTo },
        });
      }
    }

    let enrichment: Awaited<ReturnType<typeof enrichImportedContacts>> | { skipped: true; reason: string } | null =
      null;
    if (newApolloIds.length > 0) {
      enrichment = await enrichImportedContacts(newApolloIds);
    } else {
      enrichment = { skipped: true, reason: "no_new_contacts" };
    }

    return NextResponse.json({
      attached: linkResult.count,
      created: createdCount,
      attempted,
      alreadyExisted: skippedExistingInDb,
      alreadyInCampaign: campaignContactData.length - linkResult.count,
      enrichment,
    });
  } catch (error) {
    console.error("Campaign people import error:", error);
    return NextResponse.json(
      { error: "Failed to import people", details: String(error) },
      { status: 500 }
    );
  }
}
