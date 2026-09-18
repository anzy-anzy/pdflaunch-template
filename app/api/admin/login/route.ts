/**
 * POST /api/admin/login
 *
 * Body: { "password": "..." }
 *
 * Compares the submitted password against ADMIN_PASSWORD (constant-time).
 * On success sets the HttpOnly `pdflaunch_admin` session cookie and returns
 * 200; on failure returns 401. When ADMIN_PASSWORD is unset the admin area is
 * open (demo mode) and login returns 400 — there is nothing to log into.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminCookieOptions,
  createAdminToken,
  isAdminLocked,
  verifyAdminPassword,
} from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isAdminLocked()) {
    return NextResponse.json(
      {
        error:
          "Admin password protection is not enabled (ADMIN_PASSWORD is unset).",
      },
      { status: 400 },
    );
  }

  let password: string;
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body — expected { \"password\": \"...\" }." },
      { status: 400 },
    );
  }

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    ADMIN_COOKIE,
    createAdminToken(),
    adminCookieOptions(ADMIN_SESSION_SECONDS),
  );
  return response;
}