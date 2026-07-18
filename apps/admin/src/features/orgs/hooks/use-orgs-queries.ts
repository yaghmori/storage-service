"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { OrgsEndpoints, replacePathParams } from "@/lib/constants/endpoints";
import { QUERY_KEYS } from "@/lib/constants/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended";
  externalRef: string | null;
  logoUrl: string | null;
  frontendBaseUrl: string | null;
  customDomain: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  supportEmail: string | null;
  privacyUrl: string | null;
  termsUrl: string | null;
  appBaseUrl: string | null;
  metadata: Record<string, unknown> | null;
}

export type UpsertOrganizationInput = {
  slug: string;
  name: string;
  status?: "active" | "suspended";
  externalRef?: string | null;
  logoUrl?: string | null;
  /** Optional on create; server defaults when omitted. */
  frontendBaseUrl?: string | null;
  customDomain?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  supportEmail?: string | null;
  privacyUrl?: string | null;
  termsUrl?: string | null;
  appBaseUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function useOrganizationsQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.ORGS.ALL,
    queryFn: async () => {
      const response = await upstream.get(OrgsEndpoints.List);
      const items = unwrapApiData<OrganizationRow[]>(response.data);
      return { items, total: items.length, totalPages: 1 };
    },
  });
}

export async function checkOrganizationSlugAvailable(
  slug: string,
): Promise<boolean> {
  const response = await upstream.get(OrgsEndpoints.CheckSlug, {
    params: { slug },
  });
  const payload = unwrapApiData<{ available: boolean; slug: string }>(
    response.data,
  );
  return payload.available;
}

export function useCreateOrganizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertOrganizationInput) => {
      const response = await upstream.post(OrgsEndpoints.Create, input);
      return unwrapApiData<OrganizationRow>(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORGS.ALL });
    },
  });
}

export function useUpdateOrganizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: Partial<UpsertOrganizationInput>;
    }) => {
      const path = replacePathParams(OrgsEndpoints.Update, id);
      const response = await upstream.put(path, input);
      return unwrapApiData<OrganizationRow>(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORGS.ALL });
    },
  });
}

export function useDeleteOrganizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(OrgsEndpoints.Delete, id);
      await upstream.delete(path);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORGS.ALL });
    },
  });
}
