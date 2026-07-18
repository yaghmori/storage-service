"use client";

import { useActiveOrg } from "@/provider/org-provider";
import {
  Badge,
  DateDisplay,
  ResponsiveSheet,
  Separator,
} from "@workspace/ui/components";
import { JobStatusLabels, JobTypeLabels } from "@workspace/validation";
import { Loader2 } from "lucide-react";
import { FilePreviewThumb } from "@/features/files/components/file-preview-thumb";
import { useJobDetailQuery } from "../hooks/use-jobs-queries";

function statusBadgeClass(status: string): string {
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

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      className="w-full sm:max-w-lg"
    >
      <ResponsiveSheet.Header>
        <ResponsiveSheet.Title>
          {data
            ? (JobTypeLabels[data.jobType as keyof typeof JobTypeLabels] ??
              data.jobType)
            : "Job details"}
        </ResponsiveSheet.Title>
        <ResponsiveSheet.Description>
          Processing job metadata and errors.
        </ResponsiveSheet.Description>
      </ResponsiveSheet.Header>

      <ResponsiveSheet.Content className="space-y-4 px-4 pb-6">
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
                <p className="truncate font-medium">
                  {data.fileName ?? data.fileId}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {data.mimeType ?? "—"}
                </p>
              </div>
            </div>

            <dl className="grid gap-3 text-sm">
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
                <dt className="text-muted-foreground">Type</dt>
                <dd>
                  <Badge variant="outline" className="capitalize">
                    {JobTypeLabels[
                      data.jobType as keyof typeof JobTypeLabels
                    ] ?? data.jobType}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Progress</dt>
                <dd className="tabular-nums">
                  {data.progress == null ? "—" : `${data.progress}%`}
                </dd>
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
                <dt className="text-muted-foreground">BullMQ ID</dt>
                <dd className="max-w-[220px] truncate font-mono text-xs">
                  {data.bullmqJobId ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Job ID</dt>
                <dd className="max-w-[220px] truncate font-mono text-xs">
                  {data.id}
                </dd>
              </div>
            </dl>

            {data.errorMessage ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <pre className="max-h-48 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs whitespace-pre-wrap">
                    {data.errorMessage}
                  </pre>
                </div>
              </>
            ) : null}
          </>
        )}
      </ResponsiveSheet.Content>
    </ResponsiveSheet>
  );
}
