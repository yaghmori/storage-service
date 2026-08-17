"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { formatJobElapsed } from "@/lib/format-job-elapsed";
import {
  Badge,
  Button,
  DataGridColumnHeader,
  DateDisplay,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Progress,
  Skeleton,
} from "@workspace/ui/components";
import { JobStatusLabels, ProcessorKeyLabels } from "@workspace/validation";
import {
  Ban,
  Eye,
  MoreHorizontal,
  PlayCircle,
  RefreshCw,
  Rocket,
} from "lucide-react";
import {
  FilteredSelectAllHeader,
  FilteredSelectRowCell,
} from "@/lib/filtered-selection";
import {
  isJobCancellable,
  isJobPending,
  isJobRetryable,
  isJobTerminal,
  type JobRow,
} from "../hooks/use-jobs-queries";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "failed":
      return "bg-destructive/15 text-destructive";
    case "skipped":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-400";
    case "processing":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "cancelled":
      return "bg-muted text-muted-foreground";
    default:
      return "";
  }
}

export type JobsColumnHandlers = {
  onView?: (row: JobRow) => void;
  onCancel?: (row: JobRow) => void;
  onRetry?: (row: JobRow) => void;
  onRerun?: (row: JobRow) => void;
  onPrioritize?: (row: JobRow) => void;
};

export function createJobsColumns({
  onView,
  onCancel,
  onRetry,
  onRerun,
  onPrioritize,
}: JobsColumnHandlers = {}): ColumnDef<JobRow>[] {
  return [
    {
      id: "select",
      header: () => <FilteredSelectAllHeader />,
      cell: ({ row }) => <FilteredSelectRowCell id={row.original.id} />,
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
        placeholder: "Search by file name, file ID, or job ID…",
      },
    },
    {
      accessorKey: "processorKey",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Type" />
      ),
      enableColumnFilter: true,
      meta: {
        variant: "multiSelect",
        label: "Type",
        options: Object.entries(ProcessorKeyLabels).map(([value, label]) => ({
          value,
          label,
        })),
        skeleton: <Skeleton className="h-5 w-20" />,
      },
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {ProcessorKeyLabels[row.original.processorKey] ??
            row.original.processorKey}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Status" />
      ),
      enableColumnFilter: true,
      meta: {
        variant: "multiSelect",
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
          {JobStatusLabels[
            row.original.status as keyof typeof JobStatusLabels
          ] ?? row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "fileName",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="File" />
      ),
      meta: { label: "File", skeleton: <Skeleton className="h-4 w-36" /> },
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[240px]">
          <p className="truncate font-medium" dir="auto">
            {row.original.fileName ?? "—"}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {row.original.fileId}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "progress",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Progress" />
      ),
      meta: { label: "Progress", skeleton: <Skeleton className="h-4 w-20" /> },
      cell: ({ row }) => {
        const progress = row.original.progress;
        if (progress == null) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="w-24 space-y-1">
            <Progress value={Math.max(0, Math.min(100, Number(progress)))} />
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {progress}%
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "retryCount",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Retries" />
      ),
      meta: { label: "Retries", skeleton: <Skeleton className="h-4 w-10" /> },
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.retryCount}</span>
      ),
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
    {
      id: "elapsed",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Elapsed" />
      ),
      enableSorting: false,
      meta: {
        label: "Elapsed",
        skeleton: <Skeleton className="h-4 w-14" />,
      },
      cell: ({ row }) => {
        const elapsed = formatJobElapsed(
          row.original.startedAt,
          row.original.completedAt,
        );
        return (
          <span className="tabular-nums text-muted-foreground">
            {elapsed ?? "—"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        const status = String(row.original.status);
        const canCancel = isJobCancellable(status);
        const canRetry = isJobRetryable(status);
        const canRerun = isJobTerminal(status);
        const canPrioritize = isJobPending(status);
        return (
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
              {canPrioritize && onPrioritize ? (
                <DropdownMenuItem onClick={() => onPrioritize(row.original)}>
                  <Rocket className="mr-2 h-4 w-4" />
                  Prioritize (run next)
                </DropdownMenuItem>
              ) : null}
              {canRetry ? (
                <DropdownMenuItem onClick={() => onRetry?.(row.original)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry job
                </DropdownMenuItem>
              ) : null}
              {canRerun && onRerun ? (
                <DropdownMenuItem onClick={() => onRerun(row.original)}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Rerun with parameters…
                </DropdownMenuItem>
              ) : null}
              {canCancel ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onCancel?.(row.original)}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Cancel job
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
