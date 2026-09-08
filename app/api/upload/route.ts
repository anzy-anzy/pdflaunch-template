/**
 * POST /api/upload
 *
 * Receives the admin-uploaded PDF (multipart/form-data field "file"),
 * validates it, and stores it as the master copy that gets watermarked and
 * delivered to buyers. Backed by lib/store.ts + the ./data directory.
 *
 * Returns the upload record so the admin UI can show a confirmation.
 */
import { NextResponse } from "next/server";
import { createUpload, getUpload } from "@/lib/store";

export const runtime = "nodejs";

// Max upload size (not `export`ed — Next.js Routes only allow HTTP methods).
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    let fileBuffer: Buffer;
    let fileName: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Missing file field in upload." },
          { status: 400 },
        );
      }
      fileBuffer = Buffer.from(await file.arrayBuffer());
      fileName = file.name;
    } else {
      // Accept raw PDF bodies (`Content-Type: application/pdf`) for scripts.
      fileBuffer = Buffer.from(await request.arrayBuffer());
      fileName = "upload.pdf";
    }

    if (fileBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Empty file." }, { status: 400 });
    }
    if (fileBuffer.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB).` },
        { status: 413 },
      );
    }

    const upload = createUpload(fileName, fileBuffer);
    return NextResponse.json(
      { ok: true, upload: getUpload(upload.id) },
      { status: 201 },
    );
  } catch (err) {
    console.error("[upload] failed:", err);
    return NextResponse.json(
      { error: "Upload failed — see server log." },
      { status: 500 },
    );
  }
}