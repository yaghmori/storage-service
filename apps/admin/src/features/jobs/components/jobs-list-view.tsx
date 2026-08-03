"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
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
import { Ban, RefreshCw, Workflow } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createJobsColumns } from "../columns/jobs-columns";
import {
  useBulkCancelJobsMutation,
  useBulkRetryJobsMutation,
  useCancelJobMutation,
  useJobsQuery,
  useRetryJobMutation,
  type JobRow,
} from "../hooks/use-jobs-queries";
import { JobDetailSheet } from "./job-detail-sheet";

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

  const cancelMutation = useCancelJobMutation(activeOrg?.id);
  const retryMutation = useRetryJobMutation(activeOrg?.id);
  const bulkCancelMutation = useBulkCancelJobsMutation(activeOrg?.id);
  const bulkRetryMutation = useBulkRetryJobsMutation(activeOrg?.id);

  const columns = useMemo(
    () =>
      createJobsColumns(
        (row) => setViewingJobId(row.id),
        (row) =>
          cancelMutation.mutate(row.id, {
            onSuccess: () => toast.success("Job cancelled"),
            onError: (err) =>
              toast.error(extractApiErrorMessage(err, "Cancel failed")),
          }),
        (row) =>
          retryMutation.mutate(row.id, {
            onSuccess: () => toast.success("Job queued for retry"),
            onError: (err) =>
              toast.error(extractApiErrorMessage(err, "Retry failed")),
          }),
      ),
    [cancelMutation, retryMutation],
  );

  const { table } = useDataTable({
    columns,
    data: [] as JobRow[],
    pageCount: 0,
    enableRowSelection: true,
    getRowId: (row) => row.id,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 20 },
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
    processorKey: processorKeyFilter.length > 0 ? processorKeyFilter : undefined,
    fileId: fileIdExact,
    search: searchText,
    createdFrom,
    createdTo,
    orgId: activeOrg?.id,
  });

  table.setOptions((prev) => ({
    ...prev,
    data: data?.items ?? [],
    pageCount: data?.totalPages ?? 0,
  }));

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedJobs = selectedRows.map((row) => row.original);
  const selectedCount = selectedJobs.length;
  const canBulkCancel = selectedJobs.some(
    (j) => j.status === "pending" || j.status === "processing",
  );
  const canBulkRetry = selectedJobs.some(
    (j) =>
      j.status === "failed" ||
      j.status === "cancelled" ||
      j.status === "skipped" ||
      j.status === "partial",
  );
  const bulkPending =
    bulkCancelMutation.isPending || bulkRetryMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Processing jobs for this organization.
        </p>
      </div>

      <DataGrid
        table={table}
        recordCount={data?.total ?? 0}
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
            {selectedCount > 0 && canBulkCancel ? (
              <Button
                size="sm"
                variant="outline"
                disabled={bulkPending}
                onClick={() => {
                  const ids = selectedJobs
                    .filter(
                      (j) =>
                        j.status === "pending" || j.status === "processing",
                    )
                    .map((j) => j.id);
                  bulkCancelMutation.mutate(ids, {
                    onSuccess: (result) => {
                      toast.success(
                        `Cancelled ${result.cancelled ?? 0}` +
                          (result.skipped
                            ? ` (${result.skipped} skipped)`
                            : ""),
                      );
                      table.resetRowSelection();
                    },
                    onError: (err) =>
                      toast.error(
                        extractApiErrorMessage(err, "Bulk cancel failed"),
                      ),
                  });
                }}
              >
                <Ban className="size-4" />
                Cancel ({selectedCount})
              </Button>
            ) : null}
            {selectedCount > 0 && canBulkRetry ? (
              <Button
                size="sm"
                variant="outline"
                disabled={bulkPending}
                onClick={() => {
                  const ids = selectedJobs
                    .filter(
                      (j) =>
                        j.status === "failed" ||
                        j.status === "cancelled" ||
                        j.status === "skipped" ||
                        j.status === "partial",
                    )
                    .map((j) => j.id);
                  bulkRetryMutation.mutate(ids, {
                    onSuccess: (result) => {
                      toast.success(
                        `Retried ${result.retried ?? 0}` +
                          (result.skipped
                            ? ` (${result.skipped} skipped)`
                            : ""),
                      );
                      table.resetRowSelection();
                    },
                    onError: (err) =>
                      toast.error(
                        extractApiErrorMessage(err, "Bulk retry failed"),
                      ),
                  });
                }}
              >
                <RefreshCw className="size-4" />
                Retry ({selectedCount})
              </Button>
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
    </div>
  );
}
