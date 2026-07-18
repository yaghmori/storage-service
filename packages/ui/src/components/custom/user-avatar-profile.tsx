"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";

interface UserAvatarProfileProps {
  user: {
    name?: string | null;
    fullName?: string | null;
    image?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  };
  className?: string;
  showInfo?: boolean;
}

export function UserAvatarProfile({
  user,
  className,
  showInfo = false,
}: UserAvatarProfileProps) {
  const initials =
    [user.firstName?.[0], user.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "U";

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user?.name ||
    "User";

  if (showInfo) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage
            className="flex-shrink-0"
            src={user.image || undefined}
            alt={fullName}
          />
          <AvatarFallback className="text-xs bg-muted/30">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-start min-w-0">
          <span className="text-sm font-medium truncate">{fullName}</span>
          <span className="text-xs text-muted-foreground truncate">
            {user.email}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Avatar className={cn("h-8 w-8", className)}>
      <AvatarImage src={user.image || undefined} alt={fullName} />
      <AvatarFallback className="text-xs bg-muted/30">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
