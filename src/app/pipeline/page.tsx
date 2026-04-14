import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PipelineBoard } from "./pipeline-board";

interface StageWithDeals {
  id: string;
  name: string;
  order: number;
  color: string;
  deals: {
    id: string;
    title: string;
    value: number | null;
    contact: { id: string; firstName: string; lastName: string };
    company: { name: string } | null;
  }[];
}

export default async function PipelinePage() {
  let stages: StageWithDeals[] = [];
  let contacts: { id: string; firstName: string; lastName: string; companyId: string | null }[] = [];

  try {
    const [rawStages, rawContacts] = await Promise.all([
      prisma.pipelineStage.findMany({
        orderBy: { order: "asc" },
        include: {
          deals: {
            where: { status: "OPEN" },
            include: {
              contact: { select: { id: true, firstName: true, lastName: true } },
              company: { select: { name: true } },
            },
          },
        },
      }),
      prisma.contact.findMany({
        select: { id: true, firstName: true, lastName: true, companyId: true },
        take: 200,
      }),
    ]);
    stages = rawStages as unknown as StageWithDeals[];
    contacts = rawContacts;
  } catch {
    // DB not connected
  }

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Track your deals through each stage"
      />

      {stages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Pipeline stages will appear here once the database is connected and seeded.
            </p>
          </CardContent>
        </Card>
      ) : (
        <PipelineBoard stages={stages} contacts={contacts} />
      )}
    </>
  );
}
