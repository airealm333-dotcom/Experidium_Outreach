"use client";

import { ApolloImportDialog } from "@/components/apollo-import/apollo-import-dialog";

const LINKEDIN_APOLLO_IMPORT_CONFIG = {
  apiPath: "/api/import/apollo/linkedin",
  redirectPath: "/linkedin",
  logTag: "linkedin-apollo-import-ui",
  buttonLabel: "Import from Apollo",
  dialogTitle: "Import from Apollo (LinkedIn)",
  dialogDescription:
    "Search Apollo and import prospects for LinkedIn outreach. Imported contacts are tagged separately from the Contacts page.",
  defaultHasEmailOnly: false,
  linkedinGateNote:
    "Only contacts with a LinkedIn profile URL from Apollo will be imported.",
} as const;

export function LinkedInApolloImportButton() {
  return <ApolloImportDialog config={LINKEDIN_APOLLO_IMPORT_CONFIG} />;
}
