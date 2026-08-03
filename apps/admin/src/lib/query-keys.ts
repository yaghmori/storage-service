import type { QueryClient } from "@tanstack/react-query";

/**
 * Shared TanStack Query key factories for the storage-service admin app.
 *
 * Rules:
 * - Call sites import factories from `@/lib/query-keys` — no magic strings.
 * - Shape: `all → list(params) → detail(…) → nested`.
 * - Prefer `invalidateX(queryClient)` helpers next to keys.
 */

type Qc = QueryClient;

// ─── Auth / Account ─────────────────────────────────────────────────────────

export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
};

export const accountKeys = {
  me: ["account", "me"] as const,
};

export function invalidateAccount(qc: Qc) {
  qc.invalidateQueries({ queryKey: accountKeys.me });
}

// ─── Dashboard / Analytics ──────────────────────────────────────────────────

export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: (orgId?: string) => [...dashboardKeys.all, "stats", orgId] as const,
};

export function invalidateDashboard(qc: Qc) {
  qc.invalidateQueries({ queryKey: dashboardKeys.all });
}

export const analyticsKeys = {
  all: ["analytics"] as const,
  summary: (orgId?: string) =>
    [...analyticsKeys.all, "summary", orgId] as const,
  downloads: (params?: Record<string, unknown>) =>
    [...analyticsKeys.all, "downloads", params ?? {}] as const,
};

export function invalidateAnalytics(qc: Qc) {
  qc.invalidateQueries({ queryKey: analyticsKeys.all });
}

// ─── Files ──────────────────────────────────────────────────────────────────

export const fileKeys = {
  all: ["files"] as const,
  list: (params?: Record<string, unknown>) =>
    [...fileKeys.all, params ?? {}] as const,
  detail: (orgId: string | undefined, id: string | undefined) =>
    [...fileKeys.all, orgId, "detail", id] as const,
  signedUrl: (
    orgId: string | undefined,
    id: string | undefined,
    variant?: string | null,
  ) => [...fileKeys.all, orgId, "signed-url", id, variant ?? "original"] as const,
  metadata: (orgId: string | undefined, id: string | undefined) =>
    [...fileKeys.all, orgId, "metadata", id] as const,
  processorResults: (orgId: string | undefined, id: string | undefined) =>
    [...fileKeys.all, orgId, "processor-results", id] as const,
  variants: (orgId: string | undefined, id: string | undefined) =>
    [...fileKeys.all, orgId, "variants", id] as const,
  duplicates: (orgId: string | undefined, id: string | undefined) =>
    [...fileKeys.all, orgId, "duplicates", id] as const,
};

export function invalidateFiles(
  qc: Qc,
  opts?: { orgId?: string; fileId?: string; related?: boolean },
) {
  if (opts?.orgId && opts?.fileId) {
    qc.invalidateQueries({
      queryKey: fileKeys.detail(opts.orgId, opts.fileId),
    });
    qc.invalidateQueries({
      queryKey: fileKeys.variants(opts.orgId, opts.fileId),
    });
    qc.invalidateQueries({
      queryKey: fileKeys.duplicates(opts.orgId, opts.fileId),
    });
    qc.invalidateQueries({
      queryKey: fileKeys.processorResults(opts.orgId, opts.fileId),
    });
    qc.invalidateQueries({
      queryKey: fileKeys.signedUrl(opts.orgId, opts.fileId),
    });
    qc.invalidateQueries({
      queryKey: fileKeys.metadata(opts.orgId, opts.fileId),
    });
  }
  qc.invalidateQueries({ queryKey: fileKeys.all });
  if (opts?.related !== false) {
    invalidateJobs(qc);
    invalidateDashboard(qc);
  }
}

// ─── Jobs ───────────────────────────────────────────────────────────────────

export const jobKeys = {
  all: ["jobs"] as const,
  list: (params?: Record<string, unknown>) =>
    [...jobKeys.all, params ?? {}] as const,
  detail: (orgId: string | undefined, id: string | undefined) =>
    [...jobKeys.all, orgId, "detail", id] as const,
};

export function invalidateJobs(qc: Qc) {
  qc.invalidateQueries({ queryKey: jobKeys.all });
}

// ─── Orgs ───────────────────────────────────────────────────────────────────

export const orgKeys = {
  all: ["orgs"] as const,
  processingSettings: (orgId?: string) =>
    [...orgKeys.all, orgId, "processing-settings"] as const,
  usage: (orgId?: string) => [...orgKeys.all, orgId, "usage"] as const,
  limits: (orgId?: string) => [...orgKeys.all, orgId, "limits"] as const,
  retention: (orgId?: string) => [...orgKeys.all, orgId, "retention"] as const,
};

export function invalidateOrgs(
  qc: Qc,
  scope?: {
    orgId?: string;
    processingSettings?: boolean;
    usage?: boolean;
    limits?: boolean;
    retention?: boolean;
  },
) {
  if (scope?.orgId) {
    if (scope.processingSettings) {
      qc.invalidateQueries({
        queryKey: orgKeys.processingSettings(scope.orgId),
      });
    }
    if (scope.usage) {
      qc.invalidateQueries({ queryKey: orgKeys.usage(scope.orgId) });
    }
    if (scope.limits) {
      qc.invalidateQueries({ queryKey: orgKeys.limits(scope.orgId) });
    }
    if (scope.retention) {
      qc.invalidateQueries({ queryKey: orgKeys.retention(scope.orgId) });
    }
  }
  qc.invalidateQueries({ queryKey: orgKeys.all });
}

// ─── Providers / API keys / Users ───────────────────────────────────────────

export const providerKeys = {
  all: ["providers"] as const,
  list: (orgId?: string) => [...providerKeys.all, orgId] as const,
};

export function invalidateProviders(qc: Qc) {
  qc.invalidateQueries({ queryKey: providerKeys.all });
}

export const processorBackendKeys = {
  all: ["processor-backends"] as const,
  list: (orgId?: string) => [...processorBackendKeys.all, orgId] as const,
  detail: (orgId?: string, id?: string) =>
    [...processorBackendKeys.all, orgId, "detail", id] as const,
};

export function invalidateProcessorBackends(qc: Qc) {
  qc.invalidateQueries({ queryKey: processorBackendKeys.all });
}

export const apiKeyKeys = {
  all: ["api-keys"] as const,
  list: (orgId?: string) => [...apiKeyKeys.all, orgId] as const,
};

export function invalidateApiKeys(qc: Qc) {
  qc.invalidateQueries({ queryKey: apiKeyKeys.all });
}

export const userKeys = {
  all: ["users"] as const,
};

export function invalidateUsers(qc: Qc) {
  qc.invalidateQueries({ queryKey: userKeys.all });
}

export const MUTATION_KEYS = {
  AUTH: {
    LOGIN: ["auth", "login"] as const,
    LOGOUT: ["auth", "logout"] as const,
    FORGOT_PASSWORD: ["auth", "forgot-password"] as const,
  },
} as const;
