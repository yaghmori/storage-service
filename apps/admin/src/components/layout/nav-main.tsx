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
import { useEffect, useState } from "react";

export type NavMainSubItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
};

export type NavMainItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  items?: NavMainSubItem[];
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
  if (url === "/") return false;
  if (!path.startsWith(`${url}/`)) return false;

  const hasLongerMatch = siblingUrls.some((other) => {
    const o = normalizePath(other);
    if (o === url || o.length <= url.length) return false;
    return path === o || path.startsWith(`${o}/`);
  });
  return !hasLongerMatch;
}

function CollapsibleNavItem({
  item,
  siblingUrls,
  forceOpen,
  defaultOpen = true,
}: {
  item: NavMainItem;
  siblingUrls: string[];
  forceOpen?: boolean;
  /** Initial expanded state (groups remain collapsible). */
  defaultOpen?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const isActive = isNavUrlActive(pathname, item.url, siblingUrls);
  const childActive = item.items?.some((sub) =>
    isNavUrlActive(pathname, sub.url, siblingUrls),
  );
  const [open, setOpen] = useState(
    Boolean(defaultOpen || isActive || childActive || forceOpen),
  );

  useEffect(() => {
    if (forceOpen || isActive || childActive) {
      setOpen(true);
    }
  }, [forceOpen, isActive, childActive]);

  return (
    <SidebarMenuItem>
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="group/collapsible"
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={isActive || childActive}
          >
            {item.icon ? <item.icon /> : null}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90 group-data-[state=open]/collapsible:rotate-90" />
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
                <SidebarMenuSubItem key={subItem.url}>
                  <SidebarMenuSubButton asChild isActive={subActive}>
                    <Link href={subItem.url}>
                      {subItem.icon ? <subItem.icon /> : null}
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
}

/**
 * sidebar-07 NavMain: leaf links and accordion groups with sub-items.
 */
export function NavMain({
  items,
  label = "Navigation",
  forceOpenGroups = false,
  defaultOpenGroups = true,
  activeScopeUrls,
}: {
  items: NavMainItem[];
  label?: string;
  /** Keep accordion groups expanded (e.g. while searching). */
  forceOpenGroups?: boolean;
  /** Expand groups on first render; users can still collapse them. */
  defaultOpenGroups?: boolean;
  /**
   * URLs used for longest-prefix active matching across the whole sidebar
   * so short roots (e.g. org home) do not stay active on nested routes.
   */
  activeScopeUrls?: string[];
}) {
  const pathname = usePathname() ?? "";
  const siblingUrls =
    activeScopeUrls ??
    items.flatMap((item) => [
      item.url,
      ...(item.items?.map((sub) => sub.url) ?? []),
    ]);

  if (items.length === 0) return null;

  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarMenu>
        {items.map((item) => {
          const hasChildren = Boolean(item.items?.length);

          if (!hasChildren) {
            const isActive = isNavUrlActive(pathname, item.url, siblingUrls);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.title}
                >
                  <Link href={item.url}>
                    {item.icon ? <item.icon /> : null}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          return (
            <CollapsibleNavItem
              key={item.url}
              item={item}
              siblingUrls={siblingUrls}
              forceOpen={forceOpenGroups}
              defaultOpen={defaultOpenGroups}
            />
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
