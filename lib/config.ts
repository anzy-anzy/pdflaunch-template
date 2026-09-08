/**
 * Central configuration for the PDFLaunch template.
 *
 * Every tunable value flows through this module:
 *  - store identity (storeName, logoUrl, supportEmail) + product
 *    (title, description, price, currency, coverImage) come from
 *    `config/product.json`
 *  - any key can be overridden by an environment variable (see .env.example)
 *  - secrets (Stripe, Resend/SendGrid) come from the environment only — never
 *    checked into a config file
 *
 * ⚠️ SERVER-ONLY module: it uses `node:fs`/`node:path`. Never import it from a
 * "use client" component — use `lib/site.ts` (client-safe) instead, which
 * reads the same config without Node builtins.
 */
import "server-only";

import fs from "node:fs";
import path from "node:path";
import productConfig from "@/config/product.json";

export type ProductConfig = {
  title: string;
  description: string;
  priceCents: number;
  /** ISO 4217 code, lowercase — defaults to "usd". */
  currency: string;
  /** Cover image: public path (/cover.png) or full URL. */
  coverImage: string;
};

export type StoreConfig = {
  storeName: string;
  logoUrl: string;
  supportEmail: string;
};

export type FilesConfig = {
  uploadDir: string;
  dataFile: string;
};

export type SecurityConfig = {
  downloadLinkTtlHours: number;
  watermark: boolean;
  watermarkOpacity: number;
  watermarkText: string;
};

/**
 * Read the JSON config file from disk on every call. This keeps the template
 * easy to resell: a buyer can edit config/product.json and restart the server
 * without touching a line of code. (Caching with an fs.watch pattern is a
 * natural upgrade if you want hot reload.)
 */
function readJsonConfig<T>(relPath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(relPath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(
      `[config] could not read ${relPath} (${(err as Error).message}); using fallback.`,
    );
    return fallback;
  }
}

function fileConfig(): Record<string, unknown> {
  return readJsonConfig(
    path.join(process.cwd(), "config", "product.json"),
    productConfig as unknown as Record<string, unknown>,
  );
}

/* ------------------------------- store ------------------------------------ */

export function getStoreConfig(): StoreConfig {
  const file = fileConfig();
  const store = (file.store ?? {}) as Partial<StoreConfig>;
  const product = (file.product ?? {}) as Partial<ProductConfig>;

  return {
    storeName: fromEnv("STORE_NAME") || store.storeName || "PDFLaunch Demo Store",
    logoUrl:
      fromEnv("STORE_LOGO_URL") ||
      store.logoUrl ||
      product.coverImage ||
      "/cover.png",
    supportEmail:
      fromEnv("SUPPORT_EMAIL") || store.supportEmail || "complainhere40@outlook.com",
  };
}

/* ------------------------------- product ---------------------------------- */

export function getProductConfig(): ProductConfig {
  const file = fileConfig();
  const p = (file.product ?? {}) as Partial<ProductConfig>;

  return {
    title: fromEnv("PRODUCT_TITLE") || p.title || "Automated PDF Delivery",
    description:
      fromEnv("PRODUCT_DESCRIPTION") ||
      p.description ||
      "A digital PDF product, delivered automatically after checkout.",
    priceCents: numericEnv("PRODUCT_PRICE_CENTS", p.priceCents ?? 2900),
    currency: (fromEnv("PRODUCT_CURRENCY") || p.currency || "usd").toLowerCase(),
    coverImage: fromEnv("PRODUCT_COVER_IMAGE") || p.coverImage || "/cover.png",
  };
}

export function getFilesConfig(): FilesConfig {
  const file = fileConfig();
  const files = (file.files ?? {}) as Partial<FilesConfig>;
  return {
    uploadDir: files.uploadDir || "data/uploads",
    dataFile: files.dataFile || "data/store.json",
  };
}

export function getSecurityConfig(): SecurityConfig {
  const file = fileConfig();
  const security = (file.security ?? {}) as Partial<SecurityConfig>;
  return {
    downloadLinkTtlHours: numericEnv(
      "DOWNLOAD_LINK_TTL_HOURS",
      security.downloadLinkTtlHours ?? 72,
    ),
    watermark: booleanEnv("WATERMARK_ENABLED", security.watermark ?? true),
    watermarkOpacity: numericEnv(
      "WATERMARK_OPACITY",
      security.watermarkOpacity ?? 0.45,
    ),
    watermarkText:
      fromEnv("WATERMARK_TEXT") || security.watermarkText || "Licensed to",
  };
}

/* ------------------------- env parsing helpers ------------------------- */

function fromEnv(key: string): string {
  return process.env[key]?.trim() ?? "";
}

function numericEnv(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function booleanEnv(key: string, fallback: boolean): boolean {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

/* ------------------------------- secrets -------------------------------- */

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_"));
}

/**
 * True when a real Flutterwave secret key is set — enables the Mobile Money
 * (MTN MoMo / Orange Money) + local cards option at checkout.
 */
export function isFlutterwaveConfigured(): boolean {
  const key = process.env.FLUTTERWAVE_SECRET_KEY?.trim() ?? "";
  return key.startsWith("FLWSECK") && !key.includes("REPLACE_ME");
}

export function isEmailConfigured(): boolean {
  return (
    Boolean(process.env.RESEND_API_KEY?.startsWith("re_")) ||
    Boolean(process.env.SENDGRID_API_KEY?.startsWith("SG."))
  );
}

/**
 * Public origin used to build download links. Prefer APP_BASE_URL when set
 * (set it to your production domain). During local development we fall back to
 * the incoming request's host header, which keeps links correct through
 * preview/proxy hosts.
 */
export function getBaseUrl(requestUrl?: string): string {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, "");
  }
  if (requestUrl) {
    return new URL(requestUrl).origin;
  }
  return "http://localhost:3000";
}