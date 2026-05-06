/** Prisma `ContactStatus` values — keep in sync with schema. */
export const CONTACT_STATUS_VALUES = [
  "NEW",
  "QUALIFIED",
  "CONTACTED",
  "REPLIED",
  "BOUNCED",
  "UNSUBSCRIBED",
] as const;

export type ContactStatusValue = (typeof CONTACT_STATUS_VALUES)[number];

export function parseContactStatus(raw?: string): ContactStatusValue | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const u = raw.trim().toUpperCase();
  return (CONTACT_STATUS_VALUES as readonly string[]).includes(u)
    ? (u as ContactStatusValue)
    : undefined;
}

export type ContactsUrlParams = {
  q?: string;
  status?: ContactStatusValue;
  showLocked?: boolean;
  page?: number;
  /** One-shot banners — omit unless you want them in the URL */
  imported?: number;
  retried?: number;
};

/**
 * Builds `/contacts?...` preserving filters. Omit `page` or use `page <= 1` to
 * reset pagination (tab switches).
 */
export function buildContactsHref(params: ContactsUrlParams): string {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.status) sp.set("status", params.status);
  if (params.showLocked) sp.set("showLocked", "1");
  if (params.page != null && Number.isFinite(params.page) && params.page > 1) {
    sp.set("page", String(Math.floor(params.page)));
  }
  if (params.imported != null && params.imported > 0) {
    sp.set("imported", String(params.imported));
  }
  if (params.retried != null && params.retried >= 0) {
    sp.set("retried", String(params.retried));
  }
  const qs = sp.toString();
  return qs ? `/contacts?${qs}` : "/contacts";
}
