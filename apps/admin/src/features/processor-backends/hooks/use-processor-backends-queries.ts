"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import {
  ProcessorBackendsEndpoints,
  replacePathParams,
} from "@/lib/constants/endpoints";
import {
  invalidateProcessorBackends,
  processorBackendKeys,
} from "@/lib/query-keys";
import type { ProcessorBackendKind } from "@workspace/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ProcessorBackendRow {
  id: string;
  name: string;
  kind: ProcessorBackendKind;
  isActive: boolean;
  isDefault: boolean;
  baseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyLast4: string | null;
  visionModel: string | null;
  textModel: string | null;
  timeoutMs: number | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
}

export type UpsertProcessorBackendInput = {
  name: string;
  kind: ProcessorBackendKind;
  isActive: boolean;
  isDefault: boolean;
  baseUrl: string;
  apiKey?: string;
  clearApiKey?: boolean;
  visionModel?: string;
  textModel?: string;
  timeoutMs?: number;
};

export function useProcessorBackendsQuery(orgId?: string) {
  return useQuery({
    queryKey: processorBackendKeys.list(orgId),
    queryFn: async () => {
      const path = replacePathParams(ProcessorBackendsEndpoints.List, orgId!);
      const response = await upstream.get(path);
      const items = unwrapApiData<ProcessorBackendRow[]>(response.data);
      return { items, total: items.length, totalPages: 1 };
    },
    enabled: !!orgId,
  });
}

export function useCreateProcessorBackendMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertProcessorBackendInput) => {
      const path = replacePathParams(ProcessorBackendsEndpoints.Create, orgId!);
      const response = await upstream.post(path, input);
      return unwrapApiData<ProcessorBackendRow>(response.data);
    },
    onSuccess: () => invalidateProcessorBackends(queryClient),
  });
}

export function useUpdateProcessorBackendMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpsertProcessorBackendInput;
    }) => {
      const path = replacePathParams(
        ProcessorBackendsEndpoints.Update,
        orgId!,
        id,
      );
      const response = await upstream.put(path, input);
      return unwrapApiData<ProcessorBackendRow>(response.data);
    },
    onSuccess: () => invalidateProcessorBackends(queryClient),
  });
}

export function useDeleteProcessorBackendMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(
        ProcessorBackendsEndpoints.Delete,
        orgId!,
        id,
      );
      await upstream.delete(path);
    },
    onSuccess: () => invalidateProcessorBackends(queryClient),
  });
}

export function useTestProcessorBackendMutation(orgId?: string) {
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(
        ProcessorBackendsEndpoints.Test,
        orgId!,
        id,
      );
      const response = await upstream.post(path, {});
      return unwrapApiData<{
        ok: boolean;
        kind: string;
        latencyMs: number;
        message: string;
        details?: Record<string, unknown>;
      }>(response.data);
    },
  });
}

export function useProcessorBackendModelsQuery(
  orgId?: string,
  backendId?: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: [...processorBackendKeys.list(orgId), "models", backendId],
    queryFn: async () => {
      const path = replacePathParams(
        ProcessorBackendsEndpoints.Models,
        orgId!,
        backendId!,
      );
      const response = await upstream.get(path);
      return unwrapApiData<{
        items: Array<{ id: string; ownedBy?: string }>;
        total: number;
      }>(response.data);
    },
    enabled: enabled && !!orgId && !!backendId,
    staleTime: 60_000,
    retry: false,
  });
}
