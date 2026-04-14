"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Save, Check } from "lucide-react";

export function SettingsForm({ initialPrompt }: { initialPrompt: string }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptTemplate: prompt }),
      });

      if (!res.ok) {
        alert("Failed to save");
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Prompt Template</CardTitle>
        <CardDescription>
          The prompt sent to the AI model for generating cold emails. Use{" "}
          {"{{placeholders}}"} for contact data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={18}
          className="font-mono text-sm"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saved ? "Saved!" : "Save Template"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Variables: {"{{firstName}}"}, {"{{lastName}}"},{" "}
            {"{{companyName}}"}, {"{{position}}"},{" "}
            {"{{companyIndustry}}"}, {"{{companySize}}"},{" "}
            {"{{companyDescription}}"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
