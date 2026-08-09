"use client";

import { extractApiErrorMessage } from "@/lib/api/extract-api-error";
import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import {
  orgSettingsNavItems,
  type OrgSettingsSection,
} from "@/features/orgs/utils/org-settings-navigation";
import { useActiveOrg } from "@/provider/org-provider";
import { Button, Card, CardContent, Skeleton } from "@workspace/ui/components";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { useMyOrgRole } from "../hooks/use-my-org-role";
import { useUpdateOrganizationMutation } from "../hooks/use-orgs-queries";
import { ApiKeysListView } from "@/features/api-keys/components/api-keys-list-view";
import { MembersListView } from "@/features/members/components/members-list-view";
import { ProcessorBackendsListView } from "@/features/processor-backends/components/processor-backends-list-view";
import { ProvidersListView } from "@/features/providers/components/providers-list-view";
import { OrgDangerZone } from "./org-danger-zone";
import { OrgLimitsSettingsForm } from "./org-limits-settings-form";
import { OrganizationForm } from "./organization-form";
import { OrgProcessingSettingsForm } from "./org-processing-settings-form";
import { OrgRetentionSettingsForm } from "./org-retention-settings-form";
import { SettingsHeading } from "./settings-heading";

type Props = {
  section: OrgSettingsSection;
};

export function OrgSettingsSectionView({ section }: Props) {
  const router = useRouter();
  const { activeOrg, urlOrgSlug, isLoading } = useActiveOrg();
  const { isOwner, isLoading: roleLoading } = useMyOrgRole();
  const updateMutation = useUpdateOrganizationMutation();
  const navItem = orgSettingsNavItems.find((item) => item.section === section);

  useEffect(() => {
    if (section !== "danger" || roleLoading || !activeOrg) return;
    if (!isOwner) {
      router.replace(PAGE_ROUTES.settingsGeneral(activeOrg.slug));
    }
  }, [section, roleLoading, isOwner, activeOrg, router]);

  if (isLoading && !activeOrg) {
    return <Skeleton className="h-[min(50vh,420px)] w-full rounded-md" />;
  }

  if (!activeOrg) {
    return (
      <div className="space-y-2">
        <SettingsHeading
          title="Organization not found"
          description={`Organization ${urlOrgSlug ?? "unknown"} was not found.`}
        />
      </div>
    );
  }

  if (section === "danger" && (roleLoading || !isOwner)) {
    return <Skeleton className="h-[min(50vh,420px)] w-full rounded-md" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <SettingsHeading
        title={navItem?.title ?? "Organization settings"}
        description={navItem?.description ?? ""}
        destructive={section === "danger"}
      />

      {section === "members" ? <MembersListView hideHeading /> : null}

      {section === "general" ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <OrganizationForm
                key={activeOrg.id}
                formId="org-general-settings"
                mode="edit"
                layout="wide"
                hideActions
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
                          router.replace(
                            PAGE_ROUTES.settingsGeneral(updated.slug),
                          );
                        }
                      },
                      onError: (err) =>
                        toast.error(
                          extractApiErrorMessage(err, "Save failed"),
                        ),
                    },
                  );
                }}
              />
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button
              type="submit"
              form="org-general-settings"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      ) : null}

      {section === "limits" ? (
        <OrgLimitsSettingsForm orgId={activeOrg.id} />
      ) : null}

      {section === "providers" ? (
        <ProvidersListView hideHeading />
      ) : null}

      {section === "processor-backends" ? (
        <ProcessorBackendsListView hideHeading />
      ) : null}

      {section === "processing" ? (
        <OrgProcessingSettingsForm orgId={activeOrg.id} />
      ) : null}

      {section === "api-keys" ? <ApiKeysListView hideHeading /> : null}

      {section === "retention" ? (
        <OrgRetentionSettingsForm orgId={activeOrg.id} />
      ) : null}

      {section === "danger" ? <OrgDangerZone org={activeOrg} /> : null}
    </div>
  );
}
