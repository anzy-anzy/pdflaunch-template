"use client";

import { useState } from "react";
import {
  product as defaultProduct,
  formatPrice,
  type ClientProduct,
} from "@/lib/site";

type Provider = "stripe" | "flutterwave";

/**
 * "Buy Now" button. Posts to /api/checkout (Stripe: cards + Apple Pay /
 * Google Pay) or /api/checkout/flutterwave (Mobile Money: MTN MoMo /
 * Orange Money + local cards) and redirects:
 *  - real provider -> hosted checkout URL
 *  - demo mode     -> shows a mock "purchase complete" panel with a link that
 *                     walks the delivery chain (watermark → download link).
 *
 * `product`, `stripeReady` and `flutterwaveReady` are passed in by the server
 * page — the button itself is a pure client component and never touches
 * lib/config.ts. The provider toggle only appears when Flutterwave is
 * configured; otherwise checkout is Stripe-only (or its demo stub).
 */
export default function BuyButton({
  product = defaultProduct,
  storeName = defaultProduct.title,
  stripeReady = false,
  flutterwaveReady = false,
}: {
  product?: ClientProduct;
  storeName?: string;
  stripeReady?: boolean;
  flutterwaveReady?: boolean;
}) {
  const [demo, setDemo] = useState<
    { message: string; downloadUrl?: string } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<Provider>("stripe");

  const showToggle = flutterwaveReady;
  const endpoint =
    provider === "flutterwave" ? "/api/checkout/flutterwave" : "/api/checkout";

  const handleClick = async () => {
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setDemo({ message: data.error ?? "Something went wrong." });
        return;
      }

      if (data.demo) {
        setDemo({
          message: data.message,
          downloadUrl: data.downloadUrl,
        });
      } else if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setDemo({ message: `Network error: ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  const price = formatPrice(product.priceCents, product.currency);
  const providerReady = provider === "flutterwave" ? flutterwaveReady : stripeReady;

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="buyer-name"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Name (for your watermark)
        </label>
        <input
          id="buyer-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ada Lovelace"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <div>
        <label
          htmlFor="buyer-email"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Email (for delivery)
        </label>
        <input
          id="buyer-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {showToggle && (
        <div
          role="radiogroup"
          aria-label="Payment method"
          className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm"
        >
          <button
            type="button"
            role="radio"
            aria-checked={provider === "stripe"}
            onClick={() => setProvider("stripe")}
            className={`rounded-md px-3 py-2 font-medium transition ${
              provider === "stripe"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            💳 Card / Wallet
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={provider === "flutterwave"}
            onClick={() => setProvider("flutterwave")}
            className={`rounded-md px-3 py-2 font-medium transition ${
              provider === "flutterwave"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            📱 Mobile Money
          </button>
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={busy}
        className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {busy
          ? "Opening checkout…"
          : provider === "flutterwave"
            ? `Pay with MoMo — ${price}`
            : `Buy Now — ${price}`}
      </button>

      <p className="text-center text-xs text-slate-400">
        {provider === "flutterwave"
          ? `Secure checkout from ${storeName} — MTN MoMo, Orange Money & local cards.`
          : providerReady
            ? `Secure checkout from ${storeName} — cards & Apple Pay / Google Pay.`
            : "Demo mode — no Stripe key configured. Checkout is simulated."}
      </p>

      {demo && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">{demo.message}</p>
          {demo.downloadUrl && (
            <a
              href={demo.downloadUrl}
              className="mt-2 inline-block font-medium text-emerald-700 underline hover:text-emerald-900"
            >
              Open your demo delivery link →
            </a>
          )}
          {!demo.downloadUrl && (
            <p className="mt-2 text-xs">
              Upload a PDF in the{" "}
              <a href="/admin" className="underline">
                admin dashboard
              </a>{" "}
              first, then try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
