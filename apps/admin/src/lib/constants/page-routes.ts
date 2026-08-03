export const PLATFORM_PREFIX = "~";

export function orgPath(slug: string, ...parts: string[]): string {
  const encodeSeg = (part: string) =>
    part === PLATFORM_PREFIX ? PLATFORM_PREFIX : encodeURIComponent(part);
  const path = parts.filter(Boolean).map(encodeSeg);
  return `/${[encodeSeg(slug), ...path].join("/")}`;
}

export const PAGE_ROUTES = {
  AUTH: {
    LOGIN: "/auth/login",
    FORGOT_PASSWORD: "/auth/forgot-password",
  },
  ORGS: "/~/orgs",
  /** Full-page create organization (replaces /onboarding/organization). */
  ORG_NEW: "/~/orgs/new",
  /** @deprecated Use ORG_NEW */
  ONBOARDING: "/~/orgs/new",
  USERS: "/~/users",
  ACCOUNT: "/~/settings",
  ACCOUNT_PROFILE: "/~/settings/profile",
  ACCOUNT_PREFERENCES: "/~/settings/preferences",
  ACCOUNT_APPEARANCE: "/~/settings/appearance",
  home: (slug: string) => orgPath(slug),
  files: (slug: string) => orgPath(slug, "files"),
  jobs: (slug: string) => orgPath(slug, "jobs"),
  analytics: (slug: string) => orgPath(slug, "analytics"),
  /** @deprecated Prefer settingsProviders — kept for bookmarks. */
  providers: (slug: string) => orgPath(slug, "settings", "providers"),
  /** @deprecated Prefer settingsProcessorBackends — kept for bookmarks. */
  processorBackends: (slug: string) =>
    orgPath(slug, "settings", "processor-backends"),
  /** @deprecated Prefer settingsTokens — kept for bookmarks. */
  tokens: (slug: string) => orgPath(slug, "settings", "tokens"),
  settings: (slug: string) => orgPath(slug, "settings"),
  settingsGeneral: (slug: string) => orgPath(slug, "settings", "general"),
  settingsLimits: (slug: string) => orgPath(slug, "settings", "limits"),
  settingsProviders: (slug: string) => orgPath(slug, "settings", "providers"),
  settingsProcessorBackends: (slug: string) =>
    orgPath(slug, "settings", "processor-backends"),
  settingsProcessing: (slug: string) =>
    orgPath(slug, "settings", "processing"),
  settingsTokens: (slug: string) => orgPath(slug, "settings", "tokens"),
  settingsRetention: (slug: string) => orgPath(slug, "settings", "retention"),
  settingsDanger: (slug: string) => orgPath(slug, "settings", "danger"),
  settingsSection: (
    slug: string,
    section:
      | "general"
      | "limits"
      | "providers"
      | "processor-backends"
      | "processing"
      | "tokens"
      | "retention"
      | "danger",
  ) => orgPath(slug, "settings", section),
} as const;

export const PUBLIC_ROUTES = [
  PAGE_ROUTES.AUTH.LOGIN,
  PAGE_ROUTES.AUTH.FORGOT_PASSWORD,
] as const;

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

export function isPlatformPath(pathname: string): boolean {
  return (
    pathname === `/${PLATFORM_PREFIX}` ||
    pathname.startsWith(`/${PLATFORM_PREFIX}/`) ||
    pathname === "/%7E" ||
    pathname.startsWith("/%7E/") ||
    pathname === "/platform" ||
    pathname.startsWith("/platform/")
  );
}
