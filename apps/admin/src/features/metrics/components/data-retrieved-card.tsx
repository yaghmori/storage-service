"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components";
import { Bot, Info, Laptop, Smartphone, Tablet, Waypoints } from "lucide-react";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatBytes } from "../lib/format";
import type { TransferSeriesResponse } from "../hooks/use-metrics-queries";

const chartConfig = {
  bytesRetrieved: { label: "Data retrieved", color: "var(--chart-2)" },
  requests: { label: "Requests", color: "var(--chart-4)" },
} satisfies ChartConfig;

const DEVICE_PRESENTATION = {
  desktop: { label: "Desktop", icon: Laptop },
  mobile: { label: "Mobile", icon: Smartphone },
  tablet: { label: "Tablet", icon: Tablet },
  bot: { label: "Bot", icon: Bot },
  other: { label: "Other", icon: Waypoints },
} as const;

interface DataRetrievedCardProps {
  data?: TransferSeriesResponse;
  isLoading?: boolean;
}

export function DataRetrievedCard({ data, isLoading }: DataRetrievedCardProps) {
  const chartData = useMemo(
    () =>
      (data?.series ?? []).map((row) => ({
        day: row.day.slice(5),
        bytesRetrieved: row.bytesRetrieved,
        requests: row.requests,
      })),
    [data?.series],
  );

  const hasData = (data?.totalBytes ?? 0) > 0 || (data?.totalRequests ?? 0) > 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Data retrieved
          <Info className="size-3.5 text-muted-foreground" aria-hidden />
        </CardTitle>
        <CardDescription>
          Bytes and request volume served from download logs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-foreground/70" />
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium tabular-nums">
              {formatBytes(data?.totalBytes ?? 0)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-chart-4" />
            <span className="text-muted-foreground">Requests</span>
            <span className="font-medium tabular-nums">
              {data?.totalRequests ?? 0}
            </span>
          </div>
        </div>
        {data?.devices?.length ? (
          <div className="flex flex-wrap gap-2">
            {data.devices.map((device) => {
              const presentation = DEVICE_PRESENTATION[device.device];
              const DeviceIcon = presentation.icon;
              return (
                <div
                  key={device.device}
                  className="inline-flex items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs"
                  title={`${formatBytes(device.bytes)} retrieved`}
                >
                  <DeviceIcon
                    className="size-3.5 text-muted-foreground"
                    aria-hidden
                  />
                  <span>{presentation.label}</span>
                  <span className="font-medium tabular-nums">
                    {device.requests}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

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
                <linearGradient
                  id="data-retrieved-bytes"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-bytesRetrieved)"
                    stopOpacity={0.65}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-bytesRetrieved)"
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
                yAxisId="bytes"
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(value) => formatBytes(Number(value))}
              />
              <YAxis
                yAxisId="requests"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={36}
                allowDecimals={false}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {chartConfig[name as keyof typeof chartConfig]?.label ??
                            name}
                        </span>
                        <span className="font-mono font-medium tabular-nums">
                          {name === "bytesRetrieved"
                            ? formatBytes(Number(value))
                            : value}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Area
                yAxisId="bytes"
                type="monotone"
                dataKey="bytesRetrieved"
                stroke="var(--color-bytesRetrieved)"
                fill="url(#data-retrieved-bytes)"
                strokeWidth={2}
                dot={false}
              />
              <Area
                yAxisId="requests"
                type="monotone"
                dataKey="requests"
                stroke="var(--color-requests)"
                fill="none"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
