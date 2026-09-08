/**
 * GET /api/checkout/flutterwave/callback?tx_ref=...&transaction_id=...
 *
 * Flutterwave redirects the buyer here after they pay on the hosted checkout.
 * We NEVER trust the query params alone: the transaction_id is re-verified
 * via GET /v3/transactions/:id/verify, and only a "successful" verification
 * triggers fulfillOrder(). On success the buyer is redirected straight to
 * their download URL (also emailed); on failure to /?checkout=failed.
 */

import { NextResponse } from "next/server";
import { getBaseUrl, getProductConfig } from "@/lib/config";
import { verifyFlutterwaveTransaction } from "@/lib/flutterwave";
import { fulfillOrder } from "@/lib/fulfill";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseUrl = getBaseUrl(request.url);
  const txRef = url.searchParams.get("tx_ref") ?? "";
  const transactionId = url.searchParams.get("transaction_id") ?? "";
  const status = (url.searchParams.get("status") ?? "").toLowerCase();

  if (!transactionId || status === "cancelled" || status === "failed") {
    return NextResponse.redirect(`${baseUrl}/?checkout=failed`);
  }

  const verified = await verifyFlutterwaveTransaction(transactionId);
  if (!verified.ok) {
    return NextResponse.redirect(`${baseUrl}/?checkout=failed`);
  }

  // Guard against tampering: the verified tx_ref must match the one from
  // checkout (when both are present). The verified tx_ref is the dedupe key.
  const referenceId = verified.txRef || txRef;
  if (verified.txRef && txRef && verified.txRef !== txRef) {
    console.error(
      `[callback:flutterwave] tx_ref mismatch (expected ${txRef}, verified ${verified.txRef}) — not fulfilled.`,
    );
    return NextResponse.redirect(`${baseUrl}/?checkout=failed`);
  }

  const product = getProductConfig();
  const result = await fulfillOrder({
    email: verified.email || "anonymous@example.com",
    name: verified.name || "Valued Customer",
    amountCents: verified.amountCents || product.priceCents,
    currency: (verified.currency || product.currency).toLowerCase(),
    provider: "flutterwave",
    referenceId,
    baseUrl,
  });

  if (result.downloadUrl) {
    return NextResponse.redirect(result.downloadUrl);
  }
  // Fulfilled (or deduped) but no file to deliver — send the buyer somewhere
  // useful instead of stranding them on a dead callback URL.
  return NextResponse.redirect(`${baseUrl}/?checkout=success`);
}
