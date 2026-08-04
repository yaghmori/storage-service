"use client";

import upstream from "@/lib/api/upstream-client";
import { unwrapApiData } from "@/lib/api/unwrap-api-data";
import { FilesEndpoints, replacePathParams } from "@/lib/constants/endpoints";
import { fileKeys, invalidateFiles } from "@/lib/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProcessorKey } from "@workspace/validation";

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
  width: number | null;
  height: number | null;
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
  processingStatus: string | null;
  processingError: string | null;
  processingAttempts: number | null;
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

export type FilesFileTypeFilter =
  | "images"
  | "videos"
  | "audio"
  | "documents"
  | "other";

export type FilesProcessingStatusFilter =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "partial"
  | "skipped";

export function useFilesQuery(params?: {
  page?: number;
  limit?: number;
  search?: string;
  fileType?: FilesFileTypeFilter | FilesFileTypeFilter[] | string;
  processingStatus?:
    | FilesProcessingStatusFilter
    | FilesProcessingStatusFilter[]
    | string;
  minSize?: number;
  maxSize?: number;
  includeDeleted?: boolean;
  deletedOnly?: boolean;
  orgId?: string;
}) {
  const fileTypeParam = Array.isArray(params?.fileType)
    ? params.fileType.filter(Boolean).join(",")
    : params?.fileType;
  const processingStatusParam = Array.isArray(params?.processingStatus)
    ? params.processingStatus.filter(Boolean).join(",")
    : params?.processingStatus;
  return useQuery({
    queryKey: fileKeys.list({
      page: params?.page,
      limit: params?.limit,
      search: params?.search,
      fileType: fileTypeParam,
      processingStatus: processingStatusParam,
      minSize: params?.minSize,
      maxSize: params?.maxSize,
      includeDeleted: params?.includeDeleted,
      deletedOnly: params?.deletedOnly,
      orgId: params?.orgId,
    } as Record<string, unknown> | undefined),
    queryFn: async () => {
      const response = await upstream.get(FilesEndpoints.List, {
        params: {
          orgId: params?.orgId,
          page: params?.page,
          limit: params?.limit,
          ...(params?.search?.trim() ? { search: params.search.trim() } : {}),
          ...(fileTypeParam ? { fileType: fileTypeParam } : {}),
          ...(processingStatusParam
            ? { processingStatus: processingStatusParam }
            : {}),
          ...(params?.minSize != null ? { minSize: params.minSize } : {}),
          ...(params?.maxSize != null ? { maxSize: params.maxSize } : {}),
          ...(params?.includeDeleted ? { includeDeleted: true } : {}),
          ...(params?.deletedOnly ? { deletedOnly: true } : {}),
        },
      });
      const payload = unwrapApiData<FilesListResponse>(response.data);
      const limit = Number(payload.limit) || params?.limit || 20;
      const page = Number(payload.page) || params?.page || 1;
      const total = Number(payload.total) || 0;
      const totalPages = Math.ceil(total / limit) || 0;
      return {
        items: payload.items,
        total,
        totalPages,
        page,
        limit,
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

/** Files above this use initiate → object-store → complete (default 100 MiB). */
const DIRECT_UPLOAD_THRESHOLD =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_DIRECT_UPLOAD_THRESHOLD
    ? parseInt(process.env.NEXT_PUBLIC_DIRECT_UPLOAD_THRESHOLD, 10)
    : 104_857_600;

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function uploadLargeViaDirect(
  input: UploadFileInput,
  orgId?: string,
): Promise<UploadFileResult> {
  const file = input.file;
  const initiateRes = await upstream.post(
    FilesEndpoints.UploadInitiate,
    {
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      storageProviderId: input.storageProviderId,
      storageKey: input.storageKey,
    },
    { params: { orgId }, timeout: 0 },
  );
  const initiated = unwrapApiData<{
    fileId: string;
    uploadUrl?: string | null;
    method: "PUT" | "MULTIPART";
    partSize?: number;
    partCount?: number;
    headers?: Record<string, string>;
  }>(initiateRes.data);

  const parts: Array<{ partNumber: number; etag: string }> = [];

  try {
    if (initiated.method === "MULTIPART") {
      const partSize = initiated.partSize || 16 * 1024 * 1024;
      const partCount =
        initiated.partCount || Math.max(1, Math.ceil(file.size / partSize));
      for (let partNumber = 1; partNumber <= partCount; partNumber++) {
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const chunk = file.slice(start, end);
        const partUrlRes = await upstream.post(
          FilesEndpoints.UploadPartUrl,
          { fileId: initiated.fileId, partNumber },
          { params: { orgId }, timeout: 0 },
        );
        const partInfo = unwrapApiData<{ uploadUrl: string }>(partUrlRes.data);
        const putRes = await fetch(partInfo.uploadUrl, {
          method: "PUT",
          body: chunk,
        });
        if (!putRes.ok) {
          throw new Error(`Part ${partNumber} upload failed (${putRes.status})`);
        }
        const etag =
          putRes.headers.get("etag") ||
          putRes.headers.get("ETag") ||
          `part-${partNumber}`;
        parts.push({
          partNumber,
          etag: etag.replace(/"/g, ""),
        });
        input.onProgress?.(Math.round((end / file.size) * 90));
      }
    } else {
      if (!initiated.uploadUrl) {
        throw new Error("Missing uploadUrl from initiate");
      }
      const putRes = await fetch(initiated.uploadUrl, {
        method: "PUT",
        headers: initiated.headers,
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Direct upload failed (${putRes.status})`);
      }
      input.onProgress?.(90);
    }

    const sha256Hash = await sha256Hex(file);
    const completeRes = await upstream.post(
      FilesEndpoints.UploadComplete,
      {
        fileId: initiated.fileId,
        sha256Hash,
        parts: parts.length ? parts : undefined,
      },
      { params: { orgId }, timeout: 0 },
    );
    input.onProgress?.(100);
    return unwrapApiData<UploadFileResult>(completeRes.data);
  } catch (error) {
    await upstream
      .post(
        FilesEndpoints.UploadAbort,
        { fileId: initiated.fileId },
        { params: { orgId } },
      )
      .catch(() => undefined);
    throw error;
  }
}

export function useUploadFileMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadFileInput) => {
      // Auto-branch: large files use direct-to-object-store path.
      if (
        Number.isFinite(DIRECT_UPLOAD_THRESHOLD) &&
        input.file.size > DIRECT_UPLOAD_THRESHOLD
      ) {
        return uploadLargeViaDirect(input, orgId);
      }

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
            input.onProgress(
              Math.min(95, Math.round(event.loaded > 0 ? 10 : 0)),
            );
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

export function useRestoreFileMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(FilesEndpoints.Restore, id);
      const response = await upstream.post(path, {}, { params: { orgId } });
      return unwrapApiData<FileRow>(response.data);
    },
    onSuccess: (_data, id) => {
      invalidateFiles(queryClient, { orgId, fileId: id });
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

export function useFileSignedUrlQuery(
  id?: string,
  orgId?: string,
  enabled = false,
  variant?: string | null,
) {
  return useQuery({
    queryKey: fileKeys.signedUrl(orgId, id, variant),
    queryFn: async () => {
      const path = replacePathParams(FilesEndpoints.SignedUrl, id!);
      const response = await upstream.get(path, {
        params: {
          orgId,
          ...(variant ? { variant } : {}),
        },
      });
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

export interface FileProcessorResult {
  id?: string;
  fileId?: string;
  processorKey: ProcessorKey | string;
  status: string;
  data: Record<string, unknown> | null;
  model: string | null;
  error: string | null;
  processedAt: string | null;
  backendId?: string | null;
  backendKind?: string | null;
  schemaVersion?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function useFileProcessorResultsQuery(
  id?: string,
  orgId?: string,
  enabled = false,
) {
  return useQuery({
    queryKey: fileKeys.processorResults(orgId, id),
    queryFn: async () => {
      const path = replacePathParams(FilesEndpoints.ProcessorResults, id!);
      const response = await upstream.get(path, { params: { orgId } });
      return unwrapApiData<{ items: FileProcessorResult[]; total: number }>(
        response.data,
      );
    },
    enabled: enabled && !!id && !!orgId,
  });
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
    mutationFn: async (input: {
      id: string;
      scope?: "variants" | "video" | "all";
    }) => {
      const path = replacePathParams(
        FilesEndpoints.RegenerateProcessing,
        input.id,
      );
      const response = await upstream.post(
        path,
        {},
        {
          params: {
            orgId,
            ...(input.scope && input.scope !== "all"
              ? { scope: input.scope }
              : {}),
          },
        },
      );
      return unwrapApiData<{
        fileId: string;
        scheduled: string[];
        message: string;
      }>(response.data);
    },
    onSuccess: (_data, input) => {
      invalidateFiles(queryClient, { orgId, fileId: input.id });
    },
  });
}

export function useVerifyFileMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const path = replacePathParams(FilesEndpoints.Verify, id);
      const response = await upstream.post(path, {}, { params: { orgId } });
      return unwrapApiData<{
        fileId: string;
        processorKey: string;
        jobId: string;
        message: string;
      }>(response.data);
    },
    onSuccess: (_data, id) => {
      invalidateFiles(queryClient, { orgId, fileId: id });
    },
  });
}

export interface FileDuplicateRow {
  id: string;
  orgId: string;
  originalFileId: string;
  duplicateFileId: string | null;
  relatedFileId: string | null;
  relatedFileName: string | null;
  relatedMimeType: string | null;
  relatedSize: number | null;
  relatedWidth: number | null;
  relatedHeight: number | null;
  relatedCreatedAt: string | null;
  relatedDeletedAt: string | null;
  relatedFileHash: string | null;
  relatedProcessingStatus: string | null;
  relatedStorageKey: string | null;
  detectionMethod: string;
  similarityScore: number | null;
  isConfirmed: boolean | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  detectedAt: string;
}

export function useFileDuplicatesQuery(
  id?: string,
  orgId?: string,
  enabled = false,
) {
  return useQuery({
    queryKey: fileKeys.duplicates(orgId, id),
    queryFn: async () => {
      const path = replacePathParams(FilesEndpoints.Duplicates, id!);
      const response = await upstream.get(path, { params: { orgId } });
      return unwrapApiData<{ items: FileDuplicateRow[]; total: number }>(
        response.data,
      );
    },
    enabled: enabled && !!id && !!orgId,
  });
}

export function useConfirmDuplicateMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fileId: string; duplicateId: string }) => {
      const path = replacePathParams(
        FilesEndpoints.ConfirmDuplicate,
        input.fileId,
        input.duplicateId,
      );
      const response = await upstream.post(path, {}, { params: { orgId } });
      return unwrapApiData(response.data);
    },
    onSuccess: (_data, input) => {
      invalidateFiles(queryClient, { orgId, fileId: input.fileId });
    },
  });
}

export function useDismissDuplicateMutation(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fileId: string; duplicateId: string }) => {
      const path = replacePathParams(
        FilesEndpoints.DismissDuplicate,
        input.fileId,
        input.duplicateId,
      );
      const response = await upstream.post(path, {}, { params: { orgId } });
      return unwrapApiData(response.data);
    },
    onSuccess: (_data, input) => {
      invalidateFiles(queryClient, { orgId, fileId: input.fileId });
    },
  });
}
