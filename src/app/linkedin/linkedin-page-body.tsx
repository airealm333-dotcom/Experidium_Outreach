import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { ContactStatus } from "@/generated/prisma/client";
import { Search, Users } from "lucide-react";
import Link from "next/link";
import { LinkedInContactsTabs } from "./linkedin-contacts-tabs";
import { ContactsPager } from "../contacts/contacts-pager";
import { LinkedInApolloImportButton } from "./linkedin-apollo-import-button";
import { LinkedInContactsTable } from "./linkedin-contacts-table";
import {
  LINKEDIN_APOLLO_SOURCE,
  LINKEDIN_BASE_PATH,
  parseLinkedInStatus,
  type LinkedInStatusValue,
  type LinkedInPageSearchParams,
} from "./linkedin-url";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, parsePageSize } from "@/lib/page-size";

function linkedinStatusFilter(status: LinkedInStatusValue): Prisma.ContactWhereInput {
  if (status === "OUTREACHED") {
    return {
      status: { in: [ContactStatus.OUTREACHED, ContactStatus.CONTACTED] },
    };
  }
  return { status: ContactStatus.NEW };
}

interface LinkedInContactRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  linkedinUrl: string | null;
  position: string | null;
  status: string;
  author: string | null;
  company: { name: string; linkedinUrl: string | null } | null;
}

function parsePage(raw?: string): number {
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export async function LinkedInPageBody({
  searchParams,
}: {
  searchParams: LinkedInPageSearchParams;
}) {
  const { q, imported: importedParam, status: statusParam, page: pageParam, pageSize: pageSizeParam } =
    searchParams;
  const importedNotice =
    importedParam && /^\d+$/.test(importedParam)
      ? Number.parseInt(importedParam, 10)
      : null;
  const activeStatus = parseLinkedInStatus(statusParam);
  const pageRequested = parsePage(pageParam);
  const pageSize = parsePageSize(pageSizeParam);

  let contacts: LinkedInContactRow[] = [];
  let totalCount = 0;
  let statusCounts: Partial<Record<LinkedInStatusValue, number>> = {};
  let page = 1;
  let totalPages = 1;
  let dbError: string | null = null;

  const sourceScope: Prisma.ContactWhereInput = { source: LINKEDIN_APOLLO_SOURCE };

  try {
    const searchWhere = q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { position: { contains: q, mode: "insensitive" as const } },
            { linkedinUrl: { contains: q, mode: "insensitive" as const } },
            { company: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {};

    const scopeWhere: Prisma.ContactWhereInput = q
      ? { AND: [sourceScope, searchWhere] }
      : sourceScope;

    const tabParts: Prisma.ContactWhereInput[] = [scopeWhere];
    if (activeStatus !== undefined) {
      tabParts.push(linkedinStatusFilter(activeStatus));
    }
    const tabWhere: Prisma.ContactWhereInput =
      tabParts.length === 1 ? tabParts[0]! : { AND: tabParts };

    const [groupRows, total] = await Promise.all([
      prisma.contact.groupBy({
        by: ["status"],
        where: scopeWhere,
        _count: { _all: true },
      }),
      prisma.contact.count({ where: tabWhere }),
    ]);

    totalPages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(Math.max(1, pageRequested), totalPages);

    const raw = await prisma.contact.findMany({
      where: tabWhere,
      include: {
        company: {
          select: { name: true, linkedinUrl: true },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize,
      skip: (page - 1) * pageSize,
    });

    for (const row of groupRows) {
      const st = parseLinkedInStatus(row.status);
      if (st) {
        statusCounts[st] = (statusCounts[st] ?? 0) + row._count._all;
      }
    }

    totalCount = total;
    contacts = raw as unknown as LinkedInContactRow[];
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    console.error("[linkedin-page] db error", dbError);
  }

  const headerDescription = dbError
    ? undefined
    : activeStatus
      ? `${totalCount} LinkedIn prospects — ${activeStatus === "NEW" ? "New" : "Outreached"} — page ${page} of ${totalPages}${q ? ` matching "${q}"` : ""}`
      : `${totalCount} LinkedIn prospects — page ${page} of ${totalPages}${q ? ` matching "${q}"` : ""}`;

  return (
    <>
      {importedNotice != null && importedNotice > 0 && !dbError && (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 sm:flex-row sm:items-center sm:justify-between">
          <p>
            LinkedIn Apollo import finished. <strong>{importedNotice}</strong> new prospect
            {importedNotice === 1 ? "" : "s"} added below (LinkedIn profile URL required).
          </p>
          <Link
            href={LINKEDIN_BASE_PATH}
            className="shrink-0 text-emerald-800 underline hover:text-emerald-900 dark:text-emerald-200"
          >
            Dismiss
          </Link>
        </div>
      )}

      <PageHeader title="LinkedIn" description={headerDescription}>
        <LinkedInApolloImportButton />
      </PageHeader>

      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>LinkedIn Prospects</CardTitle>
              <CardDescription>
                Apollo imports tagged for LinkedIn outreach — profile and company LinkedIn links.
              </CardDescription>
            </div>
            <form
              action={LINKEDIN_BASE_PATH}
              method="get"
              className="relative w-full min-w-0 sm:max-w-xs md:w-72 md:max-w-none"
            >
              {activeStatus ? <input type="hidden" name="status" value={activeStatus} /> : null}
              {pageSize !== DEFAULT_PAGE_SIZE ? (
                <input type="hidden" name="pageSize" value={pageSize} />
              ) : null}
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder="Search prospects..."
                className="pl-9"
                defaultValue={q || ""}
              />
            </form>
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          {dbError && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Could not load LinkedIn prospects: {dbError}
            </div>
          )}
          {!dbError && (
            <LinkedInContactsTabs
              activeStatus={activeStatus}
              statusCounts={statusCounts}
              q={q}
              pageSize={pageSize}
            />
          )}
          {contacts.length === 0 && !dbError ? (
            <div className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">
                {q || activeStatus
                  ? "No prospects match your filters"
                  : "No LinkedIn prospects yet"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {q || activeStatus
                  ? "Try another status tab, search term, or clear filters."
                  : "Use Import from Apollo to add contacts with LinkedIn profile URLs."}
              </p>
            </div>
          ) : !dbError ? (
            <>
              <LinkedInContactsTable
                contacts={contacts}
                page={page}
                pageSize={pageSize}
              />
              <ContactsPager
                page={page}
                totalPages={totalPages}
                total={totalCount}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                q={q}
                status={activeStatus}
                showLocked={false}
                basePath={LINKEDIN_BASE_PATH}
              />
            </>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
