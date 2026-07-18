"use client";

import { useActiveOrg } from "@/provider/org-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  DataGrid,
  DataGridContainer,
  DataGridPagination,
  DataGridTable,
  DataGridTableContainer,
  TableEmptyState,
  TableError,
  type ChartConfig,
} from "@workspace/ui/components";
import { useDataTable } from "@workspace/ui/hooks/use-data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { DateDisplay, Skeleton } from "@workspace/ui/components";
import { BarChart3 } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  useAnalyticsSummaryQuery,
  useDownloadsQuery,
  type DownloadLogRow,
} from "../hooks/use-analytics-queries";

function formatBytes(value: number | string | null | undefined): string {
  if (value == null) return "—";
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

const chartConfig = {
  downloads: { label: "Downloads", color: "var(--chart-1)" },
} satisfies ChartConfig;

const downloadColumns: ColumnDef<DownloadLogRow>[] = [
  {
    accessorKey: "downloadedAt",
    header: "When",
    meta: { label: "When", skeleton: <Skeleton className="h-4 w-28" /> },
    cell: ({ row }) => (
      <DateDisplay date={row.original.downloadedAt} format="relative" />
    ),
  },
  {
    accessorKey: "fileId",
    header: "File",
    meta: { label: "File", skeleton: <Skeleton className="h-4 w-24" /> },
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.fileId.slice(0, 8)}…
      </span>
    ),
  },
  {
    accessorKey: "bytesDownloaded",
    header: "Bytes",
    meta: { label: "Bytes", skeleton: <Skeleton className="h-4 w-16" /> },
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatBytes(row.original.bytesDownloaded)}
      </span>
    ),
  },
  {
    accessorKey: "downloadMethod",
    header: "Method",
    meta: { label: "Method", skeleton: <Skeleton className="h-4 w-20" /> },
    cell: ({ row }) => (
      <span className="capitalize text-muted-foreground">
        {row.original.downloadMethod ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "ipAddress",
    header: "IP",
    meta: { label: "IP", skeleton: <Skeleton className="h-4 w-24" /> },
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.ipAddress ?? "—"}
      </span>
    ),
  },
];

export function AnalyticsView() {
  const { activeOrg } = useActiveOrg();
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useAnalyticsSummaryQuery(activeOrg?.id);

  const { table } = useDataTable({
    columns: downloadColumns,
    data: [] as DownloadLogRow[],
    pageCount: 0,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
  });

  const pagination = table.getState().pagination;
  const {
    data: downloads,
    isLoading: downloadsLoading,
    error: downloadsError,
    refetch,
  } = useDownloadsQuery({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    orgId: activeOrg?.id,
  });

  table.setOptions((prev) => ({
    ...prev,
    data: downloads?.items ?? [],
    pageCount: downloads?.totalPages ?? 0,
  }));

  const chartData = useMemo(
    () =>
      (summary?.downloadsByDay ?? []).map((row) => ({
        day: row.day.slice(5),
        downloads: row.downloads,
      })),
    [summary?.downloadsByDay],
  );

  if (summaryError) {
    return (
      <div className="rounded-md border p-6 text-destructive">
        Failed to load analytics.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Download activity for{" "}
          <span className="font-medium text-foreground">
            {activeOrg?.name ?? "…"}
          </span>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total downloads
            </CardTitle>
            <CardDescription className="text-xs">All time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {summaryLoading ? "—" : (summary?.totalDownloads ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bytes downloaded
            </CardTitle>
            <CardDescription className="text-xs">All time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {summaryLoading
                ? "—"
                : formatBytes(summary?.bytesDownloaded ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Downloads (14 days)</CardTitle>
          <CardDescription>Daily download volume</CardDescription>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Loading chart…
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No downloads yet
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={chartData} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="downloads"
                  fill="var(--color-downloads)"
                  radius={4}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Recent downloads</h2>
        <DataGrid
          table={table}
          recordCount={downloads?.total ?? 0}
          isLoading={downloadsLoading}
          errorState={
            downloadsError ? (
              <TableError
                error={downloadsError}
                onRetry={() => refetch()}
                title="Failed to load downloads"
              />
            ) : undefined
          }
          emptyMessage={
            <TableEmptyState
              title="No downloads"
              description="Download events will appear here."
              icon={BarChart3}
            />
          }
        >
          <DataGridContainer className="flex flex-col overflow-auto">
            <DataGridTableContainer>
              <DataGridTable />
            </DataGridTableContainer>
            <DataGridPagination />
          </DataGridContainer>
        </DataGrid>
      </div>
    </div>
  );
}
