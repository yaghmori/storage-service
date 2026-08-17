"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { formatJobElapsed } from "@/lib/format-job-elapsed";
import { useActiveOrg } from "@/provider/org-provider";
import {
  Badge,
  Button,
  DateDisplay,
  Progress,
  ResponsiveSheet,
  Separator,
} from "@workspace/ui/components";
import {
  JobStatusLabels,
  ProcessorKeyDescriptions,
  ProcessorKeyLabels,
} from "@workspace/validation";
import {
  Ban,
  Check,
  Copy,
  Loader2,
  PlayCircle,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FilePreviewThumb } from "@/features/files/components/file-preview-thumb";
import {
  isJobCancellable,
  isJobPending,
  isJobRetryable,
  isJobTerminal,
  useCancelJobMutation,
  useJobDetailQuery,
  usePrioritizeJobMutation,
  useRetryJobMutation,
} from "../hooks/use-jobs-queries";
import { JobRunDialog } from "./job-run-dialog";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "failed":
      return "bg-destructive/15 text-destructive";
    case "skipped":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-400";
    case "processing":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "cancelled":
      return "bg-muted text-muted-foreground";
    default:
      return "";
  }
}

function formatBytes(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function CopyableId({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className="min-w-0 flex-1 break-all rounded-md border bg-muted/40 px-2.5 py-2 font-mono text-xs leading-relaxed">
          {value}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              toast.success("Copied");
              window.setTimeout(() => setCopied(false), 1500);
            } catch {
              toast.error("Could not copy");
            }
          }}
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          <span className="sr-only">Copy {label}</span>
        </Button>
      </div>
    </div>
  );
}

export function JobDetailSheet({
  jobId,
  open,
  onOpenChange,
}: {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { activeOrg } = useActiveOrg();
  const { data, isLoading } = useJobDetailQuery(
    jobId ?? undefined,
    activeOrg?.id,
  );
  const retryMutation = useRetryJobMutation(activeOrg?.id);
  const cancelMutation = useCancelJobMutation(activeOrg?.id);
  const prioritizeMutation = usePrioritizeJobMutation(activeOrg?.id);
  const [rerunOpen, setRerunOpen] = useState(false);

  const processorKey = data?.processorKey;
  const progress =
    data?.progress == null || !Number.isFinite(Number(data.progress))
      ? null
      : Math.max(0, Math.min(100, Number(data.progress)));
  const status = String(data?.status ?? "");
  const canRetry = isJobRetryable(status);
  const canRerun = isJobTerminal(status);
  const canCancel = isJobCancellable(status);
  const canPrioritize = isJobPending(status);
  const actionsPending =
    retryMutation.isPending ||
    cancelMutation.isPending ||
    prioritizeMutation.isPending;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      className="w-full sm:max-w-2xl lg:max-w-3xl"
    >
      <ResponsiveSheet.Header>
        <ResponsiveSheet.Title>
          {data
            ? (ProcessorKeyLabels[data.processorKey] ?? data.processorKey)
            : "Job details"}
        </ResponsiveSheet.Title>
        <ResponsiveSheet.Description>
          Full identifiers, status, and processor output for this job.
        </ResponsiveSheet.Description>
      </ResponsiveSheet.Header>

      <ResponsiveSheet.Content className="space-y-5 px-4 pb-6">
        {isLoading || !data ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <FilePreviewThumb
                fileId={data.fileId}
                mimeType={data.mimeType}
                orgId={activeOrg?.id}
                alt={data.fileName ?? undefined}
                size="md"
              />
              <div className="min-w-0 space-y-1">
                <p className="break-words font-medium" dir="auto">
                  {data.fileName ?? data.fileId}
                </p>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {data.mimeType ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(data.fileSize)}
                </p>
              </div>
            </div>

            {processorKey && ProcessorKeyDescriptions[processorKey] ? (
              <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                {ProcessorKeyDescriptions[processorKey]}
              </p>
            ) : null}

            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Organization</dt>
                <dd className="text-right">
                  <p className="font-medium">
                    {data.orgName ?? activeOrg?.name ?? "—"}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {data.orgSlug ?? activeOrg?.slug ?? "—"}
                  </p>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge
                    variant="secondary"
                    className={statusBadgeClass(String(data.status))}
                  >
                    {JobStatusLabels[
                      data.status as keyof typeof JobStatusLabels
                    ] ?? data.status}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Processor</dt>
                <dd>
                  <Badge variant="outline" className="capitalize">
                    {ProcessorKeyLabels[data.processorKey] ?? data.processorKey}
                  </Badge>
                </dd>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Progress</dt>
                  <dd className="tabular-nums">
                    {progress == null ? "—" : `${progress}%`}
                  </dd>
                </div>
                {progress != null ? <Progress value={progress} /> : null}
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Retries</dt>
                <dd className="tabular-nums">{data.retryCount}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Created</dt>
                <dd>
                  <DateDisplay date={data.createdAt} format="datetime" />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Started</dt>
                <dd>
                  {data.startedAt ? (
                    <DateDisplay date={data.startedAt} format="datetime" />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Completed</dt>
                <dd>
                  {data.completedAt ? (
                    <DateDisplay date={data.completedAt} format="datetime" />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Elapsed</dt>
                <dd className="tabular-nums">
                  {formatJobElapsed(data.startedAt, data.completedAt) ?? "—"}
                  {data.startedAt && !data.completedAt ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (running)
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>

            <Separator />

            <div className="space-y-3">
              <CopyableId label="Job ID:" value={data.id} />
              <CopyableId label="File ID:" value={data.fileId} />
              <CopyableId label="BullMQ ID:" value={data.bullmqJobId ?? "—"} />
              {data.orgId ? (
                <CopyableId label="Organization ID:" value={data.orgId} />
              ) : null}
            </div>

            {data.status === "failed" && data.errorMessage ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <pre className="max-h-64 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs whitespace-pre-wrap break-words">
                    {data.errorMessage}
                  </pre>
                </div>
              </>
            ) : null}

            {(data.status === "skipped" || data.status === "partial") &&
            data.errorMessage ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                    Skip reason
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs whitespace-pre-wrap break-words">
                    {data.errorMessage}
                  </pre>
                </div>
              </>
            ) : null}

            {Array.isArray(data.logs) && data.logs.length > 0 ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Logs</p>
                    {(data.status === "pending" ||
                      data.status === "processing") && (
                      <Badge variant="secondary" className="gap-1">
                        <Loader2 className="size-3 animate-spin" />
                        Live
                      </Badge>
                    )}
                  </div>
                  <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                    {data.logs
                      .map(
                        (line) => `${line.ts} [${line.level}] ${line.message}`,
                      )
                      .join("\n")}
                  </pre>
                </div>
              </>
            ) : null}

            {data.output && Object.keys(data.output).length > 0 ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Output</p>
                  <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                    {JSON.stringify(data.output, null, 2)}
                  </pre>
                </div>
              </>
            ) : null}
          </>
        )}
      </ResponsiveSheet.Content>

      {data && (canRetry || canRerun || canCancel || canPrioritize) ? (
        <ResponsiveSheet.Footer className="gap-2 px-4 pb-4">
          {canRetry ? (
            <Button
              type="button"
              variant="outline"
              disabled={actionsPending}
              onClick={() =>
                retryMutation.mutate(data.id, {
                  onSuccess: () => toast.success("Job queued for retry"),
                  onError: (err) =>
                    toast.error(extractApiErrorMessage(err, "Retry failed")),
                })
              }
            >
              {retryMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Retry job
            </Button>
          ) : null}
          {canRerun ? (
            <Button
              type="button"
              variant="outline"
              disabled={actionsPending}
              onClick={() => setRerunOpen(true)}
            >
              <PlayCircle className="size-4" />
              Rerun…
            </Button>
          ) : null}
          {canPrioritize ? (
            <Button
              type="button"
              variant="outline"
              disabled={actionsPending}
              onClick={() =>
                prioritizeMutation.mutate(data.id, {
                  onSuccess: () =>
                    toast.success("Job moved to the front of its queue"),
                  onError: (err) =>
                    toast.error(
                      extractApiErrorMessage(err, "Could not prioritize job"),
                    ),
                })
              }
            >
              {prioritizeMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Rocket className="size-4" />
              )}
              Prioritize
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              variant="destructive"
              disabled={actionsPending}
              onClick={() =>
                cancelMutation.mutate(data.id, {
                  onSuccess: () => toast.success("Job cancelled"),
                  onError: (err) =>
                    toast.error(extractApiErrorMessage(err, "Cancel failed")),
                })
              }
            >
              {cancelMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Ban className="size-4" />
              )}
              Cancel job
            </Button>
          ) : null}
        </ResponsiveSheet.Footer>
      ) : null}

      <JobRunDialog
        open={rerunOpen}
        onOpenChange={setRerunOpen}
        job={data ?? null}
        onDone={() => setRerunOpen(false)}
      />
    </ResponsiveSheet>
  );
}
