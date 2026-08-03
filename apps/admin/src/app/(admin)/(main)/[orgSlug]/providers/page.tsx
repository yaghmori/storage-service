import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { redirect } from "next/navigation";

export default async function ProvidersPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(PAGE_ROUTES.settingsProviders(orgSlug));
}
