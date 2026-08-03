"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Badge,
  Button,
  DataGridColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
} from "@workspace/ui/components";
import { ProcessorBackendKindLabels } from "@workspace/validation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { ProcessorBackendRow } from "../hooks/use-processor-backends-queries";

export function createProcessorBackendsColumns(
  onEdit: (row: ProcessorBackendRow) => void,
  onDelete: (row: ProcessorBackendRow) => void,
): ColumnDef<ProcessorBackendRow>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Name" />
      ),
      meta: { label: "Name", skeleton: <Skeleton className="h-4 w-32" /> },
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "kind",
      header: "Kind",
      cell: ({ row }) => (
        <Badge variant="outline">
          {ProcessorBackendKindLabels[row.original.kind] ?? row.original.kind}
        </Badge>
      ),
    },
    {
      accessorKey: "baseUrl",
      header: "Base URL",
      cell: ({ row }) => (
        <span className="block max-w-64 truncate font-mono text-xs">
          {row.original.baseUrl}
        </span>
      ),
    },
    {
      accessorKey: "visionModel",
      header: "Fallback vision",
      cell: ({ row }) => row.original.visionModel ?? "—",
    },
    {
      accessorKey: "apiKeyConfigured",
      header: "API key",
      cell: ({ row }) =>
        row.original.apiKeyConfigured
          ? `••••${row.original.apiKeyLast4 ?? ""}`
          : "Not set",
    },
    {
      accessorKey: "isActive",
      header: "State",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
          {row.original.isDefault ? (
            <Badge variant="outline">Default</Badge>
          ) : null}
        </div>
      ),
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
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(row.original)}
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
