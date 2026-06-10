import { NextResponse } from "next/server";
import {
  buildApolloPlaceholderEmail,
  enrichImportedContacts,
  isApolloUnlockPlaceholderEmail,
} from "@/lib/apollo-enrich";
import { prisma } from "@/lib/prisma";

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

type ImportRow = {
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

type ApolloFilterPayload = {
  titles?: string[];
  technologies?: string[];
  keywords?: string[];
  countries?: string[];
  seniorities?: string[];
  employeeMin?: number;
  employeeMax?: number;
  revenueMin?: number;
  revenueMax?: number;
};

function logApollo(step: string, details?: unknown) {
  if (details === undefined) {
    console.log(`[apollo-import] ${step}`);
    return;
  }
  console.log(`[apollo-import] ${step}`, details);
}

const APOLLO_DEBUG_RESPONSE_TEXT_LIMIT = 20_000;

type ApolloDebugAttempt = {
  page: number;
  variantIndex: number;
  url: string;
  method: "POST";
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseOk: boolean;
  responseStatus: number;
  responseStatusText: string;
  responseText: string;
};

function redactSecrets(text: string, apiKey: string): string {
  if (!apiKey) return text;
  return text.split(apiKey).join("[REDACTED_API_KEY]");
}

function truncateForDebug(text: string): string {
  if (text.length <= APOLLO_DEBUG_RESPONSE_TEXT_LIMIT) return text;
  return `${text.slice(0, APOLLO_DEBUG_RESPONSE_TEXT_LIMIT)}\n…(truncated)`;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

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

function uniqueList(input: unknown, max = 100): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, max);
  return Array.from(new Set(cleaned));
}

function safeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toTechnologyUid(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
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
  const relaxed = buildApolloPayload(
    {
      titles: filters.titles,
      countries: filters.countries,
      seniorities: filters.seniorities,
    },
    page,
    perPage,
    hasEmailOnly
  );

  return [strict, medium, relaxed];
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
    const key = process.env.APOLLO_API_KEY;
    logApollo("env key present", Boolean(key && key !== "your-apollo-api-key"));
    if (!key || key === "your-apollo-api-key") {
      return NextResponse.json(
        {
          error: "APOLLO_API_KEY is not configured",
          debug: { attempts: [], notes: ["No outbound Apollo requests were made (missing API key)."] },
        },
        { status: 400 }
      );
    }

    if (!filters || typeof filters !== "object") {
      return NextResponse.json(
        {
          error: "filters payload is required",
          debug: { attempts: [], notes: ["No outbound Apollo requests were made (missing filters)."] },
        },
        { status: 400 }
      );
    }

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
      skipEnrichment: Boolean(skipEnrichment),
    });

    const titles = uniqueList(filters.titles);
    const technologies = uniqueList(filters.technologies);
    const keywords = uniqueList(filters.keywords);
    const countries = uniqueList(filters.countries);
    const seniorities = uniqueList(filters.seniorities);
    const hasAnyPrimaryFilter =
      titles.length > 0 ||
      technologies.length > 0 ||
      keywords.length > 0 ||
      countries.length > 0 ||
      seniorities.length > 0;
    logApollo("filter counts", {
      titles: titles.length,
      technologies: technologies.length,
      keywords: keywords.length,
      countries: countries.length,
      seniorities: seniorities.length,
    });
    if (!hasAnyPrimaryFilter) {
      return NextResponse.json(
        {
          error:
            "At least one filter must be provided (titles, technologies, keywords, country, or seniority).",
          debug: { attempts: [], notes: ["No outbound Apollo requests were made (no primary filters)."] },
        },
        { status: 400 }
      );
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
      return NextResponse.json(
        {
          error: "Employee range is invalid.",
          debug: { attempts: [], notes: ["No outbound Apollo requests were made (invalid employee range)."] },
        },
        { status: 400 }
      );
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
      return NextResponse.json(
        {
          error: "Revenue range is invalid.",
          debug: { attempts: [], notes: ["No outbound Apollo requests were made (invalid revenue range)."] },
        },
        { status: 400 }
      );
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
        logApollo("apollo request payload keys", {
          page,
          variantIndex,
          keys: Object.keys(apolloPayload),
        });
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

        if (payload && typeof payload === "object") {
          logApollo("apollo response keys", {
            page,
            variantIndex,
            keys: Object.keys(payload as Record<string, unknown>),
          });
        } else {
          logApollo("apollo response non-object payload", { page, variantIndex, payload });
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

      let pageEmailPassed = 0;
      let pageWithApolloId = 0;
      let pageNewUniqueApolloIds = 0;
      for (const person of people) {
        if (options.requireLinkedinUrl && !clean(person.linkedin_url)) {
          skippedNoLinkedin += 1;
          continue;
        }
        const normalized = normalizePerson(person, options);
        if (!normalized?.email || !normalized.apolloPersonId) continue;
        if (options.requireLinkedinUrl && normalized.linkedinUrl) {
          withLinkedinUrl += 1;
        }
        pageEmailPassed += 1;
        pageWithApolloId += 1;
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
      logApollo("page funnel", {
        page,
        people: people.length,
        emailPassed: pageEmailPassed,
        withApolloId: pageWithApolloId,
        newUniqueApolloIdsThisPage: pageNewUniqueApolloIds,
        allRowsSoFar: allRows.length,
        skippedNoLinkedin,
        withLinkedinUrl,
      });

      if (pageNewUniqueApolloIds === 0) {
        debugNotes.push(
          `Stopped pagination early at page ${page}: Apollo returned people but none were new unique Apollo IDs vs prior pages.`
        );
        break;
      }

      if (people.length < normalizedPerPage) break;
    }
    logApollo("all rows collected", { count: allRows.length, errors });

    if (allRows.length === 0) {
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
        debug: { attempts: debugAttempts, notes: debugNotes },
      });
    }

    const uniqueByApolloId = new Map<string, ImportRow>();
    for (const row of allRows) {
      if (!row.apolloPersonId) continue;
      uniqueByApolloId.set(row.apolloPersonId, row);
    }
    const dedupedRows = Array.from(uniqueByApolloId.values());
    logApollo("after dedupe", {
      input: allRows.length,
      deduped: dedupedRows.length,
    });

    const existingContacts = await prisma.contact.findMany({
      where: { apolloPersonId: { in: dedupedRows.map((r) => r.apolloPersonId!).filter(Boolean) } },
      select: { apolloPersonId: true },
    });
    const existingSet = new Set(
      existingContacts
        .map((c) => c.apolloPersonId)
        .filter((id): id is string => Boolean(id))
    );
    const newRows = dedupedRows.filter(
      (r) => r.apolloPersonId && !existingSet.has(r.apolloPersonId)
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

      const newCompanyNames = companyNames.filter(
        (name) => !companyMap.has(name.toLowerCase())
      );

      if (newCompanyNames.length > 0) {
        const companyData = newCompanyNames.map((name) => {
          const row = newRows.find(
            (d) => d.companyName?.toLowerCase() === name.toLowerCase()
          );
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

        await prisma.company.createMany({
          data: companyData,
          skipDuplicates: true,
        });
        logApollo("companies created", {
          attempted: companyData.length,
        });

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
      companyId: data.companyName
        ? companyMap.get(data.companyName.toLowerCase()) || null
        : null,
      source,
    }));

    let createdCount = 0;
    if (contactData.length > 0) {
      const createResult = await prisma.contact.createMany({
        data: contactData,
        skipDuplicates: true,
      });
      createdCount = createResult.count;
      logApollo("contacts created", {
        attempted: contactData.length,
        actuallyInserted: createdCount,
        skippedByUniqueConstraint: contactData.length - createdCount,
      });
    }
    const skippedDuplicateEmails = Math.max(contactData.length - createdCount, 0);

    let enrichment:
      | Awaited<ReturnType<typeof enrichImportedContacts>>
      | { skipped: true; reason: string }
      | null = null;
    if (createdCount > 0) {
      if (skipEnrichment === true) {
        enrichment = { skipped: true, reason: "skip_enrichment_requested" };
      } else {
        const idsForEnrich = [
          ...new Set(
            newRows
              .map((r) => r.apolloPersonId?.trim())
              .filter((id): id is string => Boolean(id))
          ),
        ];
        if (idsForEnrich.length > 0) {
          enrichment = await enrichImportedContacts(idsForEnrich);
          logApollo("enrichment finished", enrichment);
        } else {
          enrichment = {
            skipped: true,
            reason: "no_apollo_person_ids_on_imported_rows",
          };
        }
      }
    }

    logApollo("final response", {
      imported: createdCount,
      attempted: contactData.length,
      skipped: skippedExistingInDb,
      skippedDuplicateEmails,
      fetched: rawRowsFromApollo,
      fetchedRawRows: rawRowsFromApollo,
      fetchedUniqueApolloIds: dedupedRows.length,
      fetchedUniqueEmails: dedupedRows.length,
      skippedExistingInDb,
      errors,
    });
    return NextResponse.json({
      imported: createdCount,
      attempted: contactData.length,
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
      debug: { attempts: debugAttempts, notes: debugNotes },
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
