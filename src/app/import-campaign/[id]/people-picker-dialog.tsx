"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TagInput } from "@/components/apollo-import/tag-input";
import { MultiSelect } from "@/components/ui/multi-select";
import { APOLLO_SENIORITIES } from "@/lib/apollo-seniorities";

interface ApolloPersonResult {
  firstName: string;
  lastName: string;
  email: string;
  apolloPersonId?: string;
  position?: string;
  seniority?: string;
  linkedinUrl?: string;
  companyName?: string;
  alreadyContact: boolean;
  alreadyInCampaign: boolean;
}

interface PickerCompany {
  companyId: string;
  name: string;
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

export function PeoplePickerDialog({
  campaignId,
  companies,
  open,
  onOpenChange,
}: {
  campaignId: string;
  companies: PickerCompany[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [titles, setTitles] = useState<string[]>([]);
  const [seniorities, setSeniorities] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);

  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ApolloPersonResult[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    created: number;
    attached: number;
    alreadyExisted: number;
  } | null>(null);

  const selectable = (results ?? []).filter((p) => !p.alreadyInCampaign);
  const allSelected = selectable.length > 0 && selected.size === selectable.length;
  const someSelected = selected.size > 0 && selected.size < selectable.length;

  function reset() {
    setTitles([]);
    setSeniorities([]);
    setKeywords([]);
    setResults(null);
    setSelected(new Set());
    setError("");
    setImportSummary(null);
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectable.map((p) => p.apolloPersonId!)));
    }
  }

  function toggleOne(apolloPersonId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(apolloPersonId)) next.delete(apolloPersonId);
      else next.add(apolloPersonId);
      return next;
    });
  }

  async function handleSearch() {
    if (companies.length === 0) return;
    setSearching(true);
    setError("");
    setSelected(new Set());
    setImportSummary(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/people/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyIds: companies.map((c) => c.companyId),
          filters: { titles, seniorities, keywords },
        }),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        setResults(null);
        return;
      }
      const data = (await res.json()) as { people: ApolloPersonResult[] };
      setResults(data.people);
    } catch {
      setError("Network error");
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  async function handleImportSelected() {
    if (!results) return;
    const chosen = results.filter((p) => p.apolloPersonId && selected.has(p.apolloPersonId));
    if (chosen.length === 0) return;

    setImporting(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          people: chosen,
          searchCriteria: { titles, seniorities, keywords },
        }),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      const data = (await res.json()) as {
        created: number;
        attached: number;
        alreadyExisted: number;
      };
      setImportSummary(data);
      setResults((prev) =>
        prev
          ? prev.map((p) =>
              p.apolloPersonId && selected.has(p.apolloPersonId)
                ? { ...p, alreadyInCampaign: true }
                : p
            )
          : prev
      );
      setSelected(new Set());
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[85vh] w-[min(900px,92vw)] max-w-[min(900px,92vw)] sm:!max-w-[min(900px,92vw)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pick people</DialogTitle>
          <DialogDescription>
            Search Apollo across {companies.length} compan{companies.length === 1 ? "y" : "ies"} in
            this campaign and import the ones you want.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <TagInput
              label="Job titles"
              values={titles}
              onChange={setTitles}
              placeholder="e.g. VP Sales"
            />
            <MultiSelect
              label="Seniorities"
              options={APOLLO_SENIORITIES}
              values={seniorities}
              onChange={setSeniorities}
              placeholder="Search seniority..."
            />
            <TagInput
              label="Keywords"
              values={keywords}
              onChange={setKeywords}
              placeholder="e.g. growth"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="button" onClick={handleSearch} disabled={searching || companies.length === 0}>
            {searching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Search Apollo
          </Button>

          {importSummary && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Imported {importSummary.created} new contact
                {importSummary.created === 1 ? "" : "s"}
                {importSummary.alreadyExisted > 0
                  ? `, linked ${importSummary.alreadyExisted} existing contact${
                      importSummary.alreadyExisted === 1 ? "" : "s"
                    } to this campaign`
                  : ""}
                .
              </span>
            </div>
          )}

          {results !== null && (
            <div className="space-y-3">
              {results.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No people matched. Try broader filters.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allSelected || someSelected}
                            onCheckedChange={toggleAll}
                            aria-label="Select all"
                            disabled={selectable.length === 0}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((p) => (
                        <TableRow key={p.apolloPersonId ?? p.email}>
                          <TableCell>
                            <Checkbox
                              checked={
                                p.alreadyInCampaign ||
                                (p.apolloPersonId ? selected.has(p.apolloPersonId) : false)
                              }
                              disabled={p.alreadyInCampaign || !p.apolloPersonId}
                              onCheckedChange={() =>
                                p.apolloPersonId && toggleOne(p.apolloPersonId)
                              }
                              aria-label={`Select ${p.firstName} ${p.lastName}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {p.firstName} {p.lastName}
                              {p.alreadyInCampaign && (
                                <Badge variant="secondary" className="shrink-0">
                                  Added
                                </Badge>
                              )}
                              {!p.alreadyInCampaign && p.alreadyContact && (
                                <Badge variant="outline" className="shrink-0">
                                  Existing contact
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.companyName ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.position ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.email}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        {selected.size > 0 && (
          <DialogFooter className="flex-row items-center gap-3 sm:justify-start">
            <span className="text-sm font-medium">
              {selected.size} selected
            </span>
            <Button type="button" disabled={importing} onClick={handleImportSelected}>
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Import {selected.size} people
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
