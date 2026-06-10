import { notFound } from "next/navigation";
import { ContactDetailBody } from "../../contacts/[id]/contact-detail-body";

export default async function LinkedInContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const body = await ContactDetailBody({ basePath: "/linkedin", id });
    if (!body) notFound();
    return body;
  } catch {
    notFound();
  }
}
