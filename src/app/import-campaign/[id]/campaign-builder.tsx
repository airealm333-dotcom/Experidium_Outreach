"use client";

import { useState } from "react";
import { Building2, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CampaignAssigneeSelect } from "../campaign-assignee-select";
import { CompanySearchPanel } from "./company-search-panel";
import { CompanyList, type CampaignCompanyRow } from "./company-list";
import { ContactList, type CampaignContactRow } from "./contact-list";
import { PeoplePickerDialog } from "./people-picker-dialog";

export interface CampaignDetail {
  id: string;
  name: string;
  assignedTo: string | null;
  companies: CampaignCompanyRow[];
  contacts: CampaignContactRow[];
}

export function CampaignBuilder({ campaign }: { campaign: CampaignDetail }) {
  const [pickingCompany, setPickingCompany] = useState<CampaignCompanyRow | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm">Assignee</CardTitle>
              <CardDescription>Who owns outreach for this campaign.</CardDescription>
            </div>
            <CampaignAssigneeSelect campaignId={campaign.id} value={campaign.assignedTo} />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4" />
            Companies ({campaign.companies.length})
          </CardTitle>
          <CardDescription>
            Search Apollo for companies and add the ones you want to this campaign. Once a
            company is added, pick people at that company to import as contacts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CompanySearchPanel campaignId={campaign.id} />
          <Separator />
          <CompanyList
            campaignId={campaign.id}
            companies={campaign.companies}
            onPickPeople={setPickingCompany}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            Contacts ({campaign.contacts.length})
          </CardTitle>
          <CardDescription>
            People imported from the companies above, via &quot;Pick people&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContactList campaignId={campaign.id} contacts={campaign.contacts} />
        </CardContent>
      </Card>

      <PeoplePickerDialog
        campaignId={campaign.id}
        company={pickingCompany}
        open={pickingCompany !== null}
        onOpenChange={(open) => {
          if (!open) setPickingCompany(null);
        }}
      />
    </div>
  );
}
