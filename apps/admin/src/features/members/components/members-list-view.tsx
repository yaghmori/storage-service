"use client";

import { filterAndPaginateClientRows } from "@/lib/client-table-page";
import {
  SEARCH_COLUMN_HIDDEN,
  joinSearchText,
} from "@/lib/data-table-search-column";
import { useAuth } from "@/provider/auth-provider";
import { useActiveOrg } from "@/provider/org-provider";
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
} from "@workspace/ui/components";
import { useDataTable } from "@workspace/ui/hooks/use-data-table";
import { Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { createMembersColumns } from "../columns/members-columns";
import { useMembersQuery } from "../hooks/use-members-queries";
import { InviteMemberDialog } from "./invite-member-dialog";

export function MembersListView({
  hideHeading = false,
}: {
  hideHeading?: boolean;
} = {}) {
  const { activeOrg } = useActiveOrg();
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data = [], isLoading, error, refetch } = useMembersQuery(
    activeOrg?.id,
    "all",
  );

  const myRole = useMemo(
    () =>
      data.find(
        (m) =>
          m.type === "member" &&
          (m.user?.id === user?.id || m.email === user?.email),
      )?.role,
    [data, user?.email, user?.id],
  );

  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  const columns = useMemo(
    () =>
      createMembersColumns({
        orgId: activeOrg?.id ?? "",
        canManage,
        isOwner,
        allMembers: data,
      }),
    [activeOrg?.id, canManage, isOwner, data],
  );

  const { table } = useDataTable({
    columns,
    data: [] as typeof data,
    pageCount: 0,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
      columnVisibility: SEARCH_COLUMN_HIDDEN,
    },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const { columnFilters } = table.getState();
  const page = filterAndPaginateClientRows(
    data,
    columnFilters,
    pageIndex,
    pageSize,
    {
      search: (row) =>
        joinSearchText(row.email, row.user?.name, row.role, row.type),
      type: (row) => row.type,
      role: (row) => row.role,
    },
  );

  table.setOptions((prev) => ({
    ...prev,
    data: page.rows,
    pageCount: page.pageCount,
  }));

  return (
    <div className="space-y-6">
      {!hideHeading ? (
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">
            Invite teammates and manage organization roles.
          </p>
        </div>
      ) : null}

      <DataGrid
        table={table}
        recordCount={page.total}
        isLoading={isLoading}
        errorState={
          error ? (
            <TableError
              error={error}
              onRetry={() => refetch()}
              title="Failed to load members"
            />
          ) : undefined
        }
        emptyMessage={
          <TableEmptyState
            icon={Users}
            title="No team members yet"
            description="Invite teammates to collaborate in this organization."
          />
        }
      >
        <DataGridContainer className="flex flex-col overflow-auto">
          <DataTableToolbar table={table}>
            {canManage && activeOrg ? (
              <Button
                size="sm"
                onClick={() => setInviteOpen(true)}
                disabled={!activeOrg.id}
              >
                <Plus className="h-4 w-4" />
                Invite member
              </Button>
            ) : null}
          </DataTableToolbar>
          <DataGridTableContainer>
            <DataGridTable />
          </DataGridTableContainer>
          <DataGridPagination />
        </DataGridContainer>
      </DataGrid>

      {activeOrg ? (
        <InviteMemberDialog
          orgId={activeOrg.id}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
        />
      ) : null}
    </div>
  );
}
