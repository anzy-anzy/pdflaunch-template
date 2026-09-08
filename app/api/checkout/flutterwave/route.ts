/**
 * POST /api/checkout/flutterwave
 *
 * Creates a Flutterwave hosted payment (MTN Mobile Money / Orange Money /
 * local + international cards at the hosted checkout) for the configured
 * product — or, when no key is configured, a demo stub mirroring the Stripe
 * stub pattern (record a demo sale + mint a demo download link).
 *
 * Real mode (FLUTTERWAVE_SECRET_KEY set):
 *   - generates our own tx_ref (`pdflaunch_<ms>_<rand>`) — the dedupe key
 *     shared with the callback + webhook
 *   - redirect_url points at /api/checkout/flutterwave/callback?tx_ref=...
 *   - amount/currency: product currency uppercased; for zero-decimal
 *     currencies (XAF via PRODUCT_CURRENCY=xaf, …) priceCents IS the price —
 *     e.g. PRODUCT_PRICE_CENTS=5000 + PRODUCT_CURRENCY=xaf charges 5,000 XAF
 *   - returns { url: link } — the buyer pays on Flutterwave's hosted page
 */

import { NextResponse } from "next/server";
import { getBaseUrl, getProductConfig, getSecurityConfig } from "@/lib/config";
import {
  createFlutterwavePayment,
  isFlutterwaveConfigured,
  newTxRef,
  toMajorAmount,
} from "@/lib/flutterwave";
import { createDownload, listUploads, recordSale } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const product = getProductConfig();
  const baseUrl = getBaseUrl(request.url);

  const body = await request.json().catch(() => null);
  const email = readField(body, "email");
  const name = readField(body, "name");

  if (!isFlutterwaveConfigured()) {
    console.log(
      [
        "------------------------------------------------------------",
        "[checkout:flutterwave] FLUTTERWAVE_SECRET_KEY not set — returning demo stub.",
        `  Product: ${product.title} @ ${(product.priceCents / 100).toFixed(2)} ${product.currency}`,
        `  Email  : ${email || "(none submitted)"}`,
        "  (A real flow would charge the buyer via MTN MoMo/cards, verify the",
        "   transaction and email a secure download link — see",
        "   app/api/checkout/flutterwave/callback/route.ts.)",
        "------------------------------------------------------------",
      ].join("\n"),
    );

    const txRef = newTxRef();
    recordSale({
      email: email || "demo@example.com",
      name: name || "Demo Customer",
      amountCents: product.priceCents,
      currency: product.currency,
      provider: "flutterwave-demo",
      referenceId: txRef,
    });

    return NextResponse.json({
      demo: true,
      message:
        "Flutterwave is not configured — demo mode. Set FLUTTERWAVE_SECRET_KEY to accept MTN MoMo / Orange Money / cards.",
      downloadUrl: demoDownloadUrl(baseUrl, email, name),
    });
  }

  const txRef = newTxRef();
  const result = await createFlutterwavePayment({
    email: email || "buyer@example.com",
    name: name || "Valued Customer",
    amount: toMajorAmount(product.priceCents, product.currency),
    currency: product.currency,
    txRef,
    redirectUrl: `${baseUrl}/api/checkout/flutterwave/callback?tx_ref=${encodeURIComponent(txRef)}`,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ url: result.link, demo: false, tx_ref: txRef });
}

/* ------------------------------- helpers -------------------------------- */

function readField(
  body: { email?: unknown; name?: unknown } | null,
  key: "email" | "name",
): string | undefined {
  const value = body?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Demo-mode delivery link — same pattern as the Stripe stub: mint a link to
 * the most recently uploaded PDF so the delivery chain can be clicked through.
 */
function demoDownloadUrl(baseUrl: string, email?: string, name?: string): string {
  const upload = listUploads().at(-1);
  if (!upload) return `${baseUrl}/admin?needUpload=1`;
  const record = createDownload(
    upload.id,
    email || "demo@example.com",
    name || "Demo Customer",
    getSecurityConfig().downloadLinkTtlHours,
  );
  return `${baseUrl}/api/downloads/${record.token}`;
}
