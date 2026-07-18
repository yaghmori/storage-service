import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import { Fragment } from "react";

import { DataTablePagination } from "./data-table-pagination";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { getCommonPinningStyles } from "@workspace/ui/lib/data-table";
import { cn } from "@workspace/ui/lib/utils";

interface DataTableProps<TData> extends React.ComponentProps<"div"> {
  table: TanstackTable<TData>;
  actionBar?: React.ReactNode;
  emptyState?: React.ReactNode;
  errorState?: React.ReactNode;
  isLoading?: boolean;
  loadingRowCount?: number;
  renderExpandedRow?: (row: any) => React.ReactNode;
  showPagination?: boolean;
  pageSizeOptions?: number[];
}

export function DataTable<TData>({
  table,
  actionBar,
  children,
  className,
  emptyState,
  errorState,
  isLoading = false,
  loadingRowCount = 5,
  renderExpandedRow,
  showPagination = true,
  pageSizeOptions,
  ...props
}: DataTableProps<TData>) {
  const hasRows = table.getRowModel().rows?.length > 0;
  return (
    <div
      className={cn("flex w-full flex-col gap-2.5 overflow-auto ", className)}
      {...props}
    >
      {children}
      {errorState ? (
        errorState
      ) : isLoading ? (
        <div className="overflow-hidden rounded-md border bg-background">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{
                        ...getCommonPinningStyles({ column: header.column }),
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {Array.from({
                length:
                  loadingRowCount ?? table.getState().pagination.pageSize ?? 5,
              }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {table.getVisibleFlatColumns().map((col) => (
                    <TableCell
                      key={col.id}
                      style={{
                        ...getCommonPinningStyles({ column: col }),
                      }}
                    >
                      <Skeleton className="w-full h-6" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : !hasRows && emptyState ? (
        emptyState
      ) : (
        <div className="overflow-hidden rounded-md border bg-background">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{
                        ...getCommonPinningStyles({ column: header.column }),
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <Fragment key={row.id}>
                    <TableRow data-state={row.getIsSelected() && "selected"}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{
                            ...getCommonPinningStyles({ column: cell.column }),
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {row.getIsExpanded() && renderExpandedRow && (
                      <TableRow key={`${row.id}-expanded`}>
                        <TableCell colSpan={row.getVisibleCells().length}>
                          {renderExpandedRow(row)}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={table.getAllColumns().length}
                    className="h-24 text-center"
                  >
                    {"No data found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {hasRows && (
        <div className="flex flex-col gap-2.5">
          {showPagination && (
            <DataTablePagination
              table={table}
              pageSizeOptions={pageSizeOptions}
            />
          )}
          {actionBar &&
            table.getFilteredSelectedRowModel().rows.length > 0 &&
            actionBar}
        </div>
      )}
    </div>
  );
}
