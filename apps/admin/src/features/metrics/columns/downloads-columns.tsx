"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Badge,
  CopyButton,
  DataGridColumnHeader,
  DateDisplay,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components";
import {
  Bot,
  Globe2,
  Laptop,
  Smartphone,
  Tablet,
  type LucideIcon,
} from "lucide-react";
import { createSearchColumn } from "@/lib/data-table-search-column";
import { formatBytes } from "../lib/format";
import type { DownloadLogRow } from "../hooks/use-metrics-queries";

const METHOD_OPTIONS = [
  { value: "direct", label: "Direct" },
  { value: "signed_url", label: "Signed URL" },
  { value: "cdn", label: "CDN" },
];

export const DEVICE_OPTIONS = [
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
  { value: "bot", label: "Bot" },
  { value: "other", label: "Other" },
];

/** Slider bounds in MB; the list view converts the selection back to bytes. */
export const BYTES_FILTER_MAX_MB = 1024;

const DEVICE_ICONS: Record<string, LucideIcon> = {
  desktop: Laptop,
  mobile: Smartphone,
  tablet: Tablet,
  bot: Bot,
  other: Globe2,
};

function userAgentPresentation(userAgent: string): {
  icon: LucideIcon;
  device: string;
  browser: string;
} {
  const ua = userAgent.toLowerCase();
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("firefox/")
      ? "Firefox"
      : ua.includes("chrome/") || ua.includes("crios/")
        ? "Chrome"
        : ua.includes("safari/")
          ? "Safari"
          : "Browser";

  const value = /(bot|crawler|spider|slurp)/.test(ua)
    ? "bot"
    : /(ipad|tablet|kindle|silk)/.test(ua)
      ? "tablet"
      : /(mobile|iphone|ipod|android.*mobile)/.test(ua)
        ? "mobile"
        : /(windows|macintosh|x11|cros|linux)/.test(ua)
          ? "desktop"
          : "other";

  return {
    icon: DEVICE_ICONS[value] ?? Globe2,
    device: DEVICE_OPTIONS.find((o) => o.value === value)?.label ?? "Other",
    browser,
  };
}

export function createDownloadsColumns(opts?: {
  countryOptions?: Array<{ value: string; label: string }>;
}): ColumnDef<DownloadLogRow>[] {
  return [
    createSearchColumn<DownloadLogRow>("Search file, IP, country…"),
    {
      id: "fileName",
      accessorKey: "fileName",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="File" />
      ),
      enableSorting: true,
      meta: {
        label: "File",
        skeleton: (
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        ),
      },
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[260px] space-y-0.5">
          <div className="truncate text-sm font-medium" dir="auto">
            {row.original.fileName ?? "Deleted file"}
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <span
              className="truncate font-mono text-[11px] text-muted-foreground"
              title={row.original.fileId}
            >
              {row.original.fileId}
            </span>
            <CopyButton
              content={row.original.fileId}
              variant="ghost"
              size="sm"
              className="size-5 shrink-0 text-muted-foreground shadow-none"
              aria-label="Copy file ID"
            />
          </div>
        </div>
      ),
    },
    {
      accessorKey: "downloadedAt",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="When" />
      ),
      enableSorting: true,
      enableColumnFilter: true,
      meta: {
        label: "When",
        variant: "dateRange",
        skeleton: <Skeleton className="h-4 w-28" />,
      },
      cell: ({ row }) => (
        <DateDisplay date={row.original.downloadedAt} format="relative" />
      ),
    },
    {
      accessorKey: "bytesDownloaded",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Bytes" />
      ),
      enableSorting: true,
      enableColumnFilter: true,
      meta: {
        label: "Bytes",
        variant: "range",
        unit: "MB",
        range: [0, BYTES_FILTER_MAX_MB],
        skeleton: <Skeleton className="h-4 w-16" />,
      },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatBytes(row.original.bytesDownloaded)}
        </span>
      ),
    },
    {
      accessorKey: "downloadMethod",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Method" />
      ),
      enableSorting: true,
      enableColumnFilter: true,
      meta: {
        label: "Method",
        variant: "multiSelect",
        options: METHOD_OPTIONS,
        skeleton: <Skeleton className="h-4 w-20" />,
      },
      cell: ({ row }) => {
        const method = row.original.downloadMethod;
        if (!method) return <span className="text-muted-foreground">—</span>;
        const label =
          METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method;
        return (
          <Badge variant="secondary" className="font-normal capitalize">
            {label}
          </Badge>
        );
      },
    },
    {
      id: "countryCode",
      accessorKey: "countryCode",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Country" />
      ),
      enableSorting: true,
      enableColumnFilter: true,
      meta: {
        label: "Country",
        variant: "multiSelect",
        options: opts?.countryOptions ?? [],
        skeleton: <Skeleton className="h-4 w-16" />,
      },
      cell: ({ row }) => {
        const code = row.original.countryCode;
        if (!code) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span aria-hidden className="text-base leading-none">
              {countryFlag(code)}
            </span>
            <span className="font-medium">{code}</span>
            {row.original.city ? (
              <span className="text-muted-foreground">· {row.original.city}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      accessorKey: "ipAddress",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="IP" />
      ),
      enableSorting: false,
      meta: { label: "IP", skeleton: <Skeleton className="h-4 w-24" /> },
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.ipAddress ?? "—"}
        </span>
      ),
    },
    {
      id: "device",
      accessorFn: (row) => row.userAgent,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Device" />
      ),
      enableSorting: false,
      enableColumnFilter: true,
      meta: {
        label: "Device",
        variant: "multiSelect",
        options: DEVICE_OPTIONS,
        skeleton: <Skeleton className="h-4 w-32" />,
      },
      cell: ({ row }) => {
        const ua = row.original.userAgent;
        if (!ua) return <span className="text-muted-foreground">—</span>;
        const presentation = userAgentPresentation(ua);
        const DeviceIcon = presentation.icon;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-default items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md border bg-muted/40">
                  <DeviceIcon
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {presentation.device}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {presentation.browser}
                  </span>
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-md break-all text-xs">
              {ua}
            </TooltipContent>
          </Tooltip>
        );
      },
    },
  ];
}

function countryFlag(code: string): string {
  const upper = code.toUpperCase();
  if (upper.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + (upper.charCodeAt(0) - 65),
    A + (upper.charCodeAt(1) - 65),
  );
}
