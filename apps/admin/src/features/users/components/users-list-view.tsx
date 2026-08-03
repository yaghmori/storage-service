"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { TypeToConfirmDialog } from "@/components/type-to-confirm-dialog";
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
import { Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createUsersColumns } from "../columns/users-columns";
import {
  useAdminUsersQuery,
  useCreateAdminUserMutation,
  useDeleteAdminUserMutation,
  useUpdateAdminUserMutation,
  type AdminUserRow,
} from "../hooks/use-users-queries";
import { AdminUserForm } from "./admin-user-form";

export function UsersListView() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);

  const createMutation = useCreateAdminUserMutation();
  const updateMutation = useUpdateAdminUserMutation();
  const deleteMutation = useDeleteAdminUserMutation();

  const columns = useMemo(
    () =>
      createUsersColumns(
        (row) => setEditing(row),
        (row) => setDeleting(row),
      ),
    [],
  );

  const { table } = useDataTable({
    columns,
    data: [] as AdminUserRow[],
    pageCount: 0,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });

  const { data, isLoading, error, refetch } = useAdminUsersQuery();

  table.setOptions((prev) => ({
    ...prev,
    data: data?.items ?? [],
    pageCount: data?.totalPages ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin users</h1>
        <p className="text-sm text-muted-foreground">
          Platform operators for this storage-service admin panel.
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
              title="Failed to load users"
            />
          ) : undefined
        }
        emptyMessage={
          <TableEmptyState
            title="No admin users"
            description="Create a platform operator account."
            icon={Users}
          />
        }
      >
        <DataGridContainer className="flex flex-col overflow-auto">
          <DataTableToolbar table={table}>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Add user
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
          <ResponsiveSheet.Title>Create admin user</ResponsiveSheet.Title>
          <ResponsiveSheet.Description>
            Add a platform operator who can sign in to this admin console.
          </ResponsiveSheet.Description>
        </ResponsiveSheet.Header>
        {createOpen && (
          <AdminUserForm
            key="create-user"
            formId="create-admin-user-form"
            mode="create"
            submitLabel="Create user"
            isSubmitting={createMutation.isPending}
            onCancel={() => setCreateOpen(false)}
            onSubmit={(payload) =>
              createMutation.mutate(
                {
                  email: payload.email,
                  password: payload.password!,
                  role: payload.role,
                },
                {
                  onSuccess: () => {
                    toast.success("User created");
                    setCreateOpen(false);
                  },
                  onError: (err) =>
                    toast.error(extractApiErrorMessage(err, "Create failed")),
                },
              )
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
          <ResponsiveSheet.Title>Edit admin user</ResponsiveSheet.Title>
          <ResponsiveSheet.Description>
            Update account details for{" "}
            <span className="font-medium text-foreground">
              {editing?.email ?? "this user"}
            </span>
            .
          </ResponsiveSheet.Description>
        </ResponsiveSheet.Header>
        {editing && (
          <AdminUserForm
            key={editing.id}
            formId="edit-admin-user-form"
            mode="edit"
            initialValues={editing}
            submitLabel="Save changes"
            isSubmitting={updateMutation.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(payload) =>
              updateMutation.mutate(
                {
                  id: editing.id,
                  input: {
                    email: payload.email,
                    role: payload.role,
                    isActive: payload.isActive,
                    ...(payload.password
                      ? { password: payload.password }
                      : {}),
                  },
                },
                {
                  onSuccess: () => {
                    toast.success("User updated");
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
        title="Delete admin user?"
        description={
          <>
            Remove{" "}
            <span className="font-medium text-foreground">{deleting?.email}</span>
            ? The last active admin cannot be deleted.
          </>
        }
        confirmPhrase={deleting?.email ?? ""}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deleteMutation.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("User deleted");
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
