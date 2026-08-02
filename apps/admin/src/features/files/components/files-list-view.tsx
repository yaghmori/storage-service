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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableEmptyState,
  TableError,
} from "@workspace/ui/components";
import { useDataTable } from "@workspace/ui/hooks/use-data-table";
import { FileIcon, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  type FileRow,
} from "../hooks/use-files-queries";
import { FileBulkDeleteDialog } from "./file-bulk-delete-dialog";
import { FileDeleteDialog } from "./file-delete-dialog";
import { FileDetailSheet } from "./file-detail-sheet";
import { FileUploadDialog } from "./file-upload-dialog";

type DetailTab = "overview" | "details" | "metadata" | "jobs";

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
  const bulkDeleteMutation = useBulkDeleteFilesMutation(activeOrg?.id);
  const deletePending =
    softDeleteMutation.isPending || hardDeleteMutation.isPending;

  const columns = useMemo(
    () =>
      createFilesColumns(
        activeOrg?.id,
        (row) => {
          setDetailTab("overview");
          setViewing(row);
        },
        (row) => setDeleting(row),
        (row) => {
          setDetailTab("jobs");
          setViewing(row);
        },
        { visibility, retentionDays },
      ),
    [activeOrg?.id, visibility, retentionDays],
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
      columnVisibility: { search: false },
    },
  });

  const pagination = table.getState().pagination;
  const columnFilters = table.getState().columnFilters;
  const searchTerm =
    (columnFilters.find((f) => f.id === "search")?.value as string) ?? "";

  const { data, isLoading, error, refetch } = useFilesQuery({
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    search: searchTerm.trim() || undefined,
    orgId: activeOrg?.id,
    includeDeleted: visibility === "all" ? true : undefined,
    deletedOnly: visibility === "deleted" ? true : undefined,
  });

  table.setOptions((prev) => ({
    ...prev,
    data: data?.items ?? [],
    pageCount: data?.totalPages ?? 0,
    columns,
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
  ]);

  const rowSelection = table.getState().rowSelection;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = Object.keys(rowSelection).length;
  const selectedFiles = selectedRows.map((row) => row.original);
  const showBulkDelete = selectedCount > 1;
  const deletingAlreadySoftDeleted = !!deleting?.deletedAt;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Files</h1>
        <p className="text-sm text-muted-foreground">
          Browse and upload stored objects for this organization.
          Soft-deleted files are purged after {retentionDays} days.
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
              title="Failed to load files"
            />
          ) : undefined
        }
        emptyMessage={
          <TableEmptyState
            title={
              visibility === "deleted" ? "No soft-deleted files" : "No files"
            }
            description={
              visibility === "deleted"
                ? "Soft-deleted files will appear here until they are purged."
                : "Upload a file to get started."
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
            <Select
              value={visibility}
              onValueChange={(value) => {
                if (value == null) return;
                setVisibility(value as FilesVisibility);
                table.setPageIndex(0);
              }}
            >
              <SelectTrigger className="h-8 w-40" size="sm">
                <SelectValue placeholder="Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="deleted">Soft-deleted</SelectItem>
                <SelectItem value="all">All files</SelectItem>
              </SelectContent>
            </Select>
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
