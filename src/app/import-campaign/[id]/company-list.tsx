"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export interface CampaignCompanyRow {
  id: string;
  companyId: string;
  name: string;
  website: string | null;
  industry: string | null;
  employeeCount: number | null;
  country: string | null;
}

async function readApiError(res: Response) {
  try {
    const data = (await res.json()) as { error?: string; details?: string };
    const parts = [data?.error, data?.details].filter(Boolean);
    if (parts.length > 0) return parts.join(" — ");
  } catch {
    // ignore parse errors
  }
  return `Request failed (${res.status})`;
}

export function CompanyList({
  campaignId,
  companies,
}: {
  campaignId: string;
  companies: CampaignCompanyRow[];
}) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);

  const totalPages = Math.max(1, Math.ceil(companies.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageCompanies = companies.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  async function handleRemove(companyId: string, name: string) {
    if (!confirm(`Remove ${name} from this campaign? The company itself won't be deleted.`)) {
      return;
    }
    setRemovingId(companyId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/companies/${companyId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        alert(await readApiError(res));
        return;
      }
      router.refresh();
    } catch {
      alert("Remove failed");
    } finally {
      setRemovingId(null);
    }
  }

  if (companies.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No companies added yet — search Apollo above to add some.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <Table className="[&_th]:border-r [&_th]:border-border/50 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-border/50 [&_td:last-child]:border-r-0">
        <TableHeader>
          <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-12 text-center">Sl No</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Employees</TableHead>
            <TableHead>Country</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageCompanies.map((c, index) => (
            <TableRow key={c.id} className="border-border/50">
              <TableCell className="w-12 text-center tabular-nums text-muted-foreground">
                {(currentPage - 1) * pageSize + index + 1}
              </TableCell>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {c.industry ? <Badge variant="outline">{c.industry}</Badge> : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {c.employeeCount ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">{c.country ?? "—"}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive"
                  disabled={removingId === c.companyId}
                  onClick={() => handleRemove(c.companyId, c.name)}
                  title="Remove from campaign"
                >
                  {removingId === c.companyId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between gap-2 border-t border-border/70 bg-muted/20 px-3 py-2">
        <span className="text-xs text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={currentPage <= 1}
            onClick={() => setPage(1)}
            title="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            title="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
            title="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(totalPages)}
            title="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
