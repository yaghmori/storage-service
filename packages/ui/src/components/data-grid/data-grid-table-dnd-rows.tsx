"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  UniqueIdentifier,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Cell, flexRender, HeaderGroup, Row } from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { GripHorizontal } from "lucide-react";
import { CSSProperties, useId } from "react";
import { useDataGrid } from "./data-grid";
import {
  DataGridTableBase,
  DataGridTableBody,
  DataGridTableBodyRow,
  DataGridTableBodyRowCell,
  DataGridTableBodyRowSkeleton,
  DataGridTableBodyRowSkeletonCell,
  DataGridTableEmpty,
  DataGridTableHead,
  DataGridTableHeadRow,
  DataGridTableHeadRowCell,
  DataGridTableHeadRowCellResize,
  DataGridTableRowSpacer,
} from "./data-grid-table";

function DataGridTableDndRowHandle({ rowId }: { rowId: string }) {
  const { attributes, listeners } = useSortable({
    id: rowId,
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-7"
      {...attributes}
      {...listeners}
    >
      <GripHorizontal />
    </Button>
  );
}

function DataGridTableDndRow<TData>({
  row,
  index,
}: {
  row: Row<TData>;
  index?: number;
}) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform), //let dnd-kit do its thing
    transition: transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative",
  };
  return (
    <DataGridTableBodyRow
      row={row}
      dndRef={setNodeRef}
      dndStyle={style}
      key={row.id}
      index={index}
    >
      {row.getVisibleCells().map((cell: Cell<TData, unknown>, colIndex) => {
        return (
          <DataGridTableBodyRowCell cell={cell} key={colIndex}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </DataGridTableBodyRowCell>
        );
      })}
    </DataGridTableBodyRow>
  );
}

function DataGridTableDndRows<TData>({
  handleDragEnd,
  dataIds,
}: {
  handleDragEnd: (event: DragEndEvent) => void;
  dataIds: UniqueIdentifier[];
}) {
  const { table, isLoading, props } = useDataGrid();
  const pagination = table.getState().pagination;
  const sorting = table.getState().sorting;
  const columnFilters = table.getState().columnFilters;

  // Create a unique key based on pagination, sorting, filters, and row count to trigger animations
  const tableKey = `${pagination.pageIndex}-${JSON.stringify(sorting)}-${JSON.stringify(columnFilters)}-${table.getRowModel().rows.length}`;

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  return (
    <DndContext
      id={useId()}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <div className="relative">
        <DataGridTableBase>
          {(table.getRowModel().rows.length > 0 ||
            (isLoading &&
              props.loadingMode === "skeleton" &&
              pagination?.pageSize)) && (
          <DataGridTableHead>
            {table
              .getHeaderGroups()
              .map((headerGroup: HeaderGroup<TData>, index) => {
                return (
                  <DataGridTableHeadRow headerGroup={headerGroup} key={index}>
                    {headerGroup.headers.map((header, index) => {
                      const { column } = header;

                      return (
                        <DataGridTableHeadRowCell header={header} key={index}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          {props.tableLayout?.columnsResizable &&
                            column.getCanResize() && (
                              <DataGridTableHeadRowCellResize header={header} />
                            )}
                        </DataGridTableHeadRowCell>
                      );
                    })}
                  </DataGridTableHeadRow>
                );
              })}
          </DataGridTableHead>
          )}

          {(table.getRowModel().rows.length > 0 ||
            (isLoading &&
              props.loadingMode === "skeleton" &&
              pagination?.pageSize)) &&
          (props.tableLayout?.stripped || !props.tableLayout?.rowBorder) && (
            <DataGridTableRowSpacer />
          )}

          <DataGridTableBody key={tableKey}>
            {props.loadingMode === "skeleton" &&
            isLoading &&
            pagination?.pageSize ? (
              Array.from({ length: pagination.pageSize }).map((_, rowIndex) => (
                <DataGridTableBodyRowSkeleton key={rowIndex}>
                  {table.getVisibleFlatColumns().map((column, colIndex) => {
                    return (
                      <DataGridTableBodyRowSkeletonCell
                        column={column}
                        key={colIndex}
                      >
                        {column.columnDef.meta?.skeleton ?? (
                          <Skeleton className="h-6 w-full" />
                        )}
                      </DataGridTableBodyRowSkeletonCell>
                    );
                  })}
                </DataGridTableBodyRowSkeleton>
              ))
            ) : table.getRowModel().rows.length ? (
              <SortableContext
                items={dataIds}
                strategy={verticalListSortingStrategy}
              >
                {table.getRowModel().rows.map((row: Row<TData>, index) => {
                  return (
                    <DataGridTableDndRow row={row} key={row.id} index={index} />
                  );
                })}
              </SortableContext>
            ) : (
              <DataGridTableEmpty />
            )}
          </DataGridTableBody>
        </DataGridTableBase>
      </div>
    </DndContext>
  );
}

export { DataGridTableDndRowHandle, DataGridTableDndRows };
