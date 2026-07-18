import { deleteSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    await deleteSession();
    return NextResponse.json({ success: true });
  } catch {
    await deleteSession();
    return NextResponse.json({ success: true });
  }
}
