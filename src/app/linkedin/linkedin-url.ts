import {
  buildContactsHref,
  type ContactsUrlParams,
} from "../contacts/contacts-url";
import {
  parseLinkedInStatus,
  type LinkedInStatusValue,
} from "@/lib/linkedin-status";

export const LINKEDIN_BASE_PATH = "/linkedin";
export const LINKEDIN_APOLLO_SOURCE = "linkedin-apollo";

export type LinkedInPageSearchParams = {
  q?: string;
  imported?: string;
  status?: string;
  page?: string;
  pageSize?: string;
};

export function buildLinkedinHref(
  params: Omit<ContactsUrlParams, "showLocked" | "retried"> & { basePath?: string }
): string {
  return buildContactsHref({ ...params, basePath: LINKEDIN_BASE_PATH });
}

export { parseLinkedInStatus, type LinkedInStatusValue };
