"use client";

import { useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";

type RetryResponse = {
  ok: boolean;
  lockedBefore?: number;
  lockedAfter?: number;
  unlocked?: number;
  enrichment?: {
    attempted?: number;
    updated?: number;
    notFound?: number;
    skippedNoEmail?: number;
    conflicts?: unknown[];
    chunkErrors?: { chunkIndex: number; message: string }[];
  };
  error?: string;
};

export function RetryEnrichmentButton({
  lockedCount,
  basePath = "/contacts",
}: {
  lockedCount: number;
  basePath?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleRetry() {
    if (loading) return;
    if (lockedCount === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/enrich/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json().catch(() => null)) as RetryResponse | null;
      if (!res.ok || !data?.ok) {
        const msg = data?.error || `Retry failed (${res.status})`;
        alert(msg);
        return;
      }
      // Hard navigate so /contacts re-renders with fresh server data and the
      // success banner. Soft-routing here can hand back a stale RSC payload.
      const unlocked = data.unlocked ?? 0;
      const url = `${basePath}?retried=${unlocked}`;
      if (typeof window !== "undefined") {
        window.location.assign(url);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleRetry}
      disabled={loading || lockedCount === 0}
      className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-50 dark:hover:bg-amber-800"
      title="Re-run Apollo bulk_match enrichment for every locked contact"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCcw className="h-3.5 w-3.5" />
      )}
      {loading ? "Retrying…" : "Retry enrichment"}
    </button>
  );
}
