import { redirect } from "next/navigation";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";

/** Bare `/~` is not a page — land on organizations. */
export default function PlatformRootPage() {
  redirect(PAGE_ROUTES.ORGS);
}
