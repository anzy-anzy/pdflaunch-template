/**
 * Client-safe view of the template config.
 *
 * Server-only lib/config.ts reads files + secrets; components with
 * "use client" (like BuyButton) must NOT import it. This module exposes the
 * same values as static constants for the UI layer.
 *
 * Note: env overrides only apply server-side. Pages that want env-aware
 * branding read lib/config.ts and pass the values down as props (the pattern
 * used on the landing page + header).
 */
import productConfig from "@/config/product.json";

const jsonProduct = productConfig.product ?? {};
const jsonStore = productConfig.store ?? {};

export const store = {
  storeName: jsonStore.storeName ?? "PDFLaunch Demo Store",
  logoUrl: jsonStore.logoUrl ?? jsonProduct.coverImage ?? "/cover.png",
  supportEmail: jsonStore.supportEmail ?? "complainhere40@outlook.com",
} as const;

export const product = {
  title: jsonProduct.title ?? "Automated PDF Delivery",
  description: jsonProduct.description ?? "A digital PDF product, delivered automatically after checkout.",
  priceCents: jsonProduct.priceCents ?? 2900,
  currency: (jsonProduct.currency ?? "usd").toLowerCase(),
  coverImage: jsonProduct.coverImage ?? "/cover.png",
} as const;

export const security = {
  downloadLinkTtlHours: productConfig.security?.downloadLinkTtlHours ?? 72,
  watermark: productConfig.security?.watermark ?? true,
  watermarkOpacity: productConfig.security?.watermarkOpacity ?? 0.45,
  watermarkText: productConfig.security?.watermarkText ?? "Licensed to",
} as const;

export type ClientProduct = typeof product;
export type ClientStore = typeof store;
export type ClientSecurity = typeof security;

/* ------------------------------ formatting ------------------------------- */

/**
 * Format a price in the given currency ("usd" default). Client-safe.
 * Falls back to "$" when Intl cannot parse the currency code.
 */
export function formatPrice(
  priceCents: number,
  currency: string = "usd",
): string {
  try {
    return new Intl.NumberFormat(
      typeof navigator !== "undefined" ? navigator.language : "en-US",
      { style: "currency", currency: currency.toUpperCase() },
    ).format(priceCents / 100);
  } catch {
    return `$${(priceCents / 100).toFixed(2)}`;
  }
}