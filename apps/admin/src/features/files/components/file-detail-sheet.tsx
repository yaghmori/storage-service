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
import {
  JobStatusLabels,
  ProcessorKey,
  ProcessorKeyLabels,
} from "@workspace/validation";
import {
  Ban,
  Check,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  type FileDuplicateRow,
  type FileRow,
  type FileVariantRow,
  useConfirmDuplicateMutation,
  useDismissDuplicateMutation,
  useFileDetailQuery,
  useFileDuplicatesQuery,
  useFileMetadataQuery,
  useFileProcessorResultsQuery,
  useFileSignedUrlQuery,
  useFileVariantsQuery,
  useRegenerateProcessingMutation,
  useRestoreFileMutation,
  useVerifyFileMutation,
} from "../hooks/use-files-queries";
import { FilePreviewThumb } from "./file-preview-thumb";

function detectionMethodLabel(method: string): string {
  switch (method) {
    case "sha256":
      return "Exact hash (SHA-256)";
    case "content":
      return "Content / perceptual hash";
    case "ai":
      return "AI visual similarity";
    case "manual":
      return "Manual link";
    default:
      return method;
  }
}

function detectionMethodHint(method: string): string {
  switch (method) {
    case "sha256":
      return "Byte-identical content — same file hash as an existing object.";
    case "content":
      return "Visually or structurally similar (e.g. pHash). Compare previews before confirming.";
    case "ai":
      return "Model judged these images look alike. Confirm only if that is correct for your use case.";
    case "manual":
      return "Someone linked these files manually.";
    default:
      return "Review both files before confirming or dismissing.";
  }
}

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
    let next = false;
    if (el) {
      next =
        lines > 1
          ? el.scrollHeight > el.clientHeight + 1
          : el.scrollWidth > el.clientWidth + 1;
    }
    setTruncated((prev) => (prev === next ? prev : next));
  }, [lines]);

  useEffect(() => {
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
        {children ?? <TruncatedText text={value ?? "—"} mono={mono} />}
      </dd>
      <div className="flex w-6 justify-end">
        {copy ? <SmallCopy content={copy} /> : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
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

function IntegrityVerifyRow({
  label,
  value,
  fileId,
  showVerify,
}: {
  label: string;
  value: string | null | undefined;
  fileId: string;
  showVerify?: boolean;
}) {
  const { activeOrg } = useActiveOrg();
  const verifyMutation = useVerifyFileMutation(activeOrg?.id);
  const results = useFileProcessorResultsQuery(
    fileId,
    activeOrg?.id,
    showVerify && !!fileId && !!activeOrg?.id,
  );
  const [awaiting, setAwaiting] = useState(false);

  const integrity = results.data?.items.find(
    (row) => row.processorKey === ProcessorKey.INTEGRITY_VERIFY,
  );
  const matched = integrity?.data?.matched === true;
  const verified = integrity?.status === "completed" && matched;
  const mismatched =
    !!integrity &&
    (integrity.status === "failed" || integrity.data?.matched === false);
  const verifying =
    awaiting ||
    verifyMutation.isPending ||
    integrity?.status === "pending" ||
    integrity?.status === "processing";

  useEffect(() => {
    if (!awaiting) return;
    if (verified || mismatched) {
      setAwaiting(false);
      return;
    }
    const timer = setInterval(() => {
      void results.refetch();
    }, 2000);
    return () => clearInterval(timer);
  }, [awaiting, verified, mismatched, results.refetch]);

  const verifiedAt =
    typeof integrity?.data?.verifiedAt === "string"
      ? integrity.data.verifiedAt
      : integrity?.processedAt;

  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-border/60 py-2.5 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0">
        <TruncatedText text={value || "—"} mono />
      </dd>
      <div className="flex items-center justify-end gap-1">
        {value ? <SmallCopy content={value} /> : <span className="w-6" />}
        {showVerify ? (
          verifying && !verified ? (
            <Badge variant="secondary" className="h-6 gap-1 px-2 text-xs">
              <Loader2 className="size-3 animate-spin" />
              Verifying
            </Badge>
          ) : verified ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="h-6 gap-1 bg-emerald-500/15 px-2 text-xs text-emerald-700 dark:text-emerald-400"
                >
                  <ShieldCheck className="size-3" />
                  Verified
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Stored object matches the upload SHA-256
                {verifiedAt
                  ? ` · checked ${new Date(verifiedAt).toLocaleString()}`
                  : ""}
                .
              </TooltipContent>
            </Tooltip>
          ) : mismatched ? (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="destructive"
                    className="h-6 gap-1 px-2 text-xs"
                  >
                    Mismatch
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {integrity?.error ||
                    "Stored object hash does not match the upload SHA-256."}
                </TooltipContent>
              </Tooltip>
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                disabled={verifyMutation.isPending}
                onClick={() =>
                  verifyMutation.mutate(fileId, {
                    onSuccess: (result) => {
                      setAwaiting(true);
                      toast.success(result.message);
                      void results.refetch();
                    },
                    onError: (err) =>
                      toast.error(
                        extractApiErrorMessage(err, "Verify failed"),
                      ),
                  })
                }
              >
                Re-verify
              </Button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs"
                  disabled={verifyMutation.isPending}
                  onClick={() =>
                    verifyMutation.mutate(fileId, {
                      onSuccess: (result) => {
                        setAwaiting(true);
                        toast.success(result.message);
                        void results.refetch();
                      },
                      onError: (err) =>
                        toast.error(
                          extractApiErrorMessage(err, "Verify failed"),
                        ),
                    })
                  }
                >
                  <ShieldCheck className="size-3" />
                  Verify
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Re-hashes the stored object and compares it to the upload
                SHA-256. Use this to detect corruption or bit flips in storage.
              </TooltipContent>
            </Tooltip>
          )
        ) : null}
      </div>
    </div>
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
        <DetailRow
          label="MIME"
          value={data.mimeType}
          copy={data.mimeType}
          mono
        />
        <DetailRow
          label="Size"
          value={`${formatBytes(data.size)} (${String(data.size)} bytes)`}
        />
      </Section>

      <Section title="Integrity">
        <IntegrityVerifyRow
          label="SHA-256"
          value={data.fileHash}
          fileId={data.id}
          showVerify
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
        hasValue(data.duration) ||
        hasValue(data.bitrate) ||
        hasValue(data.frameRate) ||
        data.hasTransparency != null ||
        hasValue(data.dominantColor)) && (
        <Section title="Media">
          <DetailRow label="Dimensions" value={dimensions ?? "—"} />
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
    </div>
  );
}

type FileDetailTab =
  | "overview"
  | "details"
  | "duplicates"
  | "processors"
  | "metadata"
  | "jobs";

function isImageMime(mime: string | null | undefined) {
  return !!mime?.startsWith("image/");
}

function isVideoMime(mime: string | null | undefined) {
  return !!mime?.startsWith("video/");
}

function DeliveryAssetRow({
  fileId,
  orgId,
  label,
  mimeType,
  size,
  storageKey,
  variant,
  downloadName,
}: {
  fileId: string;
  orgId?: string;
  label: string;
  mimeType: string;
  size?: number | null;
  storageKey?: string | null;
  variant?: string | null;
  downloadName?: string;
}) {
  const [wantSigned, setWantSigned] = useState(false);
  const signed = useFileSignedUrlQuery(
    fileId,
    orgId,
    wantSigned,
    variant ?? null,
  );
  const previewUrl = fileContentUrl(fileId, {
    orgId,
    variant: variant ?? undefined,
  });
  const downloadUrl = fileContentUrl(fileId, {
    orgId,
    variant: variant ?? undefined,
    download: true,
  });

  return (
    <li className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex gap-3">
        {isImageMime(mimeType) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            className="size-16 shrink-0 rounded-md border object-cover bg-muted"
          />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-md border bg-muted text-[10px] uppercase text-muted-foreground">
            {label.slice(0, 6)}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="capitalize">
              {label}
            </Badge>
            {size != null ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatBytes(size)}
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">{mimeType}</span>
          </div>
          {storageKey ? (
            <p className="break-all font-mono text-xs text-muted-foreground">
              {storageKey}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-7 gap-1" asChild>
              <a href={previewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3" />
                Open
              </a>
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1" asChild>
              <a href={downloadUrl} download={downloadName}>
                <Download className="size-3" />
                Download
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1"
              disabled={signed.isFetching}
              onClick={() => {
                setWantSigned(true);
                if (wantSigned) void signed.refetch();
              }}
            >
              {signed.isFetching ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              {signed.data?.url ? "Refresh signed URL" : "Signed URL"}
            </Button>
          </div>
        </div>
      </div>

      {wantSigned ? (
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          {signed.isLoading || signed.isFetching ? (
            <p className="text-xs text-muted-foreground">Resolving signed URL…</p>
          ) : signed.data?.url ? (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed">
                  {signed.data.url}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <SmallCopy content={signed.data.url} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 px-2 text-xs"
                    asChild
                  >
                    <a
                      href={signed.data.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="size-3" />
                      Open
                    </a>
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {signed.data.variant
                  ? `Variant: ${signed.data.variant}`
                  : "Original object"}
                {signed.data.expiresIn != null
                  ? ` · expires in ${signed.data.expiresIn}s`
                  : ""}
              </p>
            </div>
          ) : (
            <p className="text-xs text-destructive">
              {extractApiErrorMessage(
                signed.error,
                "Could not generate signed URL",
              )}
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}

function FileDeliveryPanel({
  file,
}: {
  file: Pick<
    FileRow,
    "id" | "originalFileName" | "mimeType" | "size" | "storageKey"
  >;
}) {
  const { activeOrg } = useActiveOrg();
  const { data, isLoading, error, refetch } = useFileVariantsQuery(
    file.id,
    activeOrg?.id,
    !!file.id && !!activeOrg?.id,
  );
  const regenerate = useRegenerateProcessingMutation(activeOrg?.id);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPoll = useCallback(() => {
    setPolling(true);
    if (pollRef.current) clearInterval(pollRef.current);
    let ticks = 0;
    pollRef.current = setInterval(() => {
      ticks += 1;
      void refetch();
      if (ticks >= 8) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setPolling(false);
      }
    }, 2500);
  }, [refetch]);

  const variants = data?.items ?? [];
  const canRegenVariants = isImageMime(file.mimeType);
  const canRegenVideo = isVideoMime(file.mimeType);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Delivery
          </h3>
          <p className="text-xs text-muted-foreground">
            Generated variants with open/download and signed URLs.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {canRegenVariants ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5"
              disabled={regenerate.isPending || polling}
              onClick={() => {
                regenerate.mutate(
                  { id: file.id, scope: "variants" },
                  {
                    onSuccess: (result) => {
                      toast.success(result.message);
                      startPoll();
                    },
                    onError: (err) =>
                      toast.error(
                        extractApiErrorMessage(
                          err,
                          "Failed to schedule variant regenerate",
                        ),
                      ),
                  },
                );
              }}
            >
              {regenerate.isPending || polling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Regenerate variants
            </Button>
          ) : null}
          {canRegenVideo ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5"
              disabled={regenerate.isPending || polling}
              onClick={() => {
                regenerate.mutate(
                  { id: file.id, scope: "video" },
                  {
                    onSuccess: (result) => {
                      toast.success(result.message);
                      startPoll();
                    },
                    onError: (err) =>
                      toast.error(
                        extractApiErrorMessage(
                          err,
                          "Failed to schedule video regenerate",
                        ),
                      ),
                  },
                );
              }}
            >
              {regenerate.isPending || polling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Regenerate previews
            </Button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading assets…
        </div>
      ) : error ? (
        <div className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm">
          <p className="text-destructive">Failed to load variants</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : variants.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          No generated variants yet.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {variants.map((variant: FileVariantRow) => (
            <DeliveryAssetRow
              key={variant.id}
              fileId={file.id}
              orgId={activeOrg?.id}
              label={variant.name}
              mimeType={variant.mimeType}
              size={variant.size}
              storageKey={variant.key}
              variant={variant.name}
              downloadName={`${variant.name}-${file.originalFileName}`}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DuplicateCompareCard({
  title,
  fileId,
  orgId,
  fileName,
  mimeType,
  size,
  width,
  height,
  createdAt,
  deletedAt,
  fileHash,
  storageKey,
  processingStatus,
  highlight,
}: {
  title: string;
  fileId?: string | null;
  orgId?: string;
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | string | null;
  width?: number | null;
  height?: number | null;
  createdAt?: string | null;
  deletedAt?: string | null;
  fileHash?: string | null;
  storageKey?: string | null;
  processingStatus?: string | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 space-y-2 rounded-md border p-2.5",
        highlight ? "border-primary/40 bg-primary/5" : "bg-muted/20",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </p>
        {deletedAt ? (
          <Badge variant="destructive" className="h-5 text-[10px]">
            Deleted
          </Badge>
        ) : null}
      </div>
      <div className="flex gap-2.5">
        {fileId ? (
          <FilePreviewThumb
            fileId={fileId}
            mimeType={mimeType}
            orgId={orgId}
            alt={fileName ?? title}
            size="md"
          />
        ) : (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">
            N/A
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium">
            {fileName ?? "Unknown file"}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {mimeType ?? "—"}
            {size != null ? ` · ${formatBytes(size)}` : ""}
          </p>
          {width != null && height != null ? (
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {width}×{height}px
            </p>
          ) : null}
        </div>
      </div>
      <dl className="grid gap-1 text-[11px]">
        {fileId ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">ID</dt>
            <dd className="truncate font-mono" title={fileId}>
              {fileId}
            </dd>
          </div>
        ) : null}
        {createdAt ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Created</dt>
            <dd>
              <DateDisplay date={createdAt} format="relative" />
            </dd>
          </div>
        ) : null}
        {processingStatus ? (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="capitalize">{processingStatus}</dd>
          </div>
        ) : null}
        {fileHash ? (
          <div className="flex justify-between gap-2">
            <dt className="shrink-0 text-muted-foreground">Hash</dt>
            <dd className="truncate font-mono" title={fileHash}>
              {fileHash.slice(0, 12)}…
            </dd>
          </div>
        ) : null}
        {storageKey ? (
          <div className="flex justify-between gap-2">
            <dt className="shrink-0 text-muted-foreground">Key</dt>
            <dd className="truncate font-mono" title={storageKey}>
              {storageKey}
            </dd>
          </div>
        ) : null}
      </dl>
      {fileId ? (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-xs" asChild>
            <a
              href={fileContentUrl(fileId, { orgId })}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3" />
              Open
            </a>
          </Button>
          <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-xs" asChild>
            <a
              href={fileContentUrl(fileId, { orgId, download: true })}
              download={fileName ?? undefined}
            >
              <Download className="size-3" />
              Download
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FileDuplicatesPanel({
  file,
}: {
  file: Pick<
    FileRow,
    | "id"
    | "originalFileName"
    | "mimeType"
    | "size"
    | "width"
    | "height"
    | "createdAt"
    | "deletedAt"
    | "fileHash"
    | "storageKey"
    | "processingStatus"
  >;
}) {
  const { activeOrg } = useActiveOrg();
  const { data, isLoading, error, refetch } = useFileDuplicatesQuery(
    file.id,
    activeOrg?.id,
    !!file.id && !!activeOrg?.id,
  );
  const confirmMutation = useConfirmDuplicateMutation(activeOrg?.id);
  const dismissMutation = useDismissDuplicateMutation(activeOrg?.id);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading near-duplicates…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/30 p-4 text-sm">
        <p className="text-destructive">Failed to load duplicates</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="space-y-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        <p>No near-duplicate candidates for this file.</p>
        <p className="text-xs">
          When <code className="rounded bg-muted px-1">dedupe.phash</code> is
          enabled, visually similar images are flagged here for review. Confirm
          means “yes, these look the same”; Dismiss removes the candidate. Files
          are never merged or deleted by these actions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Compare this file with each candidate. Confirm a true match or dismiss a
        false positive — storage is never changed by these actions.
      </p>
      <ul className="space-y-3">
        {items.map((row: FileDuplicateRow) => {
          const pending =
            confirmMutation.isPending || dismissMutation.isPending;
          const sameHash =
            !!file.fileHash &&
            !!row.relatedFileHash &&
            file.fileHash === row.relatedFileHash;
          const sameSize =
            row.relatedSize != null &&
            Number(file.size) === Number(row.relatedSize);
          return (
            <li
              key={row.id}
              className="space-y-3 rounded-lg border bg-card p-3"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">
                  {detectionMethodLabel(row.detectionMethod)}
                </Badge>
                {row.isConfirmed ? (
                  <Badge variant="default">Confirmed</Badge>
                ) : (
                  <Badge variant="outline">Needs review</Badge>
                )}
                {row.similarityScore != null ? (
                  <Badge variant="outline" className="tabular-nums">
                    {(row.similarityScore * 100).toFixed(0)}% similar
                  </Badge>
                ) : null}
                {sameHash ? (
                  <Badge variant="default">Same hash</Badge>
                ) : null}
                {sameSize ? (
                  <Badge variant="outline">Same size</Badge>
                ) : null}
              </div>

              <p className="text-xs text-muted-foreground">
                {detectionMethodHint(row.detectionMethod)}
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                <DuplicateCompareCard
                  title="This file"
                  fileId={file.id}
                  orgId={activeOrg?.id}
                  fileName={file.originalFileName}
                  mimeType={file.mimeType}
                  size={file.size}
                  width={file.width}
                  height={file.height}
                  createdAt={file.createdAt}
                  deletedAt={file.deletedAt}
                  fileHash={file.fileHash}
                  storageKey={file.storageKey}
                  processingStatus={file.processingStatus}
                  highlight
                />
                <DuplicateCompareCard
                  title="Candidate"
                  fileId={row.relatedFileId}
                  orgId={activeOrg?.id}
                  fileName={row.relatedFileName}
                  mimeType={row.relatedMimeType}
                  size={row.relatedSize}
                  width={row.relatedWidth}
                  height={row.relatedHeight}
                  createdAt={row.relatedCreatedAt}
                  deletedAt={row.relatedDeletedAt}
                  fileHash={row.relatedFileHash}
                  storageKey={row.relatedStorageKey}
                  processingStatus={row.relatedProcessingStatus}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  Detected{" "}
                  <DateDisplay date={row.detectedAt} format="relative" />
                </span>
                {row.confirmedAt ? (
                  <span>
                    Confirmed{" "}
                    <DateDisplay date={row.confirmedAt} format="relative" />
                  </span>
                ) : null}
                {row.confirmedBy ? (
                  <span className="font-mono" title={row.confirmedBy}>
                    by {row.confirmedBy.slice(0, 8)}…
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {!row.isConfirmed ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1"
                    disabled={pending}
                    onClick={() =>
                      confirmMutation.mutate(
                        { fileId: file.id, duplicateId: row.id },
                        {
                          onSuccess: () => {
                            toast.success("Marked as confirmed match");
                            void refetch();
                          },
                          onError: (err) =>
                            toast.error(
                              extractApiErrorMessage(err, "Confirm failed"),
                            ),
                        },
                      )
                    }
                  >
                    <Check className="size-3" />
                    Confirm match
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1"
                  disabled={pending}
                  onClick={() =>
                    dismissMutation.mutate(
                      { fileId: file.id, duplicateId: row.id },
                      {
                        onSuccess: () => {
                          toast.success("Candidate dismissed");
                          void refetch();
                        },
                        onError: (err) =>
                          toast.error(
                            extractApiErrorMessage(err, "Dismiss failed"),
                          ),
                      },
                    )
                  }
                >
                  <X className="size-3" />
                  Dismiss
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FileProcessorResultsPanel({ fileId }: { fileId: string }) {
  const { activeOrg } = useActiveOrg();
  const { data, isLoading, error, refetch } = useFileProcessorResultsQuery(
    fileId,
    activeOrg?.id,
    !!fileId && !!activeOrg?.id,
  );

  const hasInFlight = (data?.items ?? []).some(
    (row) => row.status === "pending" || row.status === "processing",
  );

  useEffect(() => {
    if (!hasInFlight) return;
    const timer = setInterval(() => {
      void refetch();
    }, 2500);
    return () => clearInterval(timer);
  }, [hasInFlight, refetch]);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading processor results…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/30 p-4 text-sm">
        <p className="text-destructive">Failed to load processor results</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const results = data?.items ?? [];
  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No processor results for this file yet.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {results.map((result) => {
        const resultJson = metadataJson(result.data);
        const aiData =
          result.processorKey === ProcessorKey.AI_VISION ? result.data : null;
        const tags = Array.isArray(aiData?.tags)
          ? aiData.tags.filter((tag): tag is string => typeof tag === "string")
          : [];
        return (
          <li
            key={result.id ?? result.processorKey}
            className="overflow-hidden rounded-lg border bg-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {ProcessorKeyLabels[result.processorKey] ??
                    result.processorKey}
                </span>
                <Badge variant="secondary" className="capitalize">
                  {result.status}
                </Badge>
                {result.model ? (
                  <Badge variant="outline">{result.model}</Badge>
                ) : null}
              </div>
              {result.processedAt ? (
                <DateDisplay date={result.processedAt} format="datetime" />
              ) : null}
            </div>
            <div className="space-y-3 p-3">
              {aiData ? (
                <dl className="space-y-1 text-sm">
                  <DetailRow
                    label="Description"
                    value={
                      typeof aiData.description === "string"
                        ? aiData.description
                        : "—"
                    }
                  />
                  <DetailRow label="Tags" value={tags.join(", ") || "—"} />
                  <DetailRow
                    label="NSFW score"
                    value={
                      typeof aiData.nsfwScore === "number"
                        ? aiData.nsfwScore.toFixed(3)
                        : "—"
                    }
                  />
                  <DetailRow label="NSFW">
                    <div className="flex justify-end">
                      <BoolBadge
                        value={
                          typeof aiData.isNsfw === "boolean"
                            ? aiData.isNsfw
                            : null
                        }
                      />
                    </div>
                  </DetailRow>
                </dl>
              ) : null}
              {result.processorKey === ProcessorKey.DOCUMENT_OCR &&
              typeof result.data?.text === "string" &&
              result.data.text.trim() ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Extracted text
                    {typeof result.data.charCount === "number"
                      ? ` · ${result.data.charCount} chars`
                      : ""}
                  </p>
                  <pre className="max-h-60 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap leading-relaxed">
                    {result.data.text}
                  </pre>
                </div>
              ) : null}
              {result.error ? (
                <pre className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs whitespace-pre-wrap text-destructive">
                  {result.error}
                </pre>
              ) : null}
              {resultJson ? (
                <details
                  open={result.processorKey === ProcessorKey.METADATA_EXIF}
                >
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                    Result data
                  </summary>
                  <pre className="mt-2 max-h-80 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
                    {resultJson}
                  </pre>
                </details>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
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
                      {ProcessorKeyLabels[job.processorKey] ?? job.processorKey}
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
                      <TruncatedText
                        text={job.id}
                        mono
                        className="text-left!"
                      />
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
              {job.status === "failed" && job.errorMessage ? (
                <TruncatedText
                  text={job.errorMessage}
                  lines={3}
                  mono
                  className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-left! text-[11px] leading-relaxed text-destructive"
                />
              ) : null}
              {Array.isArray(job.logs) && job.logs.length > 0 ? (
                <details className="rounded-md border bg-muted/20 p-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                    Logs ({job.logs.length})
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                    {job.logs
                      .slice(-40)
                      .map(
                        (line) =>
                          `${line.ts} [${line.level}] ${line.message}`,
                      )
                      .join("\n")}
                  </pre>
                </details>
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
  const [wantSigned, setWantSigned] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Legacy "variants" tab now lives on overview Delivery section.
    setTab(
      (initialTab as string) === "variants" ? "overview" : initialTab,
    );
    setWantSigned(false);
  }, [open, initialTab, fileId]);

  const { data, isLoading } = useFileDetailQuery(
    fileId ?? undefined,
    activeOrg?.id,
  );
  const fileMetadata = useFileMetadataQuery(
    fileId ?? undefined,
    activeOrg?.id,
    open && !!fileId,
  );
  const fileDuplicates = useFileDuplicatesQuery(
    fileId ?? undefined,
    activeOrg?.id,
    open && !!fileId,
  );
  const processorResults = useFileProcessorResultsQuery(
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
  const restoreMutation = useRestoreFileMutation(activeOrg?.id);
  const signed = useFileSignedUrlQuery(
    fileId ?? undefined,
    activeOrg?.id,
    open && !!fileId && wantSigned,
  );

  const metaJson = metadataJson(fileMetadata.data?.metadata ?? null);
  const metaKeys = fileMetadata.data?.metadata
    ? Object.keys(fileMetadata.data.metadata).length
    : 0;
  const duplicatesCount = fileDuplicates.data?.total ?? 0;
  const processorResultsCount =
    processorResults.data?.total ?? processorResults.data?.items?.length ?? 0;
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
          Preview, delivery assets, near-duplicates, processor results, EXIF,
          and jobs.
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
            <TabsList className="flex h-auto w-full gap-1">
              <TabsTrigger value="overview" className="min-w-0 flex-1 px-2">
                Overview
              </TabsTrigger>
              <TabsTrigger value="details" className="min-w-0 flex-1 px-2">
                Details
              </TabsTrigger>
              <TabsTrigger
                value="duplicates"
                className="min-w-0 flex-1 gap-1 px-2"
              >
                Dupes
                {duplicatesCount > 0 ? (
                  <Badge
                    variant="secondary"
                    className="h-4 min-w-4 px-1 text-[10px] tabular-nums"
                  >
                    {duplicatesCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger
                value="processors"
                className="min-w-0 flex-1 gap-1 px-2"
              >
                Results
                {processorResultsCount > 0 ? (
                  <Badge
                    variant="secondary"
                    className="h-4 min-w-4 px-1 text-[10px] tabular-nums"
                  >
                    {processorResultsCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger
                value="metadata"
                className="min-w-0 flex-1 gap-1 px-2"
              >
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
              <TabsTrigger value="jobs" className="min-w-0 flex-1 gap-1 px-2">
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
              <div className="relative flex items-start gap-4 rounded-lg border bg-card p-3">
                <div className="absolute top-3 right-3 flex flex-wrap items-center justify-end gap-1.5">
                  <Badge variant="secondary" className="capitalize">
                    {data.processingStatus ?? "n/a"}
                  </Badge>
                  {data.deletedAt ? (
                    <Badge variant="destructive">Deleted</Badge>
                  ) : null}
                </div>
                <FilePreviewThumb
                  fileId={data.id}
                  mimeType={data.mimeType}
                  orgId={activeOrg?.id}
                  alt={data.originalFileName}
                  size="lg"
                />
                <div className="min-w-0 flex-1 space-y-1.5 pr-24">
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
                    {data.deletedAt ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5"
                        disabled={restoreMutation.isPending}
                        onClick={() =>
                          restoreMutation.mutate(data.id, {
                            onSuccess: () =>
                              toast.success("File restored to active"),
                            onError: (err) =>
                              toast.error(
                                extractApiErrorMessage(err, "Restore failed"),
                              ),
                          })
                        }
                      >
                        {restoreMutation.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="size-3.5" />
                        )}
                        Restore
                      </Button>
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5"
                      disabled={signed.isFetching}
                      onClick={() => {
                        setWantSigned(true);
                        if (wantSigned) void signed.refetch();
                      }}
                    >
                      {signed.isFetching ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      {signed.data?.url ? "Refresh signed URL" : "Signed URL"}
                    </Button>
                  </div>
                </div>
              </div>

              {wantSigned ? (
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  {signed.isLoading || signed.isFetching ? (
                    <p className="text-xs text-muted-foreground">
                      Resolving signed URL…
                    </p>
                  ) : signed.data?.url ? (
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed">
                          {signed.data.url}
                        </p>
                        <div className="flex shrink-0 items-center gap-1">
                          <SmallCopy content={signed.data.url} />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 gap-1 px-2 text-xs"
                            asChild
                          >
                            <a
                              href={signed.data.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="size-3" />
                              Open
                            </a>
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Original object
                        {signed.data.expiresIn != null
                          ? ` · expires in ${signed.data.expiresIn}s`
                          : ""}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-destructive">
                      {extractApiErrorMessage(
                        signed.error,
                        "Could not generate signed URL",
                      )}
                    </p>
                  )}
                </div>
              ) : null}

              <FileDeliveryPanel file={data} />

              <Section title="Quick facts">
                <DetailRow
                  label="SHA-256"
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
            </TabsContent>

            <TabsContent value="details" className="mt-0 space-y-4">
              <FileOverviewDetails data={data} />
            </TabsContent>

            <TabsContent value="duplicates" className="mt-0 space-y-4">
              <FileDuplicatesPanel file={data} />
            </TabsContent>

            <TabsContent value="processors" className="mt-0 space-y-4">
              <FileProcessorResultsPanel fileId={data.id} />
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
