/**
 * PDF watermarking with pdf-lib.
 *
 * Stamps a "Licensed to <name> <email>" footer on every page of a PDF, plus
 * the licensing timestamp. The watermarked copy becomes the file the buyer
 * downloads, so a shared PDF always traces back to the person who bought it.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSecurityConfig } from "@/lib/config";
import type { DownloadRecord } from "@/lib/store";

export type WatermarkOptions = {
  /** Buyer's name as given at checkout. */
  customerName: string;
  /** Buyer's email as given at checkout. */
  email: string;
  /** ISO timestamp of the purchase. Defaults to now. */
  purchasedAt?: string;
  /** When false (config WATERMARK_ENABLED=false), the source is returned untouched. */
  enabled?: boolean;
};

export type PdfResult = {
  /** Final buffer (watermarked or original). */
  buffer: Buffer;
  /** Whether a watermark was applied. */
  watermarked: boolean;
};

export const DEFAULT_FONT_SIZE = 9;

/**
 * Read a PDF from disk, stamp a footer on every page, and return the result.
 * Falls back to the original bytes when the file is not a readable PDF.
 */
export async function watermarkPdfFile(
  uploadFilePath: string,
  options: Pick<WatermarkOptions, "customerName" | "email" | "purchasedAt" | "enabled">,
): Promise<PdfResult> {
  const config = getSecurityConfig();
  const enabled = options.enabled ?? config.watermark;

  if (!enabled) {
    return { buffer: await readFileBuffer(uploadFilePath), watermarked: false };
  }

  const original = await readFileBuffer(uploadFilePath);
  return watermarkPdfBuffer(original, { ...options, enabled: true });
}

/**
 * Stamp "Licensed to <name> <email>" + purchase date and time on every page.
 *
 * The stamp is placed in the bottom margin (usually blank), slightly
 * transparent, so it protects the PDF without obscuring the content.
 */
export async function watermarkPdfBuffer(
  pdfBuffer: Buffer,
  options: WatermarkOptions,
): Promise<PdfResult> {
  const config = getSecurityConfig();
  if (options.enabled === false) {
    return { buffer: pdfBuffer, watermarked: false };
  }

  const doc = await PDFDocument.load(pdfBuffer, {
    // Keep the original metadata (title/author) intact.
    updateMetadata: false,
  });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  if (pages.length === 0) {
    return { buffer: pdfBuffer, watermarked: false };
  }

  const purchasedAt = options.purchasedAt ?? new Date().toISOString();
  const purchaseDate = new Date(purchasedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const stamp = `${config.watermarkText} ${options.customerName} <${options.email}> \u00b7 ${purchaseDate} \u00b7 Order ${shortHash(options.email)}`;

  for (const page of pages) {
    const { width, height } = page.getSize();
    const fontSize = DEFAULT_FONT_SIZE;
    const textWidth = font.widthOfTextAtSize(stamp, fontSize);

    page.drawText(stamp, {
      x: (width - textWidth) / 2, // centered
      y: 18, // bottom margin
      size: fontSize,
      font,
      color: rgb(0.35, 0.4, 0.75),
      opacity: config.watermarkOpacity,
    });
  }

  const bytes = await doc.save();
  return { buffer: Buffer.from(bytes), watermarked: true };
}

/* ------------------------------- utilities ------------------------------ */

function readFileBuffer(filePath: string): Promise<Buffer> {
  // Import lazily — this module is also imported by client components, so we
  // cannot require node:fs at the top level. See getWatermarkedPdf below.
  return import("node:fs/promises").then((fs) => fs.readFile(filePath));
}

/**
 * Convenience wrapper for the webhook flow: stamp the uploaded PDF with the
 * buyer's details, save the watermarked copy to disk, and return its path.
 */
export async function getWatermarkedPdf(
  uploadFilePath: string,
  options: Pick<WatermarkOptions, "customerName" | "email" | "purchasedAt">,
): Promise<{ deliveryPath: string; watermarked: boolean }> {
  const result = await watermarkPdfFile(uploadFilePath, options);

  if (!result.watermarked) {
    return { deliveryPath: uploadFilePath, watermarked: false };
  }

  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const deliveryPath =
    uploadFilePath.replace(/\.pdf$/i, "") + `.watermarked.pdf`;
  await mkdir(dirname(deliveryPath), { recursive: true });
  await writeFile(deliveryPath, result.buffer);
  return { deliveryPath, watermarked: true };
}

/**
 * Short stable id derived from an email, used to tie a watermarked file back
 * to its buyer even if the license line is cropped.
 */
export function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(4, "0");
}