"use client";

import { TypeToConfirmDialog } from "@/components/type-to-confirm-dialog";
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
  ResponsiveSheet,
  TableEmptyState,
  TableError,
} from "@workspace/ui/components";
import { useDataTable } from "@workspace/ui/hooks/use-data-table";
import { Cpu } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createProcessorBackendsColumns } from "../columns/processor-backends-columns";
import {
  useCreateProcessorBackendMutation,
  useDeleteProcessorBackendMutation,
  useProcessorBackendsQuery,
  useUpdateProcessorBackendMutation,
  type ProcessorBackendRow,
} from "../hooks/use-processor-backends-queries";
import { ProcessorBackendForm } from "./processor-backend-form";

export function ProcessorBackendsListView({
  hideHeading = false,
}: {
  hideHeading?: boolean;
} = {}) {
  const { activeOrg } = useActiveOrg();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessorBackendRow | null>(null);
  const [deleting, setDeleting] = useState<ProcessorBackendRow | null>(null);
  const createMutation = useCreateProcessorBackendMutation(activeOrg?.id);
  const updateMutation = useUpdateProcessorBackendMutation(activeOrg?.id);
  const deleteMutation = useDeleteProcessorBackendMutation(activeOrg?.id);
  const columns = useMemo(
    () => createProcessorBackendsColumns(setEditing, setDeleting),
    [],
  );
  const { table } = useDataTable({
    columns,
    data: [] as ProcessorBackendRow[],
    pageCount: 0,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });
  const { data, isLoading, error, refetch } = useProcessorBackendsQuery(
    activeOrg?.id,
  );

  table.setOptions((previous) => ({
    ...previous,
    data: data?.items ?? [],
    pageCount: data?.totalPages ?? 0,
  }));

  return (
    <div className="space-y-6">
      {!hideHeading ? (
        <div>
          <h1 className="text-2xl font-semibold">Processor backends</h1>
          <p className="text-sm text-muted-foreground">
            OpenAI-compatible endpoints selected from Processing for AI Vision
            and Document OCR.
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
              title="Failed to load processor backends"
            />
          ) : undefined
        }
        emptyMessage={
          <TableEmptyState
            title="No processor backends"
            description="Add a backend before enabling AI processing."
            icon={Cpu}
          />
        }
      >
        <DataGridContainer className="flex flex-col overflow-auto">
          <DataTableToolbar table={table}>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Add backend
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
          <ResponsiveSheet.Title>Add processor backend</ResponsiveSheet.Title>
          <ResponsiveSheet.Description>
            Connect an OpenAI-compatible vision or text endpoint.
          </ResponsiveSheet.Description>
        </ResponsiveSheet.Header>
        {createOpen ? (
          <ProcessorBackendForm
            submitLabel="Create backend"
            isSubmitting={createMutation.isPending}
            onCancel={() => setCreateOpen(false)}
            onSubmit={(input) =>
              createMutation.mutate(input, {
                onSuccess: () => {
                  toast.success("Processor backend created");
                  setCreateOpen(false);
                },
                onError: (err) =>
                  toast.error(extractApiErrorMessage(err, "Create failed")),
              })
            }
          />
        ) : null}
      </ResponsiveSheet>

      <ResponsiveSheet
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl"
      >
        <ResponsiveSheet.Header>
          <ResponsiveSheet.Title>Edit processor backend</ResponsiveSheet.Title>
          <ResponsiveSheet.Description>
            Update endpoint, models, credentials, and availability.
          </ResponsiveSheet.Description>
        </ResponsiveSheet.Header>
        {editing ? (
          <ProcessorBackendForm
            key={editing.id}
            initialValues={editing}
            submitLabel="Save changes"
            isSubmitting={updateMutation.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(input) =>
              updateMutation.mutate(
                { id: editing.id, input },
                {
                  onSuccess: () => {
                    toast.success("Processor backend updated");
                    setEditing(null);
                  },
                  onError: (err) =>
                    toast.error(extractApiErrorMessage(err, "Update failed")),
                },
              )
            }
          />
        ) : null}
      </ResponsiveSheet>

      <TypeToConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete processor backend?"
        description={`Remove ${deleting?.name ?? "this backend"}?`}
        confirmPhrase={deleting?.name ?? ""}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteMutation.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Processor backend deleted");
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
