"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { InlineUpdateMessage } from "@/components/inline-update-message";
import {
  CONTACT_STATUS_VALUES,
  contactStatusSelectClass,
  parseContactStatus,
} from "@/lib/contact-status";

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

export function ContactStatusSelect({
  contactId,
  value,
}: {
  contactId: string;
  value: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(parseContactStatus(value) ?? "NEW");

  useEffect(() => {
    setCurrent(parseContactStatus(value) ?? "NEW");
    setError("");
  }, [value]);

  async function handleChange(next: string) {
    const previous = current;
    setCurrent(next as typeof current);
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
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
        className={`h-8 w-full rounded-md border px-2 text-xs font-medium disabled:opacity-60 ${contactStatusSelectClass(current)}`}
        aria-label="Update status"
      >
        {CONTACT_STATUS_VALUES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <InlineUpdateMessage error={error} saving={saving} />
    </div>
  );
}
