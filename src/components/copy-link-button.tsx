"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

export function CopyLinkButton({
  url,
  label = "Copy link",
}: {
  url: string | null | undefined;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!url?.trim()) {
    return <span className="text-muted-foreground">—</span>;
  }

  async function handleCopy() {
    const value = url!.trim();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(`Copy this:`, value);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 px-2 text-xs shrink-0"
      onClick={handleCopy}
      title={url}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 shrink-0" />
          {label}
        </>
      )}
    </Button>
  );
}
