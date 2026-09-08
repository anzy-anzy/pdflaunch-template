/**
 * Minimal file-backed store for uploads, download tokens, and sales.
 *
 * This is intentionally simple (a JSON file under ./data) so the template runs
 * anywhere without a database. It is NOT a production store — swap in your own
 * persistence layer (Postgres/Redis/S3) behind these same functions when you
 * ship. The demo flow is:
 *
 *   1. Admin uploads the PDF        -> store.createUpload() saves the file + a token
 *   2. Buyer pays via Stripe        -> webhook resolves order -> store.recordSale()
 *                                     + store.createDownload()
 *   3. Buyer opens the email link   -> api/downloads/[token] validates + streams the file
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getFilesConfig } from "@/lib/config";

export type UploadRecord = {
  id: string;
  fileName: string;
  /** Path to the waterproof master PDF on disk. */
  filePath: string;
  /** Path to the watermarked copy, populated after the webhook runs. */
  deliveryPath?: string;
  createdAt: string; // ISO timestamp
};

export type DownloadRecord = {
  id: string;
  uploadId: string;
  /** Email the buyer supplied at checkout — stamped into the PDF. */
  email: string;
  /** Buyer's name — stamped into the PDF. */
  customerName: string;
  /** Expiry of the secure download link (ISO timestamp). */
  expiresAt: string;
  /** Single-use token in the /api/downloads/[token] URL. */
  token: string;
  createdAt: string;
  /** Set to true when the link has been consumed (single-use links). */
  used?: boolean;
};

export type SaleRecord = {
  id: string;
  /** Stripe session id (cs_...) when the payment came from Stripe. */
  sessionId?: string;
  /** Payment provider: "stripe" | "flutterwave" (+ "-demo" variants). */
  provider?: string;
  /** Unique per payment (Stripe session id / Flutterwave tx_ref). Dedupe key. */
  referenceId?: string;
  email: string;
  name: string;
  /** Amount paid, in the smallest currency unit (cents; whole units for XAF/JPY). */
  amountCents: number;
  /** ISO 4217 currency code, lowercase. */
  currency: string;
  /** Stripe PaymentIntent id when available. */
  paymentIntentId?: string;
  createdAt: string; // ISO timestamp
};

type StoreFile = {
  uploads: UploadRecord[];
  downloads: DownloadRecord[];
  sales: SaleRecord[];
};

const EMPTY: StoreFile = { uploads: [], downloads: [], sales: [] };

/* ------------------------------ persistence ----------------------------- */

function dataFile(): string {
  return path.join(process.cwd(), getFilesConfig().dataFile);
}

function uploadDir(): string {
  return path.join(process.cwd(), getFilesConfig().uploadDir);
}

function readStore(): StoreFile {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile(), "utf8")) as Partial<StoreFile>;
    // Tolerate stores written by older template versions without a sales array.
    return {
      uploads: Array.isArray(parsed.uploads) ? parsed.uploads : [],
      downloads: Array.isArray(parsed.downloads) ? parsed.downloads : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales : [],
    };
  } catch {
    return EMPTY;
  }
}

function writeStore(store: StoreFile): void {
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  fs.writeFileSync(dataFile(), JSON.stringify(store, null, 2));
}

function nowIso(): string {
  return new Date().toISOString();
}

/* -------------------------------- sales ---------------------------------- */

/**
 * Record a completed sale. Called from the payment webhooks on success (and
 * from the demo stubs so the dashboard shows local test purchases too).
 * Dedupes on referenceId: if a sale with the same referenceId already exists
 * (callback + webhook racing for one payment), the existing record is
 * returned and nothing is appended. Returns the stored record.
 */
export function recordSale(input: {
  email: string;
  name: string;
  amountCents: number;
  currency: string;
  createdAt?: string;
  sessionId?: string;
  paymentIntentId?: string;
  provider?: string;
  referenceId?: string;
}): SaleRecord {
  const store = readStore();
  if (input.referenceId) {
    const existing = store.sales.find(
      (s) => s.referenceId === input.referenceId,
    );
    if (existing) return existing;
  }
  const record: SaleRecord = {
    id: crypto.randomUUID(),
    sessionId: input.sessionId,
    provider: input.provider,
    referenceId: input.referenceId,
    email: (input.email || "anonymous@example.com").toLowerCase(),
    name: input.name || "Valued Customer",
    amountCents: input.amountCents,
    currency: (input.currency || "usd").toLowerCase(),
    paymentIntentId: input.paymentIntentId,
    createdAt: input.createdAt ?? nowIso(),
  };
  store.sales.push(record);
  writeStore(store);
  return record;
}

export function listSales(): SaleRecord[] {
  return readStore().sales;
}

/** Total revenue in cents (converted naively at 1:1 per record) + order count. */
export function salesTotals(): { revenueCents: number; count: number } {
  const sales = listSales();
  return sales.reduce(
    (acc, s) => ({
      revenueCents: acc.revenueCents + (s.amountCents || 0),
      count: acc.count + 1,
    }),
    { revenueCents: 0, count: 0 },
  );
}

/* -------------------------------- uploads ------------------------------- */

export function createUpload(
  fileName: string,
  fileBuffer: Buffer,
): UploadRecord {
  const id = crypto.randomUUID();
  const dir = uploadDir();
  fs.mkdirSync(dir, { recursive: true });

  // Sanitize the file name so it can never escape the upload directory.
  const safeName = path.basename(fileName).replace(/[^\w.\- ]/g, "_");
  const filePath = path.join(dir, `${id}-${safeName}`);

  fs.writeFileSync(filePath, fileBuffer);

  const record: UploadRecord = {
    id,
    fileName: safeName,
    filePath,
    createdAt: nowIso(),
  };
  const store = readStore();
  store.uploads.push(record);
  writeStore(store);
  return record;
}

export function getUpload(uploadId: string): UploadRecord | undefined {
  return readStore().uploads.find((u) => u.id === uploadId);
}

export function listUploads(): UploadRecord[] {
  return readStore().uploads;
}

export function updateUpload(
  uploadId: string,
  patch: Partial<UploadRecord>,
): UploadRecord | undefined {
  const store = readStore();
  const idx = store.uploads.findIndex((u) => u.id === uploadId);
  if (idx === -1) return undefined;
  store.uploads[idx] = { ...store.uploads[idx], ...patch };
  writeStore(store);
  return store.uploads[idx];
}

/* ------------------------------- downloads ------------------------------ */

export function createDownload(
  uploadId: string,
  email: string,
  customerName: string,
  ttlHours: number,
): DownloadRecord {
  const record: DownloadRecord = {
    id: crypto.randomUUID(),
    uploadId,
    email: email.toLowerCase(),
    customerName,
    token: crypto.randomBytes(24).toString("base64url"),
    expiresAt: new Date(Date.now() + ttlHours * 3600_000).toISOString(),
    createdAt: nowIso(),
  };
  const store = readStore();
  store.downloads.push(record);
  writeStore(store);
  return record;
}

export function consumeDownload(token: string): DownloadRecord | undefined {
  const store = readStore();
  const idx = store.downloads.findIndex((d) => d.token === token && !d.used);
  if (idx === -1) return undefined;

  const record = store.downloads[idx];
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    // Expired tokens are deleted on sight (single use, so nothing to keep).
    store.downloads.splice(idx, 1);
    writeStore(store);
    return undefined;
  }

  // Single-use: mark consumed before the file is streamed.
  store.downloads[idx] = { ...record, used: true };
  writeStore(store);
  return record;
}