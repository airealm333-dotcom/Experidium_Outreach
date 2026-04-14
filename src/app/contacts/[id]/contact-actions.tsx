"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles, StickyNote, ListTodo, Loader2 } from "lucide-react";

export function ContactActions({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [activeForm, setActiveForm] = useState<"note" | "task" | null>(null);
  const [generating, setGenerating] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleGenerateEmail() {
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: [contactId] }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to generate email");
        return;
      }
      router.push("/drafts");
    } catch {
      alert("Failed to generate email");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveActivity(type: "NOTE" | "TASK") {
    setSaving(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          type,
          subject,
          body,
          dueDate: dueDate || undefined,
        }),
      });
      if (!res.ok) {
        alert("Failed to save");
        return;
      }
      setSubject("");
      setBody("");
      setDueDate("");
      setActiveForm(null);
      router.refresh();
    } catch {
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={handleGenerateEmail}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate Email
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveForm(activeForm === "note" ? null : "note")}
          >
            <StickyNote className="mr-2 h-4 w-4" />
            Add Note
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveForm(activeForm === "task" ? null : "task")}
          >
            <ListTodo className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>

        {activeForm && (
          <div className="mt-4 space-y-3 rounded-lg border p-4">
            <Input
              placeholder={activeForm === "note" ? "Note title" : "Task title"}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <Textarea
              placeholder={
                activeForm === "note"
                  ? "Write your note..."
                  : "Task description..."
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
            {activeForm === "task" && (
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  handleSaveActivity(activeForm === "note" ? "NOTE" : "TASK")
                }
                disabled={saving || !subject.trim()}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save {activeForm === "note" ? "Note" : "Task"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveForm(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
