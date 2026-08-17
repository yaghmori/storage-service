"use client";

import { useDashboardStatsQuery } from "@/features/dashboard/hooks/use-dashboard-queries";
import { formatBytes } from "@/features/metrics/lib/format";
import { StorageSeriesCard } from "@/features/metrics/components/storage-series-card";
import { useStorageSeriesQuery } from "@/features/metrics/hooks/use-metrics-queries";
import { useOrgUsageQuery } from "@/features/orgs/hooks/use-orgs-queries";
import { useActiveOrg } from "@/provider/org-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Skeleton,
  type ChartConfig,
} from "@workspace/ui/components";
import { JobStatusLabels } from "@workspace/validation";
import {
  Database,
  Download,
  HardDrive,
  Server,
} from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

function statusLabel(status: string): string {
  return (
    JobStatusLabels[status as keyof typeof JobStatusLabels] ??
    status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
  );
}

function deltaLabel(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? "No change" : "New activity";
  }
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}% vs prior 7d`;
}

export function DashboardView() {
  const { activeOrg } = useActiveOrg();
  const { data, isLoading, error } = useDashboardStatsQuery(activeOrg?.id);
  const usageQuery = useOrgUsageQuery(activeOrg?.id);
  const storageSeries = useStorageSeriesQuery(activeOrg?.id, 30);

  const statusChartData = useMemo(
    () =>
      Object.entries(data?.jobsByStatus ?? {})
        .filter(([, count]) => count > 0)
        .map(([status, count], index) => ({
          status,
          label: statusLabel(status),
          count,
          fill: CHART_COLORS[index % CHART_COLORS.length],
        }))
        .sort((a, b) => b.count - a.count),
    [data?.jobsByStatus],
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      count: { label: "Jobs" },
    };
    for (const row of statusChartData) {
      config[row.status] = {
        label: row.label,
        color: row.fill,
      };
    }
    return config;
  }, [statusChartData]);

  const totalInChart = statusChartData.reduce((sum, row) => sum + row.count, 0);

  const breakdownData = useMemo(
    () =>
      (usageQuery.data?.breakdown ?? [])
        .filter((row) => row.bytes > 0)
        .map((row, index) => ({
          category: row.category,
          label: row.label,
          bytes: row.bytes,
          count: row.count,
          fill: CHART_COLORS[index % CHART_COLORS.length],
        })),
    [usageQuery.data?.breakdown],
  );

  const breakdownConfig = useMemo(() => {
    const config: ChartConfig = {
      bytes: { label: "Bytes" },
    };
    for (const row of breakdownData) {
      config[row.category] = { label: row.label, color: row.fill };
    }
    return config;
  }, [breakdownData]);

  const quotaUsed = Number(usageQuery.data?.usedBytes ?? data?.totalBytes ?? 0);
  const quotaLimit = Number(usageQuery.data?.storageQuotaBytes ?? 0);
  const quotaPct =
    quotaLimit > 0 ? Math.min(100, (quotaUsed / quotaLimit) * 100) : null;

  const sparkConfig = {
    count: { label: "Downloads", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  if (error) {
    return (
      <div className="rounded-md border p-6 text-destructive">
        Failed to load dashboard stats.
      </div>
    );
  }

  const statCards = [
    {
      label: "Files",
      value: data?.filesCount,
      hint: `${data?.filesLast7d ?? 0} added in last 7d`,
      icon: Database,
    },
    {
      label: "Total size",
      value: isLoading ? undefined : formatBytes(data?.totalBytes),
      hint: `${formatBytes(data?.bytesLast7d ?? 0)} added in last 7d`,
      icon: HardDrive,
    },
    {
      label: "Providers",
      value: data?.providersCount,
      hint: "Configured backends",
      icon: Server,
    },
    {
      label: "Downloads (7d)",
      value: data?.downloadsLast7d,
      hint: deltaLabel(data?.downloadsLast7d ?? 0, data?.downloadsPrev7d ?? 0),
      icon: Download,
      sparkline: data?.downloadsSparkline,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Storage overview for{" "}
          <span className="font-medium text-foreground">
            {activeOrg?.name ?? "…"}
          </span>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <CardDescription className="text-xs">{card.hint}</CardDescription>
              </div>
              <card.icon className="size-6 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-semibold tabular-nums">
                {isLoading ? <Skeleton className="h-8 w-20" /> : (card.value ?? 0)}
              </div>
              {card.sparkline && card.sparkline.length > 0 ? (
                <ChartContainer config={sparkConfig} className="h-12 w-full">
                  <AreaChart data={card.sparkline}>
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-count)"
                      fill="var(--color-count)"
                      fillOpacity={0.15}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ChartContainer>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Storage quota</CardTitle>
            <CardDescription>
              {quotaLimit > 0
                ? `${formatBytes(quotaUsed)} of ${formatBytes(quotaLimit)}`
                : `${formatBytes(quotaUsed)} used (no quota set)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usageQuery.isLoading ? (
              <Skeleton className="mx-auto size-48 rounded-full" />
            ) : (
              <ChartContainer
                config={{
                  used: { label: "Used", color: "var(--chart-1)" },
                  free: { label: "Free", color: "var(--muted)" },
                }}
                className="mx-auto aspect-square max-h-56"
              >
                <PieChart>
                  <Pie
                    data={
                      quotaLimit > 0
                        ? [
                            {
                              name: "used",
                              value: quotaUsed,
                              fill: "var(--chart-1)",
                            },
                            {
                              name: "free",
                              value: Math.max(0, quotaLimit - quotaUsed),
                              fill: "var(--muted)",
                            },
                          ]
                        : [
                            {
                              name: "used",
                              value: Math.max(quotaUsed, 1),
                              fill: "var(--chart-1)",
                            },
                          ]
                    }
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={84}
                    strokeWidth={2}
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (
                          viewBox &&
                          "cx" in viewBox &&
                          "cy" in viewBox
                        ) {
                          return (
                            <text
                              x={viewBox.cx}
                              y={viewBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy ?? 0) - 4}
                                className="fill-foreground text-2xl font-semibold"
                              >
                                {quotaPct == null
                                  ? formatBytes(quotaUsed)
                                  : `${quotaPct.toFixed(0)}%`}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy ?? 0) + 16}
                                className="fill-muted-foreground text-xs"
                              >
                                {quotaPct == null ? "used" : "of quota"}
                              </tspan>
                            </text>
                          );
                        }
                        return null;
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Storage by type</CardTitle>
            <CardDescription>MIME category breakdown of active objects</CardDescription>
          </CardHeader>
          <CardContent>
            {usageQuery.isLoading ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : breakdownData.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                No usage data yet
              </div>
            ) : (
              <ChartContainer config={breakdownConfig} className="h-56 w-full">
                <BarChart data={breakdownData} layout="vertical" accessibilityLayer>
                  <CartesianGrid horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => formatBytes(Number(value))}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={88}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, _name, item) => (
                          <div className="flex w-full flex-col gap-0.5">
                            <span className="font-medium">
                              {formatBytes(Number(value))}
                            </span>
                            <span className="text-muted-foreground">
                              {item.payload?.count ?? 0} objects
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="bytes" radius={4}>
                    {breakdownData.map((row) => (
                      <Cell key={row.category} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <StorageSeriesCard
        data={storageSeries.data}
        isLoading={storageSeries.isLoading}
      />

      <Card>
        <CardHeader>
          <CardTitle>Jobs by status</CardTitle>
          <CardDescription>
            Processing queue distribution
            {totalInChart > 0 ? ` · ${totalInChart} jobs` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-72 items-center justify-center">
              <Skeleton className="size-56 rounded-full" />
            </div>
          ) : statusChartData.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              No jobs yet
            </div>
          ) : (
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square max-h-80 w-full"
            >
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      nameKey="status"
                      formatter={(value, _name, item) => (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="text-muted-foreground">
                            {item.payload?.label ?? item.name}
                          </span>
                          <span className="font-mono font-medium tabular-nums">
                            {value}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie
                  data={statusChartData}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={64}
                  outerRadius={108}
                  strokeWidth={2}
                  paddingAngle={2}
                >
                  {statusChartData.map((row) => (
                    <Cell
                      key={row.status}
                      fill={`var(--color-${row.status})`}
                      stroke="var(--background)"
                    />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy ?? 0) - 4}
                              className="fill-foreground text-2xl font-semibold"
                            >
                              {totalInChart}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy ?? 0) + 16}
                              className="fill-muted-foreground text-xs"
                            >
                              jobs
                            </tspan>
                          </text>
                        );
                      }
                      return null;
                    }}
                  />
                </Pie>
                <ChartLegend
                  content={<ChartLegendContent nameKey="status" />}
                  className="-translate-y-1 flex-wrap gap-2"
                />
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
