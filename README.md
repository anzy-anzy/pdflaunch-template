# PDFLaunch

A resellable **Next.js (App Router) + TypeScript + Tailwind CSS** template for
automated PDF digital-product delivery:

> Upload a PDF → sell it via Stripe Checkout (cards + Apple Pay / Google Pay)
> or Flutterwave (MTN MoMo / Orange Money + local cards for Cameroon)
> → each buyer receives a **watermarked copy** with their name/email/purchase-time
> on every page, via a **secure, single-use, expiring download link** sent by email.

100% whitelabel: every store-specific value (name, logo, price, currency, Stripe
and email keys, support address) lives in **one `.env.local` file** — no code
changes needed. The template runs **end-to-end without any real credentials**:
Stripe and email are stubbed with graceful fallbacks so you can click through
the whole flow immediately, then drop in your keys when you're ready to sell.

---

## ✨ What's included

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Public product landing page — title, description, price, **cover image**, store branding, support link, **Buy Now** |
| `components/BuyButton.tsx` | Client button → `POST /api/checkout` (Stripe) or `POST /api/checkout/flutterwave` (Mobile Money) → hosted checkout redirect or demo panel |
| `app/admin/AdminDashboard.tsx` | Admin dashboard: **sales overview (revenue + 14-day chart)**, upload UI, payment/email fields, watermark toggle |
| `app/admin/LoginForm.tsx` | Password form at `/admin` (shown when `ADMIN_PASSWORD` is set and no session) |
| `app/api/admin/login/route.ts` | `POST` password check (`timingSafeEqual`) → sets the HttpOnly `pdflaunch_admin` cookie |
| `app/api/admin/logout/route.ts` | `POST` clears the admin session cookie |
| `lib/admin.ts` | Admin lock helpers — `isAdminLocked()`, HMAC token create/verify, `requireAdmin()` guard |
| `app/api/sales/route.ts` | `GET` revenue + orders for the dashboard |
| `app/api/checkout/route.ts` | Stripe Checkout session creator (global cards + wallets, or demo stub) |
| `app/api/checkout/flutterwave/route.ts` | Flutterwave hosted payment creator (MTN MoMo / Orange Money / cards, or demo stub) |
| `app/api/checkout/flutterwave/callback/route.ts` | `GET` redirect target — re-verifies the transaction via the API, fulfills, redirects to the download |
| `app/api/webhooks/stripe/route.ts` | `checkout.session.completed` → shared fulfillOrder() (record sale → watermark → token → email) |
| `app/api/webhooks/flutterwave/route.ts` | `charge.completed` (verif-hash checked) → re-verify via API → shared fulfillOrder() |
| `lib/flutterwave.ts` | Flutterwave v3 helpers (create payment, verify transaction, XAF-safe amounts) |
| `lib/fulfill.ts` | Shared fulfillment pipeline used by both providers (record → watermark → link → email, deduped) |
| `app/api/downloads/[token]/route.ts` | Secure, single-use, expiring download endpoint |
| `app/api/upload/route.ts` | Admin PDF upload (multipart or raw body) |
| `lib/config.ts` | All server config reads (env overrides + `config/product.json`) |
| `lib/site.ts` | Client-safe config + currency formatting (`formatPrice`) |
| `lib/pdf.ts` | pdf-lib footer watermark (name + email + timestamp, every page) |
| `lib/email.ts` | Resend delivery email → SendGrid fallback → log stub |
| `lib/store.ts` | File/JSON store for uploads + download tokens + **sales** |
| `config/product.json` | Store identity, product, watermark, link TTL defaults |
| `public/cover.png` | Placeholder cover image (swap for your own) |
| `scripts/generate-sample-pdf.mjs` | Generates a sample PDF for testing |

---

## 🚀 Buyer setup — under 10 minutes

```bash
# 1. Copy the env contract and open it
cp .env.example .env.local
```

**2. Edit these values in `.env.local`** (all of them, once each — there are
exactly these eight to make a store yours):

| # | Variable | You set it to |
| --- | --- | --- |
| 1 | `STORE_NAME` | Your store / brand name |
| 2 | `SUPPORT_EMAIL` | Your support inbox |
| 3 | `PRODUCT_TITLE` | Your PDF's title (also the checkout line item) |
| 4 | `PRODUCT_DESCRIPTION` | Your landing-page sales copy |
| 5 | `PRODUCT_PRICE_CENTS` | Your price in cents (e.g. `2900` = $29.00) |
| 6 | `PRODUCT_COVER_IMAGE` | `/cover.png` (replace `public/cover.png` with your art) |
| 7 | `STRIPE_SECRET_KEY` | Your `sk_test_…` key (from Stripe Dashboard) |
| 8 | `RESEND_API_KEY` | Your `re_…` key (or use `SENDGRID_API_KEY`) |

Optional but recommended: `STORE_LOGO_URL`, `EMAIL_FROM`, `APP_BASE_URL`,
`PRODUCT_CURRENCY` (defaults to `usd`, so you can skip it).

```bash
# 3. Install deps (a minute, one-time)
npm install

# 4. Run it
npm run dev
# → http://localhost:3000
```

Your store is up. Now make it deliver:

```bash
# 5. Create a sample PDF and upload it via Admin
npm run sample:pdf
# open http://localhost:3000/admin → choose sample.pdf → Upload

# 6. Test the buy flow
# open http://localhost:3000 → click "Buy Now" (demo mode simulates checkout,
# records the sale in the dashboard, and returns a link that walks the whole
# delivery chain: watermark → secure download token → (logged) delivery email).
# Open the link twice: the second time is rejected (single-use).
```

**7. Go live (wire webhooks + email)**

Stripe webhooks:
1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
   `https://<your-domain>/api/webhooks/stripe`, subscribe to
   `checkout.session.completed` (and `checkout.session.expired`).
2. Copy the **webhook signing secret** into `STRIPE_WEBHOOK_SECRET`.

Email:
1. Resend: create an API key and verify a sender domain, then set
   `EMAIL_FROM` to a verified sender (e.g. `Your Store <delivery@yourdomain.com>`).
2. No Resend? Set `SENDGRID_API_KEY` (`SG.…`) instead — the template falls back
   to SendGrid automatically. If neither is set, the delivery link is logged.

```bash
# 8. Deploy
# Deploy to Vercel, Netlify, or any Node host:
npm run build && npm start
# Set the same .env.local values as production env vars; set APP_BASE_URL to
# your production domain so download links in emails point at the right host.
```

That's it — you're selling.

---

## ⚙️ Configuration reference

Everything flows through `lib/config.ts`. Priority: **environment variable >
`config/product.json`**. Secrets come from the environment only.

| Env var | Default | Purpose |
| --- | --- | --- |
| `STORE_NAME` | PDFLaunch Demo Store | Header / landing brand name |
| `STORE_LOGO_URL` | `/cover.png` | Public logo URL (or CDN) |
| `SUPPORT_EMAIL` | complainhere40@outlook.com | `mailto:` link in footer + email |
| `PRODUCT_TITLE` | "The Founder's Guide…" | Landing page + checkout item name |
| `PRODUCT_DESCRIPTION` | … | Landing page copy |
| `PRODUCT_PRICE_CENTS` | `2900` | Unit amount (`$29.00`) |
| `PRODUCT_CURRENCY` | `usd` | ISO 4217 currency (lowercase) |
| `PRODUCT_COVER_IMAGE` | `/cover.png` | Landing page cover (path or URL) |
| `WATERMARK_ENABLED` | `true` | Stamp buyer details on every page |
| `DOWNLOAD_LINK_TTL_HOURS` | `72` | Download link lifetime |
| `STRIPE_SECRET_KEY` | — | Stripe API key (`sk_test_…` / `sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | — | Verifies `/api/webhooks/stripe` signatures |
| `STRIPE_PUBLISHABLE_KEY` | — | [Optional] reserved for future Stripe.js work |
| `FLUTTERWAVE_SECRET_KEY` | — | Flutterwave API key (`FLWSECK_TEST…` / `FLWSECK…`) — enables the Mobile Money option |
| `FLUTTERWAVE_WEBHOOK_HASH` | — | Verifies `/api/webhooks/flutterwave` verif-hash header |
| `RESEND_API_KEY` | — | Delivery email via Resend (`re_…`) |
| `SENDGRID_API_KEY` | — | Delivery email fallback via SendGrid (`SG.…`) |
| `EMAIL_FROM` | PDFLaunch <delivery@example.com> | Verified sender address |
| `ADMIN_PASSWORD` | — (unset = open) | Password for `/admin` + `/api/upload` + `/api/sales` (see [Admin password](#-admin-password-lock-or-open)) |
| `APP_BASE_URL` | request host | Public origin for download/email links |

> **Zero-decimal currencies**: Stripe charges in the smallest unit — for
> `jpy` set `PRODUCT_PRICE_CENTS` to the whole-yen price (e.g. `2900` = ¥2,900).
> Same rule for Flutterwave: `xaf`/`xof` have no minor unit, so with
> `PRODUCT_CURRENCY=xaf`, `PRODUCT_PRICE_CENTS=5000` charges 5,000 XAF
> (the template converts automatically — no decimals are ever sent).

## 💳 Flutterwave (Mobile Money — Cameroon)

Flutterwave supports MTN Mobile Money in Cameroon (via its MTN partnership)
and is licensed there, so it is the gateway for the home market: buyers pay
with MTN MoMo, Orange Money, or local/international cards on Flutterwave's
hosted checkout page.

Setup:

1. Create an account at https://dashboard.flutterwave.com and copy your
   **secret key** (`FLWSECK_TEST…` for testing, `FLWSECK…` live) into
   `FLUTTERWAVE_SECRET_KEY`. The landing page's **Mobile Money toggle**
   appears automatically once the key is set.
2. Dashboard → Settings → Webhooks → **add endpoint**
   `https://<your-domain>/api/webhooks/flutterwave`, subscribe to
   `charge.completed`, and paste the **secret hash** into
   `FLUTTERWAVE_WEBHOOK_HASH`. The route checks the `verif-hash` header
   (constant-time) and re-verifies every event via
   `GET /v3/transactions/:id/verify` before delivering — the webhook body is
   never trusted on its own.
3. Cameroon pricing: set `PRODUCT_CURRENCY=xaf` in `.env.local`
   (e.g. `PRODUCT_PRICE_CENTS=5000` = 5,000 XAF).

Test in demo mode (no key): click the Stripe "Buy Now" flow, or exercise the
Flutterwave stubs directly:

```bash
# Demo checkout stub — records a flutterwave-demo sale, mints a demo link
curl -X POST http://localhost:3000/api/checkout/flutterwave \
  -H 'Content-Type: application/json' \
  -d '{"email":"buyer@example.com","name":"Ada Lovelace"}'

# Webhook stub (FLUTTERWAVE_WEBHOOK_HASH unset → verification skipped + logged)
curl -X POST http://localhost:3000/api/webhooks/flutterwave \
  -H 'Content-Type: application/json' \
  -d '{"event":"charge.completed","data":{"id":123456,"tx_ref":"pdflaunch_demo_1"}}'
```

Note: the webhook path always re-verifies via the Flutterwave API, so with no
real key it logs the attempt and returns `{ received: true }` without
fulfilling — delivery in demo mode happens through the checkout stub above
(or the redirect callback with a real transaction).

## 🔒 Admin password (lock or open)

The admin area (`/admin` dashboard, `/api/upload`, `/api/sales`) is **open by
default** — demo mode, zero configuration, perfect for the local click-through.
When you deploy for real, set `ADMIN_PASSWORD` in `.env.local`:

- **`ADMIN_PASSWORD` unset** → admin stays open (same behaviour as the demo).
- **`ADMIN_PASSWORD` set** → the lock engages:

  - `GET /admin` with no valid session shows a **password form**.
  - `POST /api/admin/login` with `{ "password": "..." }` checks the password
    (constant-time) and sets an **HttpOnly, SameSite=Lax `pdflaunch_admin`**
    cookie — an HMAC token keyed by the password, so no server state/DB needed.
  - `POST /api/admin/logout` clears the cookie; the dashboard shows a
    **Sign out** button.
  - `/api/upload` and `/api/sales` return **401** without a valid session.
  - Checkout, webhooks and download links stay **public** (buyers never log in).

Generate a strong password:

```bash
openssl rand -base64 32
# or:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"YOUR_ADMIN_PASSWORD"}'
# → 200 + Set-Cookie: pdflaunch_admin=… ; reuse that cookie for /api/upload
```

> Keep `ADMIN_PASSWORD` a long random secret — it is both the login password
> and the HMAC key for the session token, so treat it like an API key.

## 🧪 API reference

| Route | Method | Body | Returns |
| --- | --- | --- | --- |
| `/api/checkout` | `POST` | `{ "email"?: string, "name"?: string }` | `{ url }` or `{ demo, downloadUrl }` |
| `/api/checkout/flutterwave` | `POST` | `{ "email"?: string, "name"?: string }` | `{ url, tx_ref }` or `{ demo, downloadUrl }` |
| `/api/checkout/flutterwave/callback` | `GET` | `?tx_ref=…&transaction_id=…&status=…` (Flutterwave redirect) | `302` to download URL or `/?checkout=success` / `/?checkout=failed` |
| `/api/webhooks/stripe` | `POST` | Stripe webhook payload | `{ received: true }` |
| `/api/webhooks/flutterwave` | `POST` | Flutterwave webhook payload (`charge.completed` + `verif-hash` header) | `{ received: true }` |
| `/api/sales` | `GET` | — | `{ sales, totals: { revenueCents, count } }` |
| `/api/downloads/[token]` | `GET` | — | Watermarked PDF (or `410`) |
| `/api/upload` | `POST` | `multipart` `file` (or raw PDF body) | `{ ok, upload }` |

### Simulating a Stripe webhook locally

```bash
curl -X POST http://localhost:3000/api/webhooks/stripe \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "checkout.session.completed",
    "data": { "object": {
      "id": "cs_test_123",
      "amount_total": 2900,
      "currency": "usd",
      "customer_details": { "email": "buyer@example.com", "name": "Ada Lovelace" },
      "metadata": {}
    } }
  }'
```

With `STRIPE_WEBHOOK_SECRET` unset the handler logs the payload and proceeds
(demo stub). With the secret set, signatures are verified via
`stripe.webhooks.constructEvent`. Each completed event records a sale —
refresh `/admin` to see it in the chart.

## 🗺️ Customizing for your own product

- **Sell a different product**: edit `config/product.json` or the env vars —
  no code changes.
- **Replace the cover**: drop your art over `public/cover.png` (or point
  `PRODUCT_COVER_IMAGE` at a URL).
- **Multiple products / per-product PDFs**: pass the chosen product's
  `uploadId` through checkout `metadata`, and resolve it in the webhook
  (currently `listUploads().at(-1)`).
- **Better storage**: replace the JSON-file store with a DB — the route layer
  already depends only on `createUpload`/`createDownload`/`consumeDownload`/
  `recordSale`.
- **Design**: all UI is Tailwind utility classes in `app/` + `components/`.

> ⚠️ **Storage note** — the demo store (`lib/store.ts`) writes JSON + PDFs
> under `./data/` on local disk (gitignored). Fine for the template demo; swap
> in Postgres / Redis / S3 before selling real products — the calling code
> (routes) doesn't need to change.

## 📄 License

MIT — resell, rebrand, and build on top of PDFLaunch freely.

---

*Built as an MVP template: clean, modular, config-driven, and fully clickable
without credentials.*