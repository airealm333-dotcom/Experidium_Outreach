"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { InlineUpdateMessage } from "@/components/inline-update-message";
import { TEAM_MEMBERS, formatTeamMemberLabel, teamMemberSelectClass } from "@/lib/team-members";

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

export function ContactAuthorSelect({
  contactId,
  value,
}: {
  contactId: string;
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
    const author = next || null;
    const previous = current;
    setCurrent(next);
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author }),
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
    <div className="min-w-[7.5rem] space-y-1">
      <select
        value={current}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className={`h-8 w-full rounded-md border px-2 text-xs disabled:opacity-60 ${teamMemberSelectClass(current)}`}
        aria-label="Assign author"
      >
        <option value="">Unassigned</option>
        {TEAM_MEMBERS.map((author) => (
          <option key={author} value={author}>
            {formatTeamMemberLabel(author)}
          </option>
        ))}
      </select>
      <InlineUpdateMessage error={error} saving={saving} />
    </div>
  );
}
