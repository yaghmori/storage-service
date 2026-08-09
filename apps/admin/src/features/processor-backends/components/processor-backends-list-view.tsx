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
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useOrgAuditUsersMap,
} from "@/lib/audit-user";
import {
  createProcessorBackendsColumns,
  filterProcessorBackends,
} from "../columns/processor-backends-columns";
import {
  useCreateProcessorBackendMutation,
  useDeleteProcessorBackendMutation,
  useProcessorBackendsQuery,
  useTestProcessorBackendMutation,
  useUpdateProcessorBackendMutation,
  type ProcessorBackendRow,
} from "../hooks/use-processor-backends-queries";
import { ProcessorBackendForm } from "./processor-backend-form";

function firstStringFilter(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
}

function stringArrayFilter(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

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
  const testMutation = useTestProcessorBackendMutation(activeOrg?.id);
  const usersById = useOrgAuditUsersMap(activeOrg?.id);
  const columns = useMemo(
    () =>
      createProcessorBackendsColumns(
        setEditing,
        setDeleting,
        (row) =>
          testMutation.mutate(row.id, {
            onSuccess: (result) =>
              toast[result.ok ? "success" : "error"](
                result.message ||
                  (result.ok ? "Backend OK" : "Backend test failed"),
              ),
            onError: (err) =>
              toast.error(extractApiErrorMessage(err, "Test failed")),
          }),
        usersById,
      ),
    [testMutation, usersById],
  );
  const { table } = useDataTable({
    columns,
    data: [] as ProcessorBackendRow[],
    pageCount: 0,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
      columnVisibility: { search: false },
    },
  });
  const { data, isLoading, error, refetch } = useProcessorBackendsQuery(
    activeOrg?.id,
  );

  const columnFilters = table.getState().columnFilters;
  const pagination = table.getState().pagination;
  const searchTerm =
    firstStringFilter(columnFilters.find((f) => f.id === "search")?.value) ??
    "";
  const kindFilter = stringArrayFilter(
    columnFilters.find((f) => f.id === "kind")?.value,
  );

  const filteredItems = useMemo(
    () =>
      filterProcessorBackends(data?.items ?? [], searchTerm, kindFilter),
    [data?.items, searchTerm, kindFilter],
  );

  const pageCount = Math.max(
    1,
    Math.ceil(filteredItems.length / Math.max(pagination.pageSize, 1)),
  );
  const pageIndex = Math.min(pagination.pageIndex, pageCount - 1);
  const pageItems = filteredItems.slice(
    pageIndex * pagination.pageSize,
    pageIndex * pagination.pageSize + pagination.pageSize,
  );

  useEffect(() => {
    if (pagination.pageIndex !== pageIndex) {
      table.setPageIndex(pageIndex);
    }
  }, [pageIndex, pagination.pageIndex, table]);

  table.setOptions((previous) => ({
    ...previous,
    data: pageItems,
    pageCount,
  }));

  const hasActiveFilters = Boolean(searchTerm.trim()) || kindFilter.length > 0;

  return (
    <div className="space-y-6">
      {!hideHeading ? (
        <div>
          <h1 className="text-2xl font-semibold">Processor backends</h1>
          <p className="text-sm text-muted-foreground">
            Org-scoped backends for Processing: OpenAI-compatible (AI Vision /
            Document OCR) and ClamAV (virus scan). Each organization only sees
            its own backends.
          </p>
        </div>
      ) : null}

      <DataGrid
        table={table}
        recordCount={filteredItems.length}
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
            title={
              hasActiveFilters
                ? "No matching backends"
                : "No processor backends"
            }
            description={
              hasActiveFilters
                ? "No backends match the current filters."
                : "Add OpenAI-compatible or ClamAV backends for this organization."
            }
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
            Connect an OpenAI-compatible endpoint or a ClamAV/clamd host for
            this organization.
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
            isTesting={testMutation.isPending}
            onCancel={() => setEditing(null)}
            onTest={() =>
              testMutation.mutate(editing.id, {
                onSuccess: (result) =>
                  toast[result.ok ? "success" : "error"](
                    result.message ||
                      (result.ok ? "Backend OK" : "Backend test failed"),
                  ),
                onError: (err) =>
                  toast.error(extractApiErrorMessage(err, "Test failed")),
              })
            }
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
