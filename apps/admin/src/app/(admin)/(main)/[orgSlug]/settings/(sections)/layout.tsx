import { OrgSettingsShell } from "@/features/orgs/components/org-settings-shell";

export default function OrgSettingsSectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OrgSettingsShell>{children}</OrgSettingsShell>;
}
