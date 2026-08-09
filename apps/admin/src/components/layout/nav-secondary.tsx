"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components";
import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentPropsWithoutRef } from "react";

export type NavSecondaryItem = {
  title: string;
  url: string;
  icon: LucideIcon;
};

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

function isNavUrlActive(pathname: string, itemUrl: string): boolean {
  const path = normalizePath(pathname);
  const url = normalizePath(itemUrl);
  return path === url || path.startsWith(`${url}/`);
}

/**
 * Compact footer / secondary nav (e.g. Settings above the user card).
 */
export function NavSecondary({
  items,
  ...props
}: {
  items: NavSecondaryItem[];
} & ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname();

  if (items.length === 0) return null;

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                size="sm"
                isActive={isNavUrlActive(pathname, item.url)}
                tooltip={item.title}
              >
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
