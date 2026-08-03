"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { FilesEndpoints, replacePathParams } from "@/lib/constants/endpoints";
import { fileKeys, invalidateFiles } from "@/lib/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface FileRow {
  id: string;
  orgId: string;
  storageProviderId: string;
  storageKey: string;
  storageBucket: string | null;
  fileName: string;
  originalFileName: string;
  fileExtension: string | null;
  mimeType: string;
  size: number | string;
  fileHash: string;
  checksum: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  duration: number | null;
  bitrate: number | null;
  frameRate: number | null;
  hasTransparency: boolean | null;
  dominantColor: string | null;
  colorPalette: string | null;
  streamingUrl: string | null;
  subtitleKeys: string | null;
  alt: string | null;
  title: string | null;
  caption: string | null;
  description: string | null;
  transcript: string | null;
  folder: string | null;
  folderId: string | null;
  tags: string | null;
  referenceCount: number | null;
  isOrphaned: boolean | null;
  orphanedAt: string | null;
  isProcessed: boolean | null;
  processingStatus: string | null;
  processingError: string | null;
  processingAttempts: number | null;
  aiGeneratedTags: string | null;
  aiDescription: string | null;
  objectDetection: string | null;
  faceDetection: string | null;
  nsfwScore: number | null;
  isNsfw: boolean | null;
  visibility: string | null;
  downloadPassword: string | null;
  uploadedBy: string | null;
  externalId: string | null;
  externalProvider: string | null;
  cdnUrl: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FilesListResponse {
  items: FileRow[];
  total: number;
  page: number;
  limit: number;
}

export function useFilesQuery(params?: {
  page?: number;
  limit?: number;
  search?: string;
  includeDeleted?: boolean;
  deletedOnly?: boolean;
  orgId?: string;
}) {
  return useQuery({
    queryKey: fileKeys.list(params as Record<string, unknown> | undefined),
    queryFn: async () => {
      const response = await upstream.get(FilesEndpoints.List, { params });
      const payload = unwrapApiData<FilesListResponse>(response.data);
      const totalPages = Math.ceil(payload.total / payload.limit) || 0;
      return {
        items: payload.items,
        total: payload.total,
        totalPages,
        page: payload.page,
        limit: payload.limit,
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: !!params?.orgId,
  });
}

export function useFileDetailQuery(id?: string, orgId?: string) {
  return useQuery({
    queryKey: fileKeys.detail(orgId, id),
    queryFn: async () => {
      const path = replacePathParams(FilesEndpoints.Detail, id!);
      const response = await upstream.get(path, { params: { orgId } });
      return unwrapApiData<FileRow>(response.data);
    },
    enabled: !!id && !!orgId,
  });
}

export function useDeleteFileMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(FilesEndpoints.Delete, id);
      await upstream.delete(path, { params: { orgId } });
      return id;
    },
    onSuccess: () => {
      invalidateFiles(queryClient);
    },
  });
}

export interface UploadFileResult {
  id: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  isDuplicate: boolean;
  message?: string;
  uploadedToStorage?: boolean;
  storageKey?: string;
  originalFileId?: string;
  createdAt?: string;
}

export type UploadFileInput = {
  file: File;
  storageProviderId?: string;
  storageKey?: string;
  onProgress?: (percent: number) => void;
};

export function useUploadFileMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadFileInput) => {
      const formData = new FormData();
      formData.append("file", input.file);
      if (input.storageProviderId?.trim()) {
        formData.append("storageProviderId", input.storageProviderId.trim());
      }
      if (input.storageKey?.trim()) {
        formData.append("storageKey", input.storageKey.trim());
      }

      const response = await upstream.post(FilesEndpoints.Upload, formData, {
        params: { orgId },
        // Large files need more than the default 30s client timeout.
        timeout: 0,
        onUploadProgress: (event) => {
          if (!input.onProgress) return;
          if (!event.total || event.total <= 0) {
            // Indeterminate until total is known — keep a soft lower bound.
            input.onProgress(Math.min(95, Math.round(event.loaded > 0 ? 10 : 0)));
            return;
          }
          const percent = Math.round((event.loaded / event.total) * 100);
          input.onProgress(Math.max(0, Math.min(100, percent)));
        },
      });
      input.onProgress?.(100);
      return unwrapApiData<UploadFileResult>(response.data);
    },
    onSuccess: () => {
      invalidateFiles(queryClient);
    },
  });
}

export function useHardDeleteFileMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(FilesEndpoints.HardDelete, id);
      await upstream.delete(path, { params: { orgId } });
      return id;
    },
    onSuccess: () => {
      invalidateFiles(queryClient);
    },
  });
}

export type BulkDeleteFilesInput = {
  ids: string[];
  deleteFromStorage: boolean;
};

export type BulkDeleteFilesResult = {
  succeeded: string[];
  failed: { id: string; error: unknown }[];
};

export function useBulkDeleteFilesMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      deleteFromStorage,
    }: BulkDeleteFilesInput): Promise<BulkDeleteFilesResult> => {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const path = replacePathParams(
            deleteFromStorage
              ? FilesEndpoints.HardDelete
              : FilesEndpoints.Delete,
            id,
          );
          await upstream.delete(path, { params: { orgId } });
          return id;
        }),
      );

      const succeeded: string[] = [];
      const failed: { id: string; error: unknown }[] = [];
      results.forEach((result, index) => {
        const id = ids[index]!;
        if (result.status === "fulfilled") {
          succeeded.push(id);
        } else {
          failed.push({ id, error: result.reason });
        }
      });
      return { succeeded, failed };
    },
    onSuccess: () => {
      invalidateFiles(queryClient);
    },
  });
}

export function useFileSignedUrlQuery(id?: string, orgId?: string, enabled = false) {
  return useQuery({
    queryKey: fileKeys.signedUrl(orgId, id),
    queryFn: async () => {
      const path = replacePathParams(FilesEndpoints.SignedUrl, id!);
      const response = await upstream.get(path, { params: { orgId } });
      return unwrapApiData<{
        url: string;
        expiresIn?: number;
        fileId: string;
        variant?: string | null;
        note?: string;
      }>(response.data);
    },
    enabled: enabled && !!id && !!orgId,
  });
}

export interface FileMetadataPayload {
  id?: string;
  fileId: string;
  metadata: Record<string, unknown> | null;
  extractedAt: string | null;
  updatedAt: string | null;
}

export function useFileMetadataQuery(
  id?: string,
  orgId?: string,
  enabled = false,
) {
  return useQuery({
    queryKey: fileKeys.metadata(orgId, id),
    queryFn: async () => {
      const path = replacePathParams(FilesEndpoints.Metadata, id!);
      const response = await upstream.get(path, { params: { orgId } });
      return unwrapApiData<FileMetadataPayload>(response.data);
    },
    enabled: enabled && !!id && !!orgId,
  });
}

export interface FileVariantRow {
  id: string;
  fileId: string;
  name: string;
  key: string;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export function useFileVariantsQuery(
  id?: string,
  orgId?: string,
  enabled = false,
) {
  return useQuery({
    queryKey: fileKeys.variants(orgId, id),
    queryFn: async () => {
      const path = replacePathParams(FilesEndpoints.Variants, id!);
      const response = await upstream.get(path, { params: { orgId } });
      return unwrapApiData<{ items: FileVariantRow[]; total: number }>(
        response.data,
      );
    },
    enabled: enabled && !!id && !!orgId,
  });
}

export function useRegenerateProcessingMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(FilesEndpoints.RegenerateProcessing, id);
      const response = await upstream.post(path, null, { params: { orgId } });
      return unwrapApiData<{
        fileId: string;
        scheduled: string[];
        message: string;
      }>(response.data);
    },
    onSuccess: (_data, id) => {
      invalidateFiles(queryClient, { orgId, fileId: id });
    },
  });
}
