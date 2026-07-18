import { redirect } from "next/navigation";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";

/** Legacy URL — keep so old bookmarks/links still work. */
export default function LegacyOnboardingOrganizationRedirect() {
  redirect(PAGE_ROUTES.ORG_NEW);
}
