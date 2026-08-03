"use client";

import { useProvidersQuery } from "@/features/providers/hooks/use-providers-queries";
import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { useActiveOrg } from "@/provider/org-provider";
import {
  Button,
  Input,
  Label,
  Progress,
  ResponsiveDialog,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
import {
  CheckCircle2,
  FileIcon,
  Loader2,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useUploadFileMutation,
  type UploadFileResult,
} from "../hooks/use-files-queries";

const DEFAULT_PROVIDER_VALUE = "__default__";

type UploadItemStatus = "queued" | "uploading" | "done" | "error";

type UploadItem = {
  id: string;
  file: File;
  progress: number;
  status: UploadItemStatus;
  error?: string;
  result?: UploadFileResult;
};

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function newItemId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function providerLabel(p: { name: string; type: string; isDefault?: boolean }) {
  return `${p.name}${p.isDefault ? " (default)" : ""} — ${p.type}`;
}

export function FileUploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { activeOrg } = useActiveOrg();
  const { data: providersData } = useProvidersQuery(activeOrg?.id);
  const providers = (providersData?.items ?? []).filter((p) => p.isActive);
  const uploadMutation = useUploadFileMutation(activeOrg?.id);
  const inputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<UploadItem[]>([]);
  const [providerId, setProviderId] = useState(DEFAULT_PROVIDER_VALUE);
  const [storageKey, setStorageKey] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const hasFiles = items.length > 0;

  const selectedProviderLabel = useMemo(() => {
    if (providerId === DEFAULT_PROVIDER_VALUE) return "Default provider";
    const match = providers.find((p) => p.id === providerId);
    return match ? providerLabel(match) : "Select provider";
  }, [providerId, providers]);

  const reset = useCallback(() => {
    setItems([]);
    setProviderId(DEFAULT_PROVIDER_VALUE);
    setStorageKey("");
    setIsUploading(false);
    setIsDragActive(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === "function" ? next(open) : next;
      if (!resolved && isUploading) return;
      if (!resolved) reset();
      onOpenChange(resolved);
    },
    [isUploading, onOpenChange, open, reset],
  );

  const addFiles = useCallback((accepted: File[]) => {
    if (accepted.length === 0) return;
    setItems((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        id: newItemId(),
        file,
        progress: 0,
        status: "queued" as const,
      })),
    ]);
  }, []);

  const overallProgress = useMemo(() => {
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, item) => acc + item.progress, 0);
    return Math.round(sum / items.length);
  }, [items]);

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  const removeItem = (id: string) => {
    if (isUploading) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const resolveStorageKey = (file: File, pendingCount: number) => {
    const trimmed = storageKey.trim().replace(/^\/+|\/+$/g, "");
    if (!trimmed) return undefined;
    if (pendingCount === 1) return trimmed;
    return `${trimmed}/${file.name}`;
  };

  const startUpload = async () => {
    const pending = items.filter(
      (i) => i.status === "queued" || i.status === "error",
    );
    if (pending.length === 0) {
      toast.error("Add at least one file");
      return;
    }

    setIsUploading(true);
    const resolvedProvider =
      providerId === DEFAULT_PROVIDER_VALUE ? undefined : providerId;

    let success = 0;
    let failed = 0;

    for (const item of pending) {
      updateItem(item.id, {
        status: "uploading",
        progress: 0,
        error: undefined,
      });

      try {
        const result = await uploadMutation.mutateAsync({
          file: item.file,
          storageProviderId: resolvedProvider,
          storageKey: resolveStorageKey(item.file, pending.length),
          onProgress: (progress) => {
            updateItem(item.id, { progress });
          },
        });
        updateItem(item.id, {
          status: "done",
          progress: 100,
          result,
        });
        success += 1;
      } catch (err) {
        failed += 1;
        updateItem(item.id, {
          status: "error",
          progress: 0,
          error: extractApiErrorMessage(err, "Upload failed"),
        });
      }
    }

    setIsUploading(false);

    if (failed === 0) {
      toast.success(
        success === 1 ? "File uploaded" : `${success} files uploaded`,
      );
      handleOpenChange(false);
    } else if (success > 0) {
      toast.warning(`${success} uploaded, ${failed} failed`);
    } else {
      toast.error("All uploads failed");
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      size={hasFiles ? "3xl" : "md"}
      className={cn(
        "transition-[max-width] duration-200",
        hasFiles ? "sm:max-w-5xl" : "sm:max-w-md",
      )}
      canClose={!isUploading}
      allowOutsideClick={!isUploading}
    >
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Title>Upload files</ResponsiveDialog.Title>
        <ResponsiveDialog.Description>
          {hasFiles
            ? `${items.length} file${items.length === 1 ? "" : "s"} selected. Progress is shown per file.`
            : "Choose a provider, then add one or more files."}
        </ResponsiveDialog.Description>
      </ResponsiveDialog.Header>

      <ResponsiveDialog.Content className="min-h-0">
        <div
          className={cn(
            "grid gap-6",
            hasFiles && "md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
          )}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="upload-provider">Storage provider</Label>
              <Select
                value={providerId}
                onValueChange={(value) => {
                  if (value) setProviderId(value);
                }}
                disabled={isUploading}
              >
                <SelectTrigger id="upload-provider" className="w-full">
                  <SelectValue placeholder="Default provider">
                    {selectedProviderLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_PROVIDER_VALUE}>
                    Default provider
                  </SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id} label={providerLabel(p)}>
                      {providerLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave as default to use the organization&apos;s default provider.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upload-storage-key">Storage key (optional)</Label>
              <Input
                id="upload-storage-key"
                value={storageKey}
                onChange={(e) => setStorageKey(e.target.value)}
                placeholder="path/to/object.bin"
                disabled={isUploading}
              />
              <p className="text-xs text-muted-foreground">
                Single file: exact object key. Multiple files: used as a folder
                prefix. Leave blank to auto-generate.
              </p>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!isUploading) inputRef.current?.click();
              }}
              onKeyDown={(e) => {
                if (isUploading) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isUploading) setIsDragActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isUploading) setIsDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragActive(false);
                if (isUploading) return;
                addFiles(Array.from(e.dataTransfer.files ?? []));
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center transition-colors",
                hasFiles ? "min-h-36 py-8" : "min-h-44 py-10",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/30 hover:border-primary/50",
                isUploading && "pointer-events-none opacity-60",
              )}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                disabled={isUploading}
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <Upload className="mb-2 size-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {isDragActive
                  ? "Drop files here"
                  : hasFiles
                    ? "Add more files"
                    : "Drag & drop files, or click to browse"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Multiple files supported
              </p>
            </div>
          </div>

          {hasFiles ? (
            <div className="min-h-0 space-y-3">
              <p className="text-sm font-medium">
                Selected files
                <span className="ml-1.5 font-normal text-muted-foreground">
                  ({items.length}
                  {doneCount || errorCount
                    ? ` · ${doneCount} done · ${errorCount} failed`
                    : ""}
                  )
                </span>
              </p>

              <ul className="max-h-112 space-y-2 overflow-y-auto pr-1">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-md border bg-muted/20 px-3 py-2.5"
                  >
                    <div className="flex items-start gap-3">
                      <FileIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {item.file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(item.file.size)}
                              {item.file.type ? ` · ${item.file.type}` : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {item.status === "uploading" ? (
                              <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                                <Loader2 className="size-3.5 animate-spin text-blue-600" />
                                {item.progress}%
                              </span>
                            ) : null}
                            {item.status === "done" ? (
                              <CheckCircle2 className="size-4 text-emerald-600" />
                            ) : null}
                            {item.status === "error" ? (
                              <XCircle className="size-4 text-destructive" />
                            ) : null}
                            {!isUploading && item.status !== "done" ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => removeItem(item.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        {(item.status === "uploading" ||
                          item.status === "done") && (
                          <Progress value={item.progress} />
                        )}

                        {item.status === "error" && item.error ? (
                          <p className="wrap-break-word text-xs text-destructive">
                            {item.error}
                          </p>
                        ) : null}

                        {item.status === "done" && item.result?.isDuplicate ? (
                          <p className="text-xs text-muted-foreground">
                            Duplicate — linked to existing file
                          </p>
                        ) : null}

                        {item.status === "done" && item.result?.id ? (
                          <p className="break-all font-mono text-[11px] text-muted-foreground">
                            {item.result.id}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </ResponsiveDialog.Content>

      <ResponsiveDialog.Footer>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleOpenChange(false)}
          disabled={isUploading}
        >
          {doneCount > 0 && errorCount === 0 ? "Close" : "Cancel"}
        </Button>
        <Button
          type="button"
          onClick={() => void startUpload()}
          disabled={isUploading || !hasFiles}
        >
          {isUploading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Uploading… {overallProgress}%
            </>
          ) : (
            <>
              <Upload className="size-4" />
              Upload {hasFiles ? `(${items.length})` : ""}
            </>
          )}
        </Button>
      </ResponsiveDialog.Footer>
    </ResponsiveDialog>
  );
}
