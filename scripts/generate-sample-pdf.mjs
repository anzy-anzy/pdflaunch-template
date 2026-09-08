#!/usr/bin/env node
/**
 * Helper for local development: generates a small sample PDF you can upload
 * through /admin. Uses pdf-lib (already a dependency) so there is nothing
 * extra to install.
 *
 *   node scripts/generate-sample-pdf.mjs            -> sample.pdf
 *   node scripts/generate-sample-pdf.mjs out.pdf    -> out.pdf
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFile } from "node:fs/promises";

const outPath = process.argv[2] ?? "sample.pdf";

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);

for (let p = 1; p <= 4; p++) {
  const page = doc.addPage([612, 792]); // US Letter
  page.drawText(`Sample document — page ${p} of 4`, {
    x: 72,
    y: 720,
    size: 22,
    font,
    color: rgb(0.1, 0.12, 0.25),
  });
  page.drawText(
    "Upload me in the PDFLaunch admin dashboard to test watermarking,\n" +
      "checkout and delivery.",
    { x: 72, y: 680, size: 12, font, color: rgb(0.3, 0.3, 0.35) },
  );
}

const bytes = await doc.save();
await writeFile(outPath, bytes);
console.log(`Wrote ${outPath} (${bytes.length} bytes)`);