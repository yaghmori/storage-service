"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Cell,
  flexRender,
  Header,
  HeaderGroup,
  Row,
} from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { GripVertical } from "lucide-react";
import { CSSProperties, Fragment, useId } from "react";
import { useDataGrid } from "./data-grid";
import {
  DataGridTableBase,
  DataGridTableBody,
  DataGridTableBodyRow,
  DataGridTableBodyRowCell,
  DataGridTableBodyRowExpandded,
  DataGridTableBodyRowSkeleton,
  DataGridTableBodyRowSkeletonCell,
  DataGridTableEmpty,
  DataGridTableHead,
  DataGridTableHeadRow,
  DataGridTableHeadRowCell,
  DataGridTableHeadRowCellResize,
  DataGridTableRowSpacer,
} from "./data-grid-table";

function DataGridTableDndHeader<TData>({
  header,
}: {
  header: Header<TData, unknown>;
}) {
  const { props } = useDataGrid();
  const { column } = header;
  const isColumnDragEnabled =
    !!props.tableLayout?.columnsDraggable &&
    header.column.columnDef.meta?.draggable !== false &&
    header.column.id !== "id"; // prevent DnD for select/id column by default

  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: header.column.id,
  });

  const style: CSSProperties = {
    opacity: isDragging && isColumnDragEnabled ? 0.8 : 1,
    position: "relative",
    transform: isColumnDragEnabled
      ? CSS.Translate.toString(transform)
      : undefined,
    transition: isColumnDragEnabled ? transition : undefined,
    whiteSpace: "nowrap",
    width: header.column.getSize(),
    zIndex: isDragging && isColumnDragEnabled ? 1 : 0,
  };

  return (
    <DataGridTableHeadRowCell
      header={header}
      dndStyle={style}
      dndRef={isColumnDragEnabled ? setNodeRef : undefined}
    >
      <div className="flex items-center justify-start gap-0.5">
        {isColumnDragEnabled ? (
          <Button
            size="sm"
            variant="ghost"
            className="-ms-2 size-6"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical className="opacity-50" aria-hidden="true" />
          </Button>
        ) : (
          <div className="-ms-2 size-6" aria-hidden="true" />
        )}
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
        {props.tableLayout?.columnsResizable && column.getCanResize() && (
          <DataGridTableHeadRowCellResize header={header} />
        )}
      </div>
    </DataGridTableHeadRowCell>
  );
}

function DataGridTableDndCell<TData>({ cell }: { cell: Cell<TData, unknown> }) {
  const { isDragging, setNodeRef, transform, transition } = useSortable({
    id: cell.column.id,
  });
  const isColumnDragEnabled =
    cell.column.columnDef.meta?.draggable !== false && cell.column.id !== "id";

  const style: CSSProperties = {
    opacity: isDragging && isColumnDragEnabled ? 0.8 : 1,
    position: "relative",
    transform: isColumnDragEnabled
      ? CSS.Translate.toString(transform)
      : undefined,
    transition: isColumnDragEnabled ? transition : undefined,
    width: cell.column.getSize(),
    zIndex: isDragging && isColumnDragEnabled ? 1 : 0,
  };

  return (
    <DataGridTableBodyRowCell
      cell={cell}
      dndStyle={style}
      dndRef={isColumnDragEnabled ? setNodeRef : undefined}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </DataGridTableBodyRowCell>
  );
}

function DataGridTableDnd<TData>({
  handleDragEnd,
}: {
  handleDragEnd: (event: DragEndEvent) => void;
}) {
  const { table, isLoading, props } = useDataGrid();
  const pagination = table.getState().pagination;
  const sorting = table.getState().sorting;
  const columnFilters = table.getState().columnFilters;

  // Create a unique key based on pagination, sorting, filters, and row count to trigger animations
  const tableKey = `${pagination.pageIndex}-${JSON.stringify(
    sorting
  )}-${JSON.stringify(columnFilters)}-${table.getRowModel().rows.length}`;

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  return (
    <DndContext
      id={useId()}
      collisionDetection={closestCenter}
      modifiers={[restrictToParentElement]}
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
              .map((headerGroup: HeaderGroup<TData>, index) => (
                  <DataGridTableHeadRow headerGroup={headerGroup} key={index}>
                    <SortableContext
                      items={table.getState().columnOrder}
                      strategy={horizontalListSortingStrategy}
                    >
                      {headerGroup.headers.map((header, hIdx) => (
                        <DataGridTableDndHeader header={header} key={hIdx} />
                      ))}
                    </SortableContext>
                  </DataGridTableHeadRow>
                ))}
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
              table.getRowModel().rows.map((row: Row<TData>, index) => {
                return (
                  <Fragment key={row.id}>
                    <DataGridTableBodyRow row={row} key={index} index={index}>
                      {row
                        .getVisibleCells()
                        .map((cell: Cell<TData, unknown>) => {
                          return (
                            <SortableContext
                              key={cell.id}
                              items={table.getState().columnOrder}
                              strategy={horizontalListSortingStrategy}
                            >
                              <DataGridTableDndCell cell={cell} />
                            </SortableContext>
                          );
                        })}
                    </DataGridTableBodyRow>
                    {row.getIsExpanded() && (
                      <DataGridTableBodyRowExpandded row={row} />
                    )}
                  </Fragment>
                );
              })
            ) : (
              <DataGridTableEmpty />
            )}
          </DataGridTableBody>
        </DataGridTableBase>
      </div>
    </DndContext>
  );
}

export { DataGridTableDnd };
