"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { ProvidersEndpoints, replacePathParams } from "@/lib/constants/endpoints";
import { QUERY_KEYS } from "@/lib/constants/query-keys";
import type { ProviderType } from "@workspace/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ProviderRow {
  id: string;
  name: string;
  type: ProviderType;
  config: Record<string, unknown>;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UpsertProviderInput = {
  name: string;
  type: ProviderType;
  config: Record<string, unknown>;
  isActive?: boolean;
  isDefault?: boolean;
};

export function useProvidersQuery(orgId?: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.PROVIDERS.ALL, orgId],
    queryFn: async () => {
      const response = await upstream.get(ProvidersEndpoints.List, {
        params: { orgId },
      });
      const items = unwrapApiData<ProviderRow[]>(response.data);
      return { items, total: items.length, totalPages: 1 };
    },
    enabled: !!orgId,
  });
}

export function useCreateProviderMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertProviderInput) => {
      const response = await upstream.post(ProvidersEndpoints.Create, input, {
        params: { orgId },
      });
      return unwrapApiData<ProviderRow>(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROVIDERS.ALL });
    },
  });
}

export function useUpdateProviderMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpsertProviderInput;
    }) => {
      const path = replacePathParams(ProvidersEndpoints.Update, id);
      const response = await upstream.put(path, input, { params: { orgId } });
      return unwrapApiData<ProviderRow>(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROVIDERS.ALL });
    },
  });
}

export function useDeleteProviderMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(ProvidersEndpoints.Delete, id);
      await upstream.delete(path, { params: { orgId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROVIDERS.ALL });
    },
  });
}

export function useTestProviderMutation(orgId?: string) {
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(ProvidersEndpoints.Test, id);
      const response = await upstream.post(path, {}, { params: { orgId } });
      return unwrapApiData<{ ok: boolean; type: string }>(response.data);
    },
  });
}
