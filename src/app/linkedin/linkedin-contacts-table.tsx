"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import { EditContactDialog } from "../contacts/edit-contact-dialog";
import {
  LINKEDIN_AUTHORS,
  formatAuthorLabel,
  linkedinAuthorSelectClass,
} from "@/lib/linkedin-authors";
import {
  LINKEDIN_STATUS_LABELS,
  LINKEDIN_STATUS_VALUES,
  linkedinStatusSelectClass,
  parseLinkedInStatus,
} from "@/lib/linkedin-status";
import { LINKEDIN_BASE_PATH } from "./linkedin-url";

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

interface LinkedInContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  linkedinUrl: string | null;
  position: string | null;
  status: string;
  author: string | null;
  company: { name: string; linkedinUrl: string | null } | null;
}

function InlineUpdateMessage({ error, saving }: { error: string; saving: boolean }) {
  if (saving) {
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Updating…
      </p>
    );
  }
  if (error) {
    return <p className="text-xs text-red-600">{error}</p>;
  }
  return null;
}

function CopyLinkButton({ url }: { url: string | null | undefined }) {
  const [copied, setCopied] = useState(false);

  if (!url?.trim()) {
    return <span className="text-muted-foreground">—</span>;
  }

  async function handleCopy() {
    const link = url!.trim();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", link);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 px-2 text-xs"
      onClick={handleCopy}
      title={url}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 shrink-0" />
          Copy link
        </>
      )}
    </Button>
  );
}

function AuthorSelect({
  contactId,
  value,
}: {
  contactId: string;
  value: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(value ?? "");

  useEffect(() => {
    setCurrent(value ?? "");
    setError("");
  }, [value]);

  async function handleChange(next: string) {
    const author = next || null;
    const previous = current;
    setCurrent(next);
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author }),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        setCurrent(previous);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setCurrent(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-[7.5rem] space-y-1">
      <select
        value={current}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className={`h-8 w-full rounded-md border px-2 text-xs disabled:opacity-60 ${linkedinAuthorSelectClass(current)}`}
        aria-label="Assign author"
      >
        <option value="">Unassigned</option>
        {LINKEDIN_AUTHORS.map((author) => (
          <option key={author} value={author}>
            {formatAuthorLabel(author)}
          </option>
        ))}
      </select>
      <InlineUpdateMessage error={error} saving={saving} />
    </div>
  );
}

function StatusSelect({
  contactId,
  value,
}: {
  contactId: string;
  value: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const normalized = parseLinkedInStatus(value) ?? "NEW";
  const [current, setCurrent] = useState(normalized);

  useEffect(() => {
    setCurrent(parseLinkedInStatus(value) ?? "NEW");
    setError("");
  }, [value]);

  async function handleChange(next: string) {
    const previous = current;
    setCurrent(next as typeof current);
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        setCurrent(previous);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setCurrent(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-[6.5rem] space-y-1">
      <select
        value={current}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className={`h-8 w-full rounded-md border px-2 text-xs font-medium disabled:opacity-60 ${linkedinStatusSelectClass(current)}`}
        aria-label="Update status"
      >
        {LINKEDIN_STATUS_VALUES.map((status) => (
          <option key={status} value={status}>
            {LINKEDIN_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <InlineUpdateMessage error={error} saving={saving} />
    </div>
  );
}

export function LinkedInContactsTable({
  contacts,
  page = 1,
  pageSize = 20,
}: {
  contacts: LinkedInContact[];
  page?: number;
  pageSize?: number;
}) {
  const router = useRouter();
  const [editingContact, setEditingContact] = useState<LinkedInContact | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? Related drafts and activities will be removed.`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert(await readApiError(res));
        return;
      }
      router.refresh();
    } catch {
      alert("Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border/70">
        <Table className="[&_th]:border-r [&_th]:border-border/50 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-border/50 [&_td:last-child]:border-r-0">
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-12 text-center">Sl No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>LinkedIn</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Company LinkedIn</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact, index) => (
              <TableRow key={contact.id} className="border-border/50">
                <TableCell className="w-12 text-center tabular-nums text-muted-foreground">
                  {(page - 1) * pageSize + index + 1}
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`${LINKEDIN_BASE_PATH}/${contact.id}`} className="hover:underline">
                    {contact.firstName} {contact.lastName}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[10rem]">
                  <CopyLinkButton url={contact.linkedinUrl} />
                </TableCell>
                <TableCell>{contact.company?.name ?? "—"}</TableCell>
                <TableCell className="max-w-[10rem]">
                  <CopyLinkButton url={contact.company?.linkedinUrl} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.position ?? "—"}
                </TableCell>
                <TableCell>
                  <AuthorSelect contactId={contact.id} value={contact.author} />
                </TableCell>
                <TableCell>
                  <StatusSelect contactId={contact.id} value={contact.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingContact(contact)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      disabled={deletingId === contact.id}
                      onClick={() =>
                        handleDelete(
                          contact.id,
                          `${contact.firstName} ${contact.lastName}`
                        )
                      }
                    >
                      {deletingId === contact.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingContact && (
        <EditContactDialog
          contact={editingContact}
          open={!!editingContact}
          linkedinMode
          onOpenChange={(open) => {
            if (!open) setEditingContact(null);
          }}
        />
      )}
    </>
  );
}
