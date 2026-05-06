"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Save, Check } from "lucide-react";

export function SendPacingForm({
  initialDelayBetweenEmailsSeconds,
  initialMaxEmailsPerDay,
}: {
  initialDelayBetweenEmailsSeconds: number;
  initialMaxEmailsPerDay: number;
}) {
  const [delayBetweenEmailsSeconds, setDelayBetweenEmailsSeconds] = useState(
    String(initialDelayBetweenEmailsSeconds)
  );
  const [maxEmailsPerDay, setMaxEmailsPerDay] = useState(
    String(initialMaxEmailsPerDay)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    const delayValue = Number.parseInt(delayBetweenEmailsSeconds, 10);
    const maxPerDayValue = Number.parseInt(maxEmailsPerDay, 10);

    if (!Number.isInteger(delayValue) || delayValue < 0 || delayValue > 3600) {
      alert("Delay must be an integer between 0 and 3600 seconds.");
      return;
    }

    if (!Number.isInteger(maxPerDayValue) || maxPerDayValue < 1 || maxPerDayValue > 100000) {
      alert("Max emails per day must be an integer between 1 and 100000.");
      return;
    }

    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delayBetweenEmailsSeconds: delayValue,
          maxEmailsPerDay: maxPerDayValue,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        alert(data?.error || "Failed to save send pacing settings");
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert("Failed to save send pacing settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send Pacing</CardTitle>
        <CardDescription>Control sending speed and daily send limits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Delay between emails (seconds)</label>
          <Input
            type="number"
            min={0}
            max={3600}
            value={delayBetweenEmailsSeconds}
            onChange={(e) => setDelayBetweenEmailsSeconds(e.target.value)}
            className="mt-1 w-40"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Applied during bulk sends to warm up and protect deliverability.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium">Max emails per day</label>
          <Input
            type="number"
            min={1}
            max={100000}
            value={maxEmailsPerDay}
            onChange={(e) => setMaxEmailsPerDay(e.target.value)}
            className="mt-1 w-40"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Hard cap enforced before sending a batch.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saved ? "Saved!" : "Save Send Pacing"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
