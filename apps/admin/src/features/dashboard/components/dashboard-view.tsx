"use client";

import { useDashboardStatsQuery } from "@/features/dashboard/hooks/use-dashboard-queries";
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
  type ChartConfig,
} from "@workspace/ui/components";
import { JobStatusLabels } from "@workspace/validation";
import { Cell, Pie, PieChart } from "recharts";
import { useMemo } from "react";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

function formatBytes(value: number | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return "—";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value;
  let unit = -1;
  do {
    size /= 1024;
    unit += 1;
  } while (size >= 1024 && unit < units.length - 1);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function statusLabel(status: string): string {
  return (
    JobStatusLabels[status as keyof typeof JobStatusLabels] ??
    status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
  );
}

export function DashboardView() {
  const { activeOrg } = useActiveOrg();
  const { data, isLoading, error } = useDashboardStatsQuery(activeOrg?.id);

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

  if (error) {
    return (
      <div className="rounded-md border p-6 text-destructive">
        Failed to load dashboard stats.
      </div>
    );
  }

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
        {[
          {
            label: "Files",
            value: data?.filesCount,
            hint: "Active objects",
          },
          {
            label: "Total size",
            value: isLoading ? undefined : formatBytes(data?.totalBytes),
            hint: "Active files",
          },
          {
            label: "Providers",
            value: data?.providersCount,
            hint: "Configured backends",
          },
          {
            label: "Downloads (7d)",
            value: data?.downloadsLast7d,
            hint: "Last 7 days",
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
                {isLoading ? "—" : (card.value ?? 0)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              Loading chart…
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
