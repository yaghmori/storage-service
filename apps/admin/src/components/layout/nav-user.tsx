"use client";

import { useLogout } from "@/features/auth/hooks/use-auth-mutation";
import { useAccountMeQuery } from "@/features/account/hooks/use-account-queries";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { useAuth } from "@/provider/auth-provider";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components";
import { ChevronsUpDown, Globe, LogOut, Palette, UserRound } from "lucide-react";
import Link from "next/link";

/**
 * sidebar-07 NavUser: avatar + dropdown in the sidebar footer.
 */
export function NavUser() {
  const { isMobile } = useSidebar();
  const { user } = useAuth();
  const { data: me } = useAccountMeQuery();
  const logout = useLogout();

  const name = me?.name ?? user?.name ?? user?.email ?? "Admin";
  const email = me?.email ?? user?.email ?? "";
  const avatar = me?.avatar ?? user?.avatar ?? null;
  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AD";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {avatar ? (
                  <AvatarImage src={avatar} alt={name} className="rounded-lg" />
                ) : null}
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {avatar ? (
                    <AvatarImage
                      src={avatar}
                      alt={name}
                      className="rounded-lg"
                    />
                  ) : null}
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={PAGE_ROUTES.ACCOUNT_PROFILE}>
                <UserRound />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={PAGE_ROUTES.ACCOUNT_PREFERENCES}>
                <Globe />
                Preferences
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={PAGE_ROUTES.ACCOUNT_APPEARANCE}>
                <Palette />
                Appearance
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOut />
              {logout.isPending ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
