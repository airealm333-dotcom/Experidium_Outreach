"use client";

import { useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";

type ApolloDebugAttempt = {
  page: number;
  variantIndex: number;
  url: string;
  method: "POST";
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseOk: boolean;
  responseStatus: number;
  responseStatusText: string;
  responseText: string;
};

type ApolloEnrichmentSummary =
  | {
      skipped: true;
      reason: string;
    }
  | {
      attempted: number;
      updated: number;
      notFound: number;
      skippedNoEmail: number;
      conflicts: { apolloId: string; email: string; reason: string }[];
      chunkErrors: { chunkIndex: number; message: string; status?: number; responseSnippet?: string }[];
    };

type ApolloImportResponse = {
  imported: number;
  attempted?: number;
  skipped: number;
  skippedDuplicateEmails?: number;
  fetched: number;
  fetchedRawRows?: number;
  fetchedUniqueEmails?: number;
  skippedExistingInDb?: number;
  importedNew?: number;
  skippedNoLinkedin?: number;
  withLinkedinUrl?: number;
  errors?: string[];
  enrichment?: ApolloEnrichmentSummary | null;
  debug?: {
    attempts: ApolloDebugAttempt[];
    notes: string[];
  };
};

export type ApolloImportDialogConfig = {
  apiPath: string;
  redirectPath: string;
  logTag: string;
  buttonLabel?: string;
  dialogTitle: string;
  dialogDescription: string;
  defaultTitles?: string[];
  defaultTechnologies?: string[];
  defaultKeywords?: string[];
  defaultSeniorities?: string[];
  defaultHasEmailOnly?: boolean;
  linkedinGateNote?: string;
};

const DEFAULT_TITLES = [
  "VP Supply Chain",
  "Director of Supply Chain",
  "VP of Operations",
  "Director of Operations",
  "Head of Supply Chain",
  "Supply Chain Director",
  "Chief Operating Officer",
  "COO",
  "Head of Procurement",
  "Procurement Manager",
  "Director of Procurement",
  "VP Procurement",
  "Inventory Manager",
  "Demand Planning Manager",
  "Logistics Manager",
  "IT Director",
  "CTO",
];

const DEFAULT_TECHNOLOGIES = [
  "SAP",
  "SAP ECC",
  "SAP S/4HANA",
  "Oracle",
  "Oracle NetSuite",
  "NetSuite",
  "Microsoft Dynamics",
  "Microsoft Dynamics 365",
  "Epicor",
  "Infor",
  "JD Edwards",
];

const DEFAULT_KEYWORDS = [
  "supply chain",
  "procurement",
  "inventory management",
  "demand planning",
  "logistics",
  "operations management",
  "supplier management",
  "warehouse",
  "distribution",
  "OTIF",
  "S&OP",
  "ERP implementation",
];

const DEFAULT_SENIORITIES = ["vp", "director", "head", "c_suite"];

function normalizeTags(values: string[]): string[] {
  return Array.from(
    new Set(values.map((v) => v.trim()).filter(Boolean).slice(0, 100))
  );
}

function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const normalized = draft.trim();
    if (!normalized) return;
    onChange(normalizeTags([...values, normalized]));
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addDraft();
    }
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <label className="text-base font-semibold">{label}</label>
      <div className="mt-1 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="h-11 text-base"
        />
        <Button type="button" variant="outline" onClick={addDraft} className="h-11 px-4 text-base">
          Add
        </Button>
      </div>
      {values.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 rounded-md border bg-background p-2">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(values.filter((v) => v !== value))}
              className="cursor-pointer"
              title="Remove"
            >
              <Badge variant="secondary" className="h-7 px-3 text-sm">
                {value} ×
              </Badge>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type ImportCompletionSummary = {
  imported: number;
  skippedExisting: number;
  fetched: number;
  uniqueEmails?: number;
  skippedNoLinkedin?: number;
  warnings: string[];
  redirectUrl: string;
};

function ImportSuccessPanel({ summary }: { summary: ImportCompletionSummary }) {
  const stats: { label: string; value: number; highlight?: boolean }[] = [
    { label: "Imported", value: summary.imported, highlight: true },
    { label: "Already in DB", value: summary.skippedExisting },
    { label: "Fetched from Apollo", value: summary.fetched },
    ...(typeof summary.uniqueEmails === "number"
      ? [{ label: "Unique emails", value: summary.uniqueEmails }]
      : []),
    ...(typeof summary.skippedNoLinkedin === "number" && summary.skippedNoLinkedin > 0
      ? [{ label: "Skipped (no LinkedIn URL)", value: summary.skippedNoLinkedin }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-800 dark:bg-emerald-950/40">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="text-base font-semibold text-emerald-950 dark:text-emerald-100">
            Import complete
          </p>
          <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
            {summary.imported > 0
              ? `${summary.imported} new contact${summary.imported === 1 ? "" : "s"} added.`
              : "No new contacts were added — existing records may already be in your database."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border bg-muted/30 px-3 py-3 text-center"
          >
            <p
              className={`text-2xl font-bold tabular-nums ${
                stat.highlight ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
              }`}
            >
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {summary.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Warnings ({summary.warnings.length})
          </div>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-amber-900 dark:text-amber-200">
            {summary.warnings.map((warning, i) => (
              <li key={i} className="leading-snug">
                • {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ApolloImportDialog({ config }: { config: ApolloImportDialogConfig }) {
  const {
    apiPath,
    redirectPath,
    logTag,
    buttonLabel = "Import from Apollo",
    dialogTitle,
    dialogDescription,
    defaultTitles = DEFAULT_TITLES,
    defaultTechnologies = DEFAULT_TECHNOLOGIES,
    defaultKeywords = DEFAULT_KEYWORDS,
    defaultSeniorities = DEFAULT_SENIORITIES,
    defaultHasEmailOnly = true,
    linkedinGateNote,
  } = config;

  const [open, setOpen] = useState(false);
  const [pageLimit, setPageLimit] = useState("3");
  const [perPage, setPerPage] = useState("25");
  const [hasEmailOnly, setHasEmailOnly] = useState(defaultHasEmailOnly);
  const [country, setCountry] = useState("United States");
  const [titles, setTitles] = useState<string[]>(defaultTitles);
  const [technologies, setTechnologies] = useState<string[]>(defaultTechnologies);
  const [keywords, setKeywords] = useState<string[]>(defaultKeywords);
  const [seniorities, setSeniorities] = useState<string[]>(defaultSeniorities);
  const [employeeMin, setEmployeeMin] = useState("50");
  const [employeeMax, setEmployeeMax] = useState("500");
  const [revenueMin, setRevenueMin] = useState("10000000");
  const [revenueMax, setRevenueMax] = useState("100000000");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [lastRequestBody, setLastRequestBody] = useState<unknown | null>(null);
  const [lastImportDebug, setLastImportDebug] = useState<ApolloImportResponse["debug"] | null>(null);
  const [completion, setCompletion] = useState<ImportCompletionSummary | null>(null);

  function parsePagination() {
    const parsedPageLimit = Number.parseInt(pageLimit, 10);
    if (!Number.isInteger(parsedPageLimit) || parsedPageLimit < 1 || parsedPageLimit > 20) {
      alert("Page limit must be an integer between 1 and 20.");
      return null;
    }
    const parsedPerPage = Number.parseInt(perPage, 10);
    if (!Number.isInteger(parsedPerPage) || parsedPerPage < 1 || parsedPerPage > 100) {
      alert("Per page must be an integer between 1 and 100.");
      return null;
    }
    return { parsedPageLimit, parsedPerPage };
  }

  async function postApolloImport(requestBody: unknown, tag: string) {
    console.log(`[${logTag}][${tag}] request payload`, requestBody);
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = (await res.json().catch(() => null)) as
      | ApolloImportResponse
      | { error?: string; details?: string; debug?: ApolloImportResponse["debug"] }
      | null;
    console.log(`[${logTag}][${tag}] response`, {
      status: res.status,
      ok: res.ok,
      data,
    });

    if (!res.ok) {
      setLastImportDebug(data && "debug" in data ? data.debug ?? null : null);
      alert(data && "error" in data ? data.error || "Apollo import failed" : "Apollo import failed");
      return null;
    }

    return data as ApolloImportResponse;
  }

  async function handleImport() {
    const pagination = parsePagination();
    if (!pagination) {
      return;
    }
    const { parsedPageLimit, parsedPerPage } = pagination;
    const parsedEmployeeMin = Number.parseInt(employeeMin, 10);
    const parsedEmployeeMax = Number.parseInt(employeeMax, 10);
    const parsedRevenueMin = Number.parseInt(revenueMin, 10);
    const parsedRevenueMax = Number.parseInt(revenueMax, 10);
    if (
      !Number.isInteger(parsedEmployeeMin) ||
      !Number.isInteger(parsedEmployeeMax) ||
      parsedEmployeeMin < 1 ||
      parsedEmployeeMax < parsedEmployeeMin
    ) {
      alert("Employee range is invalid.");
      return;
    }
    if (
      !Number.isInteger(parsedRevenueMin) ||
      !Number.isInteger(parsedRevenueMax) ||
      parsedRevenueMin < 0 ||
      parsedRevenueMax < parsedRevenueMin
    ) {
      alert("Revenue range is invalid.");
      return;
    }

    setLoading(true);
    setResult(null);
    setLastImportDebug(null);
    setLastRequestBody(null);

    try {
      const requestBody = {
        pageLimit: parsedPageLimit,
        perPage: parsedPerPage,
        hasEmailOnly,
        filters: {
          titles: normalizeTags(titles),
          technologies: normalizeTags(technologies),
          keywords: normalizeTags(keywords),
          countries: normalizeTags([country]),
          seniorities: normalizeTags(seniorities),
          employeeMin: parsedEmployeeMin,
          employeeMax: parsedEmployeeMax,
          revenueMin: parsedRevenueMin,
          revenueMax: parsedRevenueMax,
        },
      };
      setLastRequestBody(requestBody);
      const payload = await postApolloImport(requestBody, "full");
      if (!payload) return;
      setLastImportDebug(payload.debug ?? null);
      const raw = payload.fetchedRawRows ?? payload.fetched;
      const unique = payload.fetchedUniqueEmails;
      const skippedDb = payload.skippedExistingInDb ?? payload.skipped;
      const summaryParts = [
        `Imported ${payload.imported}`,
        `skipped(existing in DB) ${skippedDb}`,
        `fetched(raw rows) ${raw}`,
      ];
      if (typeof payload.attempted === "number" && payload.attempted !== payload.imported) {
        summaryParts.push(`attempted ${payload.attempted}`);
      }
      if (typeof payload.skippedDuplicateEmails === "number" && payload.skippedDuplicateEmails > 0) {
        summaryParts.push(`skipped(duplicate email) ${payload.skippedDuplicateEmails}`);
      }
      if (typeof unique === "number") {
        summaryParts.push(`unique emails ${unique}`);
      }
      const summary = `${summaryParts.join(", ")}.`;
      setResult(summary);
      const imported = payload.imported ?? 0;
      const nextUrl = imported > 0 ? `${redirectPath}?imported=${imported}` : redirectPath;
      setCompletion({
        imported,
        skippedExisting: skippedDb,
        fetched: raw,
        uniqueEmails: unique,
        skippedNoLinkedin: payload.skippedNoLinkedin,
        warnings: payload.errors ?? [],
        redirectUrl: nextUrl,
      });
    } catch {
      alert("Apollo import failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean, eventDetails?: { reason?: string }) {
    if (!nextOpen) {
      const reason = eventDetails?.reason;
      if (
        reason === "outside-press" ||
        reason === "escape-key" ||
        reason === "focus-out"
      ) {
        return;
      }
    }
    if (nextOpen) {
      setCompletion(null);
      setResult(null);
    }
    setOpen(nextOpen);
  }

  function handleContinueAfterImport() {
    if (completion?.redirectUrl && typeof window !== "undefined") {
      window.location.assign(completion.redirectUrl);
    }
  }

  const continueLabel =
    redirectPath === "/linkedin" ? "View LinkedIn prospects" : "View contacts";

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        <Upload className="mr-2 h-4 w-4" />
        {buttonLabel}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] w-[min(1200px,95vw)] max-w-[min(1200px,95vw)] sm:!max-w-[min(1200px,95vw)] overflow-y-auto text-base">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {completion ? "Import results" : dialogTitle}
            </DialogTitle>
            <DialogDescription className="text-base">
              {completion
                ? "Review the summary below, then continue to your list."
                : dialogDescription}
            </DialogDescription>
          </DialogHeader>

          {completion ? (
            <ImportSuccessPanel summary={completion} />
          ) : (
          <div className="space-y-5">
            <div className="rounded-lg border bg-muted/20 p-4">
              <h3 className="text-base font-semibold">People Filters</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add or remove tags to refine who gets imported.
              </p>
              {linkedinGateNote ? (
                <p className="mt-2 text-sm font-medium text-sky-900 dark:text-sky-100">
                  {linkedinGateNote}
                </p>
              ) : null}
            </div>

            <TagInput
              label="Job titles"
              values={titles}
              onChange={setTitles}
              placeholder="Type title and press Enter"
            />
            <TagInput
              label="Technologies"
              values={technologies}
              onChange={setTechnologies}
              placeholder="Type technology and press Enter"
            />
            <TagInput
              label="Keywords"
              values={keywords}
              onChange={setKeywords}
              placeholder="Type keyword and press Enter"
            />
            <TagInput
              label="Seniorities"
              values={seniorities}
              onChange={setSeniorities}
              placeholder="Type seniority and press Enter"
            />
            <div className="rounded-lg border bg-muted/20 p-4">
              <label className="text-base font-semibold">Country</label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1 h-11 text-base"
              />
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <h3 className="text-base font-semibold">Company Size and Revenue</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-base font-medium">Employee min</label>
                  <Input
                    type="number"
                    min={1}
                    value={employeeMin}
                    onChange={(e) => setEmployeeMin(e.target.value)}
                    className="mt-1 h-11 text-base"
                  />
                </div>
                <div>
                  <label className="text-base font-medium">Employee max</label>
                  <Input
                    type="number"
                    min={1}
                    value={employeeMax}
                    onChange={(e) => setEmployeeMax(e.target.value)}
                    className="mt-1 h-11 text-base"
                  />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-base font-medium">Revenue min (USD)</label>
                  <Input
                    type="number"
                    min={0}
                    value={revenueMin}
                    onChange={(e) => setRevenueMin(e.target.value)}
                    className="mt-1 h-11 text-base"
                  />
                </div>
                <div>
                  <label className="text-base font-medium">Revenue max (USD)</label>
                  <Input
                    type="number"
                    min={0}
                    value={revenueMax}
                    onChange={(e) => setRevenueMax(e.target.value)}
                    className="mt-1 h-11 text-base"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <h3 className="text-base font-semibold">Fetch Options</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-base font-medium">Page limit (1-20)</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={pageLimit}
                    onChange={(e) => setPageLimit(e.target.value)}
                    className="mt-1 h-11 text-base"
                  />
                </div>
                <div>
                  <label className="text-base font-medium">Per page (1-100)</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={perPage}
                    onChange={(e) => setPerPage(e.target.value)}
                    className="mt-1 h-11 text-base"
                  />
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-base font-medium">
                <input
                  type="checkbox"
                  checked={hasEmailOnly}
                  onChange={(e) => setHasEmailOnly(e.target.checked)}
                />
                Has email only
              </label>
            </div>
            {result && <p className="text-base text-muted-foreground">{result}</p>}
            <div className="rounded-lg border bg-muted/20 p-4">
              <h3 className="text-base font-semibold">Apollo debug (always on)</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Shows the outbound Apollo HTTP request payload and truncated raw response text returned by this import run.
              </p>
              <pre className="mt-3 max-h-[360px] overflow-auto rounded-md border bg-background p-3 text-xs leading-relaxed whitespace-pre-wrap break-words">
                {JSON.stringify(
                  {
                    localApi: {
                      method: "POST",
                      url: apiPath,
                      body: lastRequestBody,
                    },
                    apollo: lastImportDebug,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
          )}

          <DialogFooter>
            {completion ? (
              <Button onClick={handleContinueAfterImport} className="h-11 px-4 text-base">
                {continueLabel}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={loading}
                  className="h-11 px-4 text-base"
                >
                  Close
                </Button>
                <Button onClick={handleImport} disabled={loading} className="h-11 px-4 text-base">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Import
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
