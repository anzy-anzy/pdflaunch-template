/**
 * GET /api/sales
 *
 * Returns recorded sales + totals for the admin dashboard. Sales are recorded
 * by the Stripe webhook on checkout.session.completed (and by the demo stub in
 * /api/checkout), so this endpoint works with zero configuration.
 *
 * Response:
 *   { sales: SaleRecord[], totals: { revenueCents, count } }
 */
import { NextResponse } from "next/server";
import { listSales, salesTotals } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const sales = listSales();
  return NextResponse.json({ sales, totals: salesTotals() });
}