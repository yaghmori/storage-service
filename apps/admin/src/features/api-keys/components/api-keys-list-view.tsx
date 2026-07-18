"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { TypeToConfirmDialog } from "@/components/type-to-confirm-dialog";
import { useActiveOrg } from "@/provider/org-provider";
import {
  Button,
  CopyButton,
  DataGrid,
  DataGridContainer,
  DataGridPagination,
  DataGridTable,
  DataGridTableContainer,
  DataTableToolbar,
  ResponsiveSheet,
  TableEmptyState,
  TableError,
  useAppForm,
} from "@workspace/ui/components";
import { useDataTable } from "@workspace/ui/hooks/use-data-table";
import { KeyRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createApiKeySchema } from "@workspace/validation";
import { toast } from "sonner";
import { createApiKeysColumns } from "../columns/api-keys-columns";
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useDeleteApiKeyMutation,
  useRevokeApiKeyMutation,
  type ApiKeyRow,
} from "../hooks/use-api-keys-queries";

export function ApiKeysListView() {
  const { activeOrg } = useActiveOrg();
  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiKeyRow | null>(null);
  const [deleting, setDeleting] = useState<ApiKeyRow | null>(null);

  const createMutation = useCreateApiKeyMutation(activeOrg?.id);
  const revokeMutation = useRevokeApiKeyMutation(activeOrg?.id);
  const deleteMutation = useDeleteApiKeyMutation(activeOrg?.id);

  const columns = useMemo(
    () =>
      createApiKeysColumns(
        activeOrg?.slug,
        (row) => setRevoking(row),
        (row) => setDeleting(row),
      ),
    [activeOrg?.slug],
  );

  const { table } = useDataTable({
    columns,
    data: [] as ApiKeyRow[],
    pageCount: 0,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });

  const { data, isLoading, error, refetch } = useApiKeysQuery(activeOrg?.id);

  table.setOptions((prev) => ({
    ...prev,
    data: data?.items ?? [],
    pageCount: data?.totalPages ?? 0,
  }));

  const form = useAppForm({
    defaultValues: {
      serviceName: "",
      expiresAt: "",
    },
    validators: { onChange: createApiKeySchema },
    onSubmit: async ({ value }) => {
      createMutation.mutate(
        {
          serviceName: value.serviceName.trim(),
          expiresAt: value.expiresAt || undefined,
        },
        {
          onSuccess: (result) => {
            if (result.key) setCreatedKey(result.key);
            toast.success("API key created");
            setCreateOpen(false);
            form.reset();
          },
          onError: (err: unknown) =>
            toast.error(extractApiErrorMessage(err, "Create failed")),
        },
      );
    },
  });

  useEffect(() => {
    if (!createOpen) return;
    form.reset({ serviceName: "", expiresAt: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          Service credentials for{" "}
          <span className="font-mono font-medium text-foreground">
            {activeOrg?.slug ?? "…"}
          </span>
          .
        </p>
      </div>

      {createdKey && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/40">
          <p className="font-medium">
            Copy your new API key now — it won&apos;t be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="break-all rounded bg-background px-2 py-1">
              {createdKey}
            </code>
            <CopyButton value={createdKey} />
          </div>
        </div>
      )}

      <DataGrid
        table={table}
        recordCount={data?.total ?? 0}
        isLoading={isLoading}
        errorState={
          error ? (
            <TableError
              error={error}
              onRetry={() => refetch()}
              title="Failed to load API keys"
            />
          ) : undefined
        }
        emptyMessage={
          <TableEmptyState
            title="No API keys"
            description="Create a key for a service."
            icon={KeyRound}
          />
        }
      >
        <DataGridContainer className="flex flex-col overflow-auto">
          <DataTableToolbar table={table}>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Create key
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
        className="w-full sm:max-w-md"
      >
        <ResponsiveSheet.Header>
          <ResponsiveSheet.Title>Create API key</ResponsiveSheet.Title>
          <ResponsiveSheet.Description>
            Keys are scoped to this organization and shown only once after
            creation.
          </ResponsiveSheet.Description>
        </ResponsiveSheet.Header>

        <form
          id="create-api-key-form"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <ResponsiveSheet.Content className="space-y-4 px-4 pb-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Organization</p>
              <p className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
                {activeOrg?.slug ?? "—"}
              </p>
            </div>
            <form.AppField name="serviceName">
              {(field) => (
                <field.Input
                  label="Service name *"
                  placeholder="eallyfe-api"
                  description="Identifier for the consuming service (shown in the keys list)."
                />
              )}
            </form.AppField>
            <form.AppField name="expiresAt">
              {(field) => (
                <field.DateTimePicker
                  label="Expires at (optional)"
                  showTime
                  placeholder="Pick expiration date & time"
                  description="Leave empty for a non-expiring key."
                />
              )}
            </form.AppField>
          </ResponsiveSheet.Content>

          <ResponsiveSheet.Footer className="gap-2 px-4 pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting, s.isValidating]}
            >
              {([canSubmit, isSubmitting, isValidating]) => (
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    !canSubmit ||
                    isSubmitting ||
                    isValidating
                  }
                >
                  {createMutation.isPending || isSubmitting
                    ? "Creating…"
                    : "Create key"}
                </Button>
              )}
            </form.Subscribe>
          </ResponsiveSheet.Footer>
        </form>
      </ResponsiveSheet>

      <TypeToConfirmDialog
        open={!!revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Revoke API key?"
        description={
          <>
            Revoke key for{" "}
            <span className="font-medium text-foreground">
              {revoking?.serviceName}
            </span>
            ? The key will stop working immediately.
          </>
        }
        confirmPhrase={revoking?.serviceName ?? ""}
        confirmLabel="Revoke"
        warningTitle="Key will be revoked"
        warningDescription="You can delete the key later. It cannot be reactivated."
        isPending={revokeMutation.isPending}
        onConfirm={() => {
          if (!revoking) return;
          revokeMutation.mutate(revoking.id, {
            onSuccess: () => {
              toast.success("API key revoked");
              setRevoking(null);
            },
            onError: (err) =>
              toast.error(extractApiErrorMessage(err, "Revoke failed")),
          });
        }}
      />

      <TypeToConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete API key?"
        description={
          <>
            Permanently delete key for{" "}
            <span className="font-medium text-foreground">
              {deleting?.serviceName}
            </span>
            ?
          </>
        }
        confirmPhrase={deleting?.serviceName ?? ""}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteMutation.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("API key deleted");
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
