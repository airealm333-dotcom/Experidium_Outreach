import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Apollo default is false when omitted (see OpenAPI). */
const BULK_MATCH_URL = "https://api.apollo.io/api/v1/people/bulk_match";
const CHUNK_SIZE = 10;
const RESPONSE_TEXT_LOG_LIMIT = 4_000;

/**
 * Local-part prefix for contacts awaiting bulk_match unlock.
 *
 * Matches both:
 *  - legacy literal Apollo placeholder `email_not_unlocked@domain.com`
 *  - per-row unique placeholder `email_not_unlocked+<apolloPersonId>@apollo.local`
 *    that we mint at import time so the unique constraint on `Contact.email`
 *    does not collapse every locked row into a single insert.
 */
export const APOLLO_UNLOCK_PLACEHOLDER_EMAIL_PREFIX = "email_not_unlocked";
export const APOLLO_UNLOCK_PLACEHOLDER_EMAIL_DOMAIN = "apollo.local";

export function isApolloUnlockPlaceholderEmail(email: string): boolean {
  return email.trim().toLowerCase().startsWith(APOLLO_UNLOCK_PLACEHOLDER_EMAIL_PREFIX);
}

/** Per-row placeholder so locked rows can coexist under a unique-email constraint. */
export function buildApolloPlaceholderEmail(apolloPersonId: string): string {
  const id = apolloPersonId.trim().toLowerCase();
  return `${APOLLO_UNLOCK_PLACEHOLDER_EMAIL_PREFIX}+${id}@${APOLLO_UNLOCK_PLACEHOLDER_EMAIL_DOMAIN}`;
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunk size must be positive");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function redactSecrets(text: string, apiKey: string): string {
  if (!apiKey) return text;
  return text.split(apiKey).join("[REDACTED_API_KEY]");
}

function truncate(text: string, max = RESPONSE_TEXT_LOG_LIMIT): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…(truncated)`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

type BulkMatchJson = {
  status?: string;
  error_code?: string | null;
  error_message?: string | null;
  matches?: Array<{ id?: string; email?: string | null }>;
};

export type ApolloEnrichmentConflict = {
  apolloId: string;
  email: string;
  reason: "email_unique_violation";
};

export type ApolloEnrichmentChunkError = {
  chunkIndex: number;
  message: string;
  status?: number;
  responseSnippet?: string;
};

export type ApolloEnrichmentResult = {
  attempted: number;
  updated: number;
  notFound: number;
  skippedNoEmail: number;
  conflicts: ApolloEnrichmentConflict[];
  chunkErrors: ApolloEnrichmentChunkError[];
};

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchBulkMatchChunk(
  details: { id: string }[],
  apiKey: string,
  chunkIndex: number,
  chunkErrors: ApolloEnrichmentChunkError[]
): Promise<BulkMatchJson | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Key": apiKey,
  };

  const doFetch = async () =>
    fetch(BULK_MATCH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ details }),
    });

  let res = await doFetch();
  if (res.status === 429) {
    await sleep(2_000);
    res = await doFetch();
  }

  const text = await res.text();
  const redacted = redactSecrets(text, apiKey);

  if (!res.ok) {
    chunkErrors.push({
      chunkIndex,
      message: `HTTP ${res.status} ${res.statusText}`,
      status: res.status,
      responseSnippet: truncate(redacted),
    });
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    chunkErrors.push({
      chunkIndex,
      message: "Response was not valid JSON",
      responseSnippet: truncate(redacted),
      status: res.status,
    });
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    chunkErrors.push({
      chunkIndex,
      message: "Parsed response was not an object",
      responseSnippet: truncate(redacted),
    });
    return null;
  }

  const body = parsed as BulkMatchJson;
  if (body.status === "failed") {
    chunkErrors.push({
      chunkIndex,
      message: [body.error_code, body.error_message].filter(Boolean).join(": ") || "Apollo status failed",
    });
    return null;
  }

  return body;
}

function unlockPlaceholderEmailWhere(): Prisma.ContactWhereInput {
  return {
    email: {
      startsWith: APOLLO_UNLOCK_PLACEHOLDER_EMAIL_PREFIX,
      mode: "insensitive",
    },
  };
}

/**
 * Chunks Apollo person IDs (max 10 per request), calls bulk_match, then updates
 * local contacts where `apolloPersonId` matches and a work email is returned.
 */
async function enrichWithBulkMatch(
  apolloIds: string[],
  options: { onlyUpdateUnlockPlaceholder: boolean }
): Promise<ApolloEnrichmentResult> {
  const key = process.env.APOLLO_API_KEY;
  const result: ApolloEnrichmentResult = {
    attempted: 0,
    updated: 0,
    notFound: 0,
    skippedNoEmail: 0,
    conflicts: [],
    chunkErrors: [],
  };

  if (!key || key === "your-apollo-api-key") {
    result.chunkErrors.push({
      chunkIndex: -1,
      message: "APOLLO_API_KEY is not configured",
    });
    return result;
  }

  const uniqueIds = Array.from(
    new Set(
      apolloIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean)
    )
  );
  result.attempted = uniqueIds.length;
  if (uniqueIds.length === 0) {
    return result;
  }

  const emailByApolloId = new Map<string, string>();

  const chunks = chunk(uniqueIds, CHUNK_SIZE);
  for (let i = 0; i < chunks.length; i++) {
    const idsChunk = chunks[i]!;
    const details = idsChunk.map((id) => ({ id }));
    const json = await fetchBulkMatchChunk(details, key, i, result.chunkErrors);
    if (!json?.matches || !Array.isArray(json.matches)) {
      continue;
    }
    for (const m of json.matches) {
      const id = typeof m.id === "string" ? m.id.trim() : "";
      const email = typeof m.email === "string" ? m.email.trim().toLowerCase() : "";
      if (!id || !email) {
        if (id && !email) result.skippedNoEmail += 1;
        continue;
      }
      emailByApolloId.set(id, email);
    }
  }

  const placeholderWhere = unlockPlaceholderEmailWhere();

  for (const [apolloId, email] of emailByApolloId) {
    try {
      const where: Prisma.ContactWhereInput = options.onlyUpdateUnlockPlaceholder
        ? { apolloPersonId: apolloId, ...placeholderWhere }
        : { apolloPersonId: apolloId };

      const update = await prisma.contact.updateMany({
        where,
        data: { email },
      });
      if (update.count === 0) {
        result.notFound += 1;
      } else {
        result.updated += update.count;
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        result.conflicts.push({
          apolloId,
          email,
          reason: "email_unique_violation",
        });
      } else {
        throw error;
      }
    }
  }

  return result;
}

/**
 * Chunks Apollo person IDs (max 10 per request), calls bulk_match, then updates
 * local contacts where `apolloPersonId` matches and a work email is returned.
 */
export async function enrichApolloContacts(
  apolloIds: string[]
): Promise<ApolloEnrichmentResult> {
  return enrichWithBulkMatch(apolloIds, { onlyUpdateUnlockPlaceholder: false });
}

/**
 * Phase 2: chunked `people/bulk_match` enrichment.
 *
 * - **With `apolloPersonIds`:** enriches exactly those IDs (e.g. immediately after import) and
 *   updates matching contacts with emails returned by Apollo (`onlyUpdateUnlockPlaceholder: false`).
 * - **Without arguments:** loads contacts that still have the unlock placeholder email plus a
 *   saved `apolloPersonId`, then enriches only those rows.
 */
export async function enrichImportedContacts(
  apolloPersonIds?: string[]
): Promise<ApolloEnrichmentResult> {
  if (apolloPersonIds !== undefined) {
    const ids = Array.from(
      new Set(
        apolloPersonIds
          .map((id) => (typeof id === "string" ? id.trim() : ""))
          .filter(Boolean)
      )
    );
    return enrichWithBulkMatch(ids, { onlyUpdateUnlockPlaceholder: false });
  }

  const rows = await prisma.contact.findMany({
    where: {
      apolloPersonId: { not: null },
      ...unlockPlaceholderEmailWhere(),
    },
    select: { apolloPersonId: true },
  });

  const ids = rows
    .map((r) => r.apolloPersonId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  return enrichWithBulkMatch(ids, { onlyUpdateUnlockPlaceholder: true });
}
