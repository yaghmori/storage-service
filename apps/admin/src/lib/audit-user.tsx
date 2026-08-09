"use client";

import { useMembersQuery } from "@/features/members/hooks/use-members-queries";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DataGridColumnHeader,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components";
import { useMemo } from "react";

export type AuditUserRef = {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
};

function initials(name: string | null | undefined, email?: string | null) {
  const source = (name || email || "?").trim();
  return source.slice(0, 2).toUpperCase();
}

/** Compact avatar + name chip for Created by / Updated by columns. */
export function AuditUserChip({
  userId,
  usersById,
}: {
  userId: string | null | undefined;
  usersById: Map<string, AuditUserRef>;
}) {
  if (!userId) {
    return <span className="text-muted-foreground">—</span>;
  }

  const user = usersById.get(userId);
  const displayName = user?.name?.trim() || user?.email || "Unknown user";
  const email = user?.email;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex max-w-44 items-center gap-2">
            <Avatar className="size-6 shrink-0">
              {user?.avatar ? (
                <AvatarImage src={user.avatar} alt={displayName} />
              ) : null}
              <AvatarFallback className="bg-muted text-[10px] font-medium">
                {initials(user?.name, user?.email ?? userId)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{displayName}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">{displayName}</p>
          {email ? (
            <p className="text-xs text-muted-foreground">{email}</p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Active org members indexed by user id — preferred source for audit chips
 * (name + avatar). Users who left the org fall back to "Unknown user".
 */
export function useOrgAuditUsersMap(orgId: string | undefined) {
  const { data: members = [] } = useMembersQuery(orgId, "member");

  return useMemo(() => {
    const map = new Map<string, AuditUserRef>();
    for (const member of members) {
      if (!member.user?.id) continue;
      map.set(member.user.id, {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email || member.email,
        avatar: member.user.avatar,
      });
    }
    return map;
  }, [members]);
}

export type WithAuditUserIds = {
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
};

/** Created by / Updated by column pair for admin resource tables. */
export function createAuditUserColumns<T extends WithAuditUserIds>(
  usersById: Map<string, AuditUserRef>,
): ColumnDef<T>[] {
  return [
    {
      id: "createdBy",
      accessorFn: (row) => row.createdByUserId ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Created by" />
      ),
      meta: {
        label: "Created by",
        skeleton: <Skeleton className="h-6 w-28" />,
      },
      cell: ({ row }) => (
        <AuditUserChip
          userId={row.original.createdByUserId}
          usersById={usersById}
        />
      ),
    },
    {
      id: "updatedBy",
      accessorFn: (row) => row.updatedByUserId ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Updated by" />
      ),
      meta: {
        label: "Updated by",
        skeleton: <Skeleton className="h-6 w-28" />,
      },
      cell: ({ row }) => (
        <AuditUserChip
          userId={row.original.updatedByUserId}
          usersById={usersById}
        />
      ),
    },
  ];
}
