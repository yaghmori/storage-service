"use client";

import {
  orgSettingsNavItems,
  type OrgSettingsNavItem,
} from "@/features/orgs/utils/org-settings-navigation";
import { cn } from "@/lib/utils";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type OrgSettingsNavbarProps = {
  orgSlug: string;
  items?: OrgSettingsNavItem[];
  className?: string;
};

export function OrgSettingsNavbar({
  orgSlug,
  items = orgSettingsNavItems,
  className,
}: OrgSettingsNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const currentSection =
    items.find((item) => {
      const href = item.href(orgSlug);
      return pathname === href || pathname.startsWith(`${href}/`);
    })?.section ?? items[0]?.section;

  return (
    <>
      <div className="lg:hidden">
        <Select
          value={currentSection}
          onValueChange={(value) => {
            const selected = items.find((item) => item.section === value);
            if (selected) router.push(selected.href(orgSlug));
          }}
        >
          <SelectTrigger className="h-9 w-full max-w-xs text-sm">
            <SelectValue placeholder="Navigate to" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <SelectItem key={item.section} value={item.section}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-3.5" />
                    <span className="text-sm">{item.title}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <nav className={cn("hidden w-full flex-col gap-0.5 lg:flex", className)}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.section === currentSection;
          const href = item.href(orgSlug);

          return (
            <Button
              key={item.section}
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                "h-8 w-full justify-start gap-2 px-2.5 text-sm font-normal",
                isActive
                  ? "border border-primary/25 bg-primary/10 text-primary shadow-none hover:bg-primary/15 hover:text-primary"
                  : "text-foreground",
              )}
            >
              <Link href={href}>
                <Icon
                  className={cn(
                    "size-3.5 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="truncate">{item.title}</span>
              </Link>
            </Button>
          );
        })}
      </nav>
    </>
  );
}
