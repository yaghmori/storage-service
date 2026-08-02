"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { useActiveOrg } from "@/provider/org-provider";
import {
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
import { Workflow } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createJobsColumns } from "../columns/jobs-columns";
import {
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
    initialState: {
      pagination: { pageIndex: 0, pageSize: 20 },
      sorting: [{ id: "createdAt", desc: true }],
      columnVisibility: { search: false },
      columnFilters: initialSearch
        ? [{ id: "search", value: initialSearch }]
        : [],
    },
  });

  // Files → View jobs deep link
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

  const statusFilter = firstStringFilter(
    columnFilters.find((f) => f.id === "status")?.value,
  );
  const jobTypeFilter = firstStringFilter(
    columnFilters.find((f) => f.id === "jobType")?.value,
  );
  const searchTerm =
    firstStringFilter(columnFilters.find((f) => f.id === "search")?.value) ??
    "";

  // Keep ?fileId= in sync only when search is a full UUID (deep links).
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.get("fileId")?.trim() || "";
    const next = UUID_RE.test(searchTerm) ? searchTerm : "";
    if (current === next) return;
    if (next) params.set("fileId", next);
    else params.delete("fileId");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchTerm, pathname, router, searchParams]);

  const { data, isLoading, error, refetch } = useJobsQuery({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    status: statusFilter,
    jobType: jobTypeFilter,
    // Always send as `search` — API matches file UUID or filename.
    search: searchTerm || undefined,
    orgId: activeOrg?.id,
  });

  table.setOptions((prev) => ({
    ...prev,
    data: data?.items ?? [],
    pageCount: data?.totalPages ?? 0,
  }));

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
              searchTerm
                ? "No jobs match the current filters."
                : "Processing jobs appear here when files are uploaded."
            }
            icon={Workflow}
          />
        }
      >
        <DataGridContainer className="flex flex-col overflow-auto">
          <DataTableToolbar table={table} />
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
