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
import {
  createAuditUserColumns,
  type AuditUserRef,
} from "@/lib/audit-user";
import { Ban, MoreHorizontal, Trash2 } from "lucide-react";
import type { ApiKeyRow } from "../hooks/use-api-keys-queries";

export function createApiKeysColumns(
  orgSlug?: string,
  onRevoke?: (row: ApiKeyRow) => void,
  onDelete?: (row: ApiKeyRow) => void,
  usersById: Map<string, AuditUserRef> = new Map(),
): ColumnDef<ApiKeyRow>[] {
  return [
    {
      accessorKey: "serviceName",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Service" />
      ),
      meta: { label: "Service", skeleton: <Skeleton className="h-4 w-32" /> },
      cell: ({ row }) => (
        <span className="font-medium">{row.original.serviceName}</span>
      ),
    },
    {
      id: "org",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Org" />
      ),
      meta: { label: "Org", skeleton: <Skeleton className="h-4 w-28" /> },
      cell: () => (
        <span className="font-mono text-xs">{orgSlug ?? "—"}</span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "Active" : "Revoked"}
        </Badge>
      ),
    },
    {
      accessorKey: "expiresAt",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Expires" />
      ),
      meta: { label: "Expires", skeleton: <Skeleton className="h-4 w-28" /> },
      cell: ({ row }) =>
        row.original.expiresAt ? (
          <DateDisplay date={row.original.expiresAt} />
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
    ...createAuditUserColumns<ApiKeyRow>(usersById),
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
            {row.original.isActive && (
              <DropdownMenuItem onClick={() => onRevoke?.(row.original)}>
                <Ban className="mr-2 h-4 w-4" />
                Revoke
              </DropdownMenuItem>
            )}
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
