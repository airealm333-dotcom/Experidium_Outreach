import {
  type ApolloDebugAttempt,
  clean,
  createApolloLogger,
  getApolloApiKey,
  redactSecrets,
  safeInt,
  truncateForDebug,
  uniqueList,
} from "@/lib/apollo-shared";

// Apollo's organization/company search endpoint. This repo has never called
// a company-search endpoint before (only mixed_people/search) — if Apollo
// changes/renames this, `organizations/search` is the documented fallback.
const APOLLO_COMPANY_BASE_URL = "https://api.apollo.io/api/v1/mixed_companies/search";
const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 25;
const MAX_PER_PAGE = 100;

const logApollo = createApolloLogger("apollo-company-search");

export type ApolloCompanyFilterPayload = {
  names?: string[];
  domains?: string[];
  /** Free-text keywords — also the correct way to filter by industry (e.g.
   * "consulting", "mining"); Apollo's org search has no separate
   * industry-ID parameter despite an earlier, incorrect assumption here. */
  keywords?: string[];
  locations?: string[];
  employeeMin?: number;
  employeeMax?: number;
  revenueMin?: number;
  revenueMax?: number;
};

type ApolloOrgResult = {
  id?: string | null;
  organization_id?: string | null;
  name?: string | null;
  website_url?: string | null;
  primary_domain?: string | null;
  linkedin_url?: string | null;
  industry?: string | null;
  short_description?: string | null;
  estimated_num_employees?: number | null;
  country?: string | null;
  state?: string | null;
};

export type ApolloCompanyResult = {
  apolloOrgId: string;
  name: string;
  website: string | null;
  domain: string | null;
  linkedinUrl: string | null;
  industry: string | null;
  description: string | null;
  employeeCount: number | null;
  country: string | null;
  state: string | null;
};

export type ApolloCompanySearchResult = {
  companies: ApolloCompanyResult[];
  fetched: number;
  errors: string[];
  debug: { attempts: ApolloDebugAttempt[]; notes: string[] };
};

function buildApolloCompanyPayload(
  filters: ApolloCompanyFilterPayload,
  page: number,
  perPage: number
): Record<string, unknown> {
  const names = uniqueList(filters.names);
  const domains = uniqueList(filters.domains);
  const keywords = uniqueList(filters.keywords);
  const locations = uniqueList(filters.locations);
  const employeeMin = safeInt(filters.employeeMin);
  const employeeMax = safeInt(filters.employeeMax);
  const revenueMin = safeInt(filters.revenueMin);
  const revenueMax = safeInt(filters.revenueMax);

  const payload: Record<string, unknown> = { page, per_page: perPage };

  if (names.length > 0) {
    payload.q_organization_name = names.join(" ");
  }
  if (domains.length > 0) {
    payload.q_organization_domains_list = domains;
  }
  const joinedKeywords = keywords.join(" ").trim();
  if (joinedKeywords) {
    payload.q_organization_keyword_tags = keywords;
  }
  if (locations.length > 0) {
    payload.organization_locations = locations;
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

function buildApolloCompanyPayloadVariants(
  filters: ApolloCompanyFilterPayload,
  page: number,
  perPage: number
): Record<string, unknown>[] {
  const strict = buildApolloCompanyPayload(filters, page, perPage);
  const medium = buildApolloCompanyPayload(
    {
      ...filters,
      keywords: [],
      revenueMin: undefined,
      revenueMax: undefined,
      employeeMin: undefined,
      employeeMax: undefined,
    },
    page,
    perPage
  );
  const relaxed = buildApolloCompanyPayload(
    { names: filters.names, domains: filters.domains, locations: filters.locations },
    page,
    perPage
  );
  return [strict, medium, relaxed];
}

function parseOrganizations(payload: unknown): ApolloOrgResult[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  const organizations = Array.isArray(p.organizations)
    ? (p.organizations as ApolloOrgResult[])
    : [];
  const accounts = Array.isArray(p.accounts) ? (p.accounts as ApolloOrgResult[]) : [];
  if (organizations.length > 0) return organizations;
  return accounts;
}

function normalizeOrg(org: ApolloOrgResult): ApolloCompanyResult | null {
  const apolloOrgId = clean(org.id) || clean(org.organization_id);
  const name = clean(org.name);
  if (!apolloOrgId || !name) return null;

  return {
    apolloOrgId,
    name,
    website: clean(org.website_url) ?? null,
    domain: clean(org.primary_domain) ?? null,
    linkedinUrl: clean(org.linkedin_url) ?? null,
    industry: clean(org.industry) ?? null,
    description: clean(org.short_description) ?? null,
    employeeCount:
      typeof org.estimated_num_employees === "number" ? org.estimated_num_employees : null,
    country: clean(org.country) ?? null,
    state: clean(org.state) ?? null,
  };
}

export type ApolloCompanySearchOptions = {
  page?: number;
  perPage?: number;
};

/**
 * Live Apollo company/organization search. DB-free — callers are responsible
 * for persisting any selected results (see the campaign companies API route).
 */
export async function searchApolloCompanies(
  filters: ApolloCompanyFilterPayload,
  options: ApolloCompanySearchOptions = {}
): Promise<
  | { ok: true; result: ApolloCompanySearchResult }
  | { ok: false; status: number; error: string; debug: ApolloCompanySearchResult["debug"] }
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

  const names = uniqueList(filters.names);
  const domains = uniqueList(filters.domains);
  const keywords = uniqueList(filters.keywords);
  const locations = uniqueList(filters.locations);
  const hasAnyPrimaryFilter =
    names.length > 0 || domains.length > 0 || keywords.length > 0 || locations.length > 0;
  if (!hasAnyPrimaryFilter) {
    return {
      ok: false,
      status: 400,
      error: "At least one filter must be provided (company name, domain, keyword, or location).",
      debug: { attempts: [], notes: ["No outbound Apollo requests were made (no primary filters)."] },
    };
  }

  const page = Math.max(1, safeInt(options.page) ?? DEFAULT_PAGE);
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, safeInt(options.perPage) ?? DEFAULT_PER_PAGE)
  );

  const errors: string[] = [];
  const debugNotes: string[] = [];
  const debugAttempts: ApolloDebugAttempt[] = [];

  const variants = buildApolloCompanyPayloadVariants(filters, page, perPage);
  let organizations: ApolloOrgResult[] = [];

  for (let variantIndex = 0; variantIndex < variants.length; variantIndex++) {
    const apolloPayload = variants[variantIndex];
    logApollo("apollo request payload", { variantIndex, apolloPayload });

    const res = await fetch(APOLLO_COMPANY_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify(apolloPayload),
    });
    const responseTextRaw = await res.text();
    const responseText = truncateForDebug(redactSecrets(responseTextRaw, key));

    debugAttempts.push({
      page,
      variantIndex,
      url: APOLLO_COMPANY_BASE_URL,
      method: "POST",
      requestHeaders: { "Content-Type": "application/json", "X-Api-Key": "[REDACTED]" },
      requestBody: apolloPayload,
      responseOk: res.ok,
      responseStatus: res.status,
      responseStatusText: res.statusText,
      responseText,
    });

    if (!res.ok) {
      errors.push(`Apollo company search failed: ${res.status} ${responseText.slice(0, 200)}`);
      break;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(responseTextRaw) as unknown;
    } catch {
      debugNotes.push(
        `Apollo company search variant ${variantIndex}: response was not valid JSON (see responseText).`
      );
      payload = null;
    }

    organizations = parseOrganizations(payload);
    if (organizations.length > 0) {
      if (variantIndex > 0) {
        errors.push(`Apollo company search needed fallback variant ${variantIndex + 1} to return results.`);
      }
      break;
    }
  }

  const companies = organizations
    .map(normalizeOrg)
    .filter((c): c is ApolloCompanyResult => c !== null);

  const uniqueByOrgId = new Map<string, ApolloCompanyResult>();
  for (const company of companies) {
    uniqueByOrgId.set(company.apolloOrgId, company);
  }

  return {
    ok: true,
    result: {
      companies: Array.from(uniqueByOrgId.values()),
      fetched: organizations.length,
      errors,
      debug: { attempts: debugAttempts, notes: debugNotes },
    },
  };
}
