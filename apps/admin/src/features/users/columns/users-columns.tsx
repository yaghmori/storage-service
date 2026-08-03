"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Badge,
  Button,
  DataGridColumnHeader,
  DateDisplay,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
} from "@workspace/ui/components";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { AdminUserRow } from "../hooks/use-users-queries";

export function createUsersColumns(
  onEdit?: (row: AdminUserRow) => void,
  onDelete?: (row: AdminUserRow) => void,
): ColumnDef<AdminUserRow>[] {
  return [
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Email" />
      ),
      meta: { label: "Email", skeleton: <Skeleton className="h-4 w-40" /> },
      cell: ({ row }) => row.original.email,
    },
    {
      accessorKey: "role",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Role" />
      ),
      meta: { label: "Role", skeleton: <Skeleton className="h-4 w-20" /> },
      cell: ({ row }) => row.original.role,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "Active" : "Disabled"}
        </Badge>
      ),
    },
    {
      accessorKey: "lastLoginAt",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Last login" />
      ),
      meta: { label: "Last login", skeleton: <Skeleton className="h-4 w-28" /> },
      cell: ({ row }) =>
        row.original.lastLoginAt ? (
          <DateDisplay date={row.original.lastLoginAt} />
        ) : (
          <span className="text-muted-foreground">Never</span>
        ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Created" />
      ),
      meta: { label: "Created", skeleton: <Skeleton className="h-4 w-28" /> },
      cell: ({ row }) => <DateDisplay date={row.original.createdAt} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit?.(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete?.(row.original)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
