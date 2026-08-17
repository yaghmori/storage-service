"use client";

import { OrgMaskedAvatar } from "@/features/orgs/components/org-masked-avatar";
import { orgPath } from "@/lib/constants/page-routes";
import { useActiveOrg } from "@/provider/org-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@workspace/ui/components";
import { Check, ChevronsUpDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

/** Compact organization switcher used as the first breadcrumb segment. */
export function BreadcrumbOrgSwitcher() {
  const { orgs, activeOrg, isPlatform, setSelectedOrgSlug } = useActiveOrg();
  const pathname = usePathname();
  const router = useRouter();

  if (orgs.length === 0) return null;

  const selectOrganization = (slug: string) => {
    setSelectedOrgSlug(slug);
    if (isPlatform) {
      router.push(orgPath(slug));
      return;
    }

    const leaf = pathname.split("/").slice(2);
    router.push(orgPath(slug, ...leaf));
  };

  const title = activeOrg?.name ?? "Select organization";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex max-w-48 items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Switch organization"
        >
          <OrgMaskedAvatar
            src={activeOrg?.logoUrl}
            alt={title}
            sizeClassName="size-5 min-h-5 min-w-5"
          />
          <span className="truncate">{title}</span>
          {/* <ChevronsUpDown className="size-3.5 shrink-0" /> */}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56 rounded-lg">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Organizations
        </DropdownMenuLabel>
        {orgs.map((org) => {
          const isSelected = activeOrg?.id === org.id;

          return (
            <DropdownMenuItem
              key={org.id}
              onClick={() => selectOrganization(org.slug)}
              className="gap-2 p-2"
            >
              <OrgMaskedAvatar
                src={org.logoUrl}
                alt={org.name}
                sizeClassName="size-6 min-h-6 min-w-6"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{org.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {org.slug}
                </div>
              </div>
              {isSelected ? <Check className="size-4 shrink-0" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
