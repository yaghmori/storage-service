"use client";

import { AdminSidebar } from "@/components/admin-sidebar";
import { OrgProvider, useActiveOrg } from "@/provider/org-provider";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Separator,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components";
import { usePathname } from "next/navigation";

function pageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "~") {
      if (segments[1] === "orgs") return "Organizations";
      if (segments[1] === "users") return "Users";
    if (segments[1] === "settings") {
      if (segments[2] === "profile") return "Profile";
      if (segments[2] === "appearance") return "Appearance";
      return "Account settings";
    }
    return "Platform";
  }
  const leaf = segments[1];
  if (!leaf) return "Dashboard";
  return (
    {
      files: "Files",
      jobs: "Jobs",
      analytics: "Analytics",
      providers: "Providers",
      tokens: "Tokens",
      settings: "Organization settings",
    }[leaf] ?? "Admin"
  );
}

function AdminHeader() {
  const pathname = usePathname();
  const title = pageTitle(pathname);
  const { activeOrg } = useActiveOrg();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 shadow-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {activeOrg && (
            <>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage className="text-muted-foreground font-normal">
                  {activeOrg.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}

function AdminMain({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0 overflow-x-auto overflow-y-auto bg-muted/70 p-4 md:p-6">
      <div className="w-full min-w-0 max-w-7xl">{children}</div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OrgProvider>
      <SidebarProvider mobileBreakpoint={1280}>
        <AdminSidebar />
        <SidebarInset className="h-svh">
          <AdminHeader />
          <AdminMain>{children}</AdminMain>
        </SidebarInset>
      </SidebarProvider>
    </OrgProvider>
  );
}
