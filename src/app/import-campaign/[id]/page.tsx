import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { CampaignBuilder } from "./campaign-builder";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      companies: { include: { company: true }, orderBy: { createdAt: "desc" } },
      contacts: {
        include: { contact: { include: { company: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  return (
    <div>
      <Link
        href="/import-campaign"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All campaigns
      </Link>
      <PageHeader
        title={campaign.name}
        description={
          campaign.description ||
          `${campaign.companies.length} companies · ${campaign.contacts.length} contacts`
        }
      />
      <CampaignBuilder
        campaign={{
          id: campaign.id,
          name: campaign.name,
          assignedTo: campaign.assignedTo,
          companies: campaign.companies.map((cc) => ({
            id: cc.id,
            companyId: cc.companyId,
            name: cc.company.name,
            website: cc.company.website,
            industry: cc.company.industry,
            employeeCount: cc.company.employeeCount,
            country: cc.company.country,
          })),
          contacts: campaign.contacts.map((cc) => ({
            id: cc.id,
            contactId: cc.contactId,
            firstName: cc.contact.firstName,
            lastName: cc.contact.lastName,
            email: cc.contact.email,
            linkedinUrl: cc.contact.linkedinUrl,
            position: cc.contact.position,
            status: cc.contact.status,
            author: cc.contact.author,
            companyName: cc.contact.company?.name ?? null,
            companyLinkedinUrl: cc.contact.company?.linkedinUrl ?? null,
          })),
        }}
      />
    </div>
  );
}
