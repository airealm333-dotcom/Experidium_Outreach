import { CampaignCard, type CampaignSummary } from "./campaign-card";

export function CampaignsGrid({ campaigns }: { campaigns: CampaignSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  );
}
