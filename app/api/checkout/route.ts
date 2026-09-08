/**
 * POST /api/checkout
 *
 * Creates a Stripe Checkout session for the configured product, or — when no
 * Stripe key is configured — returns a stub so the landing page's "Buy Now"
 * flow can be clicked through in demo mode.
 *
 * Real mode (STRIPE_SECRET_KEY set):
 *   - payment_method_types ["card"] — the card payment method covers
 *     international cards AND automatically enables Apple Pay / Google Pay
 *     in Checkout (Stripe renders the wallet buttons when eligible).
 *   - customer_email from the buyer's submitted email (prefills the Checkout
 *     form and links past orders to one customer).
 *   - metadata { email, name } so the webhook can watermark the PDF.
 *   - locale "auto" so Checkout renders in the buyer's browser language.
 *
 * Stub mode (no key):
 *   Returns { demo: true, ... }, records a demo sale for the admin dashboard,
 *   and mints a demo download link straight from the latest uploaded PDF, so
 *   the whole chain (watermark → link → email) can be exercised locally
 *   without Stripe.
 */
import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getBaseUrl,
  getProductConfig,
  getSecurityConfig,
  isStripeConfigured,
} from "@/lib/config";
import {
  createDownload,
  listUploads,
  recordSale,
} from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const product = getProductConfig();
  const baseUrl = getBaseUrl(request.url);

  const body = await request.json().catch(() => null);
  const email = readEmail(body);
  const name = readName(body);

  if (!isStripeConfigured()) {
    console.log(
      [
        "------------------------------------------------------------",
        "[checkout] STRIPE_SECRET_KEY not set — returning demo stub.",
        `  Product: ${product.title} @ ${(product.priceCents / 100).toFixed(2)} ${product.currency}`,
        `  Email  : ${email || "(none submitted)"}`,
        "  (A real flow would charge the buyer, watermark the PDF and email",
        "   a secure download link — see app/api/webhooks/stripe/route.ts.)",
        "------------------------------------------------------------",
      ].join("\n"),
    );

    // Record the demo purchase so the admin sales dashboard shows live data
    // during local testing.
    recordSale({
      email: email || "demo@example.com",
      name: name || "Demo Customer",
      amountCents: product.priceCents,
      currency: product.currency,
      sessionId: `cs_demo_${Date.now()}`,
    });

    return NextResponse.json({
      demo: true,
      message:
        "Stripe is not configured — demo mode. Set STRIPE_SECRET_KEY to create real Checkout sessions.",
      downloadUrl: demoDownloadUrl(baseUrl, email, name),
    });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

  try {
    const metadata: { email?: string; name?: string } = {};
    if (email) metadata.email = email;
    if (name) metadata.name = name;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // "card" covers international cards AND enables Apple Pay / Google Pay
      // (Stripe Checkout surfaces the wallets automatically where eligible).
      payment_method_types: ["card"],
      locale: "auto",
      // Prefill the Checkout form + send the receipt to the right address.
      customer_email: email ?? undefined,
      metadata,
      line_items: [
        {
          price_data: {
            currency: product.currency,
            product_data: { name: product.title },
            unit_amount: product.priceCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/admin?checkout=success`,
      cancel_url: `${baseUrl}/?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url, demo: false });
  } catch (err) {
    console.error("[checkout] Stripe session creation failed:", err);
    return NextResponse.json(
      { error: "Could not create checkout session" },
      { status: 500 },
    );
  }
}

/* ------------------------------- helpers -------------------------------- */

function readEmail(body: { email?: unknown } | null): string | undefined {
  const email = body?.email;
  return typeof email === "string" && email.trim() ? email.trim() : undefined;
}

function readName(body: { name?: unknown } | null): string | undefined {
  const name = body?.name;
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
}

/**
 * Demo-mode delivery link. In real mode the Stripe webhook decides when a
 * buyer is entitled to a file and mints the link; here we mint one immediately
 * so the delivery chain (watermark → download → email) can be exercised in
 * the browser. Uses the most recently uploaded PDF.
 */
function demoDownloadUrl(baseUrl: string, email?: string, name?: string): string {
  const upload = listUploads().at(-1);

  if (!upload) {
    // Nothing uploaded yet — point the visitor at the admin upload UI.
    return `${baseUrl}/admin?needUpload=1`;
  }

  const record = createDownload(
    upload.id,
    email || "demo@example.com",
    name || "Demo Customer",
    getSecurityConfig().downloadLinkTtlHours,
  );
  return `${baseUrl}/api/downloads/${record.token}`;
}