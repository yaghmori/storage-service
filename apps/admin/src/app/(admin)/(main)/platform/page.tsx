import { redirect } from "next/navigation";

/** Bare `/~` lands on home (membership-scoped org resolution). */
export default function PlatformRootPage() {
  redirect("/");
}
