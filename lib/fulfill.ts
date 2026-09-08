/**
 * Shared order fulfillment pipeline — used by BOTH payment providers.
 *
 * Extracted from app/api/webhooks/stripe/route.ts so Stripe and Flutterwave
 * share one delivery path:
 *
 *   1. recordSale (with dedupe on referenceId — safe to call twice for the
 *      same payment, e.g. callback + webhook racing each other)
 *   2. watermark the master PDF with buyer name/email + purchase timestamp
 *   3. mint a single-use, expiring download token
 *   4. email the buyer the secure download link (Resend, or log as stub)
 */

import { getSecurityConfig } from "@/lib/config";
import { sendDeliveryEmail, downloadUrlFor } from "@/lib/email";
import { getWatermarkedPdf } from "@/lib/pdf";
import {
  createDownload,
  listSales,
  listUploads,
  recordSale,
  updateUpload,
  type SaleRecord,
} from "@/lib/store";

export type FulfillInput = {
  email: string;
  name: string;
  amountCents: number;
  currency: string;
  /** "stripe" | "flutterwave" (+ "-demo" variants) — stored on the sale. */
  provider: string;
  /** Unique per payment (Stripe session id / Flutterwave tx_ref). Dedupe key. */
  referenceId?: string;
  /** Stripe session id, when the payment came from Stripe. */
  sessionId?: string;
  /** Stripe PaymentIntent id, when available. */
  paymentIntentId?: string;
  /** Origin used to build the download link. Defaults to APP_BASE_URL. */
  baseUrl?: string;
};

export type FulfillResult = {
  sale: SaleRecord;
  /** True when a sale with this referenceId already existed — nothing re-sent. */
  deduped: boolean;
  /** Absolute download URL, or null when there was nothing to deliver. */
  downloadUrl: string | null;
};

export async function fulfillOrder(input: FulfillInput): Promise<FulfillResult> {
  const email = (input.email || "anonymous@example.com").toLowerCase();
  const customerName = input.name || "Valued Customer";

  // 0) Dedupe: the Flutterwave callback + webhook (or Stripe retries) can both
  //    fire for one payment — fulfill exactly once per referenceId.
  if (input.referenceId) {
    const existing = listSales().find(
      (s) => s.referenceId === input.referenceId,
    );
    if (existing) {
      console.log(
        `[fulfill] duplicate ${input.provider} payment ${input.referenceId} — already fulfilled, skipped.`,
      );
      return { sale: existing, deduped: true, downloadUrl: null };
    }
  }

  // 1) Record the sale for the admin dashboard (revenue + order count).
  const sale = recordSale({
    email,
    name: customerName,
    amountCents: input.amountCents,
    currency: input.currency,
    provider: input.provider,
    referenceId: input.referenceId,
    sessionId: input.sessionId,
    paymentIntentId: input.paymentIntentId,
  });

  // Pick the PDF to deliver. The template delivers the latest admin upload;
  // connect provider metadata (e.g. uploadId) if you sell multiple products.
  const upload = listUploads().at(-1);
  if (!upload) {
    console.warn(
      `[fulfill] ${input.provider} payment ${input.referenceId ?? sale.id} completed but no upload found — nothing to deliver. ` +
        "Upload a PDF from /admin first.",
    );
    return { sale, deduped: false, downloadUrl: null };
  }

  try {
    // 2) Watermark the master PDF with this buyer's details.
    const { deliveryPath, watermarked } = await getWatermarkedPdf(
      upload.filePath,
      { customerName, email, purchasedAt: new Date().toISOString() },
    );
    await updateUpload(upload.id, { deliveryPath });

    // 3) Mint the secure, expiring, single-use download link.
    const download = createDownload(
      upload.id,
      email,
      customerName,
      getSecurityConfig().downloadLinkTtlHours,
    );

    // 4) Email the link (Resend) or log it (stub).
    const baseUrl =
      input.baseUrl || process.env.APP_BASE_URL || "http://localhost:3000";
    const downloadUrl = downloadUrlFor(baseUrl, download);
    const result = await sendDeliveryEmail({
      to: email,
      downloadUrl,
      expiresAt: download.expiresAt,
    });

    console.log(
      `[fulfill] delivered "${upload.fileName}" (${watermarked ? "watermarked" : "unwatermarked"}) ` +
        `to ${email} via ${input.provider} + ${result.channel}${result.sent ? ` (${result.messageId})` : " (stub log)"}.`,
    );
    return { sale, deduped: false, downloadUrl };
  } catch (err) {
    // Never take a webhook/callback down with a delivery glitch — log and continue.
    console.error("[fulfill] delivery pipeline failed:", err);
    return { sale, deduped: false, downloadUrl: null };
  }
}
