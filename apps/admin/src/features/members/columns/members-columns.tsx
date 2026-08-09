"use client";

import { createSearchColumn } from "@/lib/data-table-search-column";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  DataGridColumnHeader,
  Skeleton,
} from "@workspace/ui/components";
import { Mail } from "lucide-react";
import { MemberCellAction } from "../components/member-cell-action";
import type { UnifiedMemberRow } from "../hooks/use-members-queries";
import { roleLabel } from "../lib/roles";

function initials(name: string | null | undefined, email: string) {
  const source = (name || email).trim();
  return source.slice(0, 2).toUpperCase();
}

export function createMembersColumns(opts: {
  orgId: string;
  canManage: boolean;
  isOwner: boolean;
  allMembers: UnifiedMemberRow[];
}): ColumnDef<UnifiedMemberRow>[] {
  return [
    createSearchColumn<UnifiedMemberRow>("Search by name or email…"),
    {
      accessorKey: "member",
      id: "member",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Member" />
      ),
      meta: {
        label: "Member",
        skeleton: <Skeleton className="h-10 w-48" />,
      },
      cell: ({ row }) => {
        const item = row.original;
        const isInvite = item.type === "invitation";
        const displayName = item.user?.name || item.email;
        const avatar = item.user?.avatar;
        return (
          <div className="flex items-center gap-3 py-1">
            <Avatar className="size-9">
              {avatar && !isInvite ? (
                <AvatarImage src={avatar} alt={displayName} />
              ) : null}
              <AvatarFallback className="bg-muted text-xs font-medium">
                {isInvite ? (
                  <Mail className="size-4 text-muted-foreground" />
                ) : (
                  initials(item.user?.name, item.email)
                )}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 truncate font-medium">
                <span className="truncate">{displayName}</span>
                {item.role === "owner" ? (
                  <Badge variant="default">Owner</Badge>
                ) : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {isInvite ? "Pending invitation · " : ""}
                {item.email}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: "type",
      accessorFn: (row) => row.type,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Type" />
      ),
      enableColumnFilter: true,
      meta: {
        label: "Type",
        variant: "select",
        options: [
          { label: "Members", value: "member" },
          { label: "Invitations", value: "invitation" },
        ],
        skeleton: <Skeleton className="h-5 w-20" />,
      },
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.type === "invitation" ? "Invitation" : "Member"}
        </Badge>
      ),
    },
    {
      accessorKey: "role",
      id: "role",
      accessorFn: (row) => row.role,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Role" />
      ),
      enableColumnFilter: true,
      meta: {
        label: "Role",
        variant: "select",
        options: [
          { label: "Owner", value: "owner" },
          { label: "Admin", value: "admin" },
          { label: "Member", value: "member" },
        ],
        skeleton: <Skeleton className="h-5 w-16" />,
      },
      cell: ({ row }) => (
        <Badge
          variant={row.original.role === "owner" ? "default" : "secondary"}
        >
          {roleLabel(row.original.role)}
        </Badge>
      ),
    },
    {
      id: "date",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Date" />
      ),
      meta: { label: "Date", skeleton: <Skeleton className="h-8 w-24" /> },
      cell: ({ row }) => {
        const item = row.original;
        const raw =
          item.type === "invitation" ? item.invitedAt : item.acceptedAt;
        const label =
          item.type === "invitation" ? "Invited at" : "Joined at";
        const date = raw ? new Date(raw) : null;
        return (
          <div className="text-sm">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p>
              {date
                ? date.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </p>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <MemberCellAction
          row={row.original}
          orgId={opts.orgId}
          canManage={opts.canManage}
          isOwner={opts.isOwner}
          allMembers={opts.allMembers}
        />
      ),
    },
  ];
}
