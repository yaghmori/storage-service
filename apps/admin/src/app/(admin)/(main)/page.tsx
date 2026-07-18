"use client";

import { PAGE_ROUTES } from "@/lib/constants/page-routes";
import { useOrganizationsQuery } from "@/features/orgs/hooks/use-orgs-queries";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Resolve `/` to first org dashboard or create-org when none exist. */
export default function AdminRootRedirectPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useOrganizationsQuery();

  useEffect(() => {
    if (isLoading) return;
    // Auth failures (401) are handled by the upstream interceptor → login.
    // Do not treat API errors as "no orgs" or we send expired sessions to create-org.
    if (isError) return;
    const items = data?.items ?? [];
    if (items.length === 0) {
      router.replace(PAGE_ROUTES.ORG_NEW);
      return;
    }
    router.replace(PAGE_ROUTES.home(items[0].slug));
  }, [data, isLoading, isError, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirecting…
    </div>
  );
}
