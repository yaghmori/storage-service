"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  useOrganizationsQuery,
  type OrganizationRow,
} from "@/features/orgs/hooks/use-orgs-queries";
import { setUpstreamOrgId } from "@/lib/api/upstream-client";
import { isPlatformPath, PLATFORM_PREFIX } from "@/lib/constants/page-routes";
import { useParams, usePathname } from "next/navigation";

const SELECTED_ORG_STORAGE_KEY = "storage-admin.selected-org-slug";

type OrgContextValue = {
  orgs: OrganizationRow[];
  /**
   * Selected organization for sidebar / scoped actions.
   * Comes from the URL on tenant routes, otherwise the last selected org
   * (survives platform routes like /~/orgs and /~/users).
   */
  activeOrg: OrganizationRow | null;
  /** URL org slug segment when on a tenant route. Null on platform paths. */
  urlOrgSlug: string | null;
  isPlatform: boolean;
  isLoading: boolean;
  /** Persist selection (used when switching orgs from the switcher). */
  setSelectedOrgSlug: (slug: string | null) => void;
};

const OrgContext = createContext<OrgContextValue | null>(null);

const RESERVED_SLUGS = new Set([
  PLATFORM_PREFIX,
  "platform",
  "auth",
  "api",
  "onboarding",
]);

function readStoredOrgSlug(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(SELECTED_ORG_STORAGE_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

function writeStoredOrgSlug(slug: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!slug) {
      window.localStorage.removeItem(SELECTED_ORG_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SELECTED_ORG_STORAGE_KEY, slug);
  } catch {
    // ignore quota / private mode
  }
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useOrganizationsQuery();
  const orgs = data?.items ?? [];
  const pathname = usePathname();
  const params = useParams<{ orgSlug?: string }>();
  const [storedSlug, setStoredSlug] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  const isPlatform = isPlatformPath(pathname);

  useEffect(() => {
    setStoredSlug(readStoredOrgSlug());
    setStorageReady(true);
  }, []);

  const urlOrgSlug = useMemo(() => {
    if (isPlatform) return null;
    const fromParams =
      typeof params.orgSlug === "string" ? params.orgSlug.trim() : "";
    const fromPath = pathname.split("/").filter(Boolean)[0] ?? "";
    const slug = decodeURIComponent(fromParams || fromPath);
    if (!slug || RESERVED_SLUGS.has(slug)) return null;
    return slug;
  }, [isPlatform, params.orgSlug, pathname]);

  // Keep last tenant org when navigating into platform routes.
  useEffect(() => {
    if (!urlOrgSlug) return;
    setStoredSlug(urlOrgSlug);
    writeStoredOrgSlug(urlOrgSlug);
  }, [urlOrgSlug]);

  const setSelectedOrgSlug = (slug: string | null) => {
    setStoredSlug(slug);
    writeStoredOrgSlug(slug);
  };

  const activeOrg = useMemo(() => {
    if (urlOrgSlug) {
      return orgs.find((o) => o.slug === urlOrgSlug) ?? null;
    }
    if (!storageReady) return null;
    if (storedSlug) {
      const match = orgs.find((o) => o.slug === storedSlug);
      if (match) return match;
    }
    return orgs.find((o) => o.status === "active") ?? orgs[0] ?? null;
  }, [orgs, urlOrgSlug, storedSlug, storageReady]);

  // Keep axios tenant scope aligned with the active org.
  useEffect(() => {
    setUpstreamOrgId(activeOrg?.id ?? null);
    return () => setUpstreamOrgId(null);
  }, [activeOrg?.id]);

  // Backfill storage when landing on platform with no saved org.
  useEffect(() => {
    if (!storageReady || urlOrgSlug || !activeOrg) return;
    if (storedSlug === activeOrg.slug) return;
    setStoredSlug(activeOrg.slug);
    writeStoredOrgSlug(activeOrg.slug);
  }, [storageReady, urlOrgSlug, activeOrg, storedSlug]);

  const value = useMemo(
    () => ({
      orgs,
      activeOrg,
      urlOrgSlug,
      isPlatform,
      isLoading: isLoading || !storageReady,
      setSelectedOrgSlug,
    }),
    [orgs, activeOrg, urlOrgSlug, isPlatform, isLoading, storageReady],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useActiveOrg() {
  const ctx = useOptionalActiveOrg();
  if (!ctx) {
    throw new Error("useActiveOrg must be used within OrgProvider");
  }
  return ctx;
}

export function useOptionalActiveOrg() {
  return useContext(OrgContext);
}
