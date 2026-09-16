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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c, index) => (
              <TableRow key={c.id} className="border-border/50">
                <TableCell className="w-12 text-center tabular-nums text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/contacts/${c.contactId}`} className="hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[10rem]">
                  <CopyLinkButton url={c.linkedinUrl} />
                </TableCell>
                <TableCell>{c.companyName ?? "—"}</TableCell>
                <TableCell className="max-w-[10rem]">
                  <CopyLinkButton url={c.companyLinkedinUrl} />
                </TableCell>
                <TableCell className="text-muted-foreground">{c.position ?? "—"}</TableCell>
                <TableCell>
                  <ContactAuthorSelect contactId={c.contactId} value={c.author} />
                </TableCell>
                <TableCell>
                  <ContactStatusSelect contactId={c.contactId} value={c.status} />
                </TableCell>
                <TableCell>
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
            ))}
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
