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
  DataTableToolbar,
  DateRangePicker,
  TableEmptyState,
  TableError,
  type ChartConfig,
  type DateRangeValue,
} from "@workspace/ui/components";
import { useDataTable } from "@workspace/ui/hooks/use-data-table";
import { BarChart3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  BYTES_FILTER_MAX_MB,
  createDownloadsColumns,
} from "../columns/downloads-columns";
import {
  useDownloadsQuery,
  useMetricsRegionsQuery,
  useMetricsSummaryQuery,
  useStorageSeriesQuery,
  useTransferSeriesQuery,
  type DownloadLogRow,
} from "../hooks/use-metrics-queries";
import { deltaPercent, formatBytes } from "../lib/format";
import { DataRetrievedCard } from "./data-retrieved-card";
import { RegionMapCard } from "./region-map-card";
import { StorageSeriesCard } from "./storage-series-card";

const downloadsChartConfig = {
  downloads: { label: "Downloads", color: "var(--chart-1)" },
} satisfies ChartConfig;

const METRICS_PRESETS = [
  { key: "7d", label: "Last 7 days", minutes: 60 * 24 * 7 },
  { key: "14d", label: "Last 14 days", minutes: 60 * 24 * 14 },
  { key: "30d", label: "Last 30 days", minutes: 60 * 24 * 30 },
  { key: "90d", label: "Last 90 days", minutes: 60 * 24 * 90 },
];

function firstStringFilter(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" && first.trim() ? first.trim() : undefined;
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function stringArrayFilter(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function bytesRangeFilter(
  value: unknown,
): { minBytes?: number; maxBytes?: number } | undefined {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number"
  ) {
    return undefined;
  }
  const [minMb, maxMb] = value;
  // Slider works in MB; the API expects bytes. Skip bounds at the full range.
  const result: { minBytes?: number; maxBytes?: number } = {};
  if (minMb > 0) result.minBytes = Math.max(0, Math.floor(minMb * 1024 * 1024));
  if (maxMb < BYTES_FILTER_MAX_MB) {
    result.maxBytes = Math.max(0, Math.ceil(maxMb * 1024 * 1024));
  }
  return result.minBytes != null || result.maxBytes != null
    ? result
    : undefined;
}

function dateRangeFilter(
  value: unknown,
): { from?: string; to?: string } | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [fromRaw, toRaw] = value;
  const from =
    typeof fromRaw === "number"
      ? new Date(fromRaw).toISOString()
      : typeof fromRaw === "string"
        ? fromRaw
        : undefined;
  const to =
    typeof toRaw === "number"
      ? new Date(toRaw).toISOString()
      : typeof toRaw === "string"
        ? toRaw
        : undefined;
  if (!from && !to) return undefined;
  return { from, to };
}

function defaultRange(): DateRangeValue {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 13);
  from.setHours(0, 0, 0, 0);
  return { from, to, preset: "14d" };
}

function rangeDays(range: DateRangeValue | undefined): number {
  if (!range?.from || !range?.to) return 14;
  const ms = range.to.getTime() - range.from.getTime();
  return Math.min(365, Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1));
}

export function MetricsView() {
  const { activeOrg } = useActiveOrg();
  const [range, setRange] = useState<DateRangeValue | undefined>(defaultRange);
  const [regionMetric, setRegionMetric] = useState<"requests" | "bytes">(
    "requests",
  );

  const rangeParams = useMemo(
    () =>
      range?.from && range?.to
        ? {
            from: range.from.toISOString().slice(0, 10),
            to: range.to.toISOString().slice(0, 10),
          }
        : undefined,
    [range],
  );
  const days = rangeDays(range);

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useMetricsSummaryQuery(activeOrg?.id, rangeParams);

  const { data: regions, isLoading: regionsLoading } = useMetricsRegionsQuery(
    activeOrg?.id,
    { ...rangeParams, metric: regionMetric },
  );

  const { data: storageSeries, isLoading: storageLoading } =
    useStorageSeriesQuery(activeOrg?.id, days);

  const { data: transferSeries, isLoading: transferLoading } =
    useTransferSeriesQuery(activeOrg?.id, days);

  const countryOptions = useMemo(
    () =>
      (regions?.countries ?? [])
        .filter((c) => c.countryCode)
        .map((c) => ({
          value: c.countryCode!,
          label: c.countryCode!,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [regions?.countries],
  );

  const columns = useMemo(
    () => createDownloadsColumns({ countryOptions }),
    [countryOptions],
  );

  const { table } = useDataTable({
    columns,
    data: [] as DownloadLogRow[],
    pageCount: 0,
    getRowId: (row) => row.id,
    enableRowSelection: false,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [{ id: "downloadedAt", desc: true }],
      columnVisibility: { search: false },
    },
  });

  const pagination = table.getState().pagination;
  const sorting = table.getState().sorting;
  const columnFilters = table.getState().columnFilters;

  const searchTerm =
    firstStringFilter(columnFilters.find((f) => f.id === "search")?.value) ??
    "";
  const country = stringArrayFilter(
    columnFilters.find((f) => f.id === "countryCode")?.value,
  );
  const method = stringArrayFilter(
    columnFilters.find((f) => f.id === "downloadMethod")?.value,
  );
  const device = stringArrayFilter(
    columnFilters.find((f) => f.id === "device")?.value,
  );
  const bytesRange = bytesRangeFilter(
    columnFilters.find((f) => f.id === "bytesDownloaded")?.value,
  );
  const tableDateRange = dateRangeFilter(
    columnFilters.find((f) => f.id === "downloadedAt")?.value,
  );

  useEffect(() => {
    table.setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- table is stable
  }, [
    searchTerm,
    country.join(","),
    method.join(","),
    device.join(","),
    bytesRange?.minBytes,
    bytesRange?.maxBytes,
    tableDateRange?.from,
    tableDateRange?.to,
    rangeParams?.from,
    rangeParams?.to,
    activeOrg?.id,
  ]);

  const sort = sorting[0];
  const {
    data: downloads,
    isLoading: downloadsLoading,
    error: downloadsError,
    refetch,
  } = useDownloadsQuery({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    orgId: activeOrg?.id,
    search: searchTerm.trim() || undefined,
    country: country.length > 0 ? country : undefined,
    method: method.length > 0 ? method : undefined,
    device: device.length > 0 ? device : undefined,
    minBytes: bytesRange?.minBytes,
    maxBytes: bytesRange?.maxBytes,
    from: tableDateRange?.from ?? rangeParams?.from,
    to: tableDateRange?.to ?? rangeParams?.to,
    sort: sort?.id,
    order: sort ? (sort.desc ? "desc" : "asc") : undefined,
  });

  const items = useMemo(() => downloads?.items ?? [], [downloads?.items]);
  const totalPages = downloads?.totalPages ?? 0;

  table.setOptions((prev) => ({
    ...prev,
    data: items,
    pageCount: totalPages,
  }));

  useEffect(() => {
    if (totalPages > 0 && pagination.pageIndex >= totalPages) {
      table.setPageIndex(Math.max(0, totalPages - 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- table is stable
  }, [totalPages, pagination.pageIndex]);

  const chartData = useMemo(
    () =>
      (summary?.downloadsByDay ?? []).map((row) => ({
        day: row.day.slice(5),
        downloads: row.downloads,
      })),
    [summary?.downloadsByDay],
  );

  const downloadsDelta = deltaPercent(
    summary?.periodDownloads ?? 0,
    summary?.previousDownloads ?? 0,
  );
  const bytesDelta = deltaPercent(
    summary?.periodBytes ?? 0,
    summary?.previousBytes ?? 0,
  );

  if (summaryError) {
    return (
      <div className="rounded-md border p-6 text-destructive">
        Failed to load metrics.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Metrics</h1>
          <p className="text-sm text-muted-foreground">
            Storage and download activity for{" "}
            <span className="font-medium text-foreground">
              {activeOrg?.name ?? "…"}
            </span>
            .
          </p>
        </div>
        <DateRangePicker
          value={range}
          onChange={setRange}
          title="Period"
          placeholder="Select period"
          showTime={false}
          presets={METRICS_PRESETS}
          className="w-full sm:w-auto"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Downloads (period)",
            value: summaryLoading ? "—" : (summary?.periodDownloads ?? 0),
            hint:
              downloadsDelta == null
                ? "vs previous period"
                : `${downloadsDelta >= 0 ? "+" : ""}${downloadsDelta.toFixed(0)}% vs previous`,
          },
          {
            label: "Bytes downloaded",
            value: summaryLoading
              ? "—"
              : formatBytes(summary?.periodBytes ?? 0),
            hint:
              bytesDelta == null
                ? "vs previous period"
                : `${bytesDelta >= 0 ? "+" : ""}${bytesDelta.toFixed(0)}% vs previous`,
          },
          {
            label: "Total downloads",
            value: summaryLoading ? "—" : (summary?.totalDownloads ?? 0),
            hint: "All time",
          },
          {
            label: "Total bytes",
            value: summaryLoading
              ? "—"
              : formatBytes(summary?.bytesDownloaded ?? 0),
            hint: "All time",
          },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
              <CardDescription className="text-xs">{card.hint}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">
                {card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RegionMapCard
          data={regions}
          isLoading={regionsLoading}
          metric={regionMetric}
          onMetricChange={setRegionMetric}
        />
        <DataRetrievedCard data={transferSeries} isLoading={transferLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Downloaded files</CardTitle>
            <CardDescription>
              Download requests per day for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Loading chart…
              </div>
            ) : chartData.every((row) => row.downloads === 0) ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No downloads in this period
              </div>
            ) : (
              <ChartContainer
                config={downloadsChartConfig}
                className="h-64 w-full"
              >
                <AreaChart data={chartData} accessibilityLayer>
                  <defs>
                    <linearGradient
                      id="metrics-downloads"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="var(--color-downloads)"
                        stopOpacity={0.65}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-downloads)"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
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
                  <Area
                    type="monotone"
                    dataKey="downloads"
                    stroke="var(--color-downloads)"
                    fill="url(#metrics-downloads)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <StorageSeriesCard data={storageSeries} isLoading={storageLoading} />
      </div>

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
            <DataTableToolbar table={table} />
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
