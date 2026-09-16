"use client";

import { useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function normalizeTags(values: string[]): string[] {
  return Array.from(
    new Set(values.map((v) => v.trim()).filter(Boolean).slice(0, 100))
  );
}

export function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const normalized = draft.trim();
    if (!normalized) return;
    onChange(normalizeTags([...values, normalized]));
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addDraft();
    }
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <label className="text-base font-semibold">{label}</label>
      <div className="mt-1 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="h-11 text-base"
        />
        <Button type="button" variant="outline" onClick={addDraft} className="h-11 px-4 text-base">
          Add
        </Button>
      </div>
      {values.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 rounded-md border bg-background p-2">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(values.filter((v) => v !== value))}
              className="cursor-pointer"
              title="Remove"
            >
              <Badge variant="secondary" className="h-7 px-3 text-sm">
                {value} ×
              </Badge>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
