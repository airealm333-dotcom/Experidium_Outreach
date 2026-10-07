"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResizableTableHead, columnStyle } from "@/components/resizable-table-head";
import { CopyLinkButton } from "@/components/copy-link-button";
import { ContactAuthorSelect } from "@/components/contact-author-select";
import { ContactStatusSelect } from "@/components/contact-status-select";
import { EditContactDialog } from "@/app/contacts/edit-contact-dialog";

export interface CampaignContactRow {
  id: string;
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
  linkedinUrl: string | null;
  position: string | null;
  status: string;
  author: string | null;
  companyName: string | null;
  companyLinkedinUrl: string | null;
}

const DEFAULT_COLUMN_WIDTHS = {
  slNo: 56,
  name: 140,
  email: 240,
  linkedin: 120,
  company: 160,
  companyLinkedin: 120,
  jobTitle: 180,
  author: 150,
  status: 120,
  actions: 88,
} as const;

type ColumnKey = keyof typeof DEFAULT_COLUMN_WIDTHS;

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

export function ContactList({
  campaignId,
  contacts,
}: {
  campaignId: string;
  contacts: CampaignContactRow[];
}) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<CampaignContactRow | null>(null);
  const [companyFilter, setCompanyFilter] = useState("");
  const [jobTitleFilter, setJobTitleFilter] = useState("");
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>({
    ...DEFAULT_COLUMN_WIDTHS,
  });

  function setColumnWidth(key: ColumnKey, width: number) {
    setColumnWidths((prev) => ({ ...prev, [key]: width }));
  }

  const companyOptions = Array.from(
    new Set(contacts.map((c) => c.companyName).filter((name): name is string => Boolean(name)))
  ).sort((a, b) => a.localeCompare(b));

  const jobTitleOptions = Array.from(
    new Set(contacts.map((c) => c.position).filter((title): title is string => Boolean(title)))
  ).sort((a, b) => a.localeCompare(b));

  const filteredContacts = contacts
    .filter((c) => !companyFilter || c.companyName === companyFilter)
    .filter((c) => !jobTitleFilter || c.position === jobTitleFilter);

  async function handleRemove(contactId: string, name: string) {
    if (!confirm(`Remove ${name} from this campaign? The contact itself won't be deleted.`)) {
      return;
    }
    setRemovingId(contactId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/people/${contactId}`, {
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

  if (contacts.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No contacts imported yet — pick people from a company above.
      </p>
    );
  }

  const tableMinWidth = Object.values(columnWidths).reduce((sum, w) => sum + w, 0);

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border/70">
        <Table
          className="table-fixed [&_th]:border-r [&_th]:border-border/50 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-border/50 [&_td:last-child]:border-r-0"
          style={{ minWidth: tableMinWidth }}
        >
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
              <ResizableTableHead
                width={columnWidths.slNo}
                onResize={(w) => setColumnWidth("slNo", w)}
                className="text-center"
                minWidth={44}
              >
                Sl No
              </ResizableTableHead>
              <ResizableTableHead
                width={columnWidths.name}
                onResize={(w) => setColumnWidth("name", w)}
              >
                Name
              </ResizableTableHead>
              <ResizableTableHead
                width={columnWidths.email}
                onResize={(w) => setColumnWidth("email", w)}
                minWidth={140}
              >
                Email
              </ResizableTableHead>
              <ResizableTableHead
                width={columnWidths.linkedin}
                onResize={(w) => setColumnWidth("linkedin", w)}
              >
                LinkedIn
              </ResizableTableHead>
              <ResizableTableHead
                width={columnWidths.company}
                onResize={(w) => setColumnWidth("company", w)}
              >
                Company
              </ResizableTableHead>
              <ResizableTableHead
                width={columnWidths.companyLinkedin}
                onResize={(w) => setColumnWidth("companyLinkedin", w)}
              >
                Company LinkedIn
              </ResizableTableHead>
              <ResizableTableHead
                width={columnWidths.jobTitle}
                onResize={(w) => setColumnWidth("jobTitle", w)}
              >
                Job Title
              </ResizableTableHead>
              <ResizableTableHead
                width={columnWidths.author}
                onResize={(w) => setColumnWidth("author", w)}
              >
                Outreach Assigned
              </ResizableTableHead>
              <ResizableTableHead
                width={columnWidths.status}
                onResize={(w) => setColumnWidth("status", w)}
              >
                Status
              </ResizableTableHead>
              <ResizableTableHead
                width={columnWidths.actions}
                resizable={false}
                className="w-20"
              />
            </TableRow>
            <TableRow className="border-border/60 bg-muted/10 hover:bg-muted/10">
              <ResizableTableHead width={columnWidths.slNo} resizable={false} />
              <ResizableTableHead width={columnWidths.name} resizable={false} />
              <ResizableTableHead width={columnWidths.email} resizable={false} />
              <ResizableTableHead width={columnWidths.linkedin} resizable={false} />
              <ResizableTableHead width={columnWidths.company} resizable={false} className="py-1.5">
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="h-7 w-full rounded-md border border-input bg-background px-1.5 text-xs font-normal"
                  aria-label="Filter by company"
                >
                  <option value="">All companies</option>
                  {companyOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </ResizableTableHead>
              <ResizableTableHead width={columnWidths.companyLinkedin} resizable={false} />
              <ResizableTableHead width={columnWidths.jobTitle} resizable={false} className="py-1.5">
                <select
                  value={jobTitleFilter}
                  onChange={(e) => setJobTitleFilter(e.target.value)}
                  className="h-7 w-full rounded-md border border-input bg-background px-1.5 text-xs font-normal"
                  aria-label="Filter by job title"
                >
                  <option value="">All job titles</option>
                  {jobTitleOptions.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
              </ResizableTableHead>
              <ResizableTableHead width={columnWidths.author} resizable={false} />
              <ResizableTableHead width={columnWidths.status} resizable={false} />
              <ResizableTableHead width={columnWidths.actions} resizable={false} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-6 text-center text-sm text-muted-foreground">
                  No contacts match this filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((c, index) => (
                <TableRow key={c.id} className="border-border/50">
                  <TableCell
                    className="text-center tabular-nums text-muted-foreground"
                    style={columnStyle(columnWidths.slNo)}
                  >
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium overflow-hidden" style={columnStyle(columnWidths.name)}>
                    <Link
                      href={`/contacts/${c.contactId}`}
                      className="block truncate hover:underline"
                      title={`${c.firstName} ${c.lastName}`}
                    >
                      {c.firstName} {c.lastName}
                    </Link>
                  </TableCell>
                  <TableCell className="overflow-hidden" style={columnStyle(columnWidths.email)}>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate text-muted-foreground" title={c.email}>
                        {c.email}
                      </span>
                      <CopyLinkButton url={c.email} label="Copy" />
                    </div>
                  </TableCell>
                  <TableCell className="overflow-hidden" style={columnStyle(columnWidths.linkedin)}>
                    <CopyLinkButton url={c.linkedinUrl} />
                  </TableCell>
                  <TableCell className="overflow-hidden" style={columnStyle(columnWidths.company)}>
                    <span className="block truncate" title={c.companyName ?? undefined}>
                      {c.companyName ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell
                    className="overflow-hidden"
                    style={columnStyle(columnWidths.companyLinkedin)}
                  >
                    <CopyLinkButton url={c.companyLinkedinUrl} />
                  </TableCell>
                  <TableCell
                    className="overflow-hidden text-muted-foreground"
                    style={columnStyle(columnWidths.jobTitle)}
                  >
                    <span className="block truncate" title={c.position ?? undefined}>
                      {c.position ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="overflow-hidden" style={columnStyle(columnWidths.author)}>
                    <ContactAuthorSelect contactId={c.contactId} value={c.author} />
                  </TableCell>
                  <TableCell className="overflow-hidden" style={columnStyle(columnWidths.status)}>
                    <ContactStatusSelect contactId={c.contactId} value={c.status} />
                  </TableCell>
                  <TableCell style={columnStyle(columnWidths.actions)}>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingContact(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        disabled={removingId === c.contactId}
                        onClick={() => handleRemove(c.contactId, `${c.firstName} ${c.lastName}`)}
                        title="Remove from campaign"
                      >
                        {removingId === c.contactId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingContact && (
        <EditContactDialog
          contact={{
            id: editingContact.contactId,
            firstName: editingContact.firstName,
            lastName: editingContact.lastName,
            email: editingContact.email,
            position: editingContact.position,
            status: editingContact.status,
            author: editingContact.author,
            company: editingContact.companyName ? { name: editingContact.companyName } : null,
          }}
          open={!!editingContact}
          onOpenChange={(open) => {
            if (!open) setEditingContact(null);
          }}
        />
      )}
    </>
  );
}
