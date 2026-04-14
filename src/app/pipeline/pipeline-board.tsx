"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";

interface Deal {
  id: string;
  title: string;
  value: number | null;
  contact: { id: string; firstName: string; lastName: string };
  company: { name: string } | null;
}

interface Stage {
  id: string;
  name: string;
  order: number;
  color: string;
  deals: Deal[];
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  companyId: string | null;
}

export function PipelineBoard({
  stages,
  contacts,
}: {
  stages: Stage[];
  contacts: Contact[];
}) {
  const router = useRouter();
  const [dragDealId, setDragDealId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContactId, setNewContactId] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleDrop(stageId: string) {
    if (!dragDealId) return;
    setDragDealId(null);

    await fetch(`/api/deals/${dragDealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    router.refresh();
  }

  async function handleAddDeal() {
    if (!addingTo || !newTitle || !newContactId) return;
    setSaving(true);

    try {
      await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          contactId: newContactId,
          stageId: addingTo,
          value: newValue || undefined,
        }),
      });
      setAddingTo(null);
      setNewTitle("");
      setNewContactId("");
      setNewValue("");
      router.refresh();
    } catch {
      alert("Failed to create deal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(stage.id)}
          >
            <div className="flex items-center justify-between border-b p-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <h3 className="text-sm font-semibold">{stage.name}</h3>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="secondary">{stage.deals.length}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setAddingTo(stage.id)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="flex-1 space-y-2 p-3 min-h-[200px]">
              {stage.deals.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No deals
                </p>
              ) : (
                stage.deals.map((deal) => (
                  <Card
                    key={deal.id}
                    draggable
                    onDragStart={() => setDragDealId(deal.id)}
                    className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-sm">{deal.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className="text-xs text-muted-foreground">
                        {deal.contact.firstName} {deal.contact.lastName}
                        {deal.company && ` · ${deal.company.name}`}
                      </p>
                      {deal.value && (
                        <p className="mt-1 text-xs font-medium">
                          ${deal.value.toLocaleString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={!!addingTo}
        onOpenChange={(open) => !open && setAddingTo(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add Deal to{" "}
              {stages.find((s) => s.id === addingTo)?.name || "Stage"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Deal Title</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Chatbot project for Acme"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Contact</label>
              <Select value={newContactId} onValueChange={(v) => setNewContactId(v ?? "")}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">
                Value ($, optional)
              </label>
              <Input
                type="number"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="5000"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setAddingTo(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddDeal}
                disabled={saving || !newTitle || !newContactId}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Deal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
