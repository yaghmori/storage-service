"use client";

import { OrgSettingsNavbar } from "@/features/orgs/components/org-settings-navbar";
import { useActiveOrg } from "@/provider/org-provider";
import { PageHeading, Separator } from "@workspace/ui/components";

export function OrgSettingsShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeOrg, urlOrgSlug } = useActiveOrg();
  const slug = activeOrg?.slug ?? urlOrgSlug ?? "";

  return (
    <div className="flex w-full flex-col">
      <PageHeading
        title="Organization settings"
        description={
          slug
            ? `Configure identity, quotas, processors, and retention for ${slug}.`
            : "Configure identity, quotas, processors, and retention for this organization."
        }
        className="mb-5"
      />

      <Separator />

      <div className="flex flex-col gap-6 pt-5 lg:min-h-[calc(100svh-6.5rem)] lg:flex-row lg:items-stretch lg:gap-0 lg:pt-0">
        <aside className="w-full shrink-0 lg:w-48 lg:border-r lg:border-border">
          <div className="lg:pr-6 lg:pt-5">
            {slug ? <OrgSettingsNavbar orgSlug={slug} /> : null}
          </div>
        </aside>

        <Separator className="lg:hidden" />

        <div className="min-w-0 flex-1">
          <div className="lg:pl-8 lg:pt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
