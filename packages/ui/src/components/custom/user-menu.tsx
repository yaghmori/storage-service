"use client";

import { LogOut, User } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";

export interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    image?: string | null;
  };
  profileHref?: string;
  onLogout?: () => void;
  logoutLabel?: string;
  profileLabel?: string;
}

export function UserMenu({
  user,
  profileHref = "/profile",
  onLogout,
  logoutLabel = "Logout",
  profileLabel = "Profile",
}: UserMenuProps) {
  const displayName =
    (user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.name) ||
    user.email ||
    "User";

  return (
    <>
      <DropdownMenuLabel className="font-normal">
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium leading-none">{displayName}</p>
          {user.email && (
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          )}
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href={profileHref} className="cursor-pointer  flex items-center">
          <User />
          <span>{profileLabel}</span>
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onClick={onLogout}
        className="cursor-pointer  flex items-center"
      >
        <LogOut />
        <span>{logoutLabel}</span>
      </DropdownMenuItem>
    </>
  );
}
