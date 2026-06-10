"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
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

const STATUSES = ["NEW", "QUALIFIED", "CONTACTED", "REPLIED", "BOUNCED", "UNSUBSCRIBED"];
const AUTHOR_UNASSIGNED = "unassigned";

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string | null;
  status: string;
  author?: string | null;
  company: { name: string } | null;
}

export function EditContactDialog({
  contact,
  open,
  onOpenChange,
  linkedinMode = false,
}: {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedinMode?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const statusOptions = linkedinMode ? [...LINKEDIN_STATUS_VALUES] : STATUSES;
  const initialStatus = linkedinMode
    ? (parseLinkedInStatus(contact.status) ?? "NEW")
    : contact.status;
  const [form, setForm] = useState({
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    position: contact.position || "",
    status: initialStatus,
    author: contact.author || "",
  });

  useEffect(() => {
    setForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      position: contact.position || "",
      status: linkedinMode
        ? (parseLinkedInStatus(contact.status) ?? "NEW")
        : contact.status,
      author: contact.author || "",
    });
    setError("");
  }, [contact, linkedinMode]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.firstName.trim() || !form.email.trim()) {
      setError("First name and email are required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          position: form.position.trim() || null,
          status: form.status,
          author: form.author.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string; details?: string };
        const msg = [data.error, data.details].filter(Boolean).join(" — ");
        setError(msg || "Failed to update");
        return;
      }

      onOpenChange(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${contact.firstName} ${contact.lastName}? This cannot be undone.`)) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete");
        return;
      }

      onOpenChange(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription>
            Update contact details for {contact.firstName} {contact.lastName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Position / Job Title</Label>
            <Input
              id="position"
              value={form.position}
              onChange={(e) => update("position", e.target.value)}
              placeholder="e.g. CEO, Marketing Manager"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={(v) => update("status", v ?? form.status)}>
              <SelectTrigger
                className={
                  linkedinMode ? linkedinStatusSelectClass(form.status) : undefined
                }
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {linkedinMode && (LINKEDIN_STATUS_VALUES as readonly string[]).includes(s)
                      ? LINKEDIN_STATUS_LABELS[s as keyof typeof LINKEDIN_STATUS_LABELS]
                      : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">Author</Label>
            <Select
              value={form.author || AUTHOR_UNASSIGNED}
              onValueChange={(v) =>
                update("author", v === AUTHOR_UNASSIGNED ? "" : (v ?? ""))
              }
            >
              <SelectTrigger
                id="author"
                className={linkedinMode ? linkedinAuthorSelectClass(form.author) : undefined}
              >
                <SelectValue placeholder="Select author" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTHOR_UNASSIGNED}>Unassigned</SelectItem>
                {LINKEDIN_AUTHORS.map((author) => (
                  <SelectItem key={author} value={author}>
                    {formatAuthorLabel(author)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={saving}
          >
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
