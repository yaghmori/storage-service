"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { FilesEndpoints, replacePathParams } from "@/lib/constants/endpoints";
import { QUERY_KEYS } from "@/lib/constants/query-keys";
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
  visibility: string | null;
  processingStatus: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cdnUrl: string | null;
  folder: string | null;
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
  orgId?: string;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.FILES.ALL, params ?? {}],
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
    queryKey: [...QUERY_KEYS.FILES.ALL, orgId, "detail", id],
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FILES.ALL });
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
        timeout: 120_000,
      });
      return unwrapApiData<UploadFileResult>(response.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FILES.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DASHBOARD.STATS });
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FILES.ALL });
    },
  });
}

export function useFileSignedUrlQuery(id?: string, orgId?: string, enabled = false) {
  return useQuery({
    queryKey: [...QUERY_KEYS.FILES.ALL, orgId, "signed-url", id],
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
