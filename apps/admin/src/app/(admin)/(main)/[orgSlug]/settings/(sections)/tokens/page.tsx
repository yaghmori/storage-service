import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { redirect } from "next/navigation";

/** Legacy `/settings/tokens` → `/settings/api-keys`. */
export default async function OrgSettingsTokensRedirectPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(PAGE_ROUTES.settingsApiKeys(orgSlug));
}
