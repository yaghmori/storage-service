import { resolveStorageApiUrl } from "@/lib/config/ports";
import { NextRequest, NextResponse } from "next/server";

const STORAGE_API_URL = resolveStorageApiUrl();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${STORAGE_API_URL}/admin/api/auth/forgot-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      },
    );

    const raw = await response.json().catch(() => ({}));
    const payload = raw?.data ?? raw;

    if (!response.ok) {
      const message =
        payload?.message ||
        raw?.message ||
        raw?.errors?.[0]?.message ||
        "Failed to reset password";
      return NextResponse.json(
        { success: false, message },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        payload?.message ||
        "Temporary password written to the service container logs. Sign in with it, then change your password.",
    });
  } catch (error) {
    console.error("[auth/forgot-password]", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to reset password",
      },
      { status: 500 },
    );
  }
}
