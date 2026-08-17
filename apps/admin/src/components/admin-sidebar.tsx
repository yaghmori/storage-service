"use client";

import { NavMain, type NavMainItem } from "@/components/layout/nav-main";
import {
  NavSecondary,
  type NavSecondaryItem,
} from "@/components/layout/nav-secondary";
import { NavUser } from "@/components/layout/nav-user";
import { SidebarBrand } from "@/components/layout/sidebar-brand";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { useOptionalActiveOrg } from "@/provider/org-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@workspace/ui/components";
import { BarChart3, FileIcon, Home, Settings, Workflow } from "lucide-react";
import type { ComponentProps } from "react";
import { OrgSwitcher } from "./layout/org-switcher";

/**
 * sidebar-07 AppSidebar composition:
 * Header → SidebarBrand → OrgSwitcher
 * Content → NavMain (leaves + accordion groups, eallyfe-style)
 * Footer → NavSecondary (Settings) → NavUser
 * Rail → icon-collapse affordance
 */
export function AdminSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const { activeOrg } = useOptionalActiveOrg() ?? { activeOrg: null };

  const navItems: NavMainItem[] = activeOrg
    ? [
        {
          title: "Dashboard",
          url: PAGE_ROUTES.home(activeOrg.slug),
          icon: Home,
        },
        {
          title: "Files",
          url: PAGE_ROUTES.files(activeOrg.slug),
          icon: FileIcon,
        },
        {
          title: "Jobs",
          url: PAGE_ROUTES.jobs(activeOrg.slug),
          icon: Workflow,
        },
        {
          title: "Metrics",
          url: PAGE_ROUTES.metrics(activeOrg.slug),
          icon: BarChart3,
        },
      ]
    : [];

  const navFooter: NavSecondaryItem[] = activeOrg
    ? [
        {
          title: "Settings",
          url: PAGE_ROUTES.settings(activeOrg.slug),
          icon: Settings,
        },
      ]
    : [];

  const activeScopeUrls = [
    ...navItems.flatMap((item) => [
      item.url,
      ...(item.items?.map((sub) => sub.url) ?? []),
    ]),
    ...navFooter.map((item) => item.url),
  ];

  return (
    <Sidebar collapsible="icon" className="border-r shadow-md" {...props}>
      <SidebarHeader className="border-b bg-sidebar">
        <SidebarBrand />
      </SidebarHeader>
      <SidebarContent className="bg-background">
        <SidebarHeader className="pt-5 pb-0">
          <OrgSwitcher />
        </SidebarHeader>

        {/* Keep org nav visible on platform routes using last/selected org */}
        {navItems.length > 0 && (
          <NavMain
            items={navItems}
            label="Navigation"
            activeScopeUrls={activeScopeUrls}
          />
        )}
      </SidebarContent>
      <SidebarFooter className="bg-background">
        <NavSecondary items={navFooter} />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
