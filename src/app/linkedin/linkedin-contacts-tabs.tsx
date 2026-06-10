import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buildContactsHref } from "../contacts/contacts-url";
import {
  LINKEDIN_STATUS_COLORS,
  LINKEDIN_STATUS_LABELS,
  LINKEDIN_STATUS_VALUES,
  type LinkedInStatusValue,
} from "@/lib/linkedin-status";
import { LINKEDIN_BASE_PATH } from "./linkedin-url";

type Props = {
  activeStatus: LinkedInStatusValue | undefined;
  statusCounts: Partial<Record<LinkedInStatusValue, number>>;
  q?: string;
  pageSize?: number;
};

export function LinkedInContactsTabs({ activeStatus, statusCounts, q, pageSize }: Props) {
  const allTotal = LINKEDIN_STATUS_VALUES.reduce(
    (sum, s) => sum + (statusCounts[s] ?? 0),
    0
  );

  const base = { q, showLocked: false, basePath: LINKEDIN_BASE_PATH, pageSize } as const;

  function tabClass(active: boolean, status?: LinkedInStatusValue) {
    const color =
      status && active ? LINKEDIN_STATUS_COLORS[status] : undefined;
    return [
      "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
      active && color
        ? color
        : active
          ? "border-foreground/20 bg-background text-foreground shadow-sm"
          : "border-transparent text-muted-foreground hover:border-foreground/10 hover:bg-muted/60 hover:text-foreground",
    ].join(" ");
  }

  return (
    <div
      role="tablist"
      aria-label="Filter by status"
      className="mb-4 flex flex-wrap gap-1 border-b border-border pb-2"
    >
      <Link
        role="tab"
        aria-selected={activeStatus === undefined}
        href={buildContactsHref({ ...base })}
        className={tabClass(activeStatus === undefined)}
      >
        All
        <Badge variant="secondary" className="tabular-nums">
          {allTotal}
        </Badge>
      </Link>
      {LINKEDIN_STATUS_VALUES.map((value) => {
        const count = statusCounts[value] ?? 0;
        const active = activeStatus === value;
        return (
          <Link
            key={value}
            role="tab"
            aria-selected={active}
            href={buildContactsHref({ ...base, status: value })}
            className={tabClass(active, value)}
          >
            {LINKEDIN_STATUS_LABELS[value]}
            <Badge
              variant="secondary"
              className={`tabular-nums ${!active ? LINKEDIN_STATUS_COLORS[value] : ""}`}
            >
              {count}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}
