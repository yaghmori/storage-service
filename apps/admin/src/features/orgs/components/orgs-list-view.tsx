"use client";

import { PAGE_ROUTES } from "@/lib/constants/page-routes";
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
import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { createOrgsColumns } from "../columns/orgs-columns";
import {
  useOrganizationsQuery,
  type OrganizationRow,
} from "../hooks/use-orgs-queries";

export function OrgsListView() {
  const router = useRouter();

  const columns = useMemo(() => createOrgsColumns(), []);

  const { table } = useDataTable({
    columns,
    data: [] as OrganizationRow[],
    pageCount: 0,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });

  const { data, isLoading, error, refetch } = useOrganizationsQuery();

  table.setOptions((prev) => ({
    ...prev,
    data: data?.items ?? [],
    pageCount: data?.totalPages ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Create organizations here, then manage branding and danger-zone
          actions under each org&apos;s settings.
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
              title="Failed to load organizations"
            />
          ) : undefined
        }
        emptyMessage={
          <TableEmptyState
            title="No organizations"
            description="Create your first organization to get started."
            icon={Building2}
            action={
              <Button
                size="sm"
                onClick={() => router.push(PAGE_ROUTES.ORG_NEW)}
              >
                Create organization
              </Button>
            }
          />
        }
      >
        <DataGridContainer className="flex flex-col overflow-auto">
          <DataTableToolbar table={table}>
            <Button size="sm" onClick={() => router.push(PAGE_ROUTES.ORG_NEW)}>
              Add organization
            </Button>
          </DataTableToolbar>
          <DataGridTableContainer>
            <DataGridTable />
          </DataGridTableContainer>
          <DataGridPagination />
        </DataGridContainer>
      </DataGrid>
    </div>
  );
}
