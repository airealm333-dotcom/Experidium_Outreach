import { prisma } from "@/lib/prisma";
import { createApolloLogger, getApolloApiKey } from "@/lib/apollo-shared";

// Real, documented Apollo endpoint (verified live) — 1 credit per company.
// Unlike people's bulk_match, this is a single-organization GET, so callers
// are enriched sequentially, not in a batch request.
const APOLLO_ORG_ENRICH_URL = "https://api.apollo.io/api/v1/organizations/enrich";
const RETRY_DELAY_MS = 2000;

const logApollo = createApolloLogger("apollo-company-enrich");

type ApolloOrgEnrichment = {
  industry?: string | null;
  short_description?: string | null;
  estimated_num_employees?: number | null;
  country?: string | null;
  state?: string | null;
};

async function fetchOrganizationEnrichment(
  domain: string,
  apiKey: string
): Promise<ApolloOrgEnrichment | null> {
  const url = `${APOLLO_ORG_ENRICH_URL}?domain=${encodeURIComponent(domain)}`;

  let res = await fetch(url, { headers: { "X-Api-Key": apiKey } });
  if (res.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    res = await fetch(url, { headers: { "X-Api-Key": apiKey } });
  }

  if (!res.ok) {
    logApollo("enrich request failed", { domain, status: res.status });
    return null;
  }

  const data = (await res.json()) as { organization?: ApolloOrgEnrichment | null };
  return data.organization ?? null;
}

export type CompanyEnrichmentTarget = { companyId: string; domain: string };

export type CompanyEnrichmentResult = {
  attempted: number;
  updated: number;
  errors: string[];
};

/**
 * Enriches Company rows (industry/description/employeeCount/country/state)
 * via Apollo's organization-enrich endpoint. Only ever called for companies
 * that don't already have `industry` set — callers are responsible for that
 * filtering, since this always spends a credit per target regardless of
 * whether Apollo has data for it.
 */
export async function enrichCampaignCompanies(
  targets: CompanyEnrichmentTarget[]
): Promise<CompanyEnrichmentResult> {
  const key = getApolloApiKey();
  if (!key || targets.length === 0) {
    return { attempted: 0, updated: 0, errors: [] };
  }

  let updated = 0;
  const errors: string[] = [];

  for (const target of targets) {
    try {
      const org = await fetchOrganizationEnrichment(target.domain, key);
      if (!org) {
        errors.push(`No enrichment data for ${target.domain}`);
        continue;
      }
      await prisma.company.update({
        where: { id: target.companyId },
        data: {
          industry: org.industry ?? undefined,
          description: org.short_description ?? undefined,
          employeeCount:
            typeof org.estimated_num_employees === "number"
              ? org.estimated_num_employees
              : undefined,
          country: org.country ?? undefined,
          state: org.state ?? undefined,
        },
      });
      updated += 1;
    } catch (error) {
      logApollo("enrich error", { domain: target.domain, error: String(error) });
      errors.push(`Failed to enrich ${target.domain}: ${String(error)}`);
    }
  }

  return { attempted: targets.length, updated, errors };
}
