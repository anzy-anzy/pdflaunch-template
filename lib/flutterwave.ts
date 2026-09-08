/**
 * Flutterwave payments (Cameroon mobile money + local cards).
 *
 * Flutterwave supports MTN Mobile Money in Cameroon (via its MTN partnership)
 * and holds a Cameroon licence, making it the right gateway for the owner's
 * home market. XAF is supported — set PRODUCT_CURRENCY=xaf.
 *
 * Standard v3 flow used here:
 *   1. Server POST /v3/payments with { tx_ref (WE generate), amount,
 *      currency, redirect_url, customer, meta } + `Authorization: Bearer
 *      FLW_SECRET_KEY` -> returns data.link (hosted checkout URL). The buyer
 *      pays with MoMo/cards on Flutterwave's page.
 *   2. Flutterwave redirects back to our callback with ?transaction_id=&tx_ref=.
 *      We MUST re-verify via GET /v3/transactions/:id/verify before fulfilling.
 *   3. The webhook (charge.completed + verif-hash header) re-verifies the same
 *      way, then fulfills. Never trust the webhook body alone.
 *
 * No new npm packages — plain fetch. Graceful stub when FLUTTERWAVE_SECRET_KEY
 * is unset (demo mode, same pattern as the Stripe routes).
 */

const API_BASE = "https://api.flutterwave.com/v3";

/** True when a real Flutterwave secret key is configured. */
export function isFlutterwaveConfigured(): boolean {
  const key = process.env.FLUTTERWAVE_SECRET_KEY?.trim() ?? "";
  return key.startsWith("FLWSECK") && !key.includes("REPLACE_ME");
}

function secretKey(): string {
  return process.env.FLUTTERWAVE_SECRET_KEY?.trim() ?? "";
}

/** Zero-decimal currencies have no minor unit (5000 XAF = 5,000 francs). */
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "uvf", "vnd", "vuv", "xaf", "xof", "xpf",
]);

export function isZeroDecimalCurrency(currency: string): boolean {
  return ZERO_DECIMAL.has((currency || "").toLowerCase());
}

/**
 * Convert template priceCents to the major-unit amount Flutterwave expects.
 * For zero-decimal currencies (XAF, XOF, JPY…) priceCents IS the price —
 * e.g. PRODUCT_PRICE_CENTS=5000 with PRODUCT_CURRENCY=xaf charges 5,000 XAF.
 */
export function toMajorAmount(priceCents: number, currency: string): number {
  if (isZeroDecimalCurrency(currency)) return Math.round(priceCents);
  return priceCents / 100;
}

/** Convert a Flutterwave major-unit amount back to template cents. */
export function toMinorAmount(amount: number, currency: string): number {
  if (isZeroDecimalCurrency(currency)) return Math.round(amount);
  return Math.round(amount * 100);
}

export type CreatePaymentInput = {
  email: string;
  name: string;
  /** Major-unit amount (e.g. 5000 = 5,000 XAF; 29 = $29.00). */
  amount: number;
  currency: string;
  /** Our own unique reference — we generate it at checkout. */
  txRef: string;
  redirectUrl: string;
};

export type CreatePaymentResult =
  | { ok: true; link: string }
  | { ok: false; error: string };

/** POST /v3/payments — returns the hosted checkout link the buyer pays on. */
export async function createFlutterwavePayment(
  input: CreatePaymentInput,
): Promise<CreatePaymentResult> {
  if (!isFlutterwaveConfigured()) {
    return { ok: false, error: "Flutterwave is not configured" };
  }

  try {
    const res = await fetch(`${API_BASE}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: input.txRef,
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        redirect_url: input.redirectUrl,
        customer: { email: input.email, name: input.name },
        meta: { source: "pdflaunch", email: input.email, name: input.name },
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || data?.status !== "success" || !data?.data?.link) {
      const msg =
        data?.message ?? `Flutterwave payments call failed (HTTP ${res.status})`;
      console.error("[flutterwave] create payment failed:", msg);
      return { ok: false, error: msg };
    }
    return { ok: true, link: data.data.link as string };
  } catch (err) {
    console.error("[flutterwave] create payment failed:", err);
    return { ok: false, error: (err as Error).message };
  }
}

export type VerifiedTransaction = {
  ok: boolean;
  /** Amount in template cents (converted via toMinorAmount). */
  amountCents: number;
  currency: string;
  email: string;
  name: string;
  /** Our tx_ref echoed back — the dedupe key shared with the webhook. */
  txRef: string;
  /** Flutterwave's own reference (flw_ref). */
  flwRef: string;
};

/**
 * GET /v3/transactions/:id/verify — the ONLY source of truth for a payment.
 * Returns ok:false unless the transaction exists AND has status "successful".
 */
export async function verifyFlutterwaveTransaction(
  transactionId: string | number,
): Promise<VerifiedTransaction> {
  const failed: VerifiedTransaction = {
    ok: false,
    amountCents: 0,
    currency: "",
    email: "",
    name: "",
    txRef: "",
    flwRef: "",
  };
  if (!isFlutterwaveConfigured()) return failed;

  try {
    const res = await fetch(
      `${API_BASE}/transactions/${encodeURIComponent(String(transactionId))}/verify`,
      { headers: { Authorization: `Bearer ${secretKey()}` } },
    );
    const data = await res.json().catch(() => null);
    const tx = data?.data;
    if (!res.ok || data?.status !== "success" || !tx) {
      console.error(
        "[flutterwave] verify failed:",
        data?.message ?? `HTTP ${res.status}`,
      );
      return failed;
    }
    if (String(tx.status).toLowerCase() !== "successful") {
      console.log(`[flutterwave] transaction ${transactionId} status: ${tx.status} — not fulfilled.`);
      return failed;
    }
    const currency = String(tx.currency ?? "").toLowerCase();
    return {
      ok: true,
      amountCents: toMinorAmount(Number(tx.amount ?? 0), currency),
      currency,
      email: String(tx.customer?.email ?? tx.meta?.email ?? ""),
      name: String(tx.customer?.name ?? tx.meta?.name ?? ""),
      txRef: String(tx.tx_ref ?? ""),
      flwRef: String(tx.flw_ref ?? ""),
    };
  } catch (err) {
    console.error("[flutterwave] verify failed:", err);
    return failed;
  }
}

/** Generate a unique tx_ref for a checkout: pdflaunch_<ms>_<rand>. */
export function newTxRef(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `pdflaunch_${Date.now()}_${rand}`;
}
