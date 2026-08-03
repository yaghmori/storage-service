"use client";

import { orgPath, PAGE_ROUTES } from "@/lib/constants/page-routes";
import { useActiveOrg } from "@/provider/org-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components";
import { Building2, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/**
 * Org switcher — always shows the selected organization (including on
 * platform routes). Switching persists selection and navigates into that org.
 */
export function OrgSwitcher() {
  const { isMobile } = useSidebar();
  const { orgs, activeOrg, isPlatform, isLoading, setSelectedOrgSlug } =
    useActiveOrg();
  const pathname = usePathname();
  const router = useRouter();

  const selectOrganization = (slug: string) => {
    setSelectedOrgSlug(slug);
    if (isPlatform) {
      router.push(orgPath(slug));
      return;
    }
    const leaf = pathname.split("/").slice(2);
    router.push(orgPath(slug, ...leaf));
  };

  if (isLoading && !activeOrg && orgs.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="animate-pulse">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary/20" />
            <div className="grid flex-1 gap-1 text-left text-sm">
              <span className="h-3 w-24 rounded bg-sidebar-accent" />
              <span className="h-2 w-16 rounded bg-sidebar-accent" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (orgs.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" asChild>
            <Link href={PAGE_ROUTES.ORG_NEW}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Plus className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Add organization</span>
                <span className="truncate text-xs">Create your first org</span>
              </div>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const title = activeOrg?.name ?? "Select organization";
  const subtitle = activeOrg
    ? `${activeOrg.slug} · ${activeOrg.status}`
    : "Choose an organization";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{title}</span>
                <span className="truncate text-xs capitalize">{subtitle}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            {orgs.map((org, index) => {
              const isSelected = activeOrg?.id === org.id;
              return (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => selectOrganization(org.slug)}
                  className={
                    isSelected
                      ? "gap-2 bg-accent p-2 text-accent-foreground focus:bg-accent"
                      : "gap-2 p-2"
                  }
                >
                  <div
                    className={
                      isSelected
                        ? "flex size-6 items-center justify-center rounded-md border   text-sidebar-primary-foreground"
                        : "flex size-6 items-center justify-center rounded-md border"
                    }
                  >
                    <Building2 className="size-3.5 shrink-0" />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span
                      className={
                        isSelected
                          ? "truncate text-sm font-medium"
                          : "truncate text-sm"
                      }
                    >
                      {org.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {org.slug} · {org.status}
                    </span>
                  </div>
                  {isSelected ? (
                    <span className="text-xs font-medium text-muted-foreground">
                      Current
                    </span>
                  ) : index < 9 ? (
                    <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                  ) : null}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" asChild>
              <Link href={PAGE_ROUTES.ORG_NEW}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  Add organization
                </div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
