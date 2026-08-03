import { OrgProvider } from "@/provider/org-provider";

/** Bare layout for create-org (no admin sidebar). */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OrgProvider>
      <div className="min-h-svh bg-background">{children}</div>
    </OrgProvider>
  );
}
