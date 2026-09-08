import { getProductConfig, getStoreConfig, isFlutterwaveConfigured, isStripeConfigured } from "@/lib/config";
import { formatPrice } from "@/lib/site";
import BuyButton from "@/components/BuyButton";

/**
 * Public product landing page. Everything shown here (title, description,
 * price, cover, store name, support email) flows from lib/config.ts — edit
 * config/product.json or an env var to sell a different product without
 * touching this template.
 */
export default function HomePage() {
  const product = getProductConfig();
  const store = getStoreConfig();
  const stripeReady = isStripeConfigured();
  const flutterwaveReady = isFlutterwaveConfigured();
  const price = formatPrice(product.priceCents, product.currency);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <section className="grid items-center gap-12 md:grid-cols-2">
        {/* Copy + CTA */}
        <div>
          <div className="flex items-center gap-2">
            {/* Store logo — falls back to the 📄 mark when unset */}
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={store.logoUrl}
                alt={`${store.storeName} logo`}
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-600 text-xl text-white">
                📄
              </span>
            )}
            <p className="text-sm font-semibold text-slate-700">{store.storeName}</p>
          </div>

          <p className="mt-6 mb-3 inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Digital product · Instant delivery
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900">
            {product.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            {product.description}
          </p>

          <div className="mt-6 flex items-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Watermarked with your name
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Secure expiring download link
            </span>
          </div>

          <div className="mt-10 max-w-sm">
            <BuyButton product={product} storeName={store.storeName} stripeReady={stripeReady} flutterwaveReady={flutterwaveReady} />
          </div>

          {store.supportEmail && (
            <p className="mt-6 text-sm text-slate-500">
              Questions?{" "}
              <a
                href={`mailto:${store.supportEmail}`}
                className="font-medium text-indigo-600 underline-offset-2 hover:underline"
              >
                {store.supportEmail}
              </a>
            </p>
          )}
        </div>

        {/* Cover image */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {product.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.coverImage}
              alt={`Cover of ${product.title}`}
              className="mx-auto aspect-[3/4] w-full max-w-xs rounded-xl object-cover"
            />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-slate-100 text-7xl">
              📕
            </div>
          )}
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">{product.title}</p>
              <p className="text-sm text-slate-500">
                PDF · {product.currency.toUpperCase()} · {price}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {stripeReady ? "Live" : "Demo"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {flutterwaveReady
              ? "Payments via Visa, Mastercard, Amex, Apple Pay, Google Pay, MTN MoMo & Orange Money"
              : "Payments via Visa, Mastercard, Amex, Apple Pay & Google Pay"}
          </p>
        </div>
      </section>

      {!stripeReady && (
        <aside className="mt-16 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Running in demo mode.</p>
          <p className="mt-1">
            Add <code className="rounded bg-amber-100 px-1">STRIPE_SECRET_KEY</code> and{" "}
            <code className="rounded bg-amber-100 px-1">RESEND_API_KEY</code> (or{" "}
            <code className="rounded bg-amber-100 px-1">SENDGRID_API_KEY</code>) to{" "}
            <code className="rounded bg-amber-100 px-1">.env.local</code> (see{" "}
            <code className="rounded bg-amber-100 px-1">.env.example</code>) to enable real
            checkout and email delivery.
          </p>
        </aside>
      )}
    </div>
  );
}