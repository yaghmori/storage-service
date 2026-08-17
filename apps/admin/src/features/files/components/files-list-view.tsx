"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { useActiveOrg } from "@/provider/org-provider";
import { useOrgRetentionQuery } from "@/features/orgs/hooks/use-orgs-queries";
import { BulkActionConfirmDialog } from "@/components/bulk-action-confirm-dialog";
import { TypeToConfirmDialog } from "@/components/type-to-confirm-dialog";
import {
  buildRowSelectionState,
  FilteredSelectionProvider,
  sameRowSelectionState,
  useFilteredSelection,
} from "@/lib/filtered-selection";
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
import {
  FileIcon,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createFilesColumns,
  type FilesVisibility,
} from "../columns/files-columns";
import {
  useBulkDeleteFilesMutation,
  useBulkProcessingStatusQuery,
  useBulkRegenerateProcessingMutation,
  useBulkRestoreFilesMutation,
  useCancelBulkProcessingMutation,
  useDeleteFileMutation,
  useEmptyTrashMutation,
  useRegenerateProcessingAllMutation,
  useFilesQuery,
  useHardDeleteFileMutation,
  useRestoreFileMutation,
  type FileRow,
  type FilesBulkFilters,
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

function stringArrayFilter(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
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

export function FilesListView() {
  const { activeOrg } = useActiveOrg();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewing, setViewing] = useState<FileRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [deleting, setDeleting] = useState<FileRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkProcessOpen, setBulkProcessOpen] = useState(false);
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
  const [stopSweepOpen, setStopSweepOpen] = useState(false);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);
  const [visibility, setVisibility] = useState<FilesVisibility>("active");

  const retentionQuery = useOrgRetentionQuery(activeOrg?.id);
  const retentionDays = retentionQuery.data?.softDeleteRetentionDays ?? 30;

  const softDeleteMutation = useDeleteFileMutation(activeOrg?.id);
  const hardDeleteMutation = useHardDeleteFileMutation(activeOrg?.id);
  const restoreMutation = useRestoreFileMutation(activeOrg?.id);
  const bulkDeleteMutation = useBulkDeleteFilesMutation(activeOrg?.id);
  const bulkRestoreMutation = useBulkRestoreFilesMutation(activeOrg?.id);
  const emptyTrashMutation = useEmptyTrashMutation(activeOrg?.id);
  const bulkRegenerateMutation = useBulkRegenerateProcessingMutation(
    activeOrg?.id,
  );
  const regenerateAllMutation = useRegenerateProcessingAllMutation(
    activeOrg?.id,
  );
  const cancelBulkProcessing = useCancelBulkProcessingMutation(activeOrg?.id);
  const bulkProcessingStatus = useBulkProcessingStatusQuery(activeOrg?.id);
  const sweep = bulkProcessingStatus.data;
  const sweepRunning = !!sweep?.running;
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
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [{ id: "createdAt", desc: true }],
      columnVisibility: { search: false, fileType: false },
    },
  });

  const pagination = table.getState().pagination;
  const columnFilters = table.getState().columnFilters;
  const searchTerm =
    firstStringFilter(columnFilters.find((f) => f.id === "search")?.value) ??
    "";

  const fileType = stringArrayFilter(
    columnFilters.find((f) => f.id === "fileType")?.value,
  ).filter((v): v is FilesFileTypeFilter =>
    FILE_TYPE_VALUES.has(v as FilesFileTypeFilter),
  );
  const processingStatus = stringArrayFilter(
    columnFilters.find((f) => f.id === "processingStatus")?.value,
  ).filter((v): v is FilesProcessingStatusFilter =>
    PROCESSING_STATUS_VALUES.has(v as FilesProcessingStatusFilter),
  );

  const sizeFilter = sizeRangeFilter(
    columnFilters.find((f) => f.id === "size")?.value,
  );
  const { createdFrom, createdTo } = dateRangeFilter(
    columnFilters.find((f) => f.id === "createdAt")?.value,
  );

  // Reset to first page when filters / visibility change (not when page itself changes).
  useEffect(() => {
    table.setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- table is stable
  }, [
    searchTerm,
    fileType.join(","),
    processingStatus.join(","),
    sizeFilter?.minSize,
    sizeFilter?.maxSize,
    createdFrom,
    createdTo,
    visibility,
    activeOrg?.id,
  ]);

  const { data, isLoading, error, refetch } = useFilesQuery({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: searchTerm.trim() || undefined,
    fileType: fileType.length > 0 ? fileType : undefined,
    processingStatus: processingStatus.length > 0 ? processingStatus : undefined,
    minSize: sizeFilter?.minSize,
    maxSize: sizeFilter?.maxSize,
    createdFrom,
    createdTo,
    orgId: activeOrg?.id,
    includeDeleted: visibility === "all" ? true : undefined,
    deletedOnly: visibility === "deleted" ? true : undefined,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
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

  const selection = useFilteredSelection(total);
  const { reset: resetSelection, isRowSelected } = selection;

  // Selection survives pagination; filters / org / visibility invalidate it.
  useEffect(() => {
    resetSelection();
  }, [
    resetSelection,
    searchTerm,
    activeOrg?.id,
    visibility,
    fileType.join(","),
    processingStatus.join(","),
    sizeFilter?.minSize,
    sizeFilter?.maxSize,
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

  const bulkFilters: FilesBulkFilters = {
    ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
    ...(fileType.length > 0 ? { fileType: fileType.join(",") } : {}),
    ...(processingStatus.length > 0
      ? { processingStatus: processingStatus.join(",") }
      : {}),
    ...(sizeFilter?.minSize != null ? { minSize: sizeFilter.minSize } : {}),
    ...(sizeFilter?.maxSize != null ? { maxSize: sizeFilter.maxSize } : {}),
    ...(createdFrom ? { createdFrom } : {}),
    ...(createdTo ? { createdTo } : {}),
    ...(visibility === "all" ? { includeDeleted: true } : {}),
    ...(visibility === "deleted" ? { deletedOnly: true } : {}),
  };

  const bulkScope = {
    ids: selection.allMatching ? undefined : selection.includedIds,
    allMatchingFilters: selection.allMatching || undefined,
    excludeIds:
      selection.allMatching && selection.excludedIds.length > 0
        ? selection.excludedIds
        : undefined,
    filters: bulkFilters,
  };

  const selectedCount = selection.selectedCount;
  const selectedFiles = items.filter((file) => selection.isRowSelected(file.id));
  const showBulkRegenerate = visibility === "active" && selectedCount > 0;
  const showBulkRestore = visibility === "deleted" && selectedCount > 0;
  const showEmptyTrash = visibility === "deleted";
  const deletingAlreadySoftDeleted = !!deleting?.deletedAt;

  const handleProcessSelected = () => {
    setBulkProcessOpen(false);
    if (selection.allMatching) {
      regenerateAllMutation.mutate(
        {
          search: searchTerm.trim() || undefined,
          fileType: fileType.length > 0 ? fileType.join(",") : undefined,
          processingStatus:
            processingStatus.length > 0
              ? processingStatus.join(",")
              : undefined,
          minSize: sizeFilter?.minSize,
          maxSize: sizeFilter?.maxSize,
          createdFrom,
          createdTo,
          excludeIds: selection.excludedIds.length
            ? selection.excludedIds
            : undefined,
        },
        {
          onSuccess: (result) => {
            resetSelection();
            if (result.matched === 0) {
              toast.warning(result.message);
              return;
            }
            toast.success(result.message);
          },
          onError: (err) =>
            toast.error(
              extractApiErrorMessage(err, "Failed to start bulk processing"),
            ),
        },
      );
      return;
    }

    bulkRegenerateMutation.mutate(selection.includedIds, {
      onSuccess: (result) => {
        resetSelection();
        const scheduled = result.succeeded.filter(
          (item) => item.scheduled.length > 0,
        ).length;
        if (result.failed.length > 0) {
          toast.error(
            `Processing scheduled for ${scheduled} files; ${result.failed.length} failed`,
          );
        } else if (scheduled === 0) {
          toast.warning(
            "No processing jobs were scheduled. Check the organization processing settings.",
          );
        } else {
          toast.success(`Processing scheduled for ${scheduled} files`);
        }
      },
      onError: (err) =>
        toast.error(
          extractApiErrorMessage(err, "Failed to schedule processing"),
        ),
    });
  };

  const handleRestoreSelected = () => {
    bulkRestoreMutation.mutate(bulkScope, {
      onSuccess: (result) => {
        resetSelection();
        setBulkRestoreOpen(false);
        if (result.failed.length > 0) {
          toast.warning(
            `Restored ${result.affected}, failed ${result.failed.length}`,
          );
          return;
        }
        toast.success(`${result.affected} files restored`);
      },
      onError: (err) =>
        toast.error(extractApiErrorMessage(err, "Bulk restore failed")),
    });
  };

  const selectionScopeLabel = selection.allMatching
    ? "matching the current filters"
    : "selected";

  const emptyTitle =
    visibility === "deleted" ? "No soft-deleted files" : "No files";

  return (
    <FilteredSelectionProvider value={selection}>
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
            resetSelection();
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
                {sweepRunning ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Processing {sweep.processed}/{sweep.matched}
                      {sweep.failed > 0 ? ` · ${sweep.failed} failed` : ""}
                      {sweep.cancelRequested ? " · stopping…" : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={
                        sweep.cancelRequested || cancelBulkProcessing.isPending
                      }
                      onClick={() => setStopSweepOpen(true)}
                    >
                      <X className="size-4" />
                      Stop
                    </Button>
                  </div>
                ) : null}
                {showBulkRegenerate && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      bulkRegenerateMutation.isPending ||
                      regenerateAllMutation.isPending ||
                      sweepRunning
                    }
                    onClick={() => setBulkProcessOpen(true)}
                  >
                    <RefreshCw
                      className={`size-4 ${
                        bulkRegenerateMutation.isPending ||
                        regenerateAllMutation.isPending
                          ? "animate-spin"
                          : ""
                      }`}
                    />
                    Process ({selectedCount})
                  </Button>
                )}
                {showBulkRestore && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkRestoreMutation.isPending}
                    onClick={() => setBulkRestoreOpen(true)}
                  >
                    <RotateCcw className="size-4" />
                    Restore ({selectedCount})
                  </Button>
                )}
                {selectedCount > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setBulkDeleteOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    Delete ({selectedCount})
                  </Button>
                )}
                {showEmptyTrash && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={emptyTrashMutation.isPending || total === 0}
                    onClick={() => setEmptyTrashOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    Empty trash
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

        <BulkActionConfirmDialog
          open={stopSweepOpen}
          onOpenChange={setStopSweepOpen}
          title="Stop bulk processing?"
          description={`Files already processed stay processed; the remaining ${Math.max(
            0,
            (sweep?.matched ?? 0) - (sweep?.processed ?? 0),
          )} file(s) in this sweep are skipped.`}
          confirmLabel="Stop processing"
          destructive
          isPending={cancelBulkProcessing.isPending}
          onConfirm={() => {
            cancelBulkProcessing.mutate(undefined, {
              onSuccess: (result) => {
                setStopSweepOpen(false);
                toast.info(result.message);
              },
              onError: (err) =>
                toast.error(extractApiErrorMessage(err, "Cancel failed")),
            });
          }}
        />

        <BulkActionConfirmDialog
          open={bulkProcessOpen}
          onOpenChange={setBulkProcessOpen}
          title={`Process ${selectedCount} file(s)?`}
          description={`Processing jobs are re-scheduled for the ${selectedCount} file(s) ${selectionScopeLabel}. Existing derived assets are regenerated.`}
          confirmLabel={`Process (${selectedCount})`}
          isPending={
            bulkRegenerateMutation.isPending || regenerateAllMutation.isPending
          }
          onConfirm={handleProcessSelected}
        />

        <BulkActionConfirmDialog
          open={bulkRestoreOpen}
          onOpenChange={setBulkRestoreOpen}
          title={`Restore ${selectedCount} file(s)?`}
          description={`The ${selectedCount} soft-deleted file(s) ${selectionScopeLabel} become active again and reappear in the file list.`}
          confirmLabel={`Restore (${selectedCount})`}
          isPending={bulkRestoreMutation.isPending}
          onConfirm={handleRestoreSelected}
        />

        <FileBulkDeleteDialog
          open={bulkDeleteOpen}
          onOpenChange={setBulkDeleteOpen}
          count={selectedCount}
          allMatching={selection.allMatching}
          files={selectedFiles.map((file) => ({
            id: file.id,
            originalFileName: file.originalFileName,
          }))}
          isPending={bulkDeleteMutation.isPending}
          forcePermanent={visibility === "deleted"}
          onConfirm={({ deleteFromStorage }) => {
            const permanent = visibility === "deleted" || deleteFromStorage;
            bulkDeleteMutation.mutate(
              { ...bulkScope, hard: permanent },
              {
                onSuccess: (result) => {
                  resetSelection();
                  setBulkDeleteOpen(false);
                  if (result.failed.length === 0) {
                    toast.success(
                      permanent
                        ? `${result.affected} files permanently deleted`
                        : `${result.affected} files soft-deleted`,
                    );
                    return;
                  }
                  if (result.affected === 0) {
                    toast.error(
                      `Failed to delete ${result.failed.length} files`,
                    );
                    return;
                  }
                  toast.warning(
                    `Deleted ${result.affected}, failed ${result.failed.length}`,
                  );
                },
                onError: (err) =>
                  toast.error(
                    extractApiErrorMessage(err, "Bulk delete failed"),
                  ),
              },
            );
          }}
        />

        <TypeToConfirmDialog
          open={emptyTrashOpen}
          onOpenChange={setEmptyTrashOpen}
          title="Empty trash?"
          description={`Permanently purges every soft-deleted file in this organization (${total} in trash) together with its stored objects and variants.`}
          confirmPhrase="DELETE"
          confirmLabel="Empty trash"
          warningTitle="This action cannot be undone"
          warningDescription="Purged objects cannot be restored from the storage provider."
          isPending={emptyTrashMutation.isPending}
          onConfirm={() => {
            emptyTrashMutation.mutate(undefined, {
              onSuccess: (result) => {
                resetSelection();
                setEmptyTrashOpen(false);
                toast.success(
                  result?.message ??
                    `Trash emptied${
                      typeof result?.deleted === "number"
                        ? ` (${result.deleted} files)`
                        : ""
                    }`,
                );
              },
              onError: (err) =>
                toast.error(extractApiErrorMessage(err, "Empty trash failed")),
            });
          }}
        />
      </div>
    </FilteredSelectionProvider>
  );
}
