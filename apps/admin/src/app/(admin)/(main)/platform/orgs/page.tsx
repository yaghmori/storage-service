import { redirect } from "next/navigation";

/** Platform org list removed — membership-scoped orgs only. */
export default function OrganizationsPage() {
  redirect("/");
}
