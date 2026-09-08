/**
 * GET /api/downloads/[token]
 *
 * Validates the single-use download token, checks expiry, and streams the
 * watermarked PDF to the buyer. Invalid, expired, or already-used tokens get
 * a friendly 410 page instead of the file.
 *
 * NOTE: real deployments should stream from object storage (S3/R2) rather
 * than disk — the file lives under ./data here for template simplicity.
 */
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { consumeDownload, getUpload } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const download = consumeDownload(token);

  if (!download) {
    return NextResponse.json(
      {
        error: "Link invalid, expired, or already used.",
        hint: "Your download link works once and expires after a few days. " +
          "If you believe this is a mistake, contact the seller.",
      },
      { status: 410 },
    );
  }

  const upload = getUpload(download.uploadId);
  const filePath = upload?.deliveryPath ?? upload?.filePath;

  if (!upload || !filePath || !fs.existsSync(filePath)) {
    console.error(
      `[downloads] token resolved but file missing for upload ${download.uploadId}`,
    );
    return NextResponse.json(
      { error: "File not found — the seller may have removed it." },
      { status: 404 },
    );
  }

  const stat = fs.statSync(filePath);
  const disposition = `attachment; filename="${encodeURIComponent(
    upload.fileName.replace(/\.pdf$/i, "") + "-licensed.pdf",
  )}"`;

  return new NextResponse(fs.createReadStream(filePath) as never, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, no-store",
    },
  });
}