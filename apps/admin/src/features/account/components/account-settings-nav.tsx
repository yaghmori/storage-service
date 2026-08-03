"use client";

import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { cn } from "@/lib/utils";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components";
import { Globe, Monitor, Palette, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  {
    title: "Overview",
    href: PAGE_ROUTES.ACCOUNT,
    section: "overview",
    icon: Monitor,
  },
  {
    title: "Profile",
    href: PAGE_ROUTES.ACCOUNT_PROFILE,
    section: "profile",
    icon: UserRound,
  },
  {
    title: "Preferences",
    href: PAGE_ROUTES.ACCOUNT_PREFERENCES,
    section: "preferences",
    icon: Globe,
  },
  {
    title: "Appearance",
    href: PAGE_ROUTES.ACCOUNT_APPEARANCE,
    section: "appearance",
    icon: Palette,
  },
] as const;

export function AccountSettingsNav() {
  const pathname = usePathname();
  const router = useRouter();

  const currentSection =
    NAV.find((item) =>
      item.href === PAGE_ROUTES.ACCOUNT
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.section ?? NAV[0].section;

  return (
    <>
      <div className="lg:hidden">
        <Select
          value={currentSection}
          onValueChange={(value) => {
            const selected = NAV.find((item) => item.section === value);
            if (selected) router.push(selected.href);
          }}
        >
          <SelectTrigger className="h-9 w-full max-w-xs text-sm">
            <SelectValue placeholder="Navigate to" />
          </SelectTrigger>
          <SelectContent>
            {NAV.map((item) => {
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

      <nav className="hidden w-full flex-col gap-0.5 lg:flex">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.section === currentSection;

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
              <Link href={item.href}>
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
