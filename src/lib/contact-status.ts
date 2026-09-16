export {
  CONTACT_STATUS_VALUES,
  type ContactStatusValue,
  parseContactStatus,
} from "@/app/contacts/contacts-url";
import { CONTACT_STATUS_VALUES, type ContactStatusValue } from "@/app/contacts/contacts-url";

// Same palette as the static badge in contacts-table.tsx, plus a color for
// OUTREACHED (that map omits it since it predates the enum value being used
// broadly outside the LinkedIn list).
export const CONTACT_STATUS_COLORS: Record<ContactStatusValue, string> = {
  NEW: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100",
  QUALIFIED:
    "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/50 dark:text-green-100",
  CONTACTED:
    "border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-100",
  OUTREACHED:
    "border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-100",
  REPLIED:
    "border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-100",
  BOUNCED:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100",
  UNSUBSCRIBED:
    "border-gray-300 bg-gray-50 text-gray-900 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-100",
};

export function contactStatusSelectClass(status: string): string {
  if ((CONTACT_STATUS_VALUES as readonly string[]).includes(status)) {
    return CONTACT_STATUS_COLORS[status as ContactStatusValue];
  }
  return "border-input bg-background text-foreground";
}
