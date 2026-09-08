import type { Metadata } from "next";
import "./globals.css";
import { getProductConfig, getStoreConfig } from "@/lib/config";
import { formatPrice } from "@/lib/site";

const DEFAULT_STORE = "PDFLaunch Demo Store";

export const metadata: Metadata = {
  title: {
    default: "PDFLaunch — Automated PDF delivery",
    template: "%s · PDFLaunch",
  },
  description:
    "Sell digital PDF products with automated, watermarked delivery — powered by Stripe, pdf-lib and Resend.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const product = getProductConfig();
  const store = getStoreConfig();
  const price = formatPrice(product.priceCents, product.currency);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <a href="/" className="flex items-center gap-2 font-semibold">
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={store.logoUrl}
                  alt={`${store.storeName} logo`}
                  className="h-8 w-8 rounded-lg object-cover"
                />
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
                  📄
                </span>
              )}
              {store.storeName || DEFAULT_STORE}
            </a>
            <div className="flex items-center gap-4 text-sm">
              {store.supportEmail && (
                <a
                  href={`mailto:${store.supportEmail}`}
                  className="hidden text-slate-600 hover:text-slate-900 sm:inline"
                >
                  Support
                </a>
              )}
              <a href="/admin" className="text-slate-600 hover:text-slate-900">
                Admin
              </a>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {product.priceCents > 0 ? price : "Free"}
              </span>
            </div>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}