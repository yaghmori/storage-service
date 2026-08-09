export const AdminAuthEndpoints = {
  Login: "admin/api/auth/login",
  ForgotPassword: "admin/api/auth/forgot-password",
  Me: "admin/api/auth/me",
  UpdateProfile: "admin/api/auth/me",
  ChangePassword: "admin/api/auth/me/password",
  Logout: "admin/api/auth/logout",
} as const;

export const DashboardEndpoints = {
  Stats: "admin/api/dashboard/stats",
} as const;

export const FilesEndpoints = {
  List: "admin/api/files",
  Upload: "admin/api/files/upload",
  UploadInitiate: "admin/api/files/upload/initiate",
  UploadPartUrl: "admin/api/files/upload/multipart/part-url",
  UploadComplete: "admin/api/files/upload/complete",
  UploadAbort: "admin/api/files/upload/abort",
  Detail: "admin/api/files/{0}",
  Delete: "admin/api/files/{0}",
  HardDelete: "admin/api/files/{0}/hard",
  Restore: "admin/api/files/{0}/restore",
  SignedUrl: "admin/api/files/{0}/signed-url",
  Content: "admin/api/files/{0}/content",
  Metadata: "admin/api/files/{0}/metadata",
  ProcessorResults: "admin/api/files/{0}/processor-results",
  Variants: "admin/api/files/{0}/variants",
  RegenerateProcessing: "admin/api/files/{0}/regenerate-processing",
  Verify: "admin/api/files/{0}/verify",
  Duplicates: "admin/api/files/{0}/duplicates",
  ConfirmDuplicate: "admin/api/files/{0}/duplicates/{1}/confirm",
  DismissDuplicate: "admin/api/files/{0}/duplicates/{1}/dismiss",
} as const;

/** Browser-friendly content URL via BFF (session cookie → admin JWT). */
export function fileContentUrl(
  fileId: string,
  opts?: { variant?: string; orgId?: string; download?: boolean },
): string {
  const path = replacePathParams(FilesEndpoints.Content, fileId);
  const params = new URLSearchParams();
  if (opts?.variant) params.set("variant", opts.variant);
  if (opts?.orgId) params.set("orgId", opts.orgId);
  if (opts?.download) params.set("download", "1");
  const query = params.toString();
  return `/api/upstream/${path}${query ? `?${query}` : ""}`;
}

export const JobsEndpoints = {
  List: "admin/api/jobs",
  Detail: "admin/api/jobs/{0}",
  Cancel: "admin/api/jobs/{0}/cancel",
  Retry: "admin/api/jobs/{0}/retry",
  BulkCancel: "admin/api/jobs/bulk-cancel",
  BulkRetry: "admin/api/jobs/bulk-retry",
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

export const ProcessorBackendsEndpoints = {
  List: "admin/api/orgs/{0}/processor-backends",
  Detail: "admin/api/orgs/{0}/processor-backends/{1}",
  Models: "admin/api/orgs/{0}/processor-backends/{1}/models",
  Test: "admin/api/orgs/{0}/processor-backends/{1}/test",
  Create: "admin/api/orgs/{0}/processor-backends",
  Update: "admin/api/orgs/{0}/processor-backends/{1}",
  Delete: "admin/api/orgs/{0}/processor-backends/{1}",
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
  ProcessingSettings: "admin/api/orgs/{0}/processing-settings",
  TestWebhook: "admin/api/orgs/{0}/processing-settings/test-webhook",
  Limits: "admin/api/orgs/{0}/limits",
  Retention: "admin/api/orgs/{0}/retention",
  Usage: "admin/api/orgs/{0}/usage",
} as const;

export const MembersEndpoints = {
  List: "admin/api/orgs/{0}/members",
  Invite: "admin/api/orgs/{0}/members/invite",
  Resend: "admin/api/orgs/{0}/members/{1}/resend",
  ChangeRole: "admin/api/orgs/{0}/members/{1}/role",
  Remove: "admin/api/orgs/{0}/members/{1}",
  Transfer: "admin/api/orgs/{0}/members/transfer",
} as const;

export const InvitesEndpoints = {
  Preview: "admin/api/invites/{0}",
  Accept: "admin/api/invites/{0}/accept",
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
