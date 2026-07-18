"use client";

import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { title: "Overview", href: PAGE_ROUTES.ACCOUNT },
  { title: "Profile", href: PAGE_ROUTES.ACCOUNT_PROFILE },
  { title: "Appearance", href: PAGE_ROUTES.ACCOUNT_APPEARANCE },
] as const;

export function AccountSettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b pb-2 sm:flex-col sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
      {NAV.map((item) => {
        const active =
          item.href === PAGE_ROUTES.ACCOUNT
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
