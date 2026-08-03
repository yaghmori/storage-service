"use client";

import * as React from "react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Spinner } from "../ui/spinner";
import { UserAvatarProfile } from "./user-avatar-profile";

export interface UserNavProps {
  user?: any; // shape provided by next-auth session.user; kept generic to avoid coupling
  isLoading?: boolean;
  className?: string;
  children?: React.ReactNode; // menu content to render inside DropdownMenuContent
}

export function UserNav({
  user,
  isLoading,
  className,
  children,
}: UserNavProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
          <Spinner variant="ring" className="opacity-30" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative  size-11 rounded-full sm:size-10"
        >
          <UserAvatarProfile user={user} className="size-10 sm:size-9" />
          <span className="sr-only">User Menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56"
        align="end"
        sideOffset={10}
        forceMount
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
