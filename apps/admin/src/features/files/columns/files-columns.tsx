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
import { Eye, MoreHorizontal, Trash2 } from "lucide-react";
import type { FileRow } from "../hooks/use-files-queries";
import { FilePreviewThumb } from "../components/file-preview-thumb";

function formatBytes(value: number | string): string {
  const bytes = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = -1;
  do {
    size /= 1024;
    unit += 1;
  } while (size >= 1024 && unit < units.length - 1);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function createFilesColumns(
  orgId?: string,
  onView?: (row: FileRow) => void,
  onDelete?: (row: FileRow) => void,
): ColumnDef<FileRow>[] {
  return [
    {
      id: "search",
      accessorKey: "search",
      header: "Search",
      cell: () => null,
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
      meta: {
        variant: "text",
        label: "Search",
        placeholder: "Search filename or mime…",
      },
    },
    {
      id: "preview",
      header: "",
      enableSorting: false,
      size: 56,
      meta: { skeleton: <Skeleton className="size-11 rounded-md" /> },
      cell: ({ row }) => (
        <button
          type="button"
          className="block"
          onClick={() => onView?.(row.original)}
          aria-label={`Preview ${row.original.originalFileName}`}
        >
          <FilePreviewThumb
            fileId={row.original.id}
            mimeType={row.original.mimeType}
            orgId={orgId}
            alt={row.original.originalFileName}
            size="md"
          />
        </button>
      ),
    },
    {
      accessorKey: "originalFileName",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Name" />
      ),
      meta: { label: "Name", skeleton: <Skeleton className="h-4 w-40" /> },
      cell: ({ row }) => (
        <button
          type="button"
          className="max-w-[240px] truncate text-left font-medium hover:underline"
          onClick={() => onView?.(row.original)}
        >
          {row.original.originalFileName}
        </button>
      ),
    },
    {
      accessorKey: "mimeType",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Type" />
      ),
      meta: { label: "Type", skeleton: <Skeleton className="h-4 w-28" /> },
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.mimeType}
        </span>
      ),
    },
    {
      accessorKey: "size",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Size" />
      ),
      meta: { label: "Size", skeleton: <Skeleton className="h-4 w-16" /> },
      cell: ({ row }) => (
        <span className="tabular-nums">{formatBytes(row.original.size)}</span>
      ),
    },
    {
      accessorKey: "processingStatus",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Status" />
      ),
      meta: { label: "Status", skeleton: <Skeleton className="h-5 w-20" /> },
      cell: ({ row }) => {
        const status = row.original.processingStatus;
        if (!status) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <Badge variant="secondary" className="capitalize">
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Created" />
      ),
      meta: { label: "Created", skeleton: <Skeleton className="h-4 w-28" /> },
      cell: ({ row }) => (
        <DateDisplay date={row.original.createdAt} format="relative" />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView?.(row.original)}>
              <Eye className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            {!row.original.deletedAt && (
              <DropdownMenuItem
                onClick={() => onDelete?.(row.original)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Soft delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
