"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import {
  useCancelJobMutation,
  useJobsQuery,
  useRetryJobMutation,
} from "@/features/jobs/hooks/use-jobs-queries";
import { fileContentUrl } from "@/lib/constants/endpoints";
import { useActiveOrg } from "@/provider/org-provider";
import {
  Badge,
  Button,
  CopyButton,
  DateDisplay,
  ResponsiveSheet,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components";
import { cn } from "@workspace/ui/lib/utils";
import { JobStatusLabels, JobTypeLabels } from "@workspace/validation";
import { Ban, Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  type FileRow,
  useFileDetailQuery,
  useFileMetadataQuery,
  useFileSignedUrlQuery,
  useFileVariantsQuery,
  useRegenerateProcessingMutation,
} from "../hooks/use-files-queries";
import { FilePreviewThumb } from "./file-preview-thumb";

function formatBytes(value: number | string | undefined | null): string {
  if (value == null) return "—";
  const bytes = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = -1;
  do {
    size /= 1024;
    unit += 1;
  } while (size >= 1024 && unit < units.length - 1);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}h ${m}m ${rem}s`;
  if (m > 0) return `${m}m ${rem}s`;
  return `${rem}s`;
}

function metadataJson(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null;
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

function SmallCopy({ content }: { content: string }) {
  return (
    <CopyButton
      content={content}
      variant="outline"
      size="sm"
      className="size-6 shrink-0 shadow-none"
      aria-label="Copy"
    />
  );
}

/** Truncates text; shows a simple tooltip only when the text is actually clipped. */
function TruncatedText({
  text,
  mono,
  className,
  lines = 1,
}: {
  text: string;
  mono?: boolean;
  className?: string;
  /** Soft-wrap clamp lines (1 = single-line truncate). */
  lines?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [open, setOpen] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setTruncated(false);
      return;
    }
    if (lines > 1) {
      setTruncated(el.scrollHeight > el.clientHeight + 1);
      return;
    }
    setTruncated(el.scrollWidth > el.clientWidth + 1);
  }, [lines]);

  useLayoutEffect(() => {
    measure();
  }, [measure, text, className]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    if (!truncated) setOpen(false);
  }, [truncated]);

  if (!text || text === "—") {
    return <span className="text-muted-foreground">—</span>;
  }

  const spanClass = cn(
    "block max-w-full text-right",
    lines > 1 ? "wrap-break-word" : "truncate",
    lines === 2 && "line-clamp-2",
    lines >= 3 && "line-clamp-3",
    mono && "font-mono text-xs tracking-tight",
    className,
  );

  return (
    <Tooltip open={truncated ? open : false} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <span ref={ref} className={spanClass}>
          {text}
        </span>
      </TooltipTrigger>
      {truncated ? (
        <TooltipContent side="top" align="end" className="max-w-xs break-all">
          {text}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

function DetailRow({
  label,
  value,
  copy,
  mono,
  children,
}: {
  label: string;
  value?: string | null;
  copy?: string | null;
  mono?: boolean;
  children?: ReactNode;
}) {
  if (children == null && (value == null || value === "")) return null;

  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-border/60 py-2.5 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0">
        {children ?? (
          <TruncatedText text={value ?? "—"} mono={mono} />
        )}
      </dd>
      <div className="flex w-6 justify-end">
        {copy ? <SmallCopy content={copy} /> : null}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b bg-muted/40 px-3 py-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
      </div>
      <dl className="px-3">{children}</dl>
    </section>
  );
}

function BoolBadge({ value }: { value: boolean | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={value ? "default" : "outline"} className="capitalize">
      {value ? "Yes" : "No"}
    </Badge>
  );
}

function FileOverviewDetails({ data }: { data: FileRow }) {
  const dimensions =
    data.width != null && data.height != null
      ? `${data.width} × ${data.height}`
      : null;

  return (
    <div className="space-y-3">
      <Section title="Identity">
        <DetailRow label="File ID" value={data.id} copy={data.id} mono />
        <DetailRow label="Org ID" value={data.orgId} copy={data.orgId} mono />
        <DetailRow
          label="Original name"
          value={data.originalFileName}
          copy={data.originalFileName}
        />
        <DetailRow
          label="Stored name"
          value={data.fileName}
          copy={data.fileName}
          mono
        />
        <DetailRow label="Extension" value={data.fileExtension ?? "—"} />
        <DetailRow label="MIME" value={data.mimeType} copy={data.mimeType} mono />
        <DetailRow
          label="Size"
          value={`${formatBytes(data.size)} (${String(data.size)} bytes)`}
        />
      </Section>

      <Section title="Integrity">
        <DetailRow
          label="File hash"
          value={data.fileHash || "—"}
          copy={data.fileHash || undefined}
          mono
        />
        <DetailRow
          label="Checksum"
          value={data.checksum || "—"}
          copy={data.checksum || undefined}
          mono
        />
      </Section>

      <Section title="Storage">
        <DetailRow
          label="Provider ID"
          value={data.storageProviderId}
          copy={data.storageProviderId}
          mono
        />
        <DetailRow
          label="Storage key"
          value={data.storageKey}
          copy={data.storageKey}
          mono
        />
        <DetailRow
          label="Bucket"
          value={data.storageBucket || "—"}
          copy={data.storageBucket || undefined}
          mono
        />
        <DetailRow label="Folder" value={data.folder || "—"} />
        <DetailRow
          label="Folder ID"
          value={data.folderId || "—"}
          copy={data.folderId || undefined}
          mono
        />
        <DetailRow
          label="CDN URL"
          value={data.cdnUrl || "—"}
          copy={data.cdnUrl || undefined}
          mono
        />
        <DetailRow
          label="Streaming URL"
          value={data.streamingUrl || "—"}
          copy={data.streamingUrl || undefined}
          mono
        />
      </Section>

      {(hasValue(dimensions) ||
        hasValue(data.aspectRatio) ||
        hasValue(data.duration) ||
        hasValue(data.bitrate) ||
        hasValue(data.frameRate) ||
        data.hasTransparency != null ||
        hasValue(data.dominantColor)) && (
        <Section title="Media">
          <DetailRow label="Dimensions" value={dimensions ?? "—"} />
          <DetailRow label="Aspect ratio" value={data.aspectRatio || "—"} />
          <DetailRow label="Duration" value={formatDuration(data.duration)} />
          <DetailRow
            label="Bitrate"
            value={
              data.bitrate != null
                ? `${data.bitrate.toLocaleString()} bps`
                : "—"
            }
          />
          <DetailRow
            label="Frame rate"
            value={data.frameRate != null ? `${data.frameRate} fps` : "—"}
          />
          <DetailRow label="Transparency">
            <div className="flex justify-end">
              <BoolBadge value={data.hasTransparency} />
            </div>
          </DetailRow>
          <DetailRow label="Dominant color">
            {data.dominantColor ? (
              <div className="flex min-w-0 items-center justify-end gap-2">
                <span
                  className="inline-block size-3 shrink-0 rounded-sm border"
                  style={{ backgroundColor: data.dominantColor }}
                />
                <TruncatedText text={data.dominantColor} mono />
              </div>
            ) : (
              <TruncatedText text="—" />
            )}
          </DetailRow>
          {hasValue(data.colorPalette) ? (
            <DetailRow label="Color palette" value={data.colorPalette} mono />
          ) : null}
        </Section>
      )}

      <Section title="Processing">
        <DetailRow label="Status">
          <div className="flex justify-end">
            <Badge variant="secondary" className="capitalize">
              {data.processingStatus ?? "n/a"}
            </Badge>
          </div>
        </DetailRow>
        <DetailRow label="Processed">
          <div className="flex justify-end">
            <BoolBadge value={data.isProcessed} />
          </div>
        </DetailRow>
        <DetailRow
          label="Attempts"
          value={
            data.processingAttempts != null
              ? String(data.processingAttempts)
              : "—"
          }
        />
        {hasValue(data.processingError) ? (
          <DetailRow
            label="Error"
            value={data.processingError}
            copy={data.processingError}
          />
        ) : null}
      </Section>

      <Section title="Access & lifecycle">
        <DetailRow label="Visibility">
          <div className="flex justify-end">
            <Badge variant="outline" className="capitalize">
              {data.visibility ?? "—"}
            </Badge>
          </div>
        </DetailRow>
        <DetailRow label="Password">
          <div className="flex justify-end">
            <BoolBadge value={!!data.downloadPassword} />
          </div>
        </DetailRow>
        <DetailRow
          label="References"
          value={
            data.referenceCount != null ? String(data.referenceCount) : "—"
          }
        />
        <DetailRow label="Orphaned">
          <div className="flex justify-end">
            <BoolBadge value={data.isOrphaned} />
          </div>
        </DetailRow>
        {hasValue(data.orphanedAt) ? (
          <DetailRow label="Orphaned at">
            <div className="flex justify-end">
              <DateDisplay date={data.orphanedAt!} format="datetime" />
            </div>
          </DetailRow>
        ) : null}
        {hasValue(data.deletedAt) ? (
          <DetailRow label="Deleted at">
            <div className="flex justify-end">
              <DateDisplay date={data.deletedAt!} format="datetime" />
            </div>
          </DetailRow>
        ) : null}
        <DetailRow label="Created">
          <div className="flex justify-end">
            <DateDisplay date={data.createdAt} format="datetime" />
          </div>
        </DetailRow>
        <DetailRow label="Updated">
          <div className="flex justify-end">
            <DateDisplay date={data.updatedAt} format="datetime" />
          </div>
        </DetailRow>
        <DetailRow
          label="Uploaded by"
          value={data.uploadedBy || "—"}
          copy={data.uploadedBy || undefined}
          mono
        />
      </Section>

      {(hasValue(data.externalId) || hasValue(data.externalProvider)) && (
        <Section title="External">
          <DetailRow
            label="External ID"
            value={data.externalId || "—"}
            copy={data.externalId || undefined}
            mono
          />
          <DetailRow label="Provider" value={data.externalProvider || "—"} />
        </Section>
      )}

      {(hasValue(data.alt) ||
        hasValue(data.title) ||
        hasValue(data.caption) ||
        hasValue(data.description) ||
        hasValue(data.tags) ||
        hasValue(data.transcript)) && (
        <Section title="Content">
          <DetailRow label="Title" value={data.title || "—"} />
          <DetailRow label="Alt" value={data.alt || "—"} />
          <DetailRow label="Caption" value={data.caption || "—"} />
          <DetailRow label="Description" value={data.description || "—"} />
          <DetailRow label="Tags" value={data.tags || "—"} />
          {hasValue(data.transcript) ? (
            <DetailRow
              label="Transcript"
              value={data.transcript}
              copy={data.transcript}
            />
          ) : null}
        </Section>
      )}

      {(hasValue(data.aiDescription) ||
        hasValue(data.aiGeneratedTags) ||
        data.isNsfw != null ||
        data.nsfwScore != null ||
        hasValue(data.objectDetection) ||
        hasValue(data.faceDetection)) && (
        <Section title="AI / moderation">
          <DetailRow label="NSFW">
            <div className="flex justify-end">
              <BoolBadge value={data.isNsfw} />
            </div>
          </DetailRow>
          <DetailRow
            label="NSFW score"
            value={data.nsfwScore != null ? data.nsfwScore.toFixed(3) : "—"}
          />
          <DetailRow
            label="AI description"
            value={data.aiDescription || "—"}
          />
          <DetailRow label="AI tags" value={data.aiGeneratedTags || "—"} />
          {hasValue(data.objectDetection) ? (
            <DetailRow label="Objects" value={data.objectDetection} mono />
          ) : null}
          {hasValue(data.faceDetection) ? (
            <DetailRow label="Faces" value={data.faceDetection} mono />
          ) : null}
        </Section>
      )}
    </div>
  );
}

type FileDetailTab = "overview" | "details" | "variants" | "metadata" | "jobs";

function FileVariantsPanel({ fileId }: { fileId: string }) {
  const { activeOrg } = useActiveOrg();
  const { data, isLoading, error, refetch } = useFileVariantsQuery(
    fileId,
    activeOrg?.id,
    !!fileId && !!activeOrg?.id,
  );
  const regenerate = useRegenerateProcessingMutation(activeOrg?.id);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading variants…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/30 p-4 text-sm">
        <p className="text-destructive">Failed to load variants</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {data?.total ?? items.length} variant
          {(data?.total ?? items.length) === 1 ? "" : "s"}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={regenerate.isPending}
          onClick={() => {
            regenerate.mutate(fileId, {
              onSuccess: (result) => {
                toast.success(result.message);
                void refetch();
              },
              onError: (err) =>
                toast.error(
                  extractApiErrorMessage(err, "Failed to schedule regenerate"),
                ),
            });
          }}
        >
          {regenerate.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Regenerate
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No variants yet. Upload processing or Regenerate may create them.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((variant) => (
            <li
              key={variant.id}
              className="space-y-1.5 rounded-lg border bg-card p-3"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="capitalize">
                  {variant.name}
                </Badge>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatBytes(variant.size)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {variant.mimeType}
                </span>
              </div>
              <p className="break-all font-mono text-xs text-muted-foreground">
                {variant.key}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function jobStatusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "failed":
      return "bg-destructive/15 text-destructive";
    case "processing":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "cancelled":
      return "bg-muted text-muted-foreground";
    default:
      return "";
  }
}

function FileJobsPanel({ fileId }: { fileId: string }) {
  const { activeOrg } = useActiveOrg();
  const { data, isLoading, error, refetch } = useJobsQuery({
    page: 1,
    limit: 50,
    fileId,
    orgId: activeOrg?.id,
    enabled: !!fileId && !!activeOrg?.id,
  });
  const cancelMutation = useCancelJobMutation(activeOrg?.id);
  const retryMutation = useRetryJobMutation(activeOrg?.id);
  const busyId =
    cancelMutation.isPending || retryMutation.isPending
      ? (cancelMutation.variables ?? retryMutation.variables)
      : null;

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading jobs…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/30 p-4 text-sm">
        <p className="text-destructive">Failed to load jobs</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const jobs = data?.items ?? [];
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No processing jobs for this file yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {data?.total ?? jobs.length} job
        {(data?.total ?? jobs.length) === 1 ? "" : "s"}
      </p>
      <ul className="space-y-2.5">
        {jobs.map((job) => {
          const canCancel =
            job.status === "pending" || job.status === "processing";
          const canRetry =
            job.status === "failed" || job.status === "cancelled";
          return (
            <li
              key={job.id}
              className="space-y-2.5 rounded-lg border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="capitalize">
                      {JobTypeLabels[
                        job.jobType as keyof typeof JobTypeLabels
                      ] ?? job.jobType}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={jobStatusBadgeClass(String(job.status))}
                    >
                      {JobStatusLabels[
                        job.status as keyof typeof JobStatusLabels
                      ] ?? job.status}
                    </Badge>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div className="min-w-0 flex-1">
                      <TruncatedText text={job.id} mono className="text-left!" />
                    </div>
                    <SmallCopy content={job.id} />
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {canRetry ? (
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-7"
                      disabled={busyId === job.id}
                      title="Retry"
                      onClick={() => {
                        retryMutation.mutate(job.id, {
                          onSuccess: () =>
                            toast.success("Job queued for retry"),
                          onError: (err) =>
                            toast.error(
                              extractApiErrorMessage(err, "Retry failed"),
                            ),
                        });
                      }}
                    >
                      {busyId === job.id && retryMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                    </Button>
                  ) : null}
                  {canCancel ? (
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-7 text-destructive"
                      disabled={busyId === job.id}
                      title="Cancel"
                      onClick={() => {
                        cancelMutation.mutate(job.id, {
                          onSuccess: () => toast.success("Job cancelled"),
                          onError: (err) =>
                            toast.error(
                              extractApiErrorMessage(err, "Cancel failed"),
                            ),
                        });
                      }}
                    >
                      {busyId === job.id && cancelMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Ban className="size-3.5" />
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-1 text-xs text-muted-foreground">
                <div className="flex justify-between gap-2">
                  <span>Created</span>
                  <DateDisplay date={job.createdAt} format="datetime" />
                </div>
                {job.completedAt ? (
                  <div className="flex justify-between gap-2">
                    <span>Completed</span>
                    <DateDisplay date={job.completedAt} format="datetime" />
                  </div>
                ) : null}
                {job.retryCount > 0 ? (
                  <div className="flex justify-between gap-2">
                    <span>Retries</span>
                    <span className="tabular-nums">{job.retryCount}</span>
                  </div>
                ) : null}
              </div>
              {job.errorMessage ? (
                <TruncatedText
                  text={job.errorMessage}
                  lines={3}
                  mono
                  className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-left! text-[11px] leading-relaxed text-destructive"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FileDetailSheet({
  fileId,
  open,
  onOpenChange,
  initialTab = "overview",
}: {
  fileId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: FileDetailTab;
}) {
  const { activeOrg } = useActiveOrg();
  const [tab, setTab] = useState<FileDetailTab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab, fileId]);

  const { data, isLoading } = useFileDetailQuery(
    fileId ?? undefined,
    activeOrg?.id,
  );
  const signedUrl = useFileSignedUrlQuery(
    fileId ?? undefined,
    activeOrg?.id,
    open && !!fileId,
  );
  const fileMetadata = useFileMetadataQuery(
    fileId ?? undefined,
    activeOrg?.id,
    open && !!fileId,
  );
  const fileVariants = useFileVariantsQuery(
    fileId ?? undefined,
    activeOrg?.id,
    open && !!fileId,
  );
  const fileJobs = useJobsQuery({
    page: 1,
    limit: 50,
    fileId: fileId ?? undefined,
    orgId: activeOrg?.id,
    enabled: open && !!fileId && !!activeOrg?.id,
  });

  const metaJson = metadataJson(fileMetadata.data?.metadata ?? null);
  const metaKeys = fileMetadata.data?.metadata
    ? Object.keys(fileMetadata.data.metadata).length
    : 0;
  const variantsCount = fileVariants.data?.total ?? 0;
  const jobsCount = fileJobs.data?.total ?? 0;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      className="w-full sm:max-w-2xl lg:max-w-3xl"
    >
      <ResponsiveSheet.Header>
        <ResponsiveSheet.Title className="pr-8">
          {data?.originalFileName ? (
            <TruncatedText
              text={data.originalFileName}
              className="text-left! text-base font-semibold"
            />
          ) : (
            "File details"
          )}
        </ResponsiveSheet.Title>
        <ResponsiveSheet.Description>
          Preview, full record, EXIF sidecar, and jobs.
        </ResponsiveSheet.Description>
      </ResponsiveSheet.Header>

      {isLoading || !data ? (
        <ResponsiveSheet.Content className="px-4 pb-6">
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        </ResponsiveSheet.Content>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as FileDetailTab)}
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
        >
          <div className="shrink-0 bg-background px-4 pb-3">
            <TabsList className="grid h-9 w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="variants" className="gap-1">
                Variants
                {variantsCount > 0 ? (
                  <Badge
                    variant="secondary"
                    className="h-4 min-w-4 px-1 text-[10px] tabular-nums"
                  >
                    {variantsCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="metadata" className="gap-1">
                Meta
                {fileMetadata.data?.metadata != null ? (
                  <Badge
                    variant="secondary"
                    className="h-4 min-w-4 px-1 text-[10px] tabular-nums"
                  >
                    {metaKeys}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1">
                Jobs
                {jobsCount > 0 ? (
                  <Badge
                    variant="secondary"
                    className="h-4 min-w-4 px-1 text-[10px] tabular-nums"
                  >
                    {jobsCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </div>

          <ResponsiveSheet.Content className="space-y-4 px-4 pb-6">
            <TabsContent value="overview" className="mt-0 space-y-4">
              <div className="flex items-start gap-4 rounded-lg border bg-card p-3">
                <FilePreviewThumb
                  fileId={data.id}
                  mimeType={data.mimeType}
                  orgId={activeOrg?.id}
                  alt={data.originalFileName}
                  size="lg"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <TruncatedText
                    text={data.originalFileName}
                    className="text-left! font-medium"
                  />
                  <TruncatedText
                    text={data.mimeType}
                    mono
                    className="text-left! text-muted-foreground"
                  />
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {formatBytes(data.size)}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <Badge variant="outline" className="capitalize">
                      {data.visibility ?? "—"}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {data.processingStatus ?? "n/a"}
                    </Badge>
                    {data.deletedAt ? (
                      <Badge variant="destructive">Deleted</Badge>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5"
                      asChild
                    >
                      <a
                        href={fileContentUrl(data.id, {
                          orgId: activeOrg?.id,
                          download: true,
                        })}
                        download={data.originalFileName}
                      >
                        <Download className="size-3.5" />
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              <Section title="Quick facts">
                <DetailRow
                  label="Checksum"
                  value={data.checksum || "—"}
                  copy={data.checksum || undefined}
                  mono
                />
                <DetailRow
                  label="File hash"
                  value={data.fileHash || "—"}
                  copy={data.fileHash || undefined}
                  mono
                />
                <DetailRow
                  label="Storage key"
                  value={data.storageKey}
                  copy={data.storageKey}
                  mono
                />
                <DetailRow label="Created">
                  <div className="flex justify-end">
                    <DateDisplay date={data.createdAt} format="datetime" />
                  </div>
                </DetailRow>
              </Section>

              <section className="overflow-hidden rounded-lg border bg-card">
                <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Signed URL
                  </h3>
                  {signedUrl.data?.url ? (
                    <div className="flex items-center gap-1.5">
                      <SmallCopy content={signedUrl.data.url} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs"
                        asChild
                      >
                        <a
                          href={signedUrl.data.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="size-3" />
                          Open
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs"
                        asChild
                      >
                        <a
                          href={fileContentUrl(data.id, {
                            orgId: activeOrg?.id,
                            download: true,
                          })}
                          download={data.originalFileName}
                        >
                          <Download className="size-3" />
                          Download
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs"
                      asChild
                    >
                      <a
                        href={fileContentUrl(data.id, {
                          orgId: activeOrg?.id,
                          download: true,
                        })}
                        download={data.originalFileName}
                      >
                        <Download className="size-3" />
                        Download
                      </a>
                    </Button>
                  )}
                </div>
                <div className="px-3 py-2.5 text-sm">
                  {signedUrl.isLoading ? (
                    <p className="text-muted-foreground">Resolving…</p>
                  ) : signedUrl.data?.url ? (
                    <div className="space-y-1.5">
                      <p className="break-all font-mono text-xs leading-relaxed">
                        {signedUrl.data.url}
                      </p>
                      {signedUrl.data.variant ? (
                        <p className="text-xs text-muted-foreground">
                          Variant: {signedUrl.data.variant}
                          {signedUrl.data.expiresIn != null
                            ? ` · expires in ${signedUrl.data.expiresIn}s`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Unavailable</p>
                  )}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="details" className="mt-0 space-y-4">
              <FileOverviewDetails data={data} />
            </TabsContent>

            <TabsContent value="variants" className="mt-0 space-y-4">
              <FileVariantsPanel fileId={data.id} />
            </TabsContent>

            <TabsContent value="metadata" className="mt-0 space-y-4">
              {fileMetadata.isLoading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading metadata…
                </div>
              ) : fileMetadata.data?.metadata == null ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No metadata sidecar yet. Run or wait for a metadata extraction
                  job.
                </div>
              ) : (
                <>
                  <Section title="Sidecar">
                    <DetailRow label="Tags" value={String(metaKeys)} />
                    <DetailRow label="Extracted">
                      <div className="flex justify-end">
                        {fileMetadata.data.extractedAt ? (
                          <DateDisplay
                            date={fileMetadata.data.extractedAt}
                            format="datetime"
                          />
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </DetailRow>
                    <DetailRow label="Updated">
                      <div className="flex justify-end">
                        {fileMetadata.data.updatedAt ? (
                          <DateDisplay
                            date={fileMetadata.data.updatedAt}
                            format="datetime"
                          />
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </DetailRow>
                  </Section>

                  <section className="overflow-hidden rounded-lg border bg-card">
                    <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        EXIF / IPTC / XMP
                      </h3>
                      {metaJson ? <SmallCopy content={metaJson} /> : null}
                    </div>
                    <div className="p-3">
                      {metaKeys === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Extraction completed with an empty payload (common for
                          non-image files).
                        </p>
                      ) : (
                        <pre className="max-h-[min(28rem,50vh)] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
                          {metaJson}
                        </pre>
                      )}
                    </div>
                  </section>
                </>
              )}
            </TabsContent>

            <TabsContent value="jobs" className="mt-0 space-y-4">
              <FileJobsPanel fileId={data.id} />
            </TabsContent>
          </ResponsiveSheet.Content>
        </Tabs>
      )}
    </ResponsiveSheet>
  );
}
