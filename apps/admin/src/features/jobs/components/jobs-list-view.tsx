"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { FilePreviewThumb } from "@/features/files/components/file-preview-thumb";
import { useActiveOrg } from "@/provider/org-provider";
import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DateDisplay,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableEmptyState,
  TableError,
} from "@workspace/ui/components";
import { JobStatusLabels, JobTypeLabels } from "@workspace/validation";
import {
  Ban,
  ChevronDown,
  Eye,
  Loader2,
  Workflow,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useCancelJobMutation,
  useJobsQuery,
  type JobFileGroup,
  type JobRow,
} from "../hooks/use-jobs-queries";
import { JobDetailSheet } from "./job-detail-sheet";

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

function GroupStatusPills({ group }: { group: JobFileGroup }) {
  const entries = Object.entries(group.statusSummary).filter(
    ([, count]) => count > 0,
  );
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([status, count]) => (
        <Badge
          key={status}
          variant="secondary"
          className={statusBadgeClass(status)}
        >
          {count}{" "}
          {JobStatusLabels[status as keyof typeof JobStatusLabels] ?? status}
        </Badge>
      ))}
    </div>
  );
}

export function JobsListView() {
  const { activeOrg } = useActiveOrg();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [viewingJobId, setViewingJobId] = useState<string | null>(null);
  const limit = 50;

  const cancelMutation = useCancelJobMutation(activeOrg?.id);

  const { data, isLoading, error, refetch } = useJobsQuery({
    page,
    limit,
    status: statusFilter === "all" ? undefined : statusFilter,
    jobType: jobTypeFilter === "all" ? undefined : jobTypeFilter,
    orgId: activeOrg?.id,
  });

  const groups = data?.groups ?? [];
  const totalPages = data?.totalPages ?? 0;

  const summary = useMemo(() => {
    const items = data?.items ?? [];
    return {
      files: groups.length,
      jobs: items.length,
      failed: items.filter((j) => j.status === "failed").length,
      inFlight: items.filter(
        (j) => j.status === "pending" || j.status === "processing",
      ).length,
    };
  }, [data?.items, groups.length]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Processing jobs grouped by file — expand a file to see each job.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(JobStatusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={jobTypeFilter}
          onValueChange={(v) => {
            setJobTypeFilter(v ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(JobTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{summary.files} files</span>
          <span>·</span>
          <span>{summary.jobs} jobs</span>
          {summary.inFlight > 0 ? (
            <>
              <span>·</span>
              <span className="text-blue-600 dark:text-blue-400">
                {summary.inFlight} active
              </span>
            </>
          ) : null}
          {summary.failed > 0 ? (
            <>
              <span>·</span>
              <span className="text-destructive">{summary.failed} failed</span>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <TableError
          error={error}
          onRetry={() => refetch()}
          title="Failed to load jobs"
        />
      ) : isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading jobs…
        </div>
      ) : groups.length === 0 ? (
        <TableEmptyState
          title="No jobs"
          description="Processing jobs will appear here when files are processed."
          icon={Workflow}
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <FileJobsGroupCard
              key={group.fileId}
              group={group}
              orgId={activeOrg?.id}
              onViewJob={(job) => setViewingJobId(job.id)}
              onCancelJob={(job) =>
                cancelMutation.mutate(job.id, {
                  onSuccess: () => toast.success("Job cancelled"),
                  onError: (err) =>
                    toast.error(extractApiErrorMessage(err, "Cancel failed")),
                })
              }
              cancelling={cancelMutation.isPending}
            />
          ))}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <JobDetailSheet
        jobId={viewingJobId}
        open={!!viewingJobId}
        onOpenChange={(open) => !open && setViewingJobId(null)}
      />
    </div>
  );
}

function FileJobsGroupCard({
  group,
  orgId,
  onViewJob,
  onCancelJob,
  cancelling,
}: {
  group: JobFileGroup;
  orgId?: string;
  onViewJob: (job: JobRow) => void;
  onCancelJob: (job: JobRow) => void;
  cancelling?: boolean;
}) {
  const [open, setOpen] = useState(
    group.statusSummary.failed > 0 ||
      group.statusSummary.processing > 0 ||
      group.statusSummary.pending > 0,
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="overflow-hidden rounded-xl border bg-card">
        <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
          <FilePreviewThumb
            fileId={group.fileId}
            mimeType={group.mimeType}
            orgId={orgId}
            alt={group.fileName}
            size="sm"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{group.fileName}</p>
              <span className="text-xs text-muted-foreground">
                {group.jobs.length} job{group.jobs.length === 1 ? "" : "s"}
              </span>
            </div>
            <GroupStatusPills group={group} />
          </div>
          <DateDisplay
            date={group.latestAt}
            format="relative"
            className="hidden text-xs text-muted-foreground sm:block"
          />
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t">
            <ul className="divide-y">
              {group.jobs.map((job) => {
                const canCancel =
                  job.status === "pending" || job.status === "processing";
                return (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
                    <Badge variant="outline" className="capitalize">
                      {JobTypeLabels[
                        job.jobType as keyof typeof JobTypeLabels
                      ] ?? job.jobType}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={statusBadgeClass(String(job.status))}
                    >
                      {JobStatusLabels[
                        job.status as keyof typeof JobStatusLabels
                      ] ?? job.status}
                    </Badge>
                    <span className="tabular-nums text-muted-foreground">
                      {job.progress == null ? "—" : `${job.progress}%`}
                    </span>
                    {job.errorMessage ? (
                      <span
                        className="max-w-[220px] truncate text-xs text-destructive"
                        title={job.errorMessage}
                      >
                        {job.errorMessage}
                      </span>
                    ) : null}
                    <div className="ml-auto flex items-center gap-2">
                      <DateDisplay
                        date={job.createdAt}
                        format="relative"
                        className="text-xs text-muted-foreground"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewJob(job)}
                      >
                        <Eye className="size-3.5" />
                        Details
                      </Button>
                      {canCancel ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={cancelling}
                          onClick={() => onCancelJob(job)}
                        >
                          <Ban className="size-3.5" />
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
