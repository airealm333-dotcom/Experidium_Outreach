"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Send,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface DraftItem {
  id: string;
  subject: string;
  contact: { firstName: string; lastName: string; email: string };
}

export function SendActions({ drafts }: { drafts: DraftItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    type: "success" | "error" | "partial";
    message: string;
  } | null>(null);

  const allSelected = drafts.length > 0 && selected.size === drafts.length;
  const someSelected = selected.size > 0 && selected.size < drafts.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(drafts.map((d) => d.id)));
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

  async function sendDrafts(draftIds: string[], label: string) {
    if (
      !confirm(
        `Send ${draftIds.length} email${draftIds.length > 1 ? "s" : ""} from alex@experidium.online? This cannot be undone.`
      )
    ) {
      return;
    }

    setSending(true);
    setStatus(null);

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftIds }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus({ type: "error", message: data.error || "Send failed" });
        return;
      }

      if (data.failed > 0 && data.sent > 0) {
        setStatus({
          type: "partial",
          message: `${data.sent} sent, ${data.failed} failed`,
        });
      } else if (data.sent > 0) {
        setStatus({
          type: "success",
          message: `${data.sent} email${data.sent > 1 ? "s" : ""} sent successfully!`,
        });
      } else {
        setStatus({ type: "error", message: "All sends failed" });
      }

      setSelected(new Set());
      router.refresh();
    } catch {
      setStatus({ type: "error", message: "Network error — is the server running?" });
    } finally {
      setSending(false);
      setSendingId(null);
    }
  }

  async function handleSendOne(draftId: string) {
    setSendingId(draftId);
    await sendDrafts([draftId], "1 email");
  }

  async function handleSendSelected() {
    await sendDrafts(Array.from(selected), `${selected.size} emails`);
  }

  async function handleSendAll() {
    setSelected(new Set(drafts.map((d) => d.id)));
    await sendDrafts(
      drafts.map((d) => d.id),
      `${drafts.length} emails`
    );
  }

  const isBusy = sending;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              Ready to Send
            </CardTitle>
            <CardDescription className="mt-1">
              {drafts.length} approved email{drafts.length !== 1 ? "s" : ""} waiting
            </CardDescription>
          </div>

          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
            {selected.size > 0 && (
              <Button
                size="sm"
                disabled={isBusy}
                onClick={handleSendSelected}
              >
                {sending && !sendingId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Selected ({selected.size})
              </Button>
            )}
            <Button
              size="sm"
              variant={selected.size > 0 ? "outline" : "default"}
              disabled={drafts.length === 0 || isBusy}
              onClick={handleSendAll}
            >
              {sending && !sendingId && selected.size === 0 ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send All ({drafts.length})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        {status && (
          <div
            className={`flex items-center gap-2 mb-4 p-3 rounded-lg border text-sm font-medium ${
              status.type === "success"
                ? "bg-green-50 text-green-700 border-green-200"
                : status.type === "partial"
                  ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                  : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            {status.type === "error" ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle className="h-4 w-4 shrink-0" />
            )}
            {status.message}
          </div>
        )}

        {drafts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No approved emails. Review and approve drafts first.
          </p>
        ) : (
          <>
            {selected.size > 0 && (
              <div className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-muted/50 border">
                <span className="text-sm font-medium">
                  {selected.size} of {drafts.length} selected
                </span>
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
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-24 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((draft) => (
                  <TableRow
                    key={draft.id}
                    className={selected.has(draft.id) ? "bg-muted/40" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(draft.id)}
                        onCheckedChange={() => toggleOne(draft.id)}
                        aria-label={`Select ${draft.contact.firstName}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {draft.contact.firstName} {draft.contact.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {draft.contact.email}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {draft.subject}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => handleSendOne(draft.id)}
                      >
                        {sendingId === draft.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Send
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
