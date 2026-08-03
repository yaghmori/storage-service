"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { useActiveOrg } from "@/provider/org-provider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUpdateOrganizationMutation } from "../hooks/use-orgs-queries";
import { OrgDangerZone } from "./org-danger-zone";
import { OrgLimitsSettingsForm } from "./org-limits-settings-form";
import { OrganizationForm } from "./organization-form";
import { OrgProcessingSettingsForm } from "./org-processing-settings-form";
import { OrgRetentionSettingsForm } from "./org-retention-settings-form";

export function OrgSettingsView() {
  const router = useRouter();
  const { activeOrg, urlOrgSlug, isLoading } = useActiveOrg();
  const updateMutation = useUpdateOrganizationMutation();

  if (isLoading && !activeOrg) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Organization settings</h1>
        <p className="text-sm text-muted-foreground">
          Organization{" "}
          <span className="font-mono">{urlOrgSlug ?? "unknown"}</span> was not
          found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization settings</h1>
        <p className="text-sm text-muted-foreground">
          Identity, quotas, processing, and retention for{" "}
          <span className="font-mono font-medium text-foreground">
            {activeOrg.slug}
          </span>
          .
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">General</h2>
        <p className="text-sm text-muted-foreground">
          Name, slug, and optional external mapping for this organization.
        </p>
        <div className="rounded-xl border bg-card p-4 md:p-6">
          <OrganizationForm
            key={activeOrg.id}
            mode="edit"
            layout="wide"
            initialValues={activeOrg}
            submitLabel="Save changes"
            isSubmitting={updateMutation.isPending}
            onSubmit={(payload) => {
              const previousSlug = activeOrg.slug;
              updateMutation.mutate(
                { id: activeOrg.id, input: payload },
                {
                  onSuccess: (updated) => {
                    toast.success("Settings saved");
                    if (updated.slug !== previousSlug) {
                      router.replace(PAGE_ROUTES.settings(updated.slug));
                    }
                  },
                  onError: (err) =>
                    toast.error(extractApiErrorMessage(err, "Save failed")),
                },
              );
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Limits &amp; quota</h2>
        <p className="text-sm text-muted-foreground">
          Enforce max file size, MIME allowlist, storage quota, and object
          count. Uploads that exceed these limits are rejected.
        </p>
        <div className="rounded-xl border bg-card p-4 md:p-6">
          <OrgLimitsSettingsForm orgId={activeOrg.id} />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Processing</h2>
        <p className="text-sm text-muted-foreground">
          Control which jobs and image variant sizes run on upload. Regenerate
          on a file uses these current settings.
        </p>
        <div className="rounded-xl border bg-card p-4 md:p-6">
          <OrgProcessingSettingsForm orgId={activeOrg.id} />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Retention</h2>
        <p className="text-sm text-muted-foreground">
          How long soft-deleted files are kept before permanent purge.
        </p>
        <div className="rounded-xl border bg-card p-4 md:p-6">
          <OrgRetentionSettingsForm orgId={activeOrg.id} />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-destructive">
            Danger zone
          </h2>
          <p className="text-sm text-muted-foreground">
            Irreversible or high-impact actions for this organization.
          </p>
        </div>
        <OrgDangerZone org={activeOrg} />
      </div>
    </div>
  );
}
