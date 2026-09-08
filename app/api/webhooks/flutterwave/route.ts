/**
 * POST /api/webhooks/flutterwave
 *
 * Receives Flutterwave webhook events. Flow:
 *
 *   1. Compare the `verif-hash` header against FLUTTERWAVE_WEBHOOK_HASH
 *      (constant-time). When the hash is unset we skip verification with a log
 *      (demo mode) and still process charge.completed as a stub.
 *   2. On `charge.completed`, extract the transaction id and RE-VERIFY via
 *      GET /v3/transactions/:id/verify — never trust the webhook body alone.
 *   3. On a successful verification, call fulfillOrder(). Dedupe is built in:
 *      fulfillOrder/recordSale skip when a sale with the same referenceId
 *      (the tx_ref) already exists, so a callback + webhook race fulfills once.
 *
 * Always returns { received: true } (200) unless the hash check fails (401).
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getBaseUrl, getProductConfig } from "@/lib/config";
import { verifyFlutterwaveTransaction } from "@/lib/flutterwave";
import { fulfillOrder } from "@/lib/fulfill";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const hash = request.headers.get("verif-hash");
  if (!verifyHash(hash)) {
    console.error("[webhook:flutterwave] verif-hash mismatch — rejected.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const event = String(body?.event ?? body?.eventType ?? "");

  if (event !== "charge.completed") {
    console.log(`[webhook:flutterwave] unhandled event: ${event || "(none)"} — ignored.`);
    return NextResponse.json({ received: true });
  }

  // Flutterwave nests the transaction under data / data.data depending on version.
  const tx = body?.data && typeof body.data === "object" ? body.data : {};
  const transactionId = tx.id ?? tx.transaction_id ?? body?.["transaction-id"];
  if (!transactionId) {
    console.warn("[webhook:flutterwave] charge.completed without a transaction id — ignored.");
    return NextResponse.json({ received: true });
  }

  const verified = await verifyFlutterwaveTransaction(transactionId);
  if (!verified.ok) {
    // Verification failed (or the charge wasn't successful) — nothing to fulfill.
    return NextResponse.json({ received: true });
  }

  const product = getProductConfig();
  await fulfillOrder({
    email: verified.email || "anonymous@example.com",
    name: verified.name || "Valued Customer",
    amountCents: verified.amountCents || product.priceCents,
    currency: (verified.currency || product.currency).toLowerCase(),
    provider: "flutterwave",
    referenceId: verified.txRef || String(transactionId),
    baseUrl: getBaseUrl(request.url),
  });

  return NextResponse.json({ received: true });
}

/* ------------------------- signature verification ----------------------- */

/**
 * Constant-time comparison of the verif-hash header against our secret hash.
 * When FLUTTERWAVE_WEBHOOK_HASH is unset we skip verification (demo mode) and
 * log, so the flow stays testable without credentials.
 */
function verifyHash(received: string | null): boolean {
  const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH?.trim();
  if (!expected) {
    console.log(
      "[webhook:flutterwave] FLUTTERWAVE_WEBHOOK_HASH not set — verification skipped (template stub).",
    );
    return true;
  }
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
