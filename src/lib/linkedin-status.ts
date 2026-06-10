export const LINKEDIN_STATUS_VALUES = ["NEW", "OUTREACHED"] as const;

export type LinkedInStatusValue = (typeof LINKEDIN_STATUS_VALUES)[number];

/** Legacy LinkedIn rows may still be stored as CONTACTED. */
export const LINKEDIN_LEGACY_CONTACTED = "CONTACTED";

export const LINKEDIN_STATUS_LABELS: Record<LinkedInStatusValue, string> = {
  NEW: "New",
  OUTREACHED: "Outreached",
};

export const LINKEDIN_STATUS_COLORS: Record<LinkedInStatusValue, string> = {
  NEW: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800",
  OUTREACHED:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800",
};

export function normalizeLinkedInStatus(raw?: string): LinkedInStatusValue | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const u = raw.trim().toUpperCase();
  if (u === LINKEDIN_LEGACY_CONTACTED) return "OUTREACHED";
  return (LINKEDIN_STATUS_VALUES as readonly string[]).includes(u)
    ? (u as LinkedInStatusValue)
    : undefined;
}

export function parseLinkedInStatus(raw?: string): LinkedInStatusValue | undefined {
  return normalizeLinkedInStatus(raw);
}

export function linkedinStatusSelectClass(status: string): string {
  const normalized = normalizeLinkedInStatus(status) ?? status;
  if (normalized === "NEW") {
    return "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100";
  }
  if (normalized === "OUTREACHED") {
    return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100";
  }
  return "border-input bg-background";
}
