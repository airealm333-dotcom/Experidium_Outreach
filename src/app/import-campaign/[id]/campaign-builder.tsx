"use client";

import { useState } from "react";
import { Building2, UserSearch, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const [pickerOpen, setPickerOpen] = useState(false);

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
          <CompanyList campaignId={campaign.id} companies={campaign.companies} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                Contacts ({campaign.contacts.length})
              </CardTitle>
              <CardDescription>
                People imported from the companies above, via &quot;Pick people&quot;.
              </CardDescription>
            </div>
            <Button
              size="sm"
              disabled={campaign.companies.length === 0}
              title={
                campaign.companies.length === 0
                  ? "Add at least one company first"
                  : undefined
              }
              onClick={() => setPickerOpen(true)}
            >
              <UserSearch className="mr-2 h-4 w-4" />
              Pick people
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ContactList campaignId={campaign.id} contacts={campaign.contacts} />
        </CardContent>
      </Card>

      <PeoplePickerDialog
        campaignId={campaign.id}
        companies={campaign.companies.map((c) => ({ companyId: c.companyId, name: c.name }))}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </div>
  );
}
