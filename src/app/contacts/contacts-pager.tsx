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
  basePath?: string;
  /** When set, shows row-per-page selector links (e.g. 10 / 20 / 50). */
  pageSizeOptions?: readonly number[];
};

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
  basePath,
  pageSizeOptions,
}: Props) {
  if (total === 0) return null;

  const base = { q, status, showLocked, pageSize };
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pages = visiblePages(page, totalPages);
  const showPageNav = totalPages > 1;
  const showPageSizeSelector =
    pageSizeOptions != null && pageSizeOptions.length > 0;

  const linkClass =
    "inline-flex min-w-9 items-center justify-center rounded-md border border-transparent px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted";
  const activeLinkClass =
    "inline-flex min-w-9 items-center justify-center rounded-md border border-foreground/20 bg-muted px-2 py-1.5 text-sm font-semibold text-foreground";
  const disabledClass =
    "inline-flex min-w-9 cursor-not-allowed items-center justify-center rounded-md px-2 py-1.5 text-sm text-muted-foreground opacity-50";
  const sizeLinkClass =
    "inline-flex min-w-9 items-center justify-center rounded-md border border-transparent px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground";
  const activeSizeLinkClass =
    "inline-flex min-w-9 items-center justify-center rounded-md border border-foreground/20 bg-muted px-2 py-1 text-sm font-semibold text-foreground";

  return (
    <div className="mt-4 flex flex-col gap-3 border-t pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">
            {start}-{end}
          </span>{" "}
          of <span className="font-medium text-foreground">{total}</span>
        </p>
        {showPageSizeSelector ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Rows per page</span>
            <div className="flex items-center gap-0.5" role="group" aria-label="Rows per page">
              {pageSizeOptions.map((size) => (
                <Link
                  key={size}
                  href={buildContactsHref({
                    ...base,
                    pageSize: size,
                    page: undefined,
                    basePath,
                  })}
                  className={size === pageSize ? activeSizeLinkClass : sizeLinkClass}
                  aria-current={size === pageSize ? "true" : undefined}
                >
                  {size}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {showPageNav ? (
        <nav
          className="flex flex-wrap items-center justify-end gap-1"
          aria-label="Pagination"
        >
          {page <= 1 ? (
            <span className={disabledClass} aria-disabled>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous</span>
            </span>
          ) : (
            <Link
              href={buildContactsHref({ ...base, page: page - 1, basePath })}
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
                href={buildContactsHref({
                  ...base,
                  page: item === 1 ? undefined : item,
                  basePath,
                })}
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
              href={buildContactsHref({ ...base, page: page + 1, basePath })}
              className={cn(linkClass, "gap-0.5")}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </nav>
      ) : null}
    </div>
  );
}
