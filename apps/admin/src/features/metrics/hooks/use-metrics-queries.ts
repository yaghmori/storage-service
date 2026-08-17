"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { MetricsEndpoints } from "@/lib/constants/endpoints";
import { metricsKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";

export interface MetricsSummary {
  totalDownloads: number;
  bytesDownloaded: number;
  periodDownloads: number;
  periodBytes: number;
  previousDownloads: number;
  previousBytes: number;
  downloadsByDay: Array<{
    day: string;
    downloads: number;
    bytes: number;
  }>;
  from: string;
  to: string;
}

export interface MetricsRegions {
  total: number;
  totalRequests: number;
  totalBytes: number;
  metric: "requests" | "bytes";
  regions: Array<{
    region: string;
    label: string;
    requests: number;
    bytes: number;
    share: number;
  }>;
  countries: Array<{
    countryCode: string | null;
    region: string;
    requests: number;
    bytes: number;
    lat: number | null;
    lon: number | null;
  }>;
  from: string;
  to: string;
}

export interface StorageSeriesPoint {
  day: string;
  storedBytes: number;
  uploadedBytes: number;
  objectCount: number;
  byProvider: Array<{
    providerId: string;
    name: string;
    storedBytes: number;
    uploadedBytes: number;
    objectCount: number;
  }>;
}

export interface StorageSeriesResponse {
  averageBytes: number;
  currentBytes: number;
  currentObjects: number;
  series: StorageSeriesPoint[];
  from: string;
  to: string;
}

export interface TransferSeriesResponse {
  totalBytes: number;
  totalRequests: number;
  devices: Array<{
    device: "desktop" | "mobile" | "tablet" | "bot" | "other";
    requests: number;
    bytes: number;
  }>;
  series: Array<{
    day: string;
    bytesRetrieved: number;
    requests: number;
  }>;
  from: string;
  to: string;
}

export interface DownloadLogRow {
  id: string;
  orgId: string;
  fileId: string;
  variantId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  userId: string | null;
  bytesDownloaded: number | string | null;
  downloadMethod: string | null;
  referer: string | null;
  countryCode: string | null;
  regionCode: string | null;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
  downloadedAt: string;
  fileName: string | null;
  mimeType: string | null;
}

interface DownloadsListResponse {
  items: DownloadLogRow[];
  total: number;
  page: number;
  limit: number;
}

export function useMetricsSummaryQuery(
  orgId?: string,
  range?: { from?: string; to?: string },
) {
  return useQuery({
    queryKey: metricsKeys.summary(orgId, range),
    queryFn: async () => {
      const response = await upstream.get(MetricsEndpoints.Summary, {
        params: { orgId, ...range },
      });
      return unwrapApiData<MetricsSummary>(response.data);
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

export function useMetricsRegionsQuery(
  orgId?: string,
  params?: {
    from?: string;
    to?: string;
    metric?: "requests" | "bytes";
  },
) {
  return useQuery({
    queryKey: metricsKeys.regions(orgId, params),
    queryFn: async () => {
      const response = await upstream.get(MetricsEndpoints.Regions, {
        params: { orgId, ...params },
      });
      return unwrapApiData<MetricsRegions>(response.data);
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

export function useStorageSeriesQuery(orgId?: string, days = 30) {
  return useQuery({
    queryKey: metricsKeys.storageSeries(orgId, days),
    queryFn: async () => {
      const response = await upstream.get(MetricsEndpoints.StorageSeries, {
        params: { orgId, days },
      });
      return unwrapApiData<StorageSeriesResponse>(response.data);
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

export function useTransferSeriesQuery(orgId?: string, days = 30) {
  return useQuery({
    queryKey: metricsKeys.transferSeries(orgId, days),
    queryFn: async () => {
      const response = await upstream.get(MetricsEndpoints.TransferSeries, {
        params: { orgId, days },
      });
      return unwrapApiData<TransferSeriesResponse>(response.data);
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

export function useDownloadsQuery(params?: {
  page?: number;
  limit?: number;
  orgId?: string;
  search?: string;
  country?: string[];
  method?: string[];
  device?: string[];
  minBytes?: number;
  maxBytes?: number;
  from?: string;
  to?: string;
  sort?: string;
  order?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: metricsKeys.downloads(params as Record<string, unknown> | undefined),
    queryFn: async () => {
      const response = await upstream.get(MetricsEndpoints.Downloads, {
        params: {
          ...params,
          country: params?.country?.length
            ? params.country.join(",")
            : undefined,
          method: params?.method?.length ? params.method.join(",") : undefined,
          device: params?.device?.length ? params.device.join(",") : undefined,
        },
      });
      const payload = unwrapApiData<DownloadsListResponse>(response.data);
      const limit = Number(payload.limit) || params?.limit || 10;
      const page = Number(payload.page) || params?.page || 1;
      const total = Number(payload.total) || 0;
      const totalPages = Math.ceil(total / limit) || 0;
      return {
        items: payload.items ?? [],
        total,
        totalPages,
        page,
        limit,
      };
    },
    placeholderData: (previousData) => previousData,
    enabled: !!params?.orgId,
  });
}
