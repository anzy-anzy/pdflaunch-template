/**
 * GET /api/sales
 *
 * Returns recorded sales + totals for the admin dashboard. Sales are recorded
 * by the Stripe webhook on checkout.session.completed (and by the demo stub in
 * /api/checkout), so this endpoint works with zero configuration.
 *
 * Protected when ADMIN_PASSWORD is set: requires the `pdflaunch_admin` session
 * cookie (see lib/admin.ts), otherwise returns 401. With ADMIN_PASSWORD unset
 * (demo mode) it stays open.
 *
 * Response:
 *   { sales: SaleRecord[], totals: { revenueCents, count } }
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { listSales, salesTotals } from "@/lib/store";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const sales = listSales();
  return NextResponse.json({ sales, totals: salesTotals() });
}