import { resolveAdminAppUrl } from "@/lib/config/ports";
import { ApiErrorResponse } from "@workspace/validation";
import axios, { AxiosError, AxiosResponse } from "axios";

const getAPIBaseURL = (): string => {
  if (typeof window !== "undefined") {
    return "/api/upstream";
  }

  return `${resolveAdminAppUrl()}/api/upstream`;
};

/** Active org for tenant-scoped admin API calls (set by OrgProvider). */
let activeUpstreamOrgId: string | null = null;

export function setUpstreamOrgId(orgId: string | null | undefined) {
  activeUpstreamOrgId = orgId?.trim() || null;
}

export function getUpstreamOrgId(): string | null {
  return activeUpstreamOrgId;
}

const upstream = axios.create({
  baseURL: getAPIBaseURL(),
  timeout: 30000,
  paramsSerializer: { indexes: true },
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

upstream.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    if (typeof config.headers.delete === "function") {
      config.headers.delete("Content-Type");
    } else {
      delete (config.headers as Record<string, unknown>)["Content-Type"];
    }
  }

  // Inject org scope for tenant APIs (defense in depth alongside ?orgId=).
  // Explicit per-request header still wins. Query params stay caller-owned
  // so platform routes (orgs/users) are not polluted.
  if (activeUpstreamOrgId) {
    const existingHeader =
      config.headers?.["x-org-id"] ?? config.headers?.["X-Org-Id"];
    if (!existingHeader) {
      config.headers = config.headers ?? {};
      config.headers["x-org-id"] = activeUpstreamOrgId;
    }
  }

  return config;
});

upstream.interceptors.response.use(
  (response): AxiosResponse => response,
  async (error: AxiosError) => {
    if (!error.response) {
      return Promise.reject({
        message: "Network error. Please check your connection and try again.",
        status: 500,
      });
    }

    const { status, data } = error.response;

    if (status === 401 && typeof window !== "undefined") {
      if (!window.location.pathname.includes("/auth")) {
        const isRedirecting = sessionStorage.getItem("auth_redirecting");
        if (!isRedirecting) {
          sessionStorage.setItem("auth_redirecting", "true");
          // Clear iron-session cookie first — otherwise proxy still treats the
          // user as logged in and bounces /auth/login → / → onboarding.
          try {
            await fetch("/api/auth/sign-out", {
              method: "POST",
              credentials: "same-origin",
            });
          } catch {
            // Still redirect to login even if sign-out fails.
          }
          const loginUrl = new URL("/auth/login", window.location.origin);
          loginUrl.searchParams.set(
            "returnUrl",
            window.location.pathname + window.location.search,
          );
          window.location.href = loginUrl.toString();
        }
      }
    }

    return Promise.reject({
      ...(data as ApiErrorResponse),
      status,
    });
  },
);

export default upstream;
