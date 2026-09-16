"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TEAM_MEMBERS,
  formatTeamMemberLabel,
  teamMemberSelectClass,
} from "@/lib/team-members";

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

export function CampaignAssigneeSelect({
  campaignId,
  value,
}: {
  campaignId: string;
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
    const assignedTo = next || null;
    const previous = current;
    setCurrent(next);
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo }),
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
    <div className="min-w-[8rem] space-y-1">
      <select
        value={current}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className={`h-8 w-full rounded-md border px-2 text-xs disabled:opacity-60 ${teamMemberSelectClass(current)}`}
        aria-label="Assign campaign"
      >
        <option value="">Unassigned</option>
        {TEAM_MEMBERS.map((member) => (
          <option key={member} value={member}>
            {formatTeamMemberLabel(member)}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
