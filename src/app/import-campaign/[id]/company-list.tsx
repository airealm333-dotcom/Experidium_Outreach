"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface CampaignCompanyRow {
  id: string;
  companyId: string;
  name: string;
  website: string | null;
  industry: string | null;
  employeeCount: number | null;
  country: string | null;
}

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

export function CompanyList({
  campaignId,
  companies,
  onPickPeople,
}: {
  campaignId: string;
  companies: CampaignCompanyRow[];
  onPickPeople?: (company: CampaignCompanyRow) => void;
}) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(companyId: string, name: string) {
    if (!confirm(`Remove ${name} from this campaign? The company itself won't be deleted.`)) {
      return;
    }
    setRemovingId(companyId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/companies/${companyId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        alert(await readApiError(res));
        return;
      }
      router.refresh();
    } catch {
      alert("Remove failed");
    } finally {
      setRemovingId(null);
    }
  }

  if (companies.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No companies added yet — search Apollo above to add some.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {companies.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
          <span className="min-w-0 truncate font-medium">{c.name}</span>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            {c.industry && <Badge variant="outline">{c.industry}</Badge>}
            {c.employeeCount != null && <span>{c.employeeCount} employees</span>}
            {c.country && <span>{c.country}</span>}
            {onPickPeople && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => onPickPeople(c)}
              >
                <Users className="mr-1 h-3 w-3" />
                Pick people
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-destructive"
              disabled={removingId === c.companyId}
              onClick={() => handleRemove(c.companyId, c.name)}
              title="Remove from campaign"
            >
              {removingId === c.companyId ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
