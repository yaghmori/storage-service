"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { ApiKeysEndpoints, replacePathParams } from "@/lib/constants/endpoints";
import { apiKeyKeys, invalidateApiKeys } from "@/lib/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ApiKeyRow {
  id: string;
  orgId: string;
  serviceName: string;
  permissions: Record<string, unknown> | null;
  expiresAt: string | null;
  isActive: boolean;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
  createdAt: string;
}

export type CreateApiKeyInput = {
  serviceName: string;
  permissions?: Record<string, unknown>;
  expiresAt?: string;
};

export function useApiKeysQuery(orgId?: string) {
  return useQuery({
    queryKey: apiKeyKeys.list(orgId),
    queryFn: async () => {
      const response = await upstream.get(ApiKeysEndpoints.List, { params: { orgId } });
      const items = unwrapApiData<ApiKeyRow[]>(response.data);
      return { items, total: items.length, totalPages: 1 };
    },
    enabled: !!orgId,
  });
}

export function useCreateApiKeyMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateApiKeyInput) => {
      const response = await upstream.post(ApiKeysEndpoints.Create, input, {
        params: { orgId },
      });
      return unwrapApiData<ApiKeyRow & { key?: string }>(response.data);
    },
    onSuccess: () => {
      invalidateApiKeys(queryClient);
    },
  });
}

export function useRevokeApiKeyMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(ApiKeysEndpoints.Update, id);
      await upstream.put(path, { isActive: false }, { params: { orgId } });
      return id;
    },
    onSuccess: () => {
      invalidateApiKeys(queryClient);
    },
  });
}

export function useDeleteApiKeyMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(ApiKeysEndpoints.Delete, id);
      await upstream.delete(path, { params: { orgId } });
      return id;
    },
    onSuccess: () => {
      invalidateApiKeys(queryClient);
    },
  });
}
