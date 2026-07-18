"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { DashboardEndpoints } from "@/lib/constants/endpoints";
import { QUERY_KEYS } from "@/lib/constants/query-keys";
import { useQuery } from "@tanstack/react-query";

export interface DashboardStats {
  filesCount: number;
  totalBytes: number;
  providersCount: number;
  jobsByStatus: Record<string, number>;
  downloadsLast7d: number;
}

export function useDashboardStatsQuery(orgId?: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.DASHBOARD.STATS, orgId],
    queryFn: async () => {
      const response = await upstream.get(DashboardEndpoints.Stats, {
        params: { orgId },
      });
      return unwrapApiData<DashboardStats>(response.data);
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}
