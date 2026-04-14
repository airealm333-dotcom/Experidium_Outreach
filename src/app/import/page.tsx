"use client";

import { useState, useRef } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";

const FIELD_OPTIONS = [
  { value: "skip", label: "— Skip this column —" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "position", label: "Position / Job Title" },
  { value: "seniority", label: "Seniority" },
  { value: "linkedinUrl", label: "LinkedIn URL" },
  { value: "country", label: "Country" },
  { value: "state", label: "State" },
  { value: "companyName", label: "Company Name" },
  { value: "companyWebsite", label: "Company Website" },
  { value: "companyLinkedin", label: "Company LinkedIn" },
  { value: "companyIndustry", label: "Company Industry" },
  { value: "companyDescription", label: "Company Description" },
  { value: "companySize", label: "Company Size (employees)" },
  { value: "companyCountry", label: "Company Country" },
  { value: "companyState", label: "Company State" },
];

type ImportStep = "upload" | "mapping" | "importing" | "done" | "error";

export default function ImportPage() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    fileRef.current = file;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) return;

      const csvHeaders = parseCSVLine(lines[0]);
      setHeaders(csvHeaders);

      const rows = lines.slice(1, 6).map(parseCSVLine);
      setPreviewRows(rows);

      const autoMap: Record<string, string> = {};
      csvHeaders.forEach((h) => {
        const mapped = autoDetectField(h);
        autoMap[h] = mapped;
      });
      setMappings(autoMap);
      setStep("mapping");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const file = fileRef.current;
    if (!file) {
      setErrorMsg("File reference was lost. Please re-upload your CSV.");
      setStep("error");
      return;
    }

    setStep("importing");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mappings", JSON.stringify(mappings));

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErrorMsg(body?.error || `Server error (${res.status})`);
        setStep("error");
        return;
      }

      const result = await res.json();
      setImportResult(result);
      setStep("done");
    } catch (err) {
      setErrorMsg(String(err));
      setStep("error");
    }
  }

  function resetImport() {
    fileRef.current = null;
    setFileName("");
    setHeaders([]);
    setMappings({});
    setPreviewRows([]);
    setImportResult(null);
    setErrorMsg("");
    setStep("upload");
  }

  return (
    <>
      <PageHeader
        title="Import Contacts"
        description="Upload CSV files from your Apollo exports"
      />

      {step === "upload" && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Supports Apollo.io exports. We&apos;ll auto-detect columns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  CSV files only
                </p>
              </div>
              <Input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {step === "mapping" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Map Columns</CardTitle>
                  <CardDescription>
                    {fileName} — {headers.length} columns detected. Map each to
                    a contact field.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {headers.map((header) => (
                  <div
                    key={header}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="min-w-0 truncate text-sm font-medium sm:w-48 sm:shrink-0">
                      {header}
                    </span>
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
                    <Select
                      value={mappings[header] || "skip"}
                      onValueChange={(val) =>
                        setMappings((prev) => ({ ...prev, [header]: val ?? "skip" }))
                      }
                    >
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {previewRows.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-2">
                    Preview (first 5 rows)
                  </h4>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {headers.map((h) => (
                            <TableHead key={h} className="text-xs">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.map((row, i) => (
                          <TableRow key={i}>
                            {row.map((cell, j) => (
                              <TableCell
                                key={j}
                                className="text-xs max-w-[200px] truncate"
                              >
                                {cell}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <Button className="mt-6" onClick={handleImport}>
                Import Contacts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "importing" && (
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">
              Importing contacts...
            </p>
          </CardContent>
        </Card>
      )}

      {step === "done" && importResult && (
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
            <h3 className="mt-4 text-lg font-semibold">Import Complete</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {importResult.imported} contacts imported, {importResult.skipped}{" "}
              skipped (duplicates or missing email).
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <Button variant="outline" onClick={resetImport}>
                Import More
              </Button>
              <a href="/contacts">
                <Button>View Contacts</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "error" && (
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h3 className="mt-4 text-lg font-semibold text-red-600">Import Failed</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {errorMsg}
            </p>
            <Button className="mt-6" onClick={resetImport}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

const HEADER_MAP: Record<string, string> = {
  "first name": "firstName",
  "firstname": "firstName",
  "first_name": "firstName",
  "last name": "lastName",
  "lastname": "lastName",
  "last_name": "lastName",
  "full name": "firstName",
  "fullname": "firstName",
  "name": "firstName",
  "email": "email",
  "email address": "email",
  "email_address": "email",
  "work email": "email",
  "title": "position",
  "job title": "position",
  "job_title": "position",
  "position": "position",
  "seniority": "seniority",
  "person linkedin url": "linkedinUrl",
  "person linkedin": "linkedinUrl",
  "linkedin url": "linkedinUrl",
  "linkedin": "linkedinUrl",
  "country": "country",
  "state": "state",
  "city": "state",
  "company name": "companyName",
  "company": "companyName",
  "company_name": "companyName",
  "organization name": "companyName",
  "website": "companyWebsite",
  "company website": "companyWebsite",
  "company linkedin url": "companyLinkedin",
  "company linkedin": "companyLinkedin",
  "industry": "companyIndustry",
  "company industry": "companyIndustry",
  "# employees": "companySize",
  "employees": "companySize",
  "company size": "companySize",
  "number of employees": "companySize",
  "company country": "companyCountry",
  "company state": "companyState",
};

function autoDetectField(header: string): string {
  const lower = header.toLowerCase().trim();
  if (HEADER_MAP[lower]) return HEADER_MAP[lower];

  const normalized = lower.replace(/[^a-z0-9]/g, "");
  for (const [key, value] of Object.entries(HEADER_MAP)) {
    if (key.replace(/[^a-z0-9]/g, "") === normalized) return value;
  }

  return "skip";
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
