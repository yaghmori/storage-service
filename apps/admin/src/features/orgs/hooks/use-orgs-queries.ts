"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { OrgsEndpoints, replacePathParams } from "@/lib/constants/endpoints";
import { invalidateOrgs, orgKeys } from "@/lib/query-keys";
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
  usedBytes?: number;
  objectCount?: number;
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
    queryKey: orgKeys.all,
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
      invalidateOrgs(queryClient);
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
      invalidateOrgs(queryClient);
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
      invalidateOrgs(queryClient);
    },
  });
}

export interface OrgProcessingSettings {
  enableImageProcessing: boolean;
  enableVideoProcessing: boolean;
  enableMetadataExtraction: boolean;
  enableAiProcessing: boolean;
  enableAiCaption: boolean;
  enableAiTags: boolean;
  enableAiNsfw: boolean;
  nsfwThreshold: number;
  aiBackendId: string | null;
  aiVisionModel?: string | null;
  documentOcrBackendId?: string | null;
  documentOcrVisionModel?: string | null;
  imageVariants: {
    thumbnail: { enabled: boolean; maxEdge: number };
    medium: { enabled: boolean; maxEdge: number };
  };
  /** Derived from enabled imageVariants (legacy). */
  imageSizes: number[];
  imageFormats: Array<"webp" | "avif">;
  videoThumbnail: boolean;
  videoPreviewFrames: number;
  enableImageNormalize?: boolean;
  enableDedupePhash?: boolean;
  phashThresholdBits?: number;
  enableIntegrityVerify?: boolean;
  enableDocumentPreview?: boolean;
  enableDocumentText?: boolean;
  enableDocumentOcr?: boolean;
  documentOcrEngine?: "openai_compatible" | "tesseract";
  enableNotifyWebhook?: boolean;
  notifyWebhookUrl?: string;
  notifyWebhookSecret?: string;
  defaults?: OrgProcessingSettings;
}

export function useOrgProcessingSettingsQuery(orgId?: string) {
  return useQuery({
    queryKey: orgKeys.processingSettings(orgId),
    queryFn: async () => {
      const path = replacePathParams(OrgsEndpoints.ProcessingSettings, orgId!);
      const response = await upstream.get(path);
      return unwrapApiData<OrgProcessingSettings>(response.data);
    },
    enabled: !!orgId,
  });
}

export function useUpdateOrgProcessingSettingsMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<OrgProcessingSettings>) => {
      const path = replacePathParams(OrgsEndpoints.ProcessingSettings, orgId!);
      const response = await upstream.put(path, input);
      return unwrapApiData<OrgProcessingSettings>(response.data);
    },
    onSuccess: () => {
      invalidateOrgs(queryClient, {
        orgId,
        processingSettings: true,
      });
    },
  });
}

export interface OrgLimitsSettings {
  maxFileSizeBytes: number | null;
  allowedMimeTypes: string[] | null;
  storageQuotaBytes: number | null;
  maxObjectCount: number | null;
  defaults?: {
    maxFileSizeBytes: number;
    allowedMimeTypes: string[];
  };
  effective?: {
    maxFileSizeBytes: number;
    allowedMimeTypes: string[];
    storageQuotaBytes: number | null;
    maxObjectCount: number | null;
  };
}

export type OrgUsageBreakdownCategory =
  "documents" | "images" | "videos" | "audio" | "other";

export interface OrgUsageBreakdownSegment {
  category: OrgUsageBreakdownCategory;
  label: string;
  bytes: number;
  count: number;
}

export interface OrgUsageSnapshot {
  usedBytes: number;
  objectCount: number;
  storageQuotaBytes: number | null;
  maxObjectCount: number | null;
  maxFileSizeBytes: number;
  softDeleteRetentionDays: number;
  breakdown: OrgUsageBreakdownSegment[];
}

export interface OrgRetentionSettings {
  softDeleteRetentionDays: number;
  defaults?: OrgRetentionSettings;
}

export function useOrgUsageQuery(orgId?: string) {
  return useQuery({
    queryKey: orgKeys.usage(orgId),
    queryFn: async () => {
      const path = replacePathParams(OrgsEndpoints.Usage, orgId!);
      const response = await upstream.get(path);
      return unwrapApiData<OrgUsageSnapshot>(response.data);
    },
    enabled: !!orgId,
  });
}

export function useOrgLimitsQuery(orgId?: string) {
  return useQuery({
    queryKey: orgKeys.limits(orgId),
    queryFn: async () => {
      const path = replacePathParams(OrgsEndpoints.Limits, orgId!);
      const response = await upstream.get(path);
      return unwrapApiData<OrgLimitsSettings>(response.data);
    },
    enabled: !!orgId,
  });
}

export function useUpdateOrgLimitsMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<OrgLimitsSettings>) => {
      const path = replacePathParams(OrgsEndpoints.Limits, orgId!);
      const response = await upstream.put(path, input);
      return unwrapApiData<OrgLimitsSettings>(response.data);
    },
    onSuccess: () => {
      invalidateOrgs(queryClient, {
        orgId,
        limits: true,
        usage: true,
      });
    },
  });
}

export function useOrgRetentionQuery(orgId?: string) {
  return useQuery({
    queryKey: orgKeys.retention(orgId),
    queryFn: async () => {
      const path = replacePathParams(OrgsEndpoints.Retention, orgId!);
      const response = await upstream.get(path);
      return unwrapApiData<OrgRetentionSettings>(response.data);
    },
    enabled: !!orgId,
  });
}

export function useUpdateOrgRetentionMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<OrgRetentionSettings>) => {
      const path = replacePathParams(OrgsEndpoints.Retention, orgId!);
      const response = await upstream.put(path, input);
      return unwrapApiData<OrgRetentionSettings>(response.data);
    },
    onSuccess: () => {
      invalidateOrgs(queryClient, {
        orgId,
        retention: true,
        usage: true,
      });
    },
  });
}
