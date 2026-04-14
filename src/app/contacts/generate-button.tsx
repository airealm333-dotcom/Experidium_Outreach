"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertCircle, CheckCircle } from "lucide-react";

export function GenerateButton({
  contactIds,
  disabled,
  label,
}: {
  contactIds: string[];
  disabled: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error" | "partial";
    message: string;
  } | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus({
          type: "error",
          message: data.error || "Failed to generate emails",
        });
        return;
      }

      if (data.generated === 0) {
        const firstError = data.errors?.[0]?.error || "Unknown error";
        let hint = "All email generations failed.";
        if (firstError.includes("429") || firstError.includes("quota")) {
          hint = "Groq API rate limit exceeded. Wait a minute and try again with fewer contacts.";
                } else if (firstError.includes("API_KEY") || firstError.includes("not configured")) {
                  hint = "Groq API key is missing or invalid. Check Settings.";
        }
        setStatus({ type: "error", message: hint });
        return;
      }

      if (data.failed > 0) {
        setStatus({
          type: "partial",
          message: `${data.generated} drafts created, ${data.failed} failed. Redirecting...`,
        });
      } else {
        setStatus({
          type: "success",
          message: `${data.generated} draft${data.generated > 1 ? "s" : ""} created! Redirecting...`,
        });
      }

      setTimeout(() => router.push("/drafts"), 1500);
    } catch {
      setStatus({
        type: "error",
        message: "Network error — is the server running?",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button size="sm" disabled={disabled || loading} onClick={handleGenerate}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {loading ? "Generating..." : (label ? `${label} (${contactIds.length})` : `Generate Emails (${contactIds.length})`)}
      </Button>

      {status && (
        <div className={`flex items-center gap-1.5 text-xs font-medium ${
          status.type === "success"
            ? "text-green-600"
            : status.type === "partial"
              ? "text-yellow-600"
              : "text-red-600"
        }`}>
          {status.type === "error" ? (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="max-w-xs">{status.message}</span>
        </div>
      )}
    </div>
  );
}
