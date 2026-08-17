"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { ProvidersEndpoints, replacePathParams } from "@/lib/constants/endpoints";
import { invalidateProviders, providerKeys } from "@/lib/query-keys";
import type { ProviderType } from "@workspace/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ProviderRow {
  id: string;
  name: string;
  type: ProviderType;
  config: Record<string, unknown>;
  isActive: boolean;
  isDefault: boolean;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
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
    queryKey: providerKeys.list(orgId),
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
      invalidateProviders(queryClient);
    },
  });
}

/** For flows where the org id only becomes known mid-submit (create wizard). */
export async function createProviderForOrg(
  orgId: string,
  input: UpsertProviderInput,
): Promise<ProviderRow> {
  const response = await upstream.post(ProvidersEndpoints.Create, input, {
    params: { orgId },
  });
  return unwrapApiData<ProviderRow>(response.data);
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
      invalidateProviders(queryClient);
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
      invalidateProviders(queryClient);
    },
  });
}

export function useTestProviderMutation(orgId?: string) {
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(ProvidersEndpoints.Test, id);
      const response = await upstream.post(path, {}, { params: { orgId } });
      return unwrapApiData<{
        ok: boolean;
        type: string;
        latencyMs: number;
        message: string;
        details?: Record<string, unknown>;
      }>(response.data);
    },
  });
}
