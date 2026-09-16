import { isTeamMember } from "@/lib/team-members";

export type CampaignsUrlParams = {
  q?: string;
  assignedTo?: string;
};

export function parseCampaignAssignee(raw?: string): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  return isTeamMember(raw) ? raw : undefined;
}

export function buildCampaignsHref(params: CampaignsUrlParams): string {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.assignedTo) sp.set("assignedTo", params.assignedTo);
  const qs = sp.toString();
  return qs ? `/import-campaign?${qs}` : "/import-campaign";
}
