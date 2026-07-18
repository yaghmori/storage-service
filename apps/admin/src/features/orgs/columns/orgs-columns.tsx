"use client";

import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Badge,
  Button,
  DataGridColumnHeader,
  Skeleton,
} from "@workspace/ui/components";
import { Settings } from "lucide-react";
import Link from "next/link";
import type { OrganizationRow } from "../hooks/use-orgs-queries";

export function createOrgsColumns(): ColumnDef<OrganizationRow>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Name" />
      ),
      meta: { label: "Name", skeleton: <Skeleton className="h-4 w-32" /> },
      cell: ({ row }) => row.original.name,
    },
    {
      accessorKey: "slug",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Slug" />
      ),
      meta: { label: "Slug", skeleton: <Skeleton className="h-4 w-28" /> },
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.slug}</span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Status" />
      ),
      meta: { label: "Status", skeleton: <Skeleton className="h-4 w-20" /> },
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "active" ? "default" : "secondary"}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "frontendBaseUrl",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Frontend URL" />
      ),
      meta: { label: "Frontend URL", skeleton: <Skeleton className="h-4 w-40" /> },
      cell: ({ row }) => (
        <span className="line-clamp-1">
          {row.original.frontendBaseUrl || "—"}
        </span>
      ),
    },
    {
      accessorKey: "supportEmail",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title="Support email" />
      ),
      meta: { label: "Support email", skeleton: <Skeleton className="h-4 w-36" /> },
      cell: ({ row }) => row.original.supportEmail ?? "—",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" asChild>
          <Link href={PAGE_ROUTES.settings(row.original.slug)}>
            <Settings className="mr-2 size-4" />
            Settings
          </Link>
        </Button>
      ),
    },
  ];
}
