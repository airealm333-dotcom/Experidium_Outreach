import {
  ContactsPageBody,
  type ContactsPageSearchParams,
} from "./contacts-page-body";

// Always render fresh on the server. Without these, Next.js / browser caches can
// keep showing a pre-import snapshot of /contacts after an Apollo import even
// though the DB has new rows.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<ContactsPageSearchParams>;
}) {
  return (
    <ContactsPageBody basePath="/contacts" searchParams={await searchParams} />
  );
}
