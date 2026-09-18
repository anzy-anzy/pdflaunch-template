/**
 * Admin password protection — lib/admin.ts
 *
 * Zero-config by design (keeps the <10-minute buyer flow intact):
 *   - `ADMIN_PASSWORD` UNSET  → admin is OPEN (demo mode; nothing to configure)
 *   - `ADMIN_PASSWORD` SET    → /admin, /api/upload and /api/sales require a
 *     valid session cookie; a password form appears at /admin.
 *
 * Session model (stateless, no DB/server state needed):
 *   POST /api/admin/login  → compares the submitted password against
 *     ADMIN_PASSWORD with crypto.timingSafeEqual, then sets an HttpOnly
 *     `pdflaunch_admin` cookie whose value is an HMAC-SHA256 of "admin" keyed
 *     by ADMIN_PASSWORD. The cookie can be verified by any process that knows
 *     the password — no session store required.
 *   POST /api/admin/logout → clears the cookie.
 *
 * ⚠️ SERVER-ONLY module (`node:crypto`). Never import from a "use client"
 * component — the login form and dashboard run without this module.
 */
import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Cookie name for the stateless admin session. */
export const ADMIN_COOKIE = "pdflaunch_admin";

/** Session lifetime — 30 days. Logging out clears it early. */
export const ADMIN_SESSION_SECONDS = 30 * 24 * 60 * 60;

/** Message signed by the HMAC (constant so tokens are portable across restarts). */
const TOKEN_MESSAGE = "admin";

/* --------------------------------- env ------------------------------------ */

/** Raw ADMIN_PASSWORD from the environment (trimmed; "" = unset = open). */
export function getAdminPassword(): string {
  return (process.env.ADMIN_PASSWORD ?? "").trim();
}

/**
 * True when password protection is ENGAGED. Unset (or empty) `ADMIN_PASSWORD`
 * keeps admin fully open — demo mode, zero configuration.
 */
export function isAdminLocked(): boolean {
  return getAdminPassword().length > 0;
}

/* -------------------------------- token ----------------------------------- */

/** Stateless session token: HMAC-SHA256("admin", key = ADMIN_PASSWORD). */
export function createAdminToken(): string {
  return createHmac("sha256", getAdminPassword())
    .update(TOKEN_MESSAGE)
    .digest("base64url");
}

/**
 * Constant-time check that `token` is exactly the token this server issues.
 * Returns false when the lock is off (no valid sessions in demo mode).
 */
export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token || !isAdminLocked()) return false;
  return safeEqual(Buffer.from(token), Buffer.from(createAdminToken()));
}

/** Constant-time password comparison for POST /api/admin/login. */
export function verifyAdminPassword(candidate: string): boolean {
  if (!isAdminLocked()) return false;
  return safeEqual(Buffer.from(candidate), Buffer.from(getAdminPassword()));
}

/**
 * Guard for individual API route handlers (per-route alternative to a
 * middleware.ts — keeps `node:crypto` on the Node runtime and public routes
 * untouched). Returns a 401 response when the lock is engaged and the request
 * has no valid session; returns null when the request may proceed.
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  if (!isAdminLocked()) return null; // demo mode — open
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (verifyAdminToken(token)) return null;
  return NextResponse.json(
    { error: "Unauthorized — admin login required." },
    { status: 401 },
  );
}

/* ------------------------------- cookies ----------------------------------- */

/** Cookie options for the admin session (HttpOnly + SameSite=Lax). */
export function adminCookieOptions(maxAgeSeconds: number): {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  secure: boolean;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}

/* ------------------------------- internals -------------------------------- */

function safeEqual(a: Buffer, b: Buffer): boolean {
  // timingSafeEqual throws on length mismatch — reject early instead.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}