import { NextResponse } from "next/server";
import {
  buildApolloPlaceholderEmail,
  enrichImportedContacts,
  isApolloUnlockPlaceholderEmail,
} from "@/lib/apollo-enrich";
import { prisma } from "@/lib/prisma";
import {
  type ApolloDebugAttempt,
  clean,
  createApolloLogger,
  getApolloApiKey,
  redactSecrets,
  safeInt,
  slugify,
  toTechnologyUid,
  truncateForDebug,
  uniqueList,
} from "@/lib/apollo-shared";

const APOLLO_BASE_URL = "https://api.apollo.io/api/v1/mixed_people/search";
const DEFAULT_PAGE_LIMIT = 3;
const MAX_PAGE_LIMIT = 20;
const DEFAULT_PER_PAGE = 25;
const MAX_PER_PAGE = 100;

type ApolloOrg = {
  name?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
  industry?: string | null;
  short_description?: string | null;
  estimated_num_employees?: number | null;
  country?: string | null;
  state?: string | null;
};

type ApolloPerson = {
  id?: string | null;
  person_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  email?: string | null;
  title?: string | null;
  seniority?: string | null;
  linkedin_url?: string | null;
  country?: string | null;
  state?: string | null;
  organization?: ApolloOrg | null;
};

export type ImportRow = {
  firstName: string;
  lastName: string;
  email: string;
  apolloPersonId?: string;
  position?: string;
  seniority?: string;
  linkedinUrl?: string;
  country?: string;
  state?: string;
  companyName?: string;
  companyWebsite?: string;
  companyLinkedin?: string;
  companyIndustry?: string;
  companyDescription?: string;
  companySize?: string;
  companyCountry?: string;
  companyState?: string;
};

export type ApolloFilterPayload = {
  titles?: string[];
  technologies?: string[];
  keywords?: string[];
  countries?: string[];
  seniorities?: string[];
  employeeMin?: number;
  employeeMax?: number;
  revenueMin?: number;
  revenueMax?: number;
  /** Scope results to specific Apollo organization ids (e.g. a campaign's attached companies). */
  organizationIds?: string[];
  /** Scope results to specific company domains. */
  organizationDomains?: string[];
};

const logApollo = createApolloLogger("apollo-import");

function normalizePerson(
  person: ApolloPerson,
  options?: { requireLinkedinUrl?: boolean }
): ImportRow | null {
  const apolloPersonId = clean(person.id) || clean(person.person_id);
  const linkedinUrl = clean(person.linkedin_url);

  if (options?.requireLinkedinUrl) {
    if (!linkedinUrl || !apolloPersonId) {
      return null;
    }
  }

  const rawEmail = clean(person.email)?.toLowerCase();

  // Apollo emits a literal `email_not_unlocked@domain.com` for every locked row.
  // That collapses all locked rows onto a single unique email — replace it with
  // a per-row sentinel keyed by apolloPersonId so each row can be inserted, and
  // bulk_match enrichment will overwrite it with the real address later.
  let email: string | undefined;
  if (rawEmail && !isApolloUnlockPlaceholderEmail(rawEmail)) {
    email = rawEmail;
  } else if (apolloPersonId) {
    email = buildApolloPlaceholderEmail(apolloPersonId);
  } else {
    return null;
  }

  const firstNameFromName = clean(person.name)?.split(/\s+/)[0];
  const firstName = clean(person.first_name) || firstNameFromName || email.split("@")[0];
  const lastName = clean(person.last_name) || "";
  const org = person.organization || {};

  return {
    firstName,
    lastName,
    email,
    apolloPersonId,
    position: clean(person.title),
    seniority: clean(person.seniority),
    linkedinUrl,
    country: clean(person.country),
    state: clean(person.state),
    companyName: clean(org.name),
    companyWebsite: clean(org.website_url),
    companyLinkedin: clean(org.linkedin_url),
    companyIndustry: clean(org.industry),
    companyDescription: clean(org.short_description),
    companySize:
      typeof org.estimated_num_employees === "number"
        ? String(org.estimated_num_employees)
        : undefined,
    companyCountry: clean(org.country),
    companyState: clean(org.state),
  };
}

function parsePeople(payload: unknown): ApolloPerson[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  const contacts = Array.isArray(p.contacts) ? (p.contacts as ApolloPerson[]) : [];
  const people = Array.isArray(p.people) ? (p.people as ApolloPerson[]) : [];
  // Prefer contacts when available; Apollo often returns richer fields there.
  if (contacts.length > 0) return contacts;
  return people;
}

function buildApolloPayload(
  filters: ApolloFilterPayload,
  page: number,
  perPage: number,
  hasEmailOnly: boolean
) {
  const titles = uniqueList(filters.titles);
  const technologies = uniqueList(filters.technologies)
    .map(toTechnologyUid)
    .filter(Boolean);
  const keywords = uniqueList(filters.keywords);
  const countries = uniqueList(filters.countries);
  const seniorities = uniqueList(filters.seniorities);
  const organizationIds = uniqueList(filters.organizationIds);
  const organizationDomains = uniqueList(filters.organizationDomains);

  const employeeMin = safeInt(filters.employeeMin);
  const employeeMax = safeInt(filters.employeeMax);
  const revenueMin = safeInt(filters.revenueMin);
  const revenueMax = safeInt(filters.revenueMax);
  const payload: Record<string, unknown> = {
    page,
    per_page: perPage,
  };
  if (hasEmailOnly) {
    payload.contact_email_status = ["verified", "unavailable"];
  }

  if (titles.length > 0) {
    payload.person_titles = titles;
  }
  if (technologies.length > 0) {
    payload.currently_using_any_of_technology_uids = technologies;
  }
  const joinedKeywords = keywords.join(" ").trim();
  if (joinedKeywords) {
    payload.q_keywords = joinedKeywords;
  }
  if (countries.length > 0) {
    payload.person_locations = countries;
  }
  if (seniorities.length > 0) {
    payload.person_seniorities = seniorities;
  }
  if (organizationIds.length > 0) {
    payload.organization_ids = organizationIds;
  }
  if (organizationDomains.length > 0) {
    payload.q_organization_domains_list = organizationDomains;
  }
  if (employeeMin !== null && employeeMax !== null) {
    payload.organization_num_employees_ranges = [`${employeeMin},${employeeMax}`];
  }
  if (revenueMin !== null || revenueMax !== null) {
    payload.revenue_range = {
      ...(revenueMin !== null ? { min: revenueMin } : {}),
      ...(revenueMax !== null ? { max: revenueMax } : {}),
    };
  }

  return payload;
}

function buildApolloPayloadVariants(
  filters: ApolloFilterPayload,
  page: number,
  perPage: number,
  hasEmailOnly: boolean
) {
  const strict = buildApolloPayload(filters, page, perPage, hasEmailOnly);
  const medium = buildApolloPayload(
    {
      ...filters,
      technologies: [],
      keywords: [],
      revenueMin: undefined,
      revenueMax: undefined,
      employeeMin: undefined,
      employeeMax: undefined,
    },
    page,
    perPage,
    hasEmailOnly
  );
  // Company scoping (organizationIds/organizationDomains) must survive every
  // fallback tier — dropping it here would leak people from unrelated
  // companies into a campaign's company-scoped search.
  const relaxed = buildApolloPayload(
    {
      titles: filters.titles,
      countries: filters.countries,
      seniorities: filters.seniorities,
      organizationIds: filters.organizationIds,
      organizationDomains: filters.organizationDomains,
    },
    page,
    perPage,
    hasEmailOnly
  );

  return [strict, medium, relaxed];
}

export type ApolloPeopleSearchOptions = {
  pageLimit?: number;
  perPage?: number;
  hasEmailOnly?: boolean;
  requireLinkedinUrl?: boolean;
};

export type ApolloPeopleSearchResult = {
  rows: ImportRow[];
  rawRowsFromApollo: number;
  skippedNoLinkedin: number;
  withLinkedinUrl: number;
  errors: string[];
  debug: { attempts: ApolloDebugAttempt[]; notes: string[] };
};

/**
 * Live Apollo people search + dedupe. DB-free — callers persist selected
 * results via `persistImportRows`.
 */
export async function searchApolloPeople(
  filters: ApolloFilterPayload,
  options: ApolloPeopleSearchOptions = {}
): Promise<
  | { ok: true; result: ApolloPeopleSearchResult }
  | { ok: false; status: number; error: string; debug: ApolloPeopleSearchResult["debug"] }
> {
  const key = getApolloApiKey();
  logApollo("env key present", Boolean(key));
  if (!key) {
    return {
      ok: false,
      status: 400,
      error: "APOLLO_API_KEY is not configured",
      debug: { attempts: [], notes: ["No outbound Apollo requests were made (missing API key)."] },
    };
  }

  const { pageLimit, perPage, hasEmailOnly, requireLinkedinUrl } = options;

  const normalizedPerPage = Math.min(
    MAX_PER_PAGE,
    Math.max(
      1,
      Number.isFinite(Number(perPage))
        ? Number.parseInt(String(perPage), 10)
        : DEFAULT_PER_PAGE
    )
  );

  const normalizedPageLimit = Math.min(
    MAX_PAGE_LIMIT,
    Math.max(
      1,
      Number.isFinite(Number(pageLimit))
        ? Number.parseInt(String(pageLimit), 10)
        : DEFAULT_PAGE_LIMIT
    )
  );
  logApollo("normalized pagination", {
    normalizedPerPage,
    normalizedPageLimit,
    hasEmailOnly,
  });

  const titles = uniqueList(filters.titles);
  const technologies = uniqueList(filters.technologies);
  const keywords = uniqueList(filters.keywords);
  const countries = uniqueList(filters.countries);
  const seniorities = uniqueList(filters.seniorities);
  const organizationIds = uniqueList(filters.organizationIds);
  const organizationDomains = uniqueList(filters.organizationDomains);
  const hasAnyPrimaryFilter =
    titles.length > 0 ||
    technologies.length > 0 ||
    keywords.length > 0 ||
    countries.length > 0 ||
    seniorities.length > 0 ||
    organizationIds.length > 0 ||
    organizationDomains.length > 0;
  logApollo("filter counts", {
    titles: titles.length,
    technologies: technologies.length,
    keywords: keywords.length,
    countries: countries.length,
    seniorities: seniorities.length,
    organizationIds: organizationIds.length,
    organizationDomains: organizationDomains.length,
  });
  if (!hasAnyPrimaryFilter) {
    return {
      ok: false,
      status: 400,
      error:
        "At least one filter must be provided (titles, technologies, keywords, country, seniority, or company).",
      debug: { attempts: [], notes: ["No outbound Apollo requests were made (no primary filters)."] },
    };
  }

  const employeeMin = safeInt(filters.employeeMin);
  const employeeMax = safeInt(filters.employeeMax);
  if (
    (employeeMin !== null || employeeMax !== null) &&
    (employeeMin === null ||
      employeeMax === null ||
      employeeMin < 1 ||
      employeeMax < employeeMin)
  ) {
    return {
      ok: false,
      status: 400,
      error: "Employee range is invalid.",
      debug: { attempts: [], notes: ["No outbound Apollo requests were made (invalid employee range)."] },
    };
  }
  const revenueMin = safeInt(filters.revenueMin);
  const revenueMax = safeInt(filters.revenueMax);
  if (
    (revenueMin !== null || revenueMax !== null) &&
    (revenueMin === null ||
      revenueMax === null ||
      revenueMin < 0 ||
      revenueMax < revenueMin)
  ) {
    return {
      ok: false,
      status: 400,
      error: "Revenue range is invalid.",
      debug: { attempts: [], notes: ["No outbound Apollo requests were made (invalid revenue range)."] },
    };
  }

  const allRows: ImportRow[] = [];
  const errors: string[] = [];
  const debugNotes: string[] = [];
  const debugAttempts: ApolloDebugAttempt[] = [];

  const seenApolloIds = new Set<string>();
  let rawRowsFromApollo = 0;
  let skippedNoLinkedin = 0;
  let withLinkedinUrl = 0;

  for (let page = 1; page <= normalizedPageLimit; page++) {
    const apolloPayloadVariants = buildApolloPayloadVariants(
      filters,
      page,
      normalizedPerPage,
      hasEmailOnly !== false
    );
    let people: ApolloPerson[] = [];
    let variantUsed = -1;
    let stopOnError = false;
    for (let variantIndex = 0; variantIndex < apolloPayloadVariants.length; variantIndex++) {
      const apolloPayload = apolloPayloadVariants[variantIndex];
      logApollo("apollo request payload", { page, variantIndex, apolloPayload });

      const res = await fetch(APOLLO_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": key,
        },
        body: JSON.stringify(apolloPayload),
      });
      logApollo("apollo response status", {
        page,
        variantIndex,
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
      });

      const responseTextRaw = await res.text();
      const responseText = truncateForDebug(redactSecrets(responseTextRaw, key));

      debugAttempts.push({
        page,
        variantIndex,
        url: APOLLO_BASE_URL,
        method: "POST",
        requestHeaders: {
          "Content-Type": "application/json",
          "X-Api-Key": "[REDACTED]",
        },
        requestBody: apolloPayload,
        responseOk: res.ok,
        responseStatus: res.status,
        responseStatusText: res.statusText,
        responseText,
      });

      if (!res.ok) {
        logApollo("apollo response error body", {
          page,
          variantIndex,
          body: responseText.slice(0, 1000),
        });
        errors.push(`Apollo page ${page} failed: ${res.status} ${responseText.slice(0, 200)}`);
        stopOnError = true;
        break;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(responseTextRaw) as unknown;
      } catch {
        debugNotes.push(
          `Apollo page ${page} variant ${variantIndex}: response was not valid JSON (see responseText).`
        );
        payload = null;
      }

      people = parsePeople(payload);
      logApollo("apollo parsed people", { page, variantIndex, count: people.length });
      if (people.length > 0) {
        variantUsed = variantIndex;
        if (variantIndex > 0) {
          errors.push(
            `Apollo page ${page} needed fallback variant ${variantIndex + 1} to return results.`
          );
        }
        break;
      }
    }

    if (stopOnError) break;
    if (people.length === 0) break;
    logApollo("apollo selected payload variant", { page, variantUsed });

    let pageNewUniqueApolloIds = 0;
    for (const person of people) {
      if (requireLinkedinUrl && !clean(person.linkedin_url)) {
        skippedNoLinkedin += 1;
        continue;
      }
      const normalized = normalizePerson(person, { requireLinkedinUrl });
      if (!normalized?.email || !normalized.apolloPersonId) continue;
      if (requireLinkedinUrl && normalized.linkedinUrl) {
        withLinkedinUrl += 1;
      }
      rawRowsFromApollo += 1;
      const apolloIdKey = normalized.apolloPersonId.trim();
      if (seenApolloIds.has(apolloIdKey)) {
        continue;
      }
      seenApolloIds.add(apolloIdKey);
      pageNewUniqueApolloIds += 1;
      if (hasEmailOnly === false || normalized.email) {
        allRows.push(normalized);
      }
    }

    if (pageNewUniqueApolloIds === 0) {
      debugNotes.push(
        `Stopped pagination early at page ${page}: Apollo returned people but none were new unique Apollo IDs vs prior pages.`
      );
      break;
    }

    if (people.length < normalizedPerPage) break;
  }
  logApollo("all rows collected", { count: allRows.length, errors });

  const uniqueByApolloId = new Map<string, ImportRow>();
  for (const row of allRows) {
    if (!row.apolloPersonId) continue;
    uniqueByApolloId.set(row.apolloPersonId, row);
  }
  const dedupedRows = Array.from(uniqueByApolloId.values());
  logApollo("after dedupe", { input: allRows.length, deduped: dedupedRows.length });

  return {
    ok: true,
    result: {
      rows: dedupedRows,
      rawRowsFromApollo,
      skippedNoLinkedin,
      withLinkedinUrl,
      errors,
      debug: { attempts: debugAttempts, notes: debugNotes },
    },
  };
}

export type PersistImportRowsResult = {
  createdCount: number;
  attempted: number;
  skippedExistingInDb: number;
  skippedDuplicateEmails: number;
  /** Contact id for every row, whether newly created or already existing. */
  contactIdByApolloId: Map<string, string>;
  /** apolloPersonIds for rows that were newly created (for enrichment/author-fill). */
  newApolloIds: string[];
};

/**
 * Persists deduped Apollo rows as Contacts (+ their Companies). Skips rows
 * whose apolloPersonId already exists as a Contact, but still reports their
 * contact id so callers can link them (e.g. to a campaign) without erroring.
 */
export async function persistImportRows(
  dedupedRows: ImportRow[],
  source: string
): Promise<PersistImportRowsResult> {
  const existingContacts = await prisma.contact.findMany({
    where: { apolloPersonId: { in: dedupedRows.map((r) => r.apolloPersonId!).filter(Boolean) } },
    select: { id: true, apolloPersonId: true },
  });
  const contactIdByApolloId = new Map<string, string>();
  for (const c of existingContacts) {
    if (c.apolloPersonId) contactIdByApolloId.set(c.apolloPersonId, c.id);
  }
  const newRows = dedupedRows.filter(
    (r) => r.apolloPersonId && !contactIdByApolloId.has(r.apolloPersonId)
  );
  const skippedExistingInDb = dedupedRows.length - newRows.length;
  logApollo("existing/new rows", {
    existing: existingContacts.length,
    newRows: newRows.length,
    skippedExistingInDb,
  });

  const companyNames = [...new Set(newRows.map((d) => d.companyName).filter(Boolean))] as string[];
  const companyMap = new Map<string, string>();

  if (companyNames.length > 0) {
    const companyIds = companyNames.map((name) => `company-${slugify(name)}`);
    const existingCompanies = await prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true },
    });

    for (const c of existingCompanies) {
      companyMap.set(c.name.toLowerCase(), c.id);
    }

    const newCompanyNames = companyNames.filter((name) => !companyMap.has(name.toLowerCase()));

    if (newCompanyNames.length > 0) {
      const companyData = newCompanyNames.map((name) => {
        const row = newRows.find((d) => d.companyName?.toLowerCase() === name.toLowerCase());
        return {
          id: `company-${slugify(name)}`,
          name,
          website: row?.companyWebsite || null,
          linkedinUrl: row?.companyLinkedin || null,
          industry: row?.companyIndustry || null,
          description: row?.companyDescription || null,
          employeeCount: row?.companySize ? Number.parseInt(row.companySize, 10) : null,
          country: row?.companyCountry || null,
          state: row?.companyState || null,
        };
      });

      await prisma.company.createMany({ data: companyData, skipDuplicates: true });
      logApollo("companies created", { attempted: companyData.length });

      for (const c of companyData) {
        companyMap.set(c.name.toLowerCase(), c.id);
      }
    }
  }

  const contactData = newRows.map((data) => ({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    apolloPersonId: data.apolloPersonId ?? null,
    position: data.position || null,
    seniority: data.seniority || null,
    linkedinUrl: data.linkedinUrl || null,
    country: data.country || null,
    state: data.state || null,
    companyId: data.companyName ? companyMap.get(data.companyName.toLowerCase()) || null : null,
    source,
  }));

  let createdCount = 0;
  if (contactData.length > 0) {
    const createResult = await prisma.contact.createMany({ data: contactData, skipDuplicates: true });
    createdCount = createResult.count;
    logApollo("contacts created", {
      attempted: contactData.length,
      actuallyInserted: createdCount,
      skippedByUniqueConstraint: contactData.length - createdCount,
    });
  }
  const skippedDuplicateEmails = Math.max(contactData.length - createdCount, 0);

  const newApolloIds = [
    ...new Set(newRows.map((r) => r.apolloPersonId?.trim()).filter((id): id is string => Boolean(id))),
  ];
  if (newApolloIds.length > 0) {
    const createdContacts = await prisma.contact.findMany({
      where: { apolloPersonId: { in: newApolloIds } },
      select: { id: true, apolloPersonId: true },
    });
    for (const c of createdContacts) {
      if (c.apolloPersonId) contactIdByApolloId.set(c.apolloPersonId, c.id);
    }
  }

  return {
    createdCount,
    attempted: contactData.length,
    skippedExistingInDb,
    skippedDuplicateEmails,
    contactIdByApolloId,
    newApolloIds,
  };
}

export type ApolloImportOptions = {
  requireLinkedinUrl?: boolean;
};

export async function runApolloImport(
  body: unknown,
  source: string,
  options: ApolloImportOptions = {}
) {
  try {
    logApollo("request received", { source, options, body });
    const { filters, pageLimit, perPage, hasEmailOnly, skipEnrichment } = body as {
      filters?: ApolloFilterPayload;
      pageLimit?: number;
      perPage?: number;
      hasEmailOnly?: boolean;
      skipEnrichment?: boolean;
    };

    if (!filters || typeof filters !== "object") {
      return NextResponse.json(
        {
          error: "filters payload is required",
          debug: { attempts: [], notes: ["No outbound Apollo requests were made (missing filters)."] },
        },
        { status: 400 }
      );
    }

    const searchResult = await searchApolloPeople(filters, {
      pageLimit,
      perPage,
      hasEmailOnly,
      requireLinkedinUrl: options.requireLinkedinUrl,
    });

    if (!searchResult.ok) {
      return NextResponse.json(
        { error: searchResult.error, debug: searchResult.debug },
        { status: searchResult.status }
      );
    }

    const {
      rows: dedupedRows,
      rawRowsFromApollo,
      skippedNoLinkedin,
      withLinkedinUrl,
      errors,
      debug,
    } = searchResult.result;

    if (dedupedRows.length === 0) {
      logApollo("early return no rows");
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        fetched: rawRowsFromApollo,
        fetchedRawRows: rawRowsFromApollo,
        fetchedUniqueApolloIds: 0,
        fetchedUniqueEmails: 0,
        skippedExistingInDb: 0,
        importedNew: 0,
        skippedNoLinkedin,
        withLinkedinUrl,
        errors,
        debug,
      });
    }

    const { createdCount, attempted, skippedExistingInDb, skippedDuplicateEmails, newApolloIds } =
      await persistImportRows(dedupedRows, source);

    let enrichment:
      | Awaited<ReturnType<typeof enrichImportedContacts>>
      | { skipped: true; reason: string }
      | null = null;
    if (createdCount > 0) {
      if (skipEnrichment === true) {
        enrichment = { skipped: true, reason: "skip_enrichment_requested" };
      } else if (newApolloIds.length > 0) {
        enrichment = await enrichImportedContacts(newApolloIds);
        logApollo("enrichment finished", enrichment);
      } else {
        enrichment = { skipped: true, reason: "no_apollo_person_ids_on_imported_rows" };
      }
    }

    logApollo("final response", {
      imported: createdCount,
      attempted,
      skipped: skippedExistingInDb,
      skippedDuplicateEmails,
      fetched: rawRowsFromApollo,
      skippedExistingInDb,
      errors,
    });
    return NextResponse.json({
      imported: createdCount,
      attempted,
      skipped: skippedExistingInDb,
      skippedDuplicateEmails,
      fetched: rawRowsFromApollo,
      fetchedRawRows: rawRowsFromApollo,
      fetchedUniqueApolloIds: dedupedRows.length,
      fetchedUniqueEmails: dedupedRows.length,
      skippedExistingInDb,
      importedNew: createdCount,
      skippedNoLinkedin,
      withLinkedinUrl,
      errors,
      enrichment,
      debug,
    });
  } catch (error) {
    console.error("Apollo import error:", error);
    return NextResponse.json(
      {
        error: "Apollo import failed",
        details: String(error),
        debug: { attempts: [], notes: ["Server threw before/during Apollo import (see details)."] },
      },
      { status: 500 }
    );
  }
}
