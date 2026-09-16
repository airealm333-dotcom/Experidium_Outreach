import { Loader2 } from "lucide-react";

export function InlineUpdateMessage({ error, saving }: { error: string; saving: boolean }) {
  if (saving) {
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Updating…
      </p>
    );
  }
  if (error) {
    return <p className="text-xs text-red-600">{error}</p>;
  }
  return null;
}
