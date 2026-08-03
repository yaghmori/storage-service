"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { useActiveOrg } from "@/provider/org-provider";
import { useOrgRetentionQuery } from "@/features/orgs/hooks/use-orgs-queries";
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
  Tabs,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components";
import { useDataTable } from "@workspace/ui/hooks/use-data-table";
import { FileIcon, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createFilesColumns,
  type FilesVisibility,
} from "../columns/files-columns";
import {
  useBulkDeleteFilesMutation,
  useDeleteFileMutation,
  useFilesQuery,
  useHardDeleteFileMutation,
  useRestoreFileMutation,
  type FileRow,
  type FilesFileTypeFilter,
  type FilesProcessingStatusFilter,
} from "../hooks/use-files-queries";
import { FileBulkDeleteDialog } from "./file-bulk-delete-dialog";
import { FileDeleteDialog } from "./file-delete-dialog";
import { FileDetailSheet } from "./file-detail-sheet";
import { FileUploadDialog } from "./file-upload-dialog";

type DetailTab =
  | "overview"
  | "details"
  | "variants"
  | "duplicates"
  | "processors"
  | "metadata"
  | "jobs";

const VISIBILITY_TABS: { value: FilesVisibility; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "deleted", label: "Deleted" },
  { value: "all", label: "All" },
];

const FILE_TYPE_VALUES = new Set<FilesFileTypeFilter>([
  "images",
  "videos",
  "audio",
  "documents",
  "other",
]);

const PROCESSING_STATUS_VALUES = new Set<FilesProcessingStatusFilter>([
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "partial",
  "skipped",
]);

function firstStringFilter(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" && first.trim() ? first.trim() : undefined;
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

const SIZE_FILTER_MAX_MB = 1024;

function sizeRangeFilter(
  value: unknown,
): { minSize?: number; maxSize?: number } | undefined {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number"
  ) {
    return undefined;
  }
  const [minMb, maxMb] = value;
  // Slider uses MB; API expects bytes. Skip bounds that match the full range.
  const result: { minSize?: number; maxSize?: number } = {};
  if (minMb > 0) {
    result.minSize = Math.max(0, Math.floor(minMb * 1024 * 1024));
  }
  if (maxMb < SIZE_FILTER_MAX_MB) {
    result.maxSize = Math.max(0, Math.ceil(maxMb * 1024 * 1024));
  }
  return result.minSize != null || result.maxSize != null ? result : undefined;
}

export function FilesListView() {
  const { activeOrg } = useActiveOrg();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewing, setViewing] = useState<FileRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [deleting, setDeleting] = useState<FileRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [visibility, setVisibility] = useState<FilesVisibility>("active");

  const retentionQuery = useOrgRetentionQuery(activeOrg?.id);
  const retentionDays = retentionQuery.data?.softDeleteRetentionDays ?? 30;

  const softDeleteMutation = useDeleteFileMutation(activeOrg?.id);
  const hardDeleteMutation = useHardDeleteFileMutation(activeOrg?.id);
  const restoreMutation = useRestoreFileMutation(activeOrg?.id);
  const bulkDeleteMutation = useBulkDeleteFilesMutation(activeOrg?.id);
  const deletePending =
    softDeleteMutation.isPending || hardDeleteMutation.isPending;

  const handleView = useCallback((row: FileRow) => {
    setDetailTab("overview");
    setViewing(row);
  }, []);

  const handleDelete = useCallback((row: FileRow) => {
    setDeleting(row);
  }, []);

  const handleViewJobs = useCallback((row: FileRow) => {
    setDetailTab("jobs");
    setViewing(row);
  }, []);

  const restoreMutate = restoreMutation.mutate;
  const handleRestore = useCallback(
    (row: FileRow) => {
      restoreMutate(row.id, {
        onSuccess: () => toast.success("File restored"),
        onError: (err) =>
          toast.error(extractApiErrorMessage(err, "Restore failed")),
      });
    },
    [restoreMutate],
  );

  const columns = useMemo(
    () =>
      createFilesColumns(
        activeOrg?.id,
        handleView,
        handleDelete,
        handleViewJobs,
        {
          visibility,
          retentionDays,
          onRestore: handleRestore,
        },
      ),
    [
      activeOrg?.id,
      visibility,
      retentionDays,
      handleView,
      handleDelete,
      handleViewJobs,
      handleRestore,
    ],
  );

  const { table } = useDataTable({
    columns,
    data: [] as FileRow[],
    pageCount: 0,
    getRowId: (row) => row.id,
    enableRowSelection: (row) =>
      visibility === "deleted" ? true : !row.original.deletedAt,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 20 },
      sorting: [{ id: "createdAt", desc: true }],
      columnVisibility: { search: false, fileType: false },
    },
  });

  const pagination = table.getState().pagination;
  const columnFilters = table.getState().columnFilters;
  const searchTerm =
    firstStringFilter(columnFilters.find((f) => f.id === "search")?.value) ??
    "";

  const fileTypeRaw = firstStringFilter(
    columnFilters.find((f) => f.id === "fileType")?.value,
  );
  const fileType =
    fileTypeRaw && FILE_TYPE_VALUES.has(fileTypeRaw as FilesFileTypeFilter)
      ? (fileTypeRaw as FilesFileTypeFilter)
      : undefined;

  const processingStatusRaw = firstStringFilter(
    columnFilters.find((f) => f.id === "processingStatus")?.value,
  );
  const processingStatus =
    processingStatusRaw &&
    PROCESSING_STATUS_VALUES.has(
      processingStatusRaw as FilesProcessingStatusFilter,
    )
      ? (processingStatusRaw as FilesProcessingStatusFilter)
      : undefined;

  const sizeFilter = sizeRangeFilter(
    columnFilters.find((f) => f.id === "size")?.value,
  );

  // Reset to first page when filters / visibility change (not when page itself changes).
  useEffect(() => {
    table.setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- table is stable
  }, [
    searchTerm,
    fileType,
    processingStatus,
    sizeFilter?.minSize,
    sizeFilter?.maxSize,
    visibility,
    activeOrg?.id,
  ]);

  const { data, isLoading, error, refetch } = useFilesQuery({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: searchTerm.trim() || undefined,
    fileType,
    processingStatus,
    minSize: sizeFilter?.minSize,
    maxSize: sizeFilter?.maxSize,
    orgId: activeOrg?.id,
    includeDeleted: visibility === "all" ? true : undefined,
    deletedOnly: visibility === "deleted" ? true : undefined,
  });

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;
  const total = data?.total ?? 0;

  // Must run during render (after useDataTable): useReactTable re-applies
  // the initial `data: []` every render, so a useEffect update is wiped /
  // never painted. Do not overwrite `columns` here — that resets table state.
  table.setOptions((prev) => ({
    ...prev,
    data: items,
    pageCount: totalPages > 0 ? totalPages : items.length > 0 ? 1 : 0,
  }));

  useEffect(() => {
    table.resetRowSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- table is stable
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    searchTerm,
    activeOrg?.id,
    visibility,
    fileType,
    processingStatus,
    sizeFilter?.minSize,
    sizeFilter?.maxSize,
  ]);

  // If filters shrink the result set, clamp to a valid page.
  useEffect(() => {
    if (totalPages > 0 && pagination.pageIndex >= totalPages) {
      table.setPageIndex(Math.max(0, totalPages - 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- table is stable
  }, [totalPages, pagination.pageIndex]);

  const rowSelection = table.getState().rowSelection;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = Object.keys(rowSelection).length;
  const selectedFiles = selectedRows.map((row) => row.original);
  const showBulkDelete = selectedCount > 1;
  const deletingAlreadySoftDeleted = !!deleting?.deletedAt;

  const emptyTitle =
    visibility === "deleted" ? "No soft-deleted files" : "No files";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Files</h1>
        <p className="text-sm text-muted-foreground">
          Browse and upload stored objects for this organization.
          Soft-deleted files are purged after {retentionDays} days.
        </p>
      </div>

      <Tabs
        value={visibility}
        onValueChange={(value) => {
          if (!value) return;
          setVisibility(value as FilesVisibility);
          table.resetRowSelection();
        }}
        className="w-full space-y-4"
      >
        <TabsList className="h-auto w-fit gap-1">
          {VISIBILITY_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex-none px-3.5"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <DataGrid
          table={table}
          recordCount={total}
          isLoading={isLoading}
          errorState={
            error ? (
              <TableError
                error={error}
                onRetry={() => refetch()}
                title="Failed to load files"
              />
            ) : undefined
          }
          emptyMessage={
            <TableEmptyState
              title={emptyTitle}
              description={
                visibility === "deleted"
                  ? "Soft-deleted files will appear here until they are purged."
                  : "Upload a file to get started, or adjust the toolbar filters."
              }
              icon={FileIcon}
              action={
                visibility === "active" ? (
                  <Button size="sm" onClick={() => setUploadOpen(true)}>
                    <Upload className="size-4" />
                    Upload files
                  </Button>
                ) : undefined
              }
            />
          }
        >
          <DataGridContainer className="flex flex-col overflow-auto">
            <DataTableToolbar table={table}>
              {showBulkDelete && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Delete ({selectedCount})
                </Button>
              )}
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="size-4" />
                Upload files
              </Button>
            </DataTableToolbar>
            <DataGridTableContainer>
              <DataGridTable />
            </DataGridTableContainer>
            <DataGridPagination />
          </DataGridContainer>
        </DataGrid>
      </Tabs>

      <FileUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />

      <FileDetailSheet
        fileId={viewing?.id ?? null}
        open={!!viewing}
        initialTab={detailTab}
        onOpenChange={(open) => {
          if (!open) {
            setViewing(null);
            setDetailTab("overview");
          }
        }}
      />

      <FileDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        fileName={deleting?.originalFileName ?? ""}
        isPending={deletePending}
        forcePermanent={deletingAlreadySoftDeleted}
        onConfirm={({ deleteFromStorage }) => {
          if (!deleting) return;
          const permanent =
            deletingAlreadySoftDeleted || deleteFromStorage;
          const mutation = permanent
            ? hardDeleteMutation
            : softDeleteMutation;
          mutation.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(
                permanent
                  ? "File permanently deleted from storage"
                  : "File soft-deleted",
              );
              setDeleting(null);
            },
            onError: (err) =>
              toast.error(extractApiErrorMessage(err, "Delete failed")),
          });
        }}
      />

      <FileBulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        files={selectedFiles.map((file) => ({
          id: file.id,
          originalFileName: file.originalFileName,
        }))}
        isPending={bulkDeleteMutation.isPending}
        forcePermanent={visibility === "deleted"}
        onConfirm={({ deleteFromStorage }) => {
          const ids = selectedFiles.map((file) => file.id);
          const permanent =
            visibility === "deleted" || deleteFromStorage;
          bulkDeleteMutation.mutate(
            { ids, deleteFromStorage: permanent },
            {
              onSuccess: (result) => {
                table.resetRowSelection();
                setBulkDeleteOpen(false);
                if (result.failed.length === 0) {
                  toast.success(
                    permanent
                      ? `${result.succeeded.length} files permanently deleted`
                      : `${result.succeeded.length} files soft-deleted`,
                  );
                  return;
                }
                if (result.succeeded.length === 0) {
                  toast.error(
                    `Failed to delete ${result.failed.length} files`,
                  );
                  return;
                }
                toast.warning(
                  `Deleted ${result.succeeded.length}, failed ${result.failed.length}`,
                );
              },
              onError: (err) =>
                toast.error(extractApiErrorMessage(err, "Bulk delete failed")),
            },
          );
        }}
      />
    </div>
  );
}
