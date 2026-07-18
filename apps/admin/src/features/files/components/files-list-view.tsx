"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { TypeToConfirmDialog } from "@/components/type-to-confirm-dialog";
import { useActiveOrg } from "@/provider/org-provider";
import {
  Button,
  DataGrid,
  DataGridContainer,
  DataGridPagination,
  DataGridTable,
  DataGridTableContainer,
  DataTableToolbar,
  ResponsiveSheet,
  TableEmptyState,
  TableError,
} from "@workspace/ui/components";
import { useDataTable } from "@workspace/ui/hooks/use-data-table";
import { FileIcon, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createFilesColumns } from "../columns/files-columns";
import {
  useDeleteFileMutation,
  useFilesQuery,
  useUploadFileMutation,
  type FileRow,
} from "../hooks/use-files-queries";
import { FileDetailSheet } from "./file-detail-sheet";
import { FileUploadForm } from "./file-upload-form";

export function FilesListView() {
  const { activeOrg } = useActiveOrg();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewing, setViewing] = useState<FileRow | null>(null);
  const [deleting, setDeleting] = useState<FileRow | null>(null);

  const deleteMutation = useDeleteFileMutation(activeOrg?.id);
  const uploadMutation = useUploadFileMutation(activeOrg?.id);

  const columns = useMemo(
    () =>
      createFilesColumns(
        activeOrg?.id,
        (row) => setViewing(row),
        (row) => setDeleting(row),
      ),
    [activeOrg?.id],
  );

  const { table } = useDataTable({
    columns,
    data: [] as FileRow[],
    pageCount: 0,
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
  });

  table.setOptions((prev) => ({
    ...prev,
    data: data?.items ?? [],
    pageCount: data?.totalPages ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Files</h1>
        <p className="text-sm text-muted-foreground">
          Browse and upload stored objects for this organization.
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
            title="No files"
            description="Upload a file to get started."
            icon={FileIcon}
            action={
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="size-4" />
                Upload file
              </Button>
            }
          />
        }
      >
        <DataGridContainer className="flex flex-col overflow-auto">
          <DataTableToolbar table={table}>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" />
              Upload file
            </Button>
          </DataTableToolbar>
          <DataGridTableContainer>
            <DataGridTable />
          </DataGridTableContainer>
          <DataGridPagination />
        </DataGridContainer>
      </DataGrid>

      <ResponsiveSheet
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        side="right"
        className="w-full sm:max-w-xl"
      >
        <ResponsiveSheet.Header>
          <ResponsiveSheet.Title>Upload file</ResponsiveSheet.Title>
          <ResponsiveSheet.Description>
            Store a file in this organization&apos;s storage provider.
          </ResponsiveSheet.Description>
        </ResponsiveSheet.Header>
        {uploadOpen && (
          <FileUploadForm
            key="upload-file"
            formId="upload-file-form"
            isSubmitting={uploadMutation.isPending}
            onCancel={() => setUploadOpen(false)}
            onSubmit={(payload) =>
              uploadMutation.mutate(payload, {
                onSuccess: (result) => {
                  toast.success(
                    result.isDuplicate
                      ? result.message || "Duplicate — using existing file"
                      : "File uploaded",
                  );
                  setUploadOpen(false);
                },
                onError: (err) =>
                  toast.error(extractApiErrorMessage(err, "Upload failed")),
              })
            }
          />
        )}
      </ResponsiveSheet>

      <FileDetailSheet
        fileId={viewing?.id ?? null}
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
      />

      <TypeToConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Soft-delete file?"
        description={
          <>
            Mark{" "}
            <span className="font-medium text-foreground">
              {deleting?.originalFileName}
            </span>{" "}
            as deleted. The object can still be hard-deleted later.
          </>
        }
        confirmPhrase={deleting?.originalFileName ?? ""}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteMutation.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("File soft-deleted");
              setDeleting(null);
            },
            onError: (err) =>
              toast.error(extractApiErrorMessage(err, "Delete failed")),
          });
        }}
      />
    </div>
  );
}
