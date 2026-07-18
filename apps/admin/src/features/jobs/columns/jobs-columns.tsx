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
import { JobStatusLabels, JobTypeLabels } from "@workspace/validation";
import { Ban, MoreHorizontal } from "lucide-react";
import type { JobRow } from "../hooks/use-jobs-queries";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "failed":
      return "bg-destructive/15 text-destructive";
    case "processing":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "cancelled":
      return "bg-muted text-muted-foreground";
    default:
      return "";
  }
}

export function createJobsColumns(
  onCancel?: (row: JobRow) => void,
): ColumnDef<JobRow>[] {
  return [
    {
      accessorKey: "jobType",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Type" />
      ),
      meta: {
        variant: "select",
        label: "Type",
        options: Object.entries(JobTypeLabels).map(([value, label]) => ({
          value,
          label,
        })),
        skeleton: <Skeleton className="h-5 w-20" />,
      },
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {JobTypeLabels[row.original.jobType as keyof typeof JobTypeLabels] ??
            row.original.jobType}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Status" />
      ),
      meta: {
        variant: "select",
        label: "Status",
        options: Object.entries(JobStatusLabels).map(([value, label]) => ({
          value,
          label,
        })),
        skeleton: <Skeleton className="h-5 w-24" />,
      },
      cell: ({ row }) => (
        <Badge
          variant="secondary"
          className={statusBadgeClass(String(row.original.status))}
        >
          {JobStatusLabels[row.original.status as keyof typeof JobStatusLabels] ??
            row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "fileId",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="File" />
      ),
      meta: { label: "File", skeleton: <Skeleton className="h-4 w-28" /> },
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.fileId.slice(0, 8)}…
        </span>
      ),
    },
    {
      accessorKey: "progress",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Progress" />
      ),
      meta: { label: "Progress", skeleton: <Skeleton className="h-4 w-12" /> },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.progress == null ? "—" : `${row.original.progress}%`}
        </span>
      ),
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
      cell: ({ row }) => {
        const canCancel =
          row.original.status === "pending" ||
          row.original.status === "processing";
        if (!canCancel) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onCancel?.(row.original)}>
                <Ban className="mr-2 h-4 w-4" />
                Cancel job
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
