===============================================================================
 PDFLaunch — Resellable Digital-PDF Delivery Template
 Export package (clean, buyer-ready)
===============================================================================

WHAT THIS PACKAGE IS
--------------------
A Next.js (App Router) + TypeScript + Tailwind CSS template for automated
PDF digital-product delivery:

  Upload a PDF  ->  sell it via Stripe Checkout (cards + Apple Pay / Google
                     Pay) or Flutterwave (MTN MoMo / Orange Money + local
                     cards, Cameroon-friendly, XAF support)
  ->  each buyer receives a watermarked copy (their name + email + purchase
      time on every page) via a secure, single-use, expiring download link
      sent by email.

100% whitelabel: every store-specific value lives in ONE file
(.env.example -> .env.local). No code changes. The template also runs
end-to-end in demo mode with zero credentials so you can click through the
entire flow before dropping in real keys.

WHAT'S INSIDE
-------------
  app/                  Next.js App Router pages + API routes
  components/           Client components (BuyButton, dashboard pieces)
  config/product.json   Store/product defaults (env vars override these)
  lib/                  Config, checksout helpers, watermarking (pdf-lib),
                        email (Resend -> SendGrid -> log stub), file store
  public/cover.png      Placeholder cover art (swap for yours)
  scripts/              sample-PDF generator (npm run sample:pdf)
  .env.example          The single whitelabel config contract
  README.md             Full setup + API reference + customization guide

Excluded on purpose: node_modules, .next, the runtime data/ directory
(demo uploads/sales), .env.local, and any sample PDFs — nothing private or
machine-specific ships in this package.

QUICK START (full walkthrough in README.md)
-------------------------------------------
  1. cp .env.example .env.local
  2. Fill in the 8 required values (table below)
  3. npm install
  4. npm run dev   ->  http://localhost:3000
  5. npm run sample:pdf, then upload sample.pdf via /admin
  6. Click "Buy Now" on the landing page to test the demo flow
  7. Wire real Stripe/Flutterwave webhooks + email (README steps 7-8)
  8. npm run build && npm start  ->  deploy to Vercel/Netlify/any Node host

VERIFY THIS PACKAGE IS SOUND
----------------------------
  npm install
  npm run build        # must exit 0 (TypeScript + Next.js production build)
  npm run dev          # then open http://localhost:3000 and /admin

THE 8 REQUIRED ENV VARS (all in .env.local)
--------------------------------------------
  1. STORE_NAME           Your store / brand name
  2. SUPPORT_EMAIL        Your support inbox (complainhere40@outlook.com)
  3. PRODUCT_TITLE        Your PDF's title (also the checkout line item)
  4. PRODUCT_DESCRIPTION  Your landing-page sales copy
  5. PRODUCT_PRICE_CENTS  Price in cents (2900 = $29.00)
  6. PRODUCT_COVER_IMAGE  /cover.png (replace public/cover.png with your art)
  7. STRIPE_SECRET_KEY    Your sk_test_... / sk_live_... key
  8. RESEND_API_KEY       Your re_... key (or set SENDGRID_API_KEY instead)

Optional but recommended: STORE_LOGO_URL, EMAIL_FROM, APP_BASE_URL,
PRODUCT_CURRENCY (defaults to usd — set xaf for Cameroon mobile money).

Flutterwave (mobile money) needs: FLUTTERWAVE_SECRET_KEY +
FLUTTERWAVE_WEBHOOK_HASH. See README "Flutterwave (Mobile Money — Cameroon)".

SUPPORT / CONTACT
-----------------
For template support or custom builds, email
    complainhere40@outlook.com

LICENSE
-------
MIT — resell, rebrand, and build on top freely (see README).
===============================================================================