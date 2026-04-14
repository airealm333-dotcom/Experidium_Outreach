"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  XCircle,
  Eye,
  Loader2,
  CheckCheck,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";

interface Draft {
  id: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  contact: { firstName: string; lastName: string; email: string };
}

const statusColors: Record<string, string> = {
  PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  SENT: "bg-blue-100 text-blue-800",
};

async function readApiError(res: Response) {
  try {
    const data = (await res.json()) as { error?: string; details?: string };
    if (data?.error) return data.error;
    if (data?.details) return data.details;
  } catch {
    // ignore parse errors
  }
  return `Request failed (${res.status})`;
}

export function DraftsTable({ drafts }: { drafts: Draft[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  const pendingCount = drafts.filter(
    (d) => d.status === "PENDING_REVIEW"
  ).length;

  async function handleAction(id: string, status: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        alert(await readApiError(res));
        return;
      }
      router.refresh();
    } catch {
      alert("Action failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleBulkApprove() {
    setBulkLoading(true);
    try {
      const res = await fetch("/api/drafts/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (!res.ok) {
        alert(await readApiError(res));
        return;
      }
      router.refresh();
    } catch {
      alert("Bulk approve failed");
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleClearAll() {
    if (!confirm(`Delete all ${drafts.length} drafts? This cannot be undone.`)) return;
    setClearing(true);
    try {
      const res = await fetch("/api/drafts/bulk", { method: "DELETE" });
      if (!res.ok) {
        alert(await readApiError(res));
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to clear drafts");
    } finally {
      setClearing(false);
    }
  }

  async function handleSaveEdit() {
    if (!editDraft) return;
    setLoading(editDraft.id);
    try {
      const res = await fetch(`/api/drafts/${editDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editSubject,
          body: editBody,
          status: "APPROVED",
        }),
      });
      if (!res.ok) {
        alert(await readApiError(res));
        return;
      }
      setEditDraft(null);
      router.refresh();
    } catch {
      alert("Save failed");
    } finally {
      setLoading(null);
    }
  }

  function openEdit(draft: Draft) {
    setEditDraft(draft);
    setEditSubject(draft.subject);
    setEditBody(draft.body);
  }

  return (
    <>
      <div className="mb-4 flex justify-between">
        <Button
          size="sm"
          variant="destructive"
          onClick={handleClearAll}
          disabled={clearing}
        >
          {clearing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Clear All Drafts
        </Button>
        {pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkApprove}
            disabled={bulkLoading}
          >
            {bulkLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 h-4 w-4" />
            )}
            Approve All Pending ({pendingCount})
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contact</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Generated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drafts.map((draft) => (
            <TableRow key={draft.id}>
              <TableCell className="font-medium">
                {draft.contact.firstName} {draft.contact.lastName}
                <br />
                <span className="text-xs text-muted-foreground">
                  {draft.contact.email}
                </span>
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {draft.subject}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={statusColors[draft.status] ?? ""}
                >
                  {draft.status.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {format(new Date(draft.createdAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(draft)}
                    title="View & Edit"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {draft.status === "PENDING_REVIEW" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction(draft.id, "APPROVED")}
                        disabled={loading === draft.id}
                        title="Approve"
                      >
                        {loading === draft.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction(draft.id, "REJECTED")}
                        disabled={loading === draft.id}
                        title="Reject"
                      >
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={!!editDraft}
        onOpenChange={(open) => !open && setEditDraft(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit Draft — {editDraft?.contact.firstName}{" "}
              {editDraft?.contact.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Subject</label>
              <Input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Body</label>
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={10}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditDraft(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={loading === editDraft?.id}>
                {loading === editDraft?.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save & Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
