"use client";

import { NavMain, type NavMainItem } from "@/components/layout/nav-main";
import { NavUser } from "@/components/layout/nav-user";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { useOptionalActiveOrg } from "@/provider/org-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@workspace/ui/components";
import {
  BarChart3,
  FileIcon,
  Home,
  Settings,
  Workflow,
} from "lucide-react";
import type { ComponentProps } from "react";

/**
 * sidebar-07 AppSidebar composition:
 * Header → OrgSwitcher (TeamSwitcher)
 * Content → NavMain groups
 * Footer → NavUser
 * Rail → icon-collapse affordance
 */
export function AdminSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const { activeOrg } = useOptionalActiveOrg() ?? { activeOrg: null };
  const navTenant: NavMainItem[] = activeOrg
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
          title: "Analytics",
          url: PAGE_ROUTES.analytics(activeOrg.slug),
          icon: BarChart3,
        },
        {
          title: "Settings",
          url: PAGE_ROUTES.settings(activeOrg.slug),
          icon: Settings,
        },
      ]
    : [];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrgSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {/* Keep org nav visible on platform routes using last/selected org */}
        {navTenant.length > 0 && (
          <NavMain items={navTenant} label="Organization" />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
