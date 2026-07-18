import { notFound } from "next/navigation";

const RESERVED = new Set(["~", "platform", "auth", "api", "onboarding"]);

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const decoded = decodeURIComponent(orgSlug);
  if (RESERVED.has(decoded)) notFound();

  return children;
}
