"use client";

import { BRAND } from "@/lib/constants/brand";

/** Service wordmark above the org switcher; collapses to the icon tile in icon mode. */
export function SidebarBrand() {
  const BrandIcon = BRAND.icon;

  return (
    <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <BrandIcon className="size-4" />
      </div>
      <div className="flex min-w-0 items-baseline gap-1.5 group-data-[collapsible=icon]:hidden">
        <span className="truncate text-2xl font-semibold leading-tight tracking-tight">
          {BRAND.name}
        </span>
        <span className="shrink-0 rounded border px-1 py-px text-[10px] font-medium leading-none text-muted-foreground">
          v{BRAND.version}
        </span>
      </div>
    </div>
  );
}
