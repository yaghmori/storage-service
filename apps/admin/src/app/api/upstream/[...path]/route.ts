import { deleteSession, getToken } from "@/lib/auth";
import { resolveStorageApiUrl } from "@/lib/config/ports";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const STORAGE_API_URL = resolveStorageApiUrl();

const PUBLIC_ROUTES = [
  "admin/api/auth/login",
  "admin/api/auth/forgot-password",
];

function isUpstreamPublic(fullPath: string): boolean {
  if (PUBLIC_ROUTES.some((route) => fullPath === route)) return true;
  if (fullPath.startsWith("admin/api/invites/")) return true;
  return false;
}

async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    const url = new URL(request.url);
    const search = url.search;
    const fullPath = path.join("/");
    const targetUrl = `${STORAGE_API_URL}/${fullPath}${search}`;

    const isPublicRoute = isUpstreamPublic(fullPath);

    let token = null;
    if (!isPublicRoute) {
      token = await getToken();
      if (!token?.accessToken) {
        return new Response(
          JSON.stringify({
            errors: [
              {
                code: "UNAUTHORIZED",
                message: "Authentication required",
              },
            ],
            meta: {
              timestamp: new Date().toISOString(),
              requestId: randomUUID(),
            },
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    const headers = new Headers();
    request.headers.forEach((value, key) => {
      if (
        !["host", "cookie", "set-cookie", "cookie2", "content-length"].includes(
          key.toLowerCase(),
        )
      ) {
        headers.set(key, value);
      }
    });

    if (!isPublicRoute && token?.accessToken) {
      headers.set("Authorization", `Bearer ${token.accessToken}`);
    }

    let body: BodyInit | undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      const contentType = request.headers.get("content-type");
      if (contentType?.includes("multipart/form-data")) {
        body = request.body || undefined;
      } else {
        const bodyText = await request.text();
        if (bodyText) {
          body = bodyText;
          if (!headers.has("content-type")) {
            headers.set("Content-Type", "application/json");
          }
        }
      }
    }

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      body,
    };

    if (body) {
      (fetchOptions as RequestInit & { duplex?: string }).duplex = "half";
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Expired/invalid admin JWT: clear the session cookie so the proxy
    // will send the user to login instead of bouncing them as "still logged in".
    if (response.status === 401 && !isPublicRoute) {
      await deleteSession();
    }

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (
        !["content-encoding", "content-length", "transfer-encoding"].includes(
          key.toLowerCase(),
        )
      ) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        errors: [
          {
            code: "INTERNAL_ERROR",
            message: "Internal server error",
            details:
              process.env.NODE_ENV === "development"
                ? {
                    error:
                      error instanceof Error ? error.message : String(error),
                  }
                : undefined,
          },
        ],
        meta: {
          timestamp: new Date().toISOString(),
          requestId: randomUUID(),
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const HEAD = handleRequest;
export const OPTIONS = handleRequest;
