export const APOLLO_DEBUG_RESPONSE_TEXT_LIMIT = 20_000;

export type ApolloDebugAttempt = {
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

export function createApolloLogger(prefix: string) {
  return function logApollo(step: string, details?: unknown) {
    if (details === undefined) {
      console.log(`[${prefix}] ${step}`);
      return;
    }
    console.log(`[${prefix}] ${step}`, details);
  };
}

export function getApolloApiKey(): string | null {
  const key = process.env.APOLLO_API_KEY;
  if (!key || key === "your-apollo-api-key") return null;
  return key;
}

export function redactSecrets(text: string, apiKey: string): string {
  if (!apiKey) return text;
  return text.split(apiKey).join("[REDACTED_API_KEY]");
}

export function truncateForDebug(text: string): string {
  if (text.length <= APOLLO_DEBUG_RESPONSE_TEXT_LIMIT) return text;
  return `${text.slice(0, APOLLO_DEBUG_RESPONSE_TEXT_LIMIT)}\n…(truncated)`;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function uniqueList(input: unknown, max = 100): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, max);
  return Array.from(new Set(cleaned));
}

export function safeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function toTechnologyUid(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
