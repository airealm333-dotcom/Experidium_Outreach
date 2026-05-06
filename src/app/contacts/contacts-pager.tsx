import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildContactsHref, type ContactStatusValue } from "./contacts-url";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  q?: string;
  status?: ContactStatusValue;
  showLocked: boolean;
};

/**
 * Returns 1-based page indices and "ellipsis" markers for a compact pager.
 */
function visiblePages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 1) return [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (let d = -1; d <= 1; d++) {
    const p = current + d;
    if (p >= 1 && p <= total) pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    if (i > 0 && p - sorted[i - 1]! > 1) {
      out.push("ellipsis");
    }
    out.push(p);
  }
  return out;
}

export function ContactsPager({
  page,
  totalPages,
  total,
  pageSize,
  q,
  status,
  showLocked,
}: Props) {
  if (totalPages <= 1) return null;

  const base = { q, status, showLocked };
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pages = visiblePages(page, totalPages);

  const linkClass =
    "inline-flex min-w-9 items-center justify-center rounded-md border border-transparent px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted";
  const activeLinkClass =
    "inline-flex min-w-9 items-center justify-center rounded-md border border-foreground/20 bg-muted px-2 py-1.5 text-sm font-semibold text-foreground";
  const disabledClass =
    "inline-flex min-w-9 cursor-not-allowed items-center justify-center rounded-md px-2 py-1.5 text-sm text-muted-foreground opacity-50";

  return (
    <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">
          {start}-{end}
        </span>{" "}
        of <span className="font-medium text-foreground">{total}</span>
      </p>
      <nav className="flex flex-wrap items-center gap-1" aria-label="Pagination">
        {page <= 1 ? (
          <span className={disabledClass} aria-disabled>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous</span>
          </span>
        ) : (
          <Link
            href={buildContactsHref({ ...base, page: page - 1 })}
            className={cn(linkClass, "gap-0.5")}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        )}
        {pages.map((item, idx) =>
          item === "ellipsis" ? (
            <span
              key={`e-${idx}`}
              className="px-1.5 text-sm text-muted-foreground"
              aria-hidden
            >
              …
            </span>
          ) : (
            <Link
              key={item}
              href={buildContactsHref({ ...base, page: item === 1 ? undefined : item })}
              className={item === page ? activeLinkClass : linkClass}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </Link>
          )
        )}
        {page >= totalPages ? (
          <span className={disabledClass} aria-disabled>
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next</span>
          </span>
        ) : (
          <Link
            href={buildContactsHref({ ...base, page: page + 1 })}
            className={cn(linkClass, "gap-0.5")}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </nav>
    </div>
  );
}
