"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil } from "lucide-react";
import { GenerateButton } from "./generate-button";
import { EditContactDialog } from "./edit-contact-dialog";

const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  QUALIFIED: "bg-green-100 text-green-800",
  CONTACTED: "bg-yellow-100 text-yellow-800",
  REPLIED: "bg-purple-100 text-purple-800",
  BOUNCED: "bg-red-100 text-red-800",
  UNSUBSCRIBED: "bg-gray-100 text-gray-800",
};

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string | null;
  status: string;
  company: { name: string } | null;
}

export function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const allSelected = contacts.length > 0 && selected.size === contacts.length;
  const someSelected = selected.size > 0 && selected.size < contacts.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = Array.from(selected);

  return (
    <>
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/50 border">
          <span className="text-sm font-medium">
            {selected.size} contact{selected.size > 1 ? "s" : ""} selected
          </span>
          <GenerateButton contactIds={selectedIds} disabled={false} />
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected || someSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow
              key={contact.id}
              className={selected.has(contact.id) ? "bg-muted/40" : ""}
            >
              <TableCell>
                <Checkbox
                  checked={selected.has(contact.id)}
                  onCheckedChange={() => toggleOne(contact.id)}
                  aria-label={`Select ${contact.firstName}`}
                />
              </TableCell>
              <TableCell className="font-medium">
                <Link
                  href={`/contacts/${contact.id}`}
                  className="hover:underline"
                >
                  {contact.firstName} {contact.lastName}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {contact.email}
              </TableCell>
              <TableCell>{contact.company?.name ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {contact.position ?? "—"}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={statusColors[contact.status] ?? ""}
                >
                  {contact.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditingContact(contact)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingContact && (
        <EditContactDialog
          contact={editingContact}
          open={!!editingContact}
          onOpenChange={(open) => {
            if (!open) setEditingContact(null);
          }}
        />
      )}
    </>
  );
}
