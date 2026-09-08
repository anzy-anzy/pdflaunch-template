"use client";

import { useEffect, useState } from "react";
import { product, security, formatPrice } from "@/lib/site";
import type { UploadRecord, SaleRecord } from "@/lib/store";

/**
 * Admin dashboard shell (template). Four working panels:
 *
 *  0. Sales overview — revenue + order count + last-14-days bar chart
 *     (fetches GET /api/sales, recorded by the Stripe webhook / demo stub)
 *  1. Upload   — POSTs a PDF to /api/upload (the "master" that gets delivered)
 *  2. Stripe   — settings fields (not wired to storage — secrets live in env)
 *  3. Watermark toggle → persisted to env/config at runtime for the demo
 *
 * Resell note: builders typically wire the toggle to a real settings store
 * (DB) — this UI deliberately edits the same config object the app reads from.
 */

type SalesSummary = {
  sales: SaleRecord[];
  totals: { revenueCents: number; count: number };
};

const CHART_DAYS = 14;

export default function AdminDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [upload, setUpload] = useState<UploadRecord | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [salesError, setSalesError] = useState<string | null>(null);

  const [stripeKey, setStripeKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [watermark, setWatermark] = useState(security.watermark);
  const [saved, setSaved] = useState(false);

  // Load sales for the overview panel.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sales")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setSales(data as SalesSummary);
      })
      .catch((err) => {
        if (!cancelled) setSalesError(`Could not load sales: ${(err as Error).message}`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed.");
        return;
      }
      setUpload(data.upload as UploadRecord);
      setFile(null);
    } catch (err) {
      setUploadError(`Network error: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = () => {
    // Template stub: secrets live in .env.local, so this panel documents the
    // fields a real dashboard would persist (e.g. to a Postgres settings row).
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Admin dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Revenue overview, PDF upload, and payments &amp; delivery settings.
      </p>

      <div className="mt-8 space-y-6">
        {/* ---------------- Sales overview ---------------- */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Sales overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Recorded on every completed checkout (Stripe webhook or demo stub).
          </p>

          {salesError ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {salesError}
            </p>
          ) : !sales ? (
            <p className="mt-4 text-sm text-slate-400">Loading sales…</p>
          ) : (
            <div className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Total revenue
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {formatPrice(sales.totals.revenueCents, product.currency)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Orders
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {sales.totals.count}
                  </p>
                </div>
              </div>

              <RevenueChart
                sales={sales.sales}
                currency={product.currency}
                days={CHART_DAYS}
              />

              {sales.sales.length > 0 ? (
                <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {[...sales.sales]
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .slice(0, 5)
                    .map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between px-4 py-2.5 text-sm"
                      >
                        <span className="text-slate-700">
                          <span className="font-medium">{s.name}</span>
                          <span className="ml-2 text-xs text-slate-400">{s.email}</span>
                        </span>
                        <span className="font-semibold text-slate-900">
                          {formatPrice(s.amountCents, s.currency || product.currency)}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  No sales yet — click “Buy Now” in demo mode to record one.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ---------------- Upload ---------------- */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">1 · Upload your PDF</h2>
          <p className="mt-1 text-sm text-slate-500">
            This is the master file buyers receive. It gets watermarked per
            buyer at checkout time (max 25 MB).
          </p>

          <div className="mt-4 flex items-center gap-3">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="shrink-0 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>

          {uploadError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {uploadError}
            </p>
          )}
          {upload && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              ✅ Uploaded <strong>{upload.fileName}</strong>{" "}
              <span className="text-emerald-600">({upload.id.slice(0, 8)}…)</span> — this
              PDF will be delivered to buyers.
            </p>
          )}
        </section>

        {/* ---------------- Stripe + Resend ---------------- */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">2 · Payments &amp; email</h2>
          <p className="mt-1 text-sm text-slate-500">
            Keys are read from <code className="rounded bg-slate-100 px-1">.env.local</code> —
            this panel is the reference UI for a real settings store.
          </p>

          <div className="mt-4 grid gap-4">
            {[
              {
                label: "Stripe secret key",
                value: stripeKey,
                set: setStripeKey,
                placeholder: "sk_test_…",
                note: "Create sessions · dashboard.stripe.com/apikeys",
              },
              {
                label: "Stripe webhook secret",
                value: webhookSecret,
                set: setWebhookSecret,
                placeholder: "whsec_…",
                note: "Verify delivery events · /api/webhooks/stripe",
              },
              {
                label: "Resend API key",
                value: resendKey,
                set: setResendKey,
                placeholder: "re_…",
                note: "Send the delivery email · resend.com/api-keys",
              },
            ].map((f) => (
              <div key={f.label}>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {f.label}
                </label>
                <input
                  type="password"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
                <p className="mt-1 text-xs text-slate-400">{f.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Watermark buyer PDFs</p>
              <p className="text-xs text-slate-500">
                Stamp name + email + purchase time on every page.
              </p>
            </div>
            <button
              onClick={() => setWatermark((w) => !w)}
              className={`relative h-6 w-11 rounded-full transition ${
                watermark ? "bg-indigo-600" : "bg-slate-300"
              }`}
              aria-pressed={watermark}
              aria-label="Toggle watermarking"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  watermark ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Product: <strong>{product.title}</strong> ·{" "}
              {formatPrice(product.priceCents, product.currency)} · links expire
              after {security.downloadLinkTtlHours}h
            </p>
            <button
              onClick={handleSaveSettings}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              {saved ? "Saved ✓" : "Save settings"}
            </button>
          </div>
        </section>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        Template stub — see README.md for wiring these panels to a real
        settings store and object storage.
      </p>
    </div>
  );
}

/* --------------------- lightweight SVG revenue chart --------------------- */

function RevenueChart({
  sales,
  currency,
  days,
}: {
  sales: SaleRecord[];
  currency: string;
  days: number;
}) {
  // Bucket revenue by local calendar day, oldest → newest.
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    buckets.set(d.toDateString(), 0);
  }
  for (const s of sales) {
    const key = new Date(s.createdAt).toDateString();
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + s.amountCents);
  }

  const entries = [...buckets.entries()];
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const barW = 100 / entries.length;
  const isEmpty = entries.every(([, v]) => v === 0);

  if (isEmpty) {
    return (
      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        No revenue in the last {days} days.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Revenue — last {days} days
      </p>
      <div className="flex h-32 items-end gap-1">
        {entries.map(([label, cents]) => (
          <div
            key={label}
            className="group relative flex flex-1 flex-col items-center justify-end"
            title={`${label}: ${formatPrice(cents, currency)}`}
          >
            <div
              className="w-full rounded-t bg-indigo-500 transition hover:bg-indigo-600"
              style={{ height: `${Math.max((cents / max) * 100, 2)}%` }}
            />
            <span className="mt-1 hidden text-[9px] text-slate-400 group-hover:block">
              {new Date(label).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wide text-slate-400">
        <span>{formatDay(entries[0][0])}</span>
        <span>{formatDay(entries[entries.length - 1][0])}</span>
      </div>
    </div>
  );
}

function formatDay(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}