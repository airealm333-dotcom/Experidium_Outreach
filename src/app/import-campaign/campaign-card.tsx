"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Users, Loader2, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTeamMemberLabel } from "@/lib/team-members";

export interface CampaignSummary {
  id: string;
  name: string;
  description: string | null;
  assignedTo: string | null;
  status: string;
  createdAt: string;
  _count: { companies: number; contacts: number };
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

export function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete campaign "${campaign.name}"? Companies and contacts stay intact.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
      if (!res.ok) {
        alert(await readApiError(res));
        return;
      }
      router.refresh();
    } catch {
      alert("Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="min-w-0 truncate">
            <Link href={`/import-campaign/${campaign.id}`} className="hover:underline">
              {campaign.name}
            </Link>
          </CardTitle>
          {campaign.assignedTo ? (
            <Badge variant="secondary" className="shrink-0">
              {formatTeamMemberLabel(campaign.assignedTo)}
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0">
              Unassigned
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
          {campaign.description || "No description"}
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            {campaign._count.companies} compan{campaign._count.companies === 1 ? "y" : "ies"}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {campaign._count.contacts} contact{campaign._count.contacts === 1 ? "" : "s"}
          </span>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Created {new Date(campaign.createdAt).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-2">
          <Link href={`/import-campaign/${campaign.id}`}>
            <Button variant="outline" size="sm">
              Open
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
