"use client";

import { BulkActionConfirmDialog } from "@/components/bulk-action-confirm-dialog";
import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import {
  buildRowSelectionState,
  FilteredSelectionProvider,
  sameRowSelectionState,
  useFilteredSelection,
} from "@/lib/filtered-selection";
import { useActiveOrg } from "@/provider/org-provider";
import {
  Button,
  DataGrid,
  DataGridContainer,
  DataGridPagination,
  DataGridTable,
  DataGridTableContainer,
  DataTableToolbar,
  TableEmptyState,
  TableError,
} from "@workspace/ui/components";
import { useDataTable } from "@workspace/ui/hooks/use-data-table";
import { Ban, Rocket, RefreshCw, Workflow } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createJobsColumns } from "../columns/jobs-columns";
import {
  isJobCancellable,
  isJobPending,
  isJobRetryable,
  useBulkCancelJobsMutation,
  useBulkPrioritizeJobsMutation,
  useBulkRetryJobsMutation,
  useCancelAllPendingJobsMutation,
  useCancelJobMutation,
  useJobsQuery,
  usePrioritizeJobMutation,
  useRetryJobMutation,
  type BulkJobSelectionInput,
  type JobRow,
} from "../hooks/use-jobs-queries";
import { JobDetailSheet } from "./job-detail-sheet";
import { JobRunDialog } from "./job-run-dialog";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstStringFilter(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" && first.trim() ? first.trim() : undefined;
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function stringArrayFilter(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

type BulkJobAction = "cancel" | "retry" | "prioritize";

function dateRangeFilter(value: unknown): {
  createdFrom?: string;
  createdTo?: string;
} {
  if (!Array.isArray(value) || value.length < 2) return {};
  const [from, to] = value;
  const createdFrom =
    from instanceof Date
      ? from.toISOString()
      : typeof from === "string"
        ? from
        : undefined;
  const createdTo =
    to instanceof Date
      ? to.toISOString()
      : typeof to === "string"
        ? to
        : undefined;
  return { createdFrom, createdTo };
}

export function JobsListView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeOrg } = useActiveOrg();

  const fileIdFromUrl = searchParams.get("fileId")?.trim() || "";
  const initialSearch =
    fileIdFromUrl && UUID_RE.test(fileIdFromUrl) ? fileIdFromUrl : "";

  const [viewingJobId, setViewingJobId] = useState<string | null>(null);
  const [rerunJob, setRerunJob] = useState<JobRow | null>(null);
  const [pendingBulkAction, setPendingBulkAction] =
    useState<BulkJobAction | null>(null);
  const [cancelAllOpen, setCancelAllOpen] = useState(false);

  const cancelMutation = useCancelJobMutation(activeOrg?.id);
  const retryMutation = useRetryJobMutation(activeOrg?.id);
  const prioritizeMutation = usePrioritizeJobMutation(activeOrg?.id);
  const bulkCancelMutation = useBulkCancelJobsMutation(activeOrg?.id);
  const bulkRetryMutation = useBulkRetryJobsMutation(activeOrg?.id);
  const bulkPrioritizeMutation = useBulkPrioritizeJobsMutation(activeOrg?.id);
  const cancelAllPendingMutation = useCancelAllPendingJobsMutation(
    activeOrg?.id,
  );

  const cancelMutate = cancelMutation.mutate;
  const retryMutate = retryMutation.mutate;
  const prioritizeMutate = prioritizeMutation.mutate;

  const handleView = useCallback((row: JobRow) => setViewingJobId(row.id), []);

  const handleCancel = useCallback(
    (row: JobRow) =>
      cancelMutate(row.id, {
        onSuccess: () => toast.success("Job cancelled"),
        onError: (err) =>
          toast.error(extractApiErrorMessage(err, "Cancel failed")),
      }),
    [cancelMutate],
  );

  const handleRetry = useCallback(
    (row: JobRow) =>
      retryMutate(row.id, {
        onSuccess: () => toast.success("Job queued for retry"),
        onError: (err) =>
          toast.error(extractApiErrorMessage(err, "Retry failed")),
      }),
    [retryMutate],
  );

  const handleRerun = useCallback((row: JobRow) => setRerunJob(row), []);

  const handlePrioritize = useCallback(
    (row: JobRow) =>
      prioritizeMutate(row.id, {
        onSuccess: () => toast.success("Job moved to the front of its queue"),
        onError: (err) =>
          toast.error(extractApiErrorMessage(err, "Could not prioritize job")),
      }),
    [prioritizeMutate],
  );

  const columns = useMemo(
    () =>
      createJobsColumns({
        onView: handleView,
        onCancel: handleCancel,
        onRetry: handleRetry,
        onRerun: handleRerun,
        onPrioritize: handlePrioritize,
      }),
    [handleView, handleCancel, handleRetry, handleRerun, handlePrioritize],
  );

  const { table } = useDataTable({
    columns,
    data: [] as JobRow[],
    pageCount: 0,
    enableRowSelection: true,
    getRowId: (row) => row.id,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [{ id: "createdAt", desc: true }],
      columnVisibility: { search: false },
      columnFilters: initialSearch
        ? [{ id: "search", value: initialSearch }]
        : [],
    },
  });

  useEffect(() => {
    if (!fileIdFromUrl || !UUID_RE.test(fileIdFromUrl)) return;
    const current =
      (table.getColumn("search")?.getFilterValue() as string | undefined) ?? "";
    if (current === fileIdFromUrl) return;
    table.getColumn("search")?.setFilterValue(fileIdFromUrl);
    table.setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileIdFromUrl]);

  const pagination = table.getState().pagination;
  const columnFilters = table.getState().columnFilters;

  const statusFilter = stringArrayFilter(
    columnFilters.find((f) => f.id === "status")?.value,
  );
  const processorKeyFilter = stringArrayFilter(
    columnFilters.find((f) => f.id === "processorKey")?.value,
  );
  const searchTerm =
    firstStringFilter(columnFilters.find((f) => f.id === "search")?.value) ??
    "";
  const { createdFrom, createdTo } = dateRangeFilter(
    columnFilters.find((f) => f.id === "createdAt")?.value,
  );

  // Drop deep-link ?fileId= once the search box no longer matches it (so job-ID
  // UUID searches are not forced through the exact fileId filter).
  useEffect(() => {
    const current = searchParams.get("fileId")?.trim() || "";
    if (!current || searchTerm === current) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("fileId");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, searchTerm]);

  const fileIdExact =
    fileIdFromUrl && searchTerm === fileIdFromUrl ? fileIdFromUrl : undefined;
  const searchText = fileIdExact ? undefined : searchTerm || undefined;

  const { data, isLoading, error, refetch } = useJobsQuery({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    status: statusFilter.length > 0 ? statusFilter : undefined,
    processorKey:
      processorKeyFilter.length > 0 ? processorKeyFilter : undefined,
    fileId: fileIdExact,
    search: searchText,
    createdFrom,
    createdTo,
    orgId: activeOrg?.id,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const totalPages = data?.totalPages ?? 0;
  const total = data?.total ?? 0;

  // Must run during render (after useDataTable): useReactTable re-applies the
  // initial `data: []` every render, so a useEffect update never paints.
  table.setOptions((prev) => ({
    ...prev,
    data: items,
    pageCount: totalPages,
  }));

  const selection = useFilteredSelection(total);
  const { reset: resetSelection, isRowSelected } = selection;

  // Selection survives pagination; filters / org invalidate it.
  useEffect(() => {
    resetSelection();
  }, [
    resetSelection,
    activeOrg?.id,
    searchTerm,
    fileIdExact,
    statusFilter.join(","),
    processorKeyFilter.join(","),
    createdFrom,
    createdTo,
  ]);

  // Mirror onto the loaded rows so DataGrid highlights selected rows.
  useEffect(() => {
    const next = buildRowSelectionState(
      items.map((item) => item.id),
      isRowSelected,
    );
    table.setRowSelection((prev) =>
      sameRowSelectionState(prev as Record<string, boolean>, next)
        ? prev
        : next,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- table is stable
  }, [items, isRowSelected]);

  // If filters shrink the result set, clamp to a valid page.
  useEffect(() => {
    if (totalPages > 0 && pagination.pageIndex >= totalPages) {
      table.setPageIndex(Math.max(0, totalPages - 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- table is stable
  }, [totalPages, pagination.pageIndex]);

  const selectedJobs = items.filter((job) => selection.isRowSelected(job.id));
  const cancellable = selectedJobs.filter((job) =>
    isJobCancellable(String(job.status)),
  );
  const retryable = selectedJobs.filter((job) =>
    isJobRetryable(String(job.status)),
  );
  const prioritizable = selectedJobs.filter((job) =>
    isJobPending(String(job.status)),
  );
  const bulkPending =
    bulkCancelMutation.isPending ||
    bulkRetryMutation.isPending ||
    bulkPrioritizeMutation.isPending;

  const bulkSelection: BulkJobSelectionInput = selection.allMatching
    ? {
        allMatchingFilters: true,
        excludeIds:
          selection.excludedIds.length > 0 ? selection.excludedIds : undefined,
        filters: {
          fileId: fileIdExact,
          search: searchText,
          status: statusFilter.length > 0 ? statusFilter.join(",") : undefined,
          processorKey:
            processorKeyFilter.length > 0
              ? processorKeyFilter.join(",")
              : undefined,
          createdFrom,
          createdTo,
        },
      }
    : { ids: selection.includedIds };

  const selectionCount = selection.selectedCount;
  const hasSelection = selectionCount > 0;

  /** "Cancel all pending" ignores the status filter; the server forces pending. */
  const pendingSweepFilters = {
    fileId: fileIdExact,
    search: searchText,
    processorKey:
      processorKeyFilter.length > 0 ? processorKeyFilter.join(",") : undefined,
    createdFrom,
    createdTo,
  };
  const hasNarrowingFilters = Object.values(pendingSweepFilters).some(Boolean);

  const cancelAllPending = () => {
    cancelAllPendingMutation.mutate(pendingSweepFilters, {
      onSuccess: (result) => {
        resetSelection();
        setCancelAllOpen(false);
        toast.success(`Cancelled ${result.cancelled ?? 0} pending job(s)`);
      },
      onError: (err) =>
        toast.error(extractApiErrorMessage(err, "Cancel all pending failed")),
    });
  };

  /**
   * Counts are only known for rows on the current page; ineligible jobs are
   * reported back by the server as "skipped".
   */
  const eligibleHint = (loadedEligible: number) =>
    selection.allMatching
      ? "Jobs that cannot take this action are skipped."
      : `${loadedEligible} of ${selectionCount} selected job(s) on this page are eligible; the rest are skipped.`;

  const runPendingBulkAction = () => {
    if (!pendingBulkAction) return;

    const finish = (message: string) => {
      resetSelection();
      setPendingBulkAction(null);
      toast.success(message);
    };
    const fail = (fallback: string) => (err: unknown) =>
      toast.error(extractApiErrorMessage(err, fallback));
    const skippedSuffix = (skipped?: number) =>
      skipped ? ` (${skipped} skipped)` : "";

    if (pendingBulkAction === "cancel") {
      bulkCancelMutation.mutate(bulkSelection, {
        onSuccess: (result) =>
          finish(
            `Cancelled ${result.cancelled ?? 0}${skippedSuffix(result.skipped)}`,
          ),
        onError: fail("Bulk cancel failed"),
      });
      return;
    }

    if (pendingBulkAction === "retry") {
      bulkRetryMutation.mutate(bulkSelection, {
        onSuccess: (result) =>
          finish(
            `Retried ${result.retried ?? 0}${skippedSuffix(result.skipped)}`,
          ),
        onError: fail("Bulk retry failed"),
      });
      return;
    }

    bulkPrioritizeMutation.mutate(bulkSelection, {
      onSuccess: (result) =>
        finish(
          `Moved ${result.prioritized ?? 0} jobs to the front${skippedSuffix(
            result.skipped,
          )}`,
        ),
      onError: fail("Bulk prioritize failed"),
    });
  };

  return (
    <FilteredSelectionProvider value={selection}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Processing jobs for this organization.
          </p>
        </div>

        <DataGrid
          table={table}
          recordCount={total}
          isLoading={isLoading}
          errorState={
            error ? (
              <TableError
                error={error}
                onRetry={() => refetch()}
                title="Failed to load jobs"
              />
            ) : undefined
          }
          emptyMessage={
            <TableEmptyState
              title="No jobs"
              description={
                searchTerm || statusFilter.length > 0
                  ? "No jobs match the current filters."
                  : "Processing jobs appear here when files are uploaded."
              }
              icon={Workflow}
            />
          }
        >
          <DataGridContainer className="flex flex-col overflow-auto">
            <DataTableToolbar table={table}>
              {!hasSelection ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cancelAllPendingMutation.isPending}
                  onClick={() => setCancelAllOpen(true)}
                >
                  <Ban className="size-4" />
                  Cancel all pending
                </Button>
              ) : null}
              {hasSelection ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkPending}
                    onClick={() => setPendingBulkAction("prioritize")}
                  >
                    <Rocket className="size-4" />
                    Prioritize ({selectionCount})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkPending}
                    onClick={() => setPendingBulkAction("retry")}
                  >
                    <RefreshCw className="size-4" />
                    Retry ({selectionCount})
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={bulkPending}
                    onClick={() => setPendingBulkAction("cancel")}
                  >
                    <Ban className="size-4" />
                    Cancel ({selectionCount})
                  </Button>
                </>
              ) : null}
            </DataTableToolbar>
            <DataGridTableContainer>
              <DataGridTable />
            </DataGridTableContainer>
            <DataGridPagination />
          </DataGridContainer>
        </DataGrid>

        <JobDetailSheet
          jobId={viewingJobId}
          open={!!viewingJobId}
          onOpenChange={(open) => !open && setViewingJobId(null)}
        />

        <JobRunDialog
          open={!!rerunJob}
          onOpenChange={(open) => !open && setRerunJob(null)}
          job={rerunJob}
          onDone={() => setRerunJob(null)}
        />

        <BulkActionConfirmDialog
          open={!!pendingBulkAction}
          onOpenChange={(open) => !open && setPendingBulkAction(null)}
          title={
            pendingBulkAction === "cancel"
              ? `Cancel ${selectionCount} job(s)?`
              : pendingBulkAction === "retry"
                ? `Retry ${selectionCount} job(s)?`
                : `Prioritize ${selectionCount} job(s)?`
          }
          description={
            pendingBulkAction === "cancel"
              ? `Pending and processing jobs will stop. ${eligibleHint(cancellable.length)}`
              : pendingBulkAction === "retry"
                ? `Failed, cancelled, skipped, and partial jobs are queued again. ${eligibleHint(retryable.length)}`
                : `Waiting jobs move to the front of their queue. ${eligibleHint(prioritizable.length)}`
          }
          destructive={pendingBulkAction === "cancel"}
          warningTitle={
            pendingBulkAction === "cancel" ? "Cancelled jobs stop" : undefined
          }
          warningDescription={
            pendingBulkAction === "cancel"
              ? "Work already done is kept, but the run is marked cancelled and must be retried manually."
              : undefined
          }
          confirmLabel={
            pendingBulkAction === "cancel"
              ? `Cancel jobs (${selectionCount})`
              : pendingBulkAction === "retry"
                ? `Retry jobs (${selectionCount})`
                : `Prioritize jobs (${selectionCount})`
          }
          isPending={bulkPending}
          onConfirm={runPendingBulkAction}
        />

        <BulkActionConfirmDialog
          open={cancelAllOpen}
          onOpenChange={setCancelAllOpen}
          title="Cancel all pending jobs?"
          description={
            hasNarrowingFilters
              ? "Every job still waiting in the queue that matches the current filters is cancelled. Jobs already processing are left alone."
              : "Every job still waiting in the queue for this organization is cancelled. Jobs already processing are left alone."
          }
          destructive
          warningTitle="Cancelled jobs stop"
          warningDescription="Cancelled jobs are removed from their queue and must be retried manually."
          confirmLabel="Cancel pending jobs"
          isPending={cancelAllPendingMutation.isPending}
          onConfirm={cancelAllPending}
        />
      </div>
    </FilteredSelectionProvider>
  );
}
