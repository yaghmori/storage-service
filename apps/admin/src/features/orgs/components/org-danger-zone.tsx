"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { TypeToConfirmDialog } from "@/components/type-to-confirm-dialog";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Separator,
  Switch,
} from "@workspace/ui/components";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  useDeleteOrganizationMutation,
  useOrganizationsQuery,
  useUpdateOrganizationMutation,
  type OrganizationRow,
} from "../hooks/use-orgs-queries";

export function OrgDangerZone({ org }: { org: OrganizationRow }) {
  const router = useRouter();
  const { data } = useOrganizationsQuery();
  const updateMutation = useUpdateOrganizationMutation();
  const deleteMutation = useDeleteOrganizationMutation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);

  const isActive = org.status === "active";

  const applyStatus = (checked: boolean) => {
    updateMutation.mutate(
      {
        id: org.id,
        input: { status: checked ? "active" : "suspended" },
      },
      {
        onSuccess: () => {
          toast.success(
            checked ? "Organization activated" : "Organization suspended",
          );
          setSuspendOpen(false);
        },
        onError: (err) =>
          toast.error(extractApiErrorMessage(err, "Status update failed")),
      },
    );
  };

  return (
    <>
      <Card className="border-destructive/30">
        <CardContent className="space-y-6 px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium">Organization status</h3>
              <p className="text-sm text-muted-foreground">
                Suspended orgs cannot send with their API keys.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={isActive ? "default" : "secondary"}>
                {org.status}
              </Badge>
              <Switch
                checked={isActive}
                onCheckedChange={(checked) => {
                  if (!checked && isActive) {
                    setSuspendOpen(true);
                    return;
                  }
                  applyStatus(checked);
                }}
                disabled={updateMutation.isPending}
              />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Trash2 className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <h3 className="font-medium text-destructive">
                  Delete organization
                </h3>
                <p className="text-sm text-muted-foreground">
                  Permanently remove this organization. Bound API keys and
                  catalog data are removed with it.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              className="w-full shrink-0 sm:w-auto"
              onClick={() => setDeleteOpen(true)}
            >
              Delete organization
            </Button>
          </div>
        </CardContent>
      </Card>

      <TypeToConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title="Suspend organization?"
        description={
          <>
            Suspend <span className="font-medium text-foreground">{org.name}</span>
            ? Sending with this org&apos;s API keys will be blocked.
          </>
        }
        confirmPhrase={org.name}
        confirmLabel="Suspend"
        warningTitle="Organization will be suspended"
        warningDescription="You can reactivate it later from this page."
        isPending={updateMutation.isPending}
        onConfirm={() => applyStatus(false)}
      />

      <TypeToConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete organization?"
        description={
          <>
            Permanently delete{" "}
            <span className="font-medium text-foreground">{org.name}</span> (
            <span className="font-mono text-xs">{org.slug}</span>).
          </>
        }
        confirmPhrase={org.name}
        confirmLabel="Delete organization"
        warningDescription="Catalog, API keys, and related data for this org will be removed."
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          deleteMutation.mutate(org.id, {
            onSuccess: () => {
              toast.success("Organization deleted");
              setDeleteOpen(false);
              const remaining =
                data?.items.filter((item) => item.id !== org.id) ?? [];
              if (remaining.length === 0) {
                router.replace(PAGE_ROUTES.ORG_NEW);
              } else {
                router.replace(PAGE_ROUTES.home(remaining[0].slug));
              }
            },
            onError: (err) =>
              toast.error(extractApiErrorMessage(err, "Delete failed")),
          });
        }}
      />
    </>
  );
}
