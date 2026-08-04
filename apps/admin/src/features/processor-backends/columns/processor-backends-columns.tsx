"use client";

import type { ColumnDef, FilterFn } from "@tanstack/react-table";
import {
  Badge,
  Button,
  DataGridColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
} from "@workspace/ui/components";
import {
  ProcessorBackendKind,
  ProcessorBackendKindLabels,
} from "@workspace/validation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { ProcessorBackendRow } from "../hooks/use-processor-backends-queries";

const KIND_FILTER_OPTIONS = [
  ProcessorBackendKind.OPENAI_COMPATIBLE,
  ProcessorBackendKind.CLAMAV,
].map((value) => ({
  value,
  label: ProcessorBackendKindLabels[value] ?? value,
}));

const multiSelectIncludes: FilterFn<ProcessorBackendRow> = (
  row,
  columnId,
  filterValue,
) => {
  const selected = Array.isArray(filterValue)
    ? filterValue.filter((value): value is string => typeof value === "string")
    : [];
  if (selected.length === 0) return true;
  const cell = String(row.getValue(columnId) ?? "");
  return selected.includes(cell);
};

export function createProcessorBackendsColumns(
  onEdit: (row: ProcessorBackendRow) => void,
  onDelete: (row: ProcessorBackendRow) => void,
): ColumnDef<ProcessorBackendRow>[] {
  return [
    {
      id: "search",
      accessorFn: () => "",
      header: "Search",
      cell: () => null,
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: false,
      filterFn: () => true,
      meta: {
        variant: "text",
        label: "Search",
        placeholder: "Search name, kind, or URL…",
      },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Name" />
      ),
      meta: { label: "Name", skeleton: <Skeleton className="h-4 w-32" /> },
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "kind",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Kind" />
      ),
      enableColumnFilter: true,
      filterFn: multiSelectIncludes,
      meta: {
        variant: "multiSelect",
        label: "Kind",
        options: KIND_FILTER_OPTIONS,
        skeleton: <Skeleton className="h-5 w-28" />,
      },
      cell: ({ row }) => (
        <Badge variant="outline">
          {ProcessorBackendKindLabels[row.original.kind] ?? row.original.kind}
        </Badge>
      ),
    },
    {
      accessorKey: "baseUrl",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="URL / host" />
      ),
      meta: {
        label: "URL / host",
        skeleton: <Skeleton className="h-4 w-40" />,
      },
      cell: ({ row }) => (
        <span className="block max-w-64 truncate font-mono text-xs">
          {row.original.baseUrl}
        </span>
      ),
    },
    {
      accessorKey: "apiKeyConfigured",
      header: "API key",
      cell: ({ row }) => {
        if (row.original.kind === ProcessorBackendKind.CLAMAV) {
          return <span className="text-muted-foreground">—</span>;
        }
        return row.original.apiKeyConfigured
          ? `••••${row.original.apiKeyLast4 ?? ""}`
          : "Not set";
      },
    },
    {
      accessorKey: "isActive",
      header: "State",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
          {row.original.isDefault ? (
            <Badge variant="outline">Default</Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(row.original)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}

export function filterProcessorBackends(
  items: ProcessorBackendRow[],
  search: string | undefined,
  kinds: string[],
): ProcessorBackendRow[] {
  const query = search?.trim().toLowerCase() ?? "";
  return items.filter((item) => {
    if (kinds.length > 0 && !kinds.includes(item.kind)) return false;
    if (!query) return true;
    const kindLabel = (
      ProcessorBackendKindLabels[item.kind] ?? item.kind
    ).toLowerCase();
    const haystack = [
      item.name,
      item.kind,
      kindLabel,
      item.baseUrl,
      item.visionModel ?? "",
      item.textModel ?? "",
      item.apiKeyLast4 ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}
