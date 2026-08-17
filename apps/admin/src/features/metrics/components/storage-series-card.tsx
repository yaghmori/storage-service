"use client";

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
import { Info } from "lucide-react";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatBytes } from "../lib/format";
import type { StorageSeriesResponse } from "../hooks/use-metrics-queries";

const PROVIDER_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

interface StorageSeriesCardProps {
  data?: StorageSeriesResponse;
  isLoading?: boolean;
}

export function StorageSeriesCard({ data, isLoading }: StorageSeriesCardProps) {
  const providers = useMemo(() => {
    const totals = new Map<string, { name: string; uploadedBytes: number }>();
    for (const point of data?.series ?? []) {
      for (const provider of point.byProvider) {
        const current = totals.get(provider.providerId) ?? {
          name: provider.name,
          uploadedBytes: 0,
        };
        current.uploadedBytes += provider.uploadedBytes;
        totals.set(provider.providerId, current);
      }
    }
    return Array.from(totals.entries()).map(([providerId, provider], index) => ({
      providerId,
      ...provider,
      color: PROVIDER_COLORS[index % PROVIDER_COLORS.length],
      key: `p_${providerId.replace(/[^a-zA-Z0-9]/g, "")}`,
    }));
  }, [data?.series]);

  const chartData = useMemo(() => {
    return (data?.series ?? []).map((row) => {
      const point: Record<string, string | number> = {
        day: row.day.slice(5),
        uploadedBytes: row.uploadedBytes,
      };
      for (const provider of providers) {
        const match = row.byProvider.find(
          (p) => p.providerId === provider.providerId,
        );
        point[provider.key] = match?.uploadedBytes ?? 0;
      }
      return point;
    });
  }, [data?.series, providers]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      uploadedBytes: { label: "Total uploaded", color: "var(--chart-1)" },
    };
    for (const provider of providers) {
      config[provider.key] = {
        label: provider.name,
        color: provider.color,
      };
    }
    return config;
  }, [providers]);

  const totalUploadedBytes = (data?.series ?? []).reduce(
    (total, point) => total + point.uploadedBytes,
    0,
  );
  const hasData = totalUploadedBytes > 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Uploaded data
          <Info className="size-3.5 text-muted-foreground" aria-hidden />
        </CardTitle>
        <CardDescription>
          File bytes uploaded each day, split by storage provider
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-foreground/70" />
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium tabular-nums">
              {formatBytes(totalUploadedBytes)}
            </span>
          </div>
          {providers.map((provider) => (
            <div key={provider.providerId} className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ background: provider.color }}
              />
              <span className="text-muted-foreground">{provider.name}</span>
              <span className="font-medium tabular-nums">
                {formatBytes(provider.uploadedBytes)}
              </span>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Loading chart…
          </div>
        ) : !hasData ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No data is available for this time range.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <AreaChart data={chartData} accessibilityLayer>
              <defs>
                {[...providers.map((provider) => provider.key), "uploadedBytes"].map(
                  (key) => (
                    <linearGradient
                      key={key}
                      id={`storage-series-${key}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={`var(--color-${key})`}
                        stopOpacity={0.65}
                      />
                      <stop
                        offset="95%"
                        stopColor={`var(--color-${key})`}
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  ),
                )}
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(value) => formatBytes(Number(value))}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {chartConfig[String(name)]?.label ?? name}
                        </span>
                        <span className="font-mono font-medium tabular-nums">
                          {formatBytes(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              {providers.length > 0 ? (
                providers.map((provider) => (
                  <Area
                    key={provider.key}
                    type="monotone"
                    dataKey={provider.key}
                    stackId="providers"
                    stroke={`var(--color-${provider.key})`}
                    fill={`url(#storage-series-${provider.key})`}
                    strokeWidth={2}
                    dot={false}
                  />
                ))
              ) : (
                <Area
                  type="monotone"
                  dataKey="uploadedBytes"
                  stroke="var(--color-uploadedBytes)"
                  fill="url(#storage-series-uploadedBytes)"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {providers.length > 0 ? (
                <ChartLegend content={<ChartLegendContent />} />
              ) : null}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
