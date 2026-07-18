"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { AnalyticsEndpoints } from "@/lib/constants/endpoints";
import { QUERY_KEYS } from "@/lib/constants/query-keys";
import { useQuery } from "@tanstack/react-query";

export interface AnalyticsSummary {
  totalDownloads: number;
  bytesDownloaded: number;
  downloadsByDay: Array<{
    day: string;
    downloads: number;
    bytes: number;
  }>;
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
  downloadedAt: string;
}

interface DownloadsListResponse {
  items: DownloadLogRow[];
  total: number;
  page: number;
  limit: number;
}

export function useAnalyticsSummaryQuery(orgId?: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ANALYTICS.ALL, "summary", orgId],
    queryFn: async () => {
      const response = await upstream.get(AnalyticsEndpoints.Summary, {
        params: { orgId },
      });
      return unwrapApiData<AnalyticsSummary>(response.data);
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

export function useDownloadsQuery(params?: {
  page?: number;
  limit?: number;
  orgId?: string;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ANALYTICS.ALL, "downloads", params ?? {}],
    queryFn: async () => {
      const response = await upstream.get(AnalyticsEndpoints.Downloads, {
        params,
      });
      const payload = unwrapApiData<DownloadsListResponse>(response.data);
      const totalPages = Math.ceil(payload.total / payload.limit) || 0;
      return {
        items: payload.items,
        total: payload.total,
        totalPages,
        page: payload.page,
        limit: payload.limit,
      };
    },
    enabled: !!params?.orgId,
  });
}
