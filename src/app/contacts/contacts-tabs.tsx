import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  buildContactsHref,
  CONTACT_STATUS_VALUES,
  type ContactStatusValue,
} from "./contacts-url";

const STATUS_LABELS: Record<ContactStatusValue, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  CONTACTED: "Contacted",
  OUTREACHED: "Outreached",
  REPLIED: "Replied",
  BOUNCED: "Bounced",
  UNSUBSCRIBED: "Unsubscribed",
};

type Props = {
  activeStatus: ContactStatusValue | undefined;
  /** Count per status from `groupBy` on the current scope (search + locked filter). */
  statusCounts: Partial<Record<ContactStatusValue, number>>;
  q?: string;
  showLocked: boolean;
  basePath?: string;
};

export function ContactsTabs({ activeStatus, statusCounts, q, showLocked, basePath }: Props) {
  const allTotal = CONTACT_STATUS_VALUES.reduce(
    (sum, s) => sum + (statusCounts[s] ?? 0),
    0
  );

  const base = { q, showLocked } as const;

  function tabClass(active: boolean) {
    return [
      "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "border-foreground/20 bg-background text-foreground shadow-sm data-[active]:opacity-100"
        : "border-transparent text-muted-foreground hover:border-foreground/10 hover:bg-muted/60 hover:text-foreground",
    ].join(" ");
  }

  return (
    <div
      role="tablist"
      aria-label="Filter by contact status"
      className="mb-4 flex flex-wrap gap-1 border-b border-border pb-2"
    >
      <Link
        role="tab"
        aria-selected={activeStatus === undefined}
        data-active={activeStatus === undefined ? "" : undefined}
        href={buildContactsHref({ ...base, basePath })}
        className={tabClass(activeStatus === undefined)}
      >
        All
        <Badge variant="secondary" className="tabular-nums">
          {allTotal}
        </Badge>
      </Link>
      {CONTACT_STATUS_VALUES.map((value) => {
        const count = statusCounts[value] ?? 0;
        if (count <= 0) return null;
        const active = activeStatus === value;
        return (
          <Link
            key={value}
            role="tab"
            aria-selected={active}
            data-active={active ? "" : undefined}
            href={buildContactsHref({ ...base, status: value, basePath })}
            className={tabClass(active)}
          >
            {STATUS_LABELS[value]}
            <Badge variant="secondary" className="tabular-nums">
              {count}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}
