/**
 * POST /api/admin/logout
 *
 * Clears the `pdflaunch_admin` session cookie. Always succeeds (idempotent) —
 * in demo mode (ADMIN_PASSWORD unset) there is nothing to clear, and the
 * response is still 200.
 */
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // maxAge 0 expires the cookie immediately.
  response.cookies.set(ADMIN_COOKIE, "", adminCookieOptions(0));
  return response;
}