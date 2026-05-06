import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APOLLO_UNLOCK_PLACEHOLDER_EMAIL_PREFIX } from "@/lib/apollo-enrich";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { Upload, Search, Users } from "lucide-react";
import Link from "next/link";
import { GenerateButton } from "./generate-button";
import { ContactsTable } from "./contacts-table";
import { ApolloImportButton } from "./apollo-import-button";
import { RetryEnrichmentButton } from "./retry-enrichment-button";
import { ContactsTabs } from "./contacts-tabs";
import { ContactsPager } from "./contacts-pager";
import { buildContactsHref, parseContactStatus, type ContactStatusValue } from "./contacts-url";

// Always render fresh on the server. Without these, Next.js / browser caches can
// keep showing a pre-import snapshot of /contacts after an Apollo import even
// though the DB has new rows.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const PAGE_SIZE = 20;

interface ContactWithCompany {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string | null;
  status: string;
  source: string | null;
  apolloPersonId: string | null;
  company: { name: string } | null;
}

function parsePage(raw?: string): number {
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    imported?: string;
    showLocked?: string;
    retried?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const {
    q,
    imported: importedParam,
    showLocked: showLockedParam,
    retried: retriedParam,
    status: statusParam,
    page: pageParam,
  } = await searchParams;
  const importedNotice =
    importedParam && /^\d+$/.test(importedParam)
      ? Number.parseInt(importedParam, 10)
      : null;
  const retriedNotice =
    retriedParam && /^\d+$/.test(retriedParam)
      ? Number.parseInt(retriedParam, 10)
      : null;
  const showLocked = showLockedParam === "1" || showLockedParam === "true";
  const activeStatus = parseContactStatus(statusParam);
  const pageRequested = parsePage(pageParam);

  let contacts: ContactWithCompany[] = [];
  let totalCount = 0;
  let lockedCount = 0;
  let statusCounts: Partial<Record<ContactStatusValue, number>> = {};
  let page = 1;
  let totalPages = 1;
  let dbError: string | null = null;
  const renderStartedAt = new Date();

  const lockedEmailFilter = {
    email: {
      startsWith: APOLLO_UNLOCK_PLACEHOLDER_EMAIL_PREFIX,
      mode: "insensitive" as const,
    },
  };

  try {
    const searchWhere = q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { company: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {};

    const hasSearch = Object.keys(searchWhere).length > 0;
    const scopeWhere = showLocked
      ? hasSearch
        ? searchWhere
        : {}
      : hasSearch
        ? { AND: [searchWhere, { NOT: lockedEmailFilter }] }
        : { NOT: lockedEmailFilter };

    const tabParts: Prisma.ContactWhereInput[] = [];
    if (Object.keys(scopeWhere).length > 0) {
      tabParts.push(scopeWhere as Prisma.ContactWhereInput);
    }
    if (activeStatus !== undefined) {
      tabParts.push({ status: activeStatus });
    }
    const tabWhere: Prisma.ContactWhereInput =
      tabParts.length === 0
        ? {}
        : tabParts.length === 1
          ? tabParts[0]!
          : { AND: tabParts };

    const lockedWhere = hasSearch
      ? { AND: [searchWhere, lockedEmailFilter] }
      : lockedEmailFilter;

    const [groupRows, total, locked] = await Promise.all([
      prisma.contact.groupBy({
        by: ["status"],
        where: scopeWhere,
        _count: { _all: true },
      }),
      prisma.contact.count({ where: tabWhere }),
      prisma.contact.count({ where: lockedWhere }),
    ]);

    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(Math.max(1, pageRequested), totalPages);

    const raw = await prisma.contact.findMany({
      where: tabWhere,
      include: { company: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    });

    for (const row of groupRows) {
      const st = row.status as ContactStatusValue;
      statusCounts[st] = row._count._all;
    }

    totalCount = total;
    lockedCount = locked;
    contacts = raw as unknown as ContactWithCompany[];

    console.log("[contacts-page] render", {
      q: q ?? null,
      importedNotice,
      retriedNotice,
      showLocked,
      activeStatus: activeStatus ?? null,
      page,
      pageRequested,
      totalPages,
      pageSize: PAGE_SIZE,
      returned: contacts.length,
      totalCount,
      lockedCount,
      newestEmail: contacts[0]?.email ?? null,
      newestSource: contacts[0]?.source ?? null,
      apolloRows: contacts.filter((c) => c.source === "apollo-saved-search").length,
    });
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    console.error("[contacts-page] db error", dbError);
  }

  const allContactIds = contacts.map((c) => c.id);
  const apolloCount = contacts.filter((c) => c.source === "apollo-saved-search").length;
  const renderedAtLabel = renderStartedAt.toLocaleTimeString("en-US", {
    hour12: false,
  });

  const toggleHref = buildContactsHref({
    q,
    status: activeStatus,
    showLocked: !showLocked,
    page: page > 1 ? page : undefined,
  });

  const headerDescription = dbError
    ? undefined
    : activeStatus
      ? `${totalCount} contacts — ${activeStatus.replaceAll("_", " ")} — page ${page} of ${totalPages}${q ? ` matching "${q}"` : ""}`
      : `${totalCount} contacts — page ${page} of ${totalPages}${q ? ` matching "${q}"` : ""}`;

  return (
    <>
      {importedNotice != null && importedNotice > 0 && !dbError && (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Apollo import finished. <strong>{importedNotice}</strong> new row
            {importedNotice === 1 ? "" : "s"} added below.
          </p>
          <Link
            href="/contacts"
            className="shrink-0 text-emerald-800 underline hover:text-emerald-900 dark:text-emerald-200"
          >
            Dismiss
          </Link>
        </div>
      )}
      {retriedNotice != null && !dbError && (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Re-ran enrichment. <strong>{retriedNotice}</strong> contact
            {retriedNotice === 1 ? "" : "s"} unlocked.
          </p>
          <Link
            href="/contacts"
            className="shrink-0 text-sky-800 underline hover:text-sky-900 dark:text-sky-200"
          >
            Dismiss
          </Link>
        </div>
      )}
      {lockedCount > 0 && !dbError && (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <strong>{lockedCount}</strong> Apollo contact
            {lockedCount === 1 ? "" : "s"}{" "}
            {lockedCount === 1 ? "is" : "are"} locked — Apollo didn&apos;t return
            an email yet. {showLocked ? "Showing them below." : "Hidden by default."}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <RetryEnrichmentButton lockedCount={lockedCount} />
            <Link
              href={toggleHref}
              className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
            >
              {showLocked ? "Hide locked" : "Show locked"}
            </Link>
          </div>
        </div>
      )}
      {!dbError && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span>
            Page <strong className="text-foreground">{page}</strong> /{" "}
            <strong className="text-foreground">{totalPages}</strong> —{" "}
            <strong className="text-foreground">{contacts.length}</strong> row
            {contacts.length === 1 ? "" : "s"} (of{" "}
            <strong className="text-foreground">{totalCount}</strong> in view)
          </span>
          {activeStatus ? (
            <span>
              Status: <strong className="text-foreground">{activeStatus}</strong>
            </span>
          ) : (
            <span>Status: All</span>
          )}
          <span>
            Apollo rows (this page):{" "}
            <strong className="text-foreground">{apolloCount}</strong>
          </span>
          {lockedCount > 0 && (
            <span>
              Locked:{" "}
              <strong className="text-foreground">{lockedCount}</strong>{" "}
              {showLocked ? "(included)" : "(hidden)"}
            </span>
          )}
          <span>at {renderedAtLabel}</span>
          {q ? <span>filter: {q}</span> : null}
          {contacts.length === 0 && totalCount > 0 ? (
            <span className="text-amber-600 dark:text-amber-400">
              No rows on this page (try another page or clear filters).
            </span>
          ) : null}
        </div>
      )}
      <PageHeader title="Contacts" description={headerDescription}>
        <Link href="/import">
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
        </Link>
        <ApolloImportButton />
        <GenerateButton contactIds={allContactIds} disabled={contacts.length === 0} label="Generate All" />
      </PageHeader>

      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>All Contacts</CardTitle>
              <CardDescription>
                Manage your leads and prospects — filter by status, 20 per page. Apollo imports show
                the Apollo badge in Source.
              </CardDescription>
            </div>
            <form
              action="/contacts"
              method="get"
              className="relative w-full min-w-0 sm:max-w-xs md:w-72 md:max-w-none"
            >
              {activeStatus ? <input type="hidden" name="status" value={activeStatus} /> : null}
              {showLocked ? <input type="hidden" name="showLocked" value="1" /> : null}
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder="Search contacts..."
                className="pl-9"
                defaultValue={q || ""}
              />
            </form>
          </div>
        </CardHeader>
        <CardContent className="min-w-0">
          {dbError && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Could not load contacts from the database: {dbError}
            </div>
          )}
          {!dbError && (
            <ContactsTabs
              activeStatus={activeStatus}
              statusCounts={statusCounts}
              q={q}
              showLocked={showLocked}
            />
          )}
          {contacts.length === 0 && !dbError ? (
            <div className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">
                {q || activeStatus
                  ? "No contacts match your filters"
                  : "No contacts yet"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {q || activeStatus
                  ? "Try another status tab, search term, or clear filters."
                  : "Import your Apollo exports to get started."}
              </p>
              {!q && !activeStatus && (
                <Link href="/import">
                  <Button className="mt-4" size="sm">
                    <Upload className="mr-2 h-4 w-4" />
                    Import Contacts
                  </Button>
                </Link>
              )}
            </div>
          ) : !dbError ? (
            <>
              <ContactsTable contacts={contacts} />
              <ContactsPager
                page={page}
                totalPages={totalPages}
                total={totalCount}
                pageSize={PAGE_SIZE}
                q={q}
                status={activeStatus}
                showLocked={showLocked}
              />
            </>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
