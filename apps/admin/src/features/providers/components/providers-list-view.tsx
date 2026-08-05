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
import { Server } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createProvidersColumns } from "../columns/providers-columns";
import {
  useCreateProviderMutation,
  useDeleteProviderMutation,
  useProvidersQuery,
  useTestProviderMutation,
  useUpdateProviderMutation,
  type ProviderRow,
} from "../hooks/use-providers-queries";
import { ProviderForm } from "./provider-form";

export function ProvidersListView({
  hideHeading = false,
}: {
  hideHeading?: boolean;
} = {}) {
  const { activeOrg } = useActiveOrg();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderRow | null>(null);
  const [deleting, setDeleting] = useState<ProviderRow | null>(null);

  const createMutation = useCreateProviderMutation(activeOrg?.id);
  const updateMutation = useUpdateProviderMutation(activeOrg?.id);
  const deleteMutation = useDeleteProviderMutation(activeOrg?.id);
  const testMutation = useTestProviderMutation(activeOrg?.id);

  const columns = useMemo(
    () =>
      createProvidersColumns(
        (row) => setEditing(row),
        (row) => setDeleting(row),
        (row) =>
          testMutation.mutate(row.id, {
            onSuccess: (result) =>
              toast[result.ok ? "success" : "error"](
                result.message ||
                  (result.ok
                    ? `Provider OK (${result.type})`
                    : "Provider test failed"),
              ),
            onError: (err) =>
              toast.error(extractApiErrorMessage(err, "Test failed")),
          }),
      ),
    [testMutation],
  );

  const { table } = useDataTable({
    columns,
    data: [] as ProviderRow[],
    pageCount: 0,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });

  const { data, isLoading, error, refetch } = useProvidersQuery(activeOrg?.id);

  table.setOptions((prev) => ({
    ...prev,
    data: data?.items ?? [],
    pageCount: data?.totalPages ?? 0,
  }));

  return (
    <div className="space-y-6">
      {!hideHeading ? (
        <div>
          <h1 className="text-2xl font-semibold">Providers</h1>
          <p className="text-sm text-muted-foreground">
            Configure storage backends (local, MinIO, S3).
          </p>
        </div>
      ) : null}

      <DataGrid
        table={table}
        recordCount={data?.total ?? 0}
        isLoading={isLoading}
        errorState={
          error ? (
            <TableError
              error={error}
              onRetry={() => refetch()}
              title="Failed to load providers"
            />
          ) : undefined
        }
        emptyMessage={
          <TableEmptyState
            title="No providers"
            description="Add a storage provider to start uploading."
            icon={Server}
          />
        }
      >
        <DataGridContainer className="flex flex-col overflow-auto">
          <DataTableToolbar table={table}>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Add provider
            </Button>
          </DataTableToolbar>
          <DataGridTableContainer>
            <DataGridTable />
          </DataGridTableContainer>
          <DataGridPagination />
        </DataGridContainer>
      </DataGrid>

      <ResponsiveSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl"
      >
        <ResponsiveSheet.Header>
          <ResponsiveSheet.Title>Add provider</ResponsiveSheet.Title>
          <ResponsiveSheet.Description>
            Connect a local, MinIO, or S3 backend for this organization.
          </ResponsiveSheet.Description>
        </ResponsiveSheet.Header>
        {createOpen && (
          <ProviderForm
            key="create-provider"
            formId="create-provider-form"
            submitLabel="Create provider"
            isSubmitting={createMutation.isPending}
            onCancel={() => setCreateOpen(false)}
            onSubmit={(payload) =>
              createMutation.mutate(payload, {
                onSuccess: () => {
                  toast.success("Provider created");
                  setCreateOpen(false);
                },
                onError: (err) =>
                  toast.error(extractApiErrorMessage(err, "Create failed")),
              })
            }
          />
        )}
      </ResponsiveSheet>

      <ResponsiveSheet
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl"
      >
        <ResponsiveSheet.Header>
          <ResponsiveSheet.Title>Edit provider</ResponsiveSheet.Title>
          <ResponsiveSheet.Description>
            Update storage config for{" "}
            <span className="font-medium text-foreground">
              {editing?.name ?? "this provider"}
            </span>
            .
          </ResponsiveSheet.Description>
        </ResponsiveSheet.Header>
        {editing && (
          <ProviderForm
            key={editing.id}
            formId="edit-provider-form"
            initialValues={editing}
            submitLabel="Save changes"
            isSubmitting={updateMutation.isPending}
            isTesting={testMutation.isPending}
            onCancel={() => setEditing(null)}
            onTest={() =>
              testMutation.mutate(editing.id, {
                onSuccess: (result) =>
                  toast[result.ok ? "success" : "error"](
                    result.message ||
                      (result.ok
                        ? `Provider OK (${result.type})`
                        : "Provider test failed"),
                  ),
                onError: (err) =>
                  toast.error(extractApiErrorMessage(err, "Test failed")),
              })
            }
            onSubmit={(payload) =>
              updateMutation.mutate(
                { id: editing.id, input: payload },
                {
                  onSuccess: () => {
                    toast.success("Provider updated");
                    setEditing(null);
                  },
                  onError: (err) =>
                    toast.error(extractApiErrorMessage(err, "Update failed")),
                },
              )
            }
          />
        )}
      </ResponsiveSheet>

      <TypeToConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete provider?"
        description={
          <>
            Remove provider{" "}
            <span className="font-medium text-foreground">{deleting?.name}</span>
            ?
          </>
        }
        confirmPhrase={deleting?.name ?? ""}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteMutation.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Provider deleted");
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
