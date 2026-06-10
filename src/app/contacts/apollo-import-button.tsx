"use client";

import { ApolloImportDialog } from "@/components/apollo-import/apollo-import-dialog";

const CONTACTS_APOLLO_IMPORT_CONFIG = {
  apiPath: "/api/import/apollo",
  redirectPath: "/contacts",
  logTag: "contacts-apollo-import-ui",
  buttonLabel: "Import from Apollo",
  dialogTitle: "Import from Apollo (ICP filters)",
  dialogDescription: "Filters are preloaded from your ICP profile. Adjust and import.",
} as const;

export function ApolloImportButton() {
  return <ApolloImportDialog config={CONTACTS_APOLLO_IMPORT_CONFIG} />;
}
