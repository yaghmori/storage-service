"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { JobsEndpoints, replacePathParams } from "@/lib/constants/endpoints";
import { fileKeys, invalidateJobs, jobKeys } from "@/lib/query-keys";
import type { JobStatus, ProcessorKey } from "@workspace/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface JobLogEntry {
  ts: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

export interface JobRow {
  id: string;
  orgId: string;
  fileId: string;
  processorKey: ProcessorKey | string;
  status: JobStatus | string;
  bullmqJobId: string | null;
  errorMessage: string | null;
  logs?: JobLogEntry[] | null;
  output?: Record<string, unknown> | null;
  retryCount: number;
  progress: number | null;
  priority: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | string | null;
  orgName?: string | null;
  orgSlug?: string | null;
}

export interface JobFileGroup {
  fileId: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | string | null;
  jobs: JobRow[];
  latestAt: string;
  statusSummary: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
}

interface JobsListResponse {
  items: JobRow[];
  total: number;
  page: number;
  limit: number;
}

export function groupJobsByFile(jobs: JobRow[]): JobFileGroup[] {
  const map = new Map<string, JobFileGroup>();

  for (const job of jobs) {
    const existing = map.get(job.fileId);
    if (!existing) {
      map.set(job.fileId, {
        fileId: job.fileId,
        fileName: job.fileName || job.fileId,
        mimeType: job.mimeType ?? null,
        fileSize: job.fileSize ?? null,
        jobs: [job],
        latestAt: job.createdAt,
        statusSummary: {
          pending: job.status === "pending" ? 1 : 0,
          processing: job.status === "processing" ? 1 : 0,
          completed: job.status === "completed" ? 1 : 0,
          failed: job.status === "failed" ? 1 : 0,
          cancelled: job.status === "cancelled" ? 1 : 0,
        },
      });
      continue;
    }

    existing.jobs.push(job);
    if (new Date(job.createdAt) > new Date(existing.latestAt)) {
      existing.latestAt = job.createdAt;
    }
    const key = job.status as keyof JobFileGroup["statusSummary"];
    if (key in existing.statusSummary) {
      existing.statusSummary[key] += 1;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
  );
}

export function useJobsQuery(params?: {
  page?: number;
  limit?: number;
  status?: JobStatus | string;
  processorKey?: ProcessorKey | string;
  fileId?: string;
  search?: string;
  orgId?: string;
  enabled?: boolean;
}) {
  const { enabled: enabledParam, ...queryParams } = params ?? {};
  return useQuery({
    queryKey: jobKeys.list(queryParams as Record<string, unknown>),
    queryFn: async () => {
      const response = await upstream.get(JobsEndpoints.List, {
        params: {
          orgId: queryParams.orgId,
          page: queryParams.page,
          limit: queryParams.limit,
          ...(queryParams.status ? { status: queryParams.status } : {}),
          ...(queryParams.processorKey
            ? { processorKey: queryParams.processorKey }
            : {}),
          ...(queryParams.fileId ? { fileId: queryParams.fileId } : {}),
          ...(queryParams.search?.trim()
            ? { search: queryParams.search.trim() }
            : {}),
        },
      });
      const payload = unwrapApiData<JobsListResponse>(response.data);
      const totalPages = Math.ceil(payload.total / payload.limit) || 0;
      return {
        items: payload.items,
        total: payload.total,
        totalPages,
        page: payload.page,
        limit: payload.limit,
        groups: groupJobsByFile(payload.items),
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: (enabledParam ?? true) && !!queryParams.orgId,
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const inFlight = items.some(
        (j) => j.status === "pending" || j.status === "processing",
      );
      return inFlight ? 3000 : false;
    },
  });
}

export function useJobDetailQuery(id?: string, orgId?: string) {
  return useQuery({
    queryKey: jobKeys.detail(orgId, id),
    queryFn: async () => {
      const path = replacePathParams(JobsEndpoints.Detail, id!);
      const response = await upstream.get(path, { params: { orgId } });
      return unwrapApiData<JobRow>(response.data);
    },
    enabled: !!id && !!orgId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 2000 : false;
    },
  });
}

export function useCancelJobMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(JobsEndpoints.Cancel, id);
      const response = await upstream.post(path, {}, { params: { orgId } });
      return unwrapApiData<JobRow>(response.data);
    },
    onSuccess: () => {
      invalidateJobs(queryClient);
    },
  });
}

export function useRetryJobMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(JobsEndpoints.Retry, id);
      const response = await upstream.post(path, {}, { params: { orgId } });
      return unwrapApiData<JobRow>(response.data);
    },
    onSuccess: (updated) => {
      // Patch every cached jobs list so file detail updates immediately.
      queryClient.setQueriesData(
        { queryKey: jobKeys.all },
        (old: unknown) => {
          if (!old || typeof old !== "object") return old;
          const data = old as {
            items?: JobRow[];
            groups?: unknown;
            total?: number;
            totalPages?: number;
            page?: number;
            limit?: number;
          };
          if (!Array.isArray(data.items)) return old;
          const items = data.items.map((job) =>
            job.id === updated.id
              ? {
                  ...job,
                  ...updated,
                  status: updated.status ?? "pending",
                  errorMessage: null,
                  logs: updated.logs ?? [],
                  output: updated.output ?? null,
                }
              : job,
          );
          return {
            ...data,
            items,
            groups: groupJobsByFile(items),
          };
        },
      );
      queryClient.setQueryData(jobKeys.detail(orgId, updated.id), updated);
      invalidateJobs(queryClient);
      if (orgId && updated.fileId) {
        queryClient.invalidateQueries({
          queryKey: fileKeys.processorResults(orgId, updated.fileId),
        });
        queryClient.invalidateQueries({
          queryKey: fileKeys.detail(orgId, updated.fileId),
        });
      }
    },
  });
}
