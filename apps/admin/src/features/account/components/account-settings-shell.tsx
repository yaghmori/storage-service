"use client";

import { AccountSettingsNav } from "./account-settings-nav";
import { PageHeading, Separator } from "@workspace/ui/components";

export function AccountSettingsShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col">
      <PageHeading
        title={title}
        description={description ?? ""}
        className="mb-5"
      />

      <Separator />

      <div className="flex flex-col gap-6 pt-5 lg:min-h-[calc(100svh-6.5rem)] lg:flex-row lg:items-stretch lg:gap-0 lg:pt-0">
        <aside className="w-full shrink-0 lg:w-48 lg:border-r lg:border-border">
          <div className="lg:pr-6 lg:pt-5">
            <AccountSettingsNav />
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
