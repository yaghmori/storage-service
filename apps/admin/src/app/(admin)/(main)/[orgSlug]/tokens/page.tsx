import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { redirect } from "next/navigation";

export default async function TokensPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  redirect(PAGE_ROUTES.settingsTokens(orgSlug));
}
