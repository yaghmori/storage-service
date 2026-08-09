"use client";

import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components";
import { Globe, Monitor, Palette, UserRound } from "lucide-react";
import Link from "next/link";
import { AccountSettingsShell } from "./account-settings-shell";

const CARDS = [
  {
    title: "Profile",
    description: "View your account details and change your password.",
    href: PAGE_ROUTES.ACCOUNT_PROFILE,
    icon: UserRound,
  },
  {
    title: "Preferences",
    description: "Choose the timezone used for dates in this admin console.",
    href: PAGE_ROUTES.ACCOUNT_PREFERENCES,
    icon: Globe,
  },
  {
    title: "Appearance",
    description: "Choose color theme and light or dark mode.",
    href: PAGE_ROUTES.ACCOUNT_APPEARANCE,
    icon: Palette,
  },
] as const;

export function AccountSettingsHub() {
  return (
    <AccountSettingsShell
      title="Account settings"
      description="Preferences for your signed-in admin account."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link key={card.href} href={card.href} className="group">
            <Card className="h-full rounded-2xl border-border/70 bg-card/90 shadow-sm transition-colors group-hover:bg-muted/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <card.icon className="size-4" />
                  {card.title}
                </CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                <Monitor className="mr-1 inline size-3" />
                Manage
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AccountSettingsShell>
  );
}
