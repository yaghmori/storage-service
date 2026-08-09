import { createSession } from "@/lib/auth";
import { resolveStorageApiUrl } from "@/lib/config/ports";
import { NextRequest, NextResponse } from "next/server";

const STORAGE_API_URL = resolveStorageApiUrl();

export async function POST(request: NextRequest) {
  try {
    if (!process.env.AUTH_SECRET) {
      return NextResponse.json(
        { success: false, message: "AUTH_SECRET is not configured" },
        { status: 500 },
      );
    }

    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Invitation token is required" },
        { status: 400 },
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const auth = request.headers.get("authorization");
    if (auth) headers.Authorization = auth;

    // Prefer cookie session token when present
    const { getToken } = await import("@/lib/auth");
    const sessionToken = await getToken();
    if (sessionToken?.accessToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${sessionToken.accessToken}`;
    }

    const response = await fetch(
      `${STORAGE_API_URL}/admin/api/invites/${encodeURIComponent(token)}/accept`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          password: body.password,
          name: body.name,
        }),
      },
    );

    const raw = await response.json().catch(() => ({}));
    const payload = raw?.data ?? raw;

    if (!response.ok) {
      const message =
        payload?.message ||
        raw?.errors?.[0]?.message ||
        "Failed to accept invitation";
      return NextResponse.json(
        { success: false, message },
        { status: response.status },
      );
    }

    if (!payload?.token || !payload?.admin) {
      return NextResponse.json(
        { success: false, message: "Invalid accept response" },
        { status: 500 },
      );
    }

    const admin = payload.admin;
    await createSession({
      token: payload.token,
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        name: admin.name || admin.email,
        avatar: admin.avatar ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      orgId: payload.orgId,
      role: payload.role,
    });
  } catch (error) {
    console.error("[auth/accept-invite]", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to accept invitation",
      },
      { status: 500 },
    );
  }
}
