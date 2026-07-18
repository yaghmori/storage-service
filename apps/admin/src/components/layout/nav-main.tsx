"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@workspace/ui/components";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavMainItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  items?: { title: string; url: string }[];
};

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

/** Active when exact match, or prefix match unless a longer sibling URL matches better. */
function isNavUrlActive(
  pathname: string,
  itemUrl: string,
  siblingUrls: string[],
): boolean {
  const path = normalizePath(pathname);
  const url = normalizePath(itemUrl);
  if (path === url) return true;
  if (!path.startsWith(`${url}/`)) return false;

  // e.g. Dashboard `/org` must not stay active on `/org/files`
  const hasLongerMatch = siblingUrls.some((other) => {
    const o = normalizePath(other);
    if (o === url || o.length <= url.length) return false;
    return path === o || path.startsWith(`${o}/`);
  });
  return !hasLongerMatch;
}

/**
 * sidebar-07 NavMain: collapsible groups with optional sub-items.
 * Adapted for Base UI Collapsible (no Root asChild).
 */
export function NavMain({
  items,
  label = "Platform",
}: {
  items: NavMainItem[];
  label?: string;
}) {
  const pathname = usePathname();
  const siblingUrls = items.flatMap((item) => [
    item.url,
    ...(item.items?.map((sub) => sub.url) ?? []),
  ]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const hasChildren = Boolean(item.items?.length);
          const isActive = isNavUrlActive(pathname, item.url, siblingUrls);
          const childActive = item.items?.some((sub) =>
            isNavUrlActive(pathname, sub.url, siblingUrls),
          );

          if (!hasChildren) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.title}
                >
                  <Link href={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          return (
            <SidebarMenuItem key={item.title}>
              <Collapsible
                defaultOpen={isActive || childActive}
                className="group/collapsible"
              >
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isActive || childActive}
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[open]/collapsible:rotate-90 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => {
                      const subActive = isNavUrlActive(
                        pathname,
                        subItem.url,
                        siblingUrls,
                      );
                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={subActive}>
                            <Link href={subItem.url}>
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
