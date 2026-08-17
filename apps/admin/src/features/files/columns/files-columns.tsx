"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Badge,
  Button,
  CopyButton,
  DataGridColumnHeader,
  DateDisplay,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
} from "@workspace/ui/components";
import { Eye, MoreHorizontal, RotateCcw, Trash2, Workflow } from "lucide-react";
import {
  FilteredSelectAllHeader,
  FilteredSelectRowCell,
} from "@/lib/filtered-selection";
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

function daysUntilPurge(
  deletedAt: string,
  retentionDays: number,
): { daysLeft: number; purgeAt: Date } {
  const deleted = new Date(deletedAt);
  const purgeAt = new Date(deleted);
  purgeAt.setDate(purgeAt.getDate() + retentionDays);
  const msLeft = purgeAt.getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  return { daysLeft, purgeAt };
}

export type FilesVisibility = "active" | "deleted" | "all";

export function createFilesColumns(
  orgId?: string,
  onView?: (row: FileRow) => void,
  onDelete?: (row: FileRow) => void,
  onViewJobs?: (row: FileRow) => void,
  options?: {
    visibility?: FilesVisibility;
    retentionDays?: number;
    onRestore?: (row: FileRow) => void;
  },
): ColumnDef<FileRow>[] {
  const onRestore = options?.onRestore;
  const visibility = options?.visibility ?? "active";
  const retentionDays = options?.retentionDays ?? 30;
  const showDeletedColumns =
    visibility === "deleted" || visibility === "all";

  const columns: ColumnDef<FileRow>[] = [
    {
      id: "select",
      header: () => <FilteredSelectAllHeader />,
      cell: ({ row }) => (
        <FilteredSelectRowCell
          id={row.original.id}
          disabled={visibility !== "deleted" && !!row.original.deletedAt}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      enableColumnFilter: false,
      size: 40,
      minSize: 40,
      maxSize: 40,
      meta: {
        headerClassName: "w-10 min-w-10 max-w-10 px-3",
        cellClassName: "w-10 min-w-10 max-w-10 px-3",
        skeleton: <Skeleton className="size-4" />,
      },
    },
    {
      id: "search",
      accessorFn: () => "",
      header: "Search",
      cell: () => null,
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
      filterFn: () => true,
      meta: {
        variant: "text",
        label: "Search",
        placeholder: "Search filename, mime, or ID…",
      },
    },
    {
      accessorKey: "originalFileName",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="File" />
      ),
      meta: {
        label: "File",
        skeleton: (
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-md" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ),
      },
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="shrink-0"
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
          <div className="min-w-0 space-y-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="max-w-[240px] truncate text-left font-medium hover:underline"
                dir="auto"
                onClick={() => onView?.(row.original)}
              >
                {row.original.originalFileName}
              </button>
              {row.original.deletedAt && (
                <Badge variant="destructive" className="shrink-0">
                  Soft-deleted
                </Badge>
              )}
            </div>
            <div className="flex min-w-0 items-center gap-1">
              <span
                className="max-w-[220px] truncate font-mono text-[11px] text-muted-foreground"
                title={row.original.id}
              >
                {row.original.id}
              </span>
              <CopyButton
                content={row.original.id}
                variant="ghost"
                size="sm"
                className="size-5 shrink-0 text-muted-foreground shadow-none"
                aria-label="Copy file ID"
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "fileType",
      accessorFn: () => "",
      header: "File type",
      cell: () => null,
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
      filterFn: () => true,
      meta: {
        variant: "multiSelect",
        label: "File type",
        options: [
          { value: "images", label: "Images" },
          { value: "videos", label: "Videos" },
          { value: "documents", label: "Documents" },
          { value: "audio", label: "Audio" },
          { value: "other", label: "Other" },
        ],
      },
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
      enableColumnFilter: true,
      meta: {
        variant: "range",
        label: "Size",
        unit: "MB",
        range: [0, 1024], // MB; matches SIZE_FILTER_MAX_MB in list view
        skeleton: <Skeleton className="h-4 w-16" />,
      },
      cell: ({ row }) => (
        <span className="tabular-nums">{formatBytes(row.original.size)}</span>
      ),
    },
    {
      id: "provider",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Provider" />
      ),
      enableSorting: false,
      meta: { label: "Provider", skeleton: <Skeleton className="h-4 w-24" /> },
      cell: ({ row }) => {
        const name = row.original.storageProviderName;
        const type = row.original.storageProviderType;
        if (!name && !type) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="min-w-0 max-w-[160px]">
            <p className="truncate text-sm">{name ?? "—"}</p>
            {type ? (
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {type}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "bucket",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Bucket" />
      ),
      enableSorting: false,
      meta: { label: "Bucket", skeleton: <Skeleton className="h-4 w-24" /> },
      cell: ({ row }) =>
        row.original.storageBucket ? (
          <span
            className="block max-w-[180px] truncate font-mono text-xs text-muted-foreground"
            title={row.original.storageBucket}
          >
            {row.original.storageBucket}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "processingStatus",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Status" />
      ),
      enableColumnFilter: true,
      meta: {
        variant: "multiSelect",
        label: "Status",
        options: [
          { value: "pending", label: "Pending" },
          { value: "processing", label: "Processing" },
          { value: "completed", label: "Completed" },
          { value: "partial", label: "Partial" },
          { value: "skipped", label: "Skipped" },
          { value: "failed", label: "Failed" },
          { value: "cancelled", label: "Cancelled" },
        ],
        skeleton: <Skeleton className="h-5 w-20" />,
      },
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
      enableColumnFilter: true,
      meta: {
        variant: "dateRange",
        label: "Created",
        skeleton: <Skeleton className="h-4 w-28" />,
      },
      cell: ({ row }) => (
        <DateDisplay date={row.original.createdAt} format="relative" />
      ),
    },
  ];

  if (showDeletedColumns) {
    columns.push(
      {
        accessorKey: "deletedAt",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Deleted" />
        ),
        meta: { label: "Deleted", skeleton: <Skeleton className="h-4 w-28" /> },
        cell: ({ row }) =>
          row.original.deletedAt ? (
            <DateDisplay date={row.original.deletedAt} format="relative" />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "purgeIn",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Purge in" />
        ),
        enableSorting: false,
        meta: {
          label: "Purge in",
          skeleton: <Skeleton className="h-4 w-24" />,
        },
        cell: ({ row }) => {
          if (!row.original.deletedAt) {
            return <span className="text-muted-foreground">—</span>;
          }
          const { daysLeft, purgeAt } = daysUntilPurge(
            row.original.deletedAt,
            retentionDays,
          );
          if (daysLeft <= 0) {
            return (
              <Badge variant="destructive" title={purgeAt.toISOString()}>
                Due now
              </Badge>
            );
          }
          return (
            <span
              className="tabular-nums text-sm"
              title={`Purges around ${purgeAt.toLocaleString()}`}
            >
              {daysLeft} day{daysLeft === 1 ? "" : "s"}
            </span>
          );
        },
      },
    );
  }

  columns.push({
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
          <DropdownMenuItem onClick={() => onViewJobs?.(row.original)}>
            <Workflow className="mr-2 h-4 w-4" />
            View jobs
          </DropdownMenuItem>
          {row.original.deletedAt ? (
            <DropdownMenuItem onClick={() => onRestore?.(row.original)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restore
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onClick={() => onDelete?.(row.original)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {row.original.deletedAt ? "Delete permanently…" : "Delete…"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  });

  return columns;
}
