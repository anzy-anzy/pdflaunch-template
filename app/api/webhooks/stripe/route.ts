/**
 * POST /api/webhooks/stripe
 *
 * Receives Stripe webhook events. The only event this template acts on is
 * `checkout.session.completed`, which triggers the shared fulfillOrder()
 * pipeline (record sale → watermark → token → email — see lib/fulfill.ts).
 *
 * Signature verification: enabled when STRIPE_WEBHOOK_SECRET is set, and
 * skipped (with a clear log) otherwise, so the template is testable in demo
 * mode without Stripe credentials.
 */
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getProductConfig, isStripeConfigured } from "@/lib/config";
import { fulfillOrder } from "@/lib/fulfill";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  const event = verifyEvent(body, sig);
  if (!event) {
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.expired":
      console.log(`[webhook] session ${event.data.object.id} expired — ignored.`);
      break;
    default:
      console.log(`[webhook] unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

/* --------------------------- event handling ----------------------------- */

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const email = (session.customer_details?.email ?? session.metadata?.email ?? "").toLowerCase();
  const customerName =
    session.customer_details?.name?.trim() || session.metadata?.name?.trim() || "Valued Customer";

  // amount_total is in the session's currency (zero-decimal currencies are
  // already in whole units — Stripe normalizes unit_amount for us).
  await fulfillOrder({
    email: email || "anonymous@example.com",
    name: customerName,
    amountCents: session.amount_total ?? getProductConfig().priceCents,
    currency: (session.currency ?? getProductConfig().currency).toLowerCase(),
    provider: "stripe",
    // Dedupe key — Stripe retries the same event; fulfill exactly once.
    referenceId: session.id,
    sessionId: session.id,
    paymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : undefined,
  });
}

/* ------------------------- signature verification ----------------------- */

function verifyEvent(
  body: string,
  sig: string | null,
): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !sig) {
    // Stub mode: the payload is logged so the flow is inspectable end-to-end,
    // but not processed as if it were a genuine Stripe event.
    console.log(
      "[webhook] STRIPE_WEBHOOK_SECRET not set — verifying signature skipped (template stub).",
      "  payload:", body.slice(0, 400),
    );
    return JSON.parse(body) as Stripe.Event;
  }

  const stripe = new Stripe(isStripeConfigured()
    ? (process.env.STRIPE_SECRET_KEY as string)
    : "sk_test_dummy_dummy_dummy_dummy_dummy");
  try {
    return stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[webhook] signature verification failed:", err);
    return null;
  }
}
