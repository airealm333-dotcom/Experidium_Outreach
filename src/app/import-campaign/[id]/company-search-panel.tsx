"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { TagInput } from "@/components/apollo-import/tag-input";
import { MultiSelect } from "@/components/ui/multi-select";
import { COUNTRIES } from "@/lib/countries";

interface ApolloCompanyResult {
  apolloOrgId: string;
  name: string;
  website: string | null;
  domain: string | null;
  linkedinUrl: string | null;
  industry: string | null;
  description: string | null;
  employeeCount: number | null;
  country: string | null;
  state: string | null;
  alreadyInCampaign: boolean;
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

export function CompanySearchPanel({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [employeeMin, setEmployeeMin] = useState("");
  const [employeeMax, setEmployeeMax] = useState("");

  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ApolloCompanyResult[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const selectable = (results ?? []).filter((c) => !c.alreadyInCampaign);
  const allSelected = selectable.length > 0 && selected.size === selectable.length;
  const someSelected = selected.size > 0 && selected.size < selectable.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectable.map((c) => c.apolloOrgId)));
    }
  }

  function toggleOne(apolloOrgId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(apolloOrgId)) next.delete(apolloOrgId);
      else next.add(apolloOrgId);
      return next;
    });
  }

  async function handleSearch() {
    const parsedMin = employeeMin ? Number.parseInt(employeeMin, 10) : undefined;
    const parsedMax = employeeMax ? Number.parseInt(employeeMax, 10) : undefined;

    if (keywords.length === 0 && locations.length === 0) {
      setError("Add at least one keyword or location to search.");
      return;
    }

    setSearching(true);
    setError("");
    setSelected(new Set());
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/companies/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            keywords,
            locations,
            employeeMin: parsedMin,
            employeeMax: parsedMax,
          },
        }),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        setResults(null);
        return;
      }
      const data = (await res.json()) as { companies: ApolloCompanyResult[] };
      setResults(data.companies);
    } catch {
      setError("Network error");
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  async function handleAddSelected() {
    if (!results) return;
    const chosen = results.filter((c) => selected.has(c.apolloOrgId));
    if (chosen.length === 0) return;

    setAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies: chosen,
          searchCriteria: { keywords, locations, employeeMin, employeeMax },
        }),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      setResults((prev) =>
        prev
          ? prev.map((c) =>
              selected.has(c.apolloOrgId) ? { ...c, alreadyInCampaign: true } : c
            )
          : prev
      );
      setSelected(new Set());
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TagInput
          label="Keywords"
          values={keywords}
          onChange={setKeywords}
          placeholder="e.g. fintech, consulting, mining"
        />
        <MultiSelect
          label="Locations (countries)"
          options={COUNTRIES}
          values={locations}
          onChange={setLocations}
          placeholder="Search countries..."
        />
        <div className="rounded-lg border bg-muted/20 p-4">
          <label className="text-base font-semibold">Employee count</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input
              type="number"
              min={0}
              placeholder="Min"
              value={employeeMin}
              onChange={(e) => setEmployeeMin(e.target.value)}
            />
            <Input
              type="number"
              min={0}
              placeholder="Max"
              value={employeeMax}
              onChange={(e) => setEmployeeMax(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="button" onClick={handleSearch} disabled={searching}>
        {searching ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Search className="mr-2 h-4 w-4" />
        )}
        Search Apollo
      </Button>

      {results !== null && (
        <div className="space-y-3">
          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No companies matched. Try broader keywords or locations.
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
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((c) => (
                    <TableRow key={c.apolloOrgId}>
                      <TableCell>
                        <Checkbox
                          checked={c.alreadyInCampaign || selected.has(c.apolloOrgId)}
                          disabled={c.alreadyInCampaign}
                          onCheckedChange={() => toggleOne(c.apolloOrgId)}
                          aria-label={`Select ${c.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {c.name}
                          {c.alreadyInCampaign && (
                            <Badge variant="secondary" className="shrink-0">
                              Added
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.industry ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.employeeCount ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {[c.country, c.state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {selected.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
              <span className="text-sm font-medium">
                {selected.size} compan{selected.size === 1 ? "y" : "ies"} selected
              </span>
              <Button type="button" size="sm" disabled={adding} onClick={handleAddSelected}>
                {adding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Add to campaign
              </Button>
              <button
                onClick={() => setSelected(new Set())}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
