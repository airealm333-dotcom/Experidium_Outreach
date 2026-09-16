import Link from "next/link";
import { Megaphone, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { TEAM_MEMBERS, formatTeamMemberLabel } from "@/lib/team-members";
import { CampaignsGrid } from "./campaigns-grid";
import { NewCampaignDialog } from "./new-campaign-dialog";
import { parseCampaignAssignee } from "./campaigns-url";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ImportCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; assignedTo?: string }>;
}) {
  const { q, assignedTo: assignedToParam } = await searchParams;
  const assignedTo = parseCampaignAssignee(assignedToParam);

  let campaigns: Awaited<ReturnType<typeof loadCampaigns>> = [];
  let dbError: string | null = null;

  try {
    campaigns = await loadCampaigns(q, assignedTo);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    console.error("[import-campaign] db error", dbError);
  }

  return (
    <div>
      <PageHeader
        title="Import Campaign"
        description="Search Apollo for companies, drill into their people, and import the ones you want."
      >
        <NewCampaignDialog />
      </PageHeader>

      <Card className="min-w-0">
        <CardContent className="min-w-0 space-y-4">
          <form
            action="/import-campaign"
            method="get"
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder="Search campaigns..."
                className="pl-9"
                defaultValue={q || ""}
              />
            </div>
            <select
              name="assignedTo"
              defaultValue={assignedTo || ""}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">All assignees</option>
              {TEAM_MEMBERS.map((member) => (
                <option key={member} value={member}>
                  {formatTeamMemberLabel(member)}
                </option>
              ))}
            </select>
          </form>

          {dbError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Could not load campaigns from the database: {dbError}
            </div>
          )}

          {!dbError && campaigns.length === 0 && (
            <div className="py-12 text-center">
              <Megaphone className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">
                {q || assignedTo ? "No campaigns match your filters" : "No campaigns yet"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {q || assignedTo
                  ? "Try another search term or clear filters."
                  : "Create a campaign to start searching Apollo for companies and people."}
              </p>
            </div>
          )}

          {!dbError && campaigns.length > 0 && (
            <CampaignsGrid
              campaigns={campaigns.map((c) => ({
                ...c,
                createdAt: c.createdAt.toISOString(),
              }))}
            />
          )}
        </CardContent>
      </Card>

      {!dbError && campaigns.length === 0 && !q && !assignedTo && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Looking for the old single-shot Apollo import?{" "}
          <Link href="/contacts" className="underline">
            It still lives on Contacts
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function loadCampaigns(q?: string, assignedTo?: string) {
  return prisma.campaign.findMany({
    where: {
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      ...(assignedTo ? { assignedTo } : {}),
    },
    include: {
      _count: { select: { companies: true, contacts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
