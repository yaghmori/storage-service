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
    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${STORAGE_API_URL}/admin/api/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
    );

    const raw = await response.json().catch(() => ({}));
    const payload = raw?.data ?? raw;

    if (!response.ok) {
      const message =
        payload?.message ||
        raw?.errors?.[0]?.message ||
        "Invalid email or password";
      return NextResponse.json({ success: false, message }, { status: 401 });
    }

    if (!payload?.token || !payload?.admin) {
      return NextResponse.json(
        { success: false, message: "Invalid login response" },
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
        name: admin.email,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[auth/sign-in]", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create session",
      },
      { status: 500 },
    );
  }
}
