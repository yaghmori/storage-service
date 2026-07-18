export const AdminAuthEndpoints = {
  Login: "admin/api/auth/login",
  ForgotPassword: "admin/api/auth/forgot-password",
  Me: "admin/api/auth/me",
  ChangePassword: "admin/api/auth/me/password",
  Logout: "admin/api/auth/logout",
} as const;

export const DashboardEndpoints = {
  Stats: "admin/api/dashboard/stats",
} as const;

export const FilesEndpoints = {
  List: "admin/api/files",
  Upload: "admin/api/files/upload",
  Detail: "admin/api/files/{0}",
  Delete: "admin/api/files/{0}",
  HardDelete: "admin/api/files/{0}/hard",
  SignedUrl: "admin/api/files/{0}/signed-url",
  Content: "admin/api/files/{0}/content",
} as const;

/** Browser-friendly content URL via BFF (session cookie → admin JWT). */
export function fileContentUrl(
  fileId: string,
  opts?: { variant?: string; orgId?: string },
): string {
  const path = replacePathParams(FilesEndpoints.Content, fileId);
  const params = new URLSearchParams();
  if (opts?.variant) params.set("variant", opts.variant);
  if (opts?.orgId) params.set("orgId", opts.orgId);
  const query = params.toString();
  return `/api/upstream/${path}${query ? `?${query}` : ""}`;
}

export const JobsEndpoints = {
  List: "admin/api/jobs",
  Detail: "admin/api/jobs/{0}",
  Cancel: "admin/api/jobs/{0}/cancel",
} as const;

export const AnalyticsEndpoints = {
  Summary: "admin/api/analytics/summary",
  Downloads: "admin/api/analytics/downloads",
} as const;

export const ProvidersEndpoints = {
  List: "admin/api/providers",
  Detail: "admin/api/providers/{0}",
  Create: "admin/api/providers",
  Update: "admin/api/providers/{0}",
  Delete: "admin/api/providers/{0}",
  Test: "admin/api/providers/{0}/test",
} as const;

export const ApiKeysEndpoints = {
  List: "admin/api/api-keys",
  Create: "admin/api/api-keys",
  Update: "admin/api/api-keys/{0}",
  Delete: "admin/api/api-keys/{0}",
} as const;

export const OrgsEndpoints = {
  List: "admin/api/orgs",
  Detail: "admin/api/orgs/{0}",
  CheckSlug: "admin/api/orgs/check-slug",
  Create: "admin/api/orgs",
  Update: "admin/api/orgs/{0}",
  Delete: "admin/api/orgs/{0}",
} as const;

export const UsersEndpoints = {
  List: "admin/api/users",
  Detail: "admin/api/users/{0}",
  Create: "admin/api/users",
  Update: "admin/api/users/{0}",
  Delete: "admin/api/users/{0}",
} as const;

export function replacePathParams(
  path: string,
  ...params: Array<string | number>
): string {
  let result = path;
  params.forEach((param, index) => {
    result = result.replace(`{${index}}`, String(param));
  });
  return result;
}
