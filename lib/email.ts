/**
 * Transactional email via Resend, with a SendGrid fallback.
 *
 * The webhook calls sendDeliveryEmail() after watermarking. Delivery channel:
 *
 *   1. RESEND_API_KEY set   -> sent via Resend (v4 SDK)
 *   2. else SENDGRID_API_KEY -> sent via SendGrid v3 REST API (fetch)
 *   3. neither               -> the delivery link is logged to the server
 *                               console, so the demo flow stays testable
 *                               end-to-end without a real email account
 */
import { Resend } from "resend";
import { getProductConfig, isEmailConfigured, getStoreConfig } from "@/lib/config";
import type { DownloadRecord } from "@/lib/store";

export type DeliveryEmail = {
  to: string;
  downloadUrl: string;
  expiresAt: string;
};

type SendResult = {
  sent: boolean;
  /** Human-readable channel: "resend", "sendgrid" or "log" (stub). */
  channel: "resend" | "sendgrid" | "log";
  /** Message id when sent through a provider, else `null`. */
  messageId: string | null;
};

/**
 * Email the buyer their secure, expiring download link.
 * Falls back to SendGrid, then to logging when no provider is configured.
 */
export async function sendDeliveryEmail(
  input: DeliveryEmail,
): Promise<SendResult> {
  const product = getProductConfig();
  const from = process.env.EMAIL_FROM || "PDFLaunch <delivery@example.com>";
  const subject = `Your ${product.title} is ready to download`;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey?.startsWith("re_")) {
    return sendViaResend(resendKey, from, subject, input);
  }

  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey?.startsWith("SG.")) {
    return sendViaSendGrid(sendgridKey, from, subject, input);
  }

  console.log(
    [
      "------------------------------------------------------------",
      "[email] no RESEND_API_KEY / SENDGRID_API_KEY — delivery NOT sent (template stub).",
      "  to         : " + input.to,
      "  product    : " + product.title,
      "  download   : " + input.downloadUrl,
      "  expires at : " + input.expiresAt,
      "------------------------------------------------------------",
    ].join("\n"),
  );
  return { sent: false, channel: "log", messageId: null };
}

/* ------------------------------ providers -------------------------------- */

async function sendViaResend(
  key: string,
  from: string,
  subject: string,
  input: DeliveryEmail,
): Promise<SendResult> {
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from,
    to: [input.to],
    subject,
    html: EMAIL_HTML(input),
  });

  if (error) {
    console.error("[email] Resend send failed:", error);
    return { sent: false, channel: "resend", messageId: null };
  }
  return { sent: true, channel: "resend", messageId: data?.id ?? null };
}

async function sendViaSendGrid(
  key: string,
  from: string,
  subject: string,
  input: DeliveryEmail,
): Promise<SendResult> {
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to }] }],
        from: parseFrom(from),
        subject,
        content: [{ type: "text/html", value: EMAIL_HTML(input) }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[email] SendGrid send failed (HTTP ${res.status}):`,
        body.slice(0, 300),
      );
      return { sent: false, channel: "sendgrid", messageId: null };
    }
    // SendGrid v3 returns 202 Accepted with an empty body (no message id).
    return { sent: true, channel: "sendgrid", messageId: null };
  } catch (err) {
    console.error("[email] SendGrid send failed:", err);
    return { sent: false, channel: "sendgrid", messageId: null };
  }
}

/** SendGrid's `from` must be an object { email, name }; accept "Name <a@b>" too. */
function parseFrom(from: string): { email: string; name?: string } {
  const match = /^(.*?)\s*<([^>]+)>$/.exec(from.trim());
  if (match) return { email: match[2], name: match[1].trim() };
  return { email: from.trim() };
}

/** Store the download record plus the URL — useful for stubs/logs/tests. */
export function downloadUrlFor(
  baseUrl: string,
  download: DownloadRecord,
): string {
  return `${baseUrl}/api/downloads/${download.token}`;
}

/* ------------------------------ footer ----------------------------------- */

/** Support line for email footers — falls back to EMAIL_FROM's address. */
export function supportEmailFor(): string {
  return getStoreConfig().supportEmail;
}

/* ------------------------------ templates -------------------------------- */

const EMAIL_HTML = (input: DeliveryEmail) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0"
           style="background:#ffffff;border-radius:12px;padding:32px;font-family:Helvetica,Arial,sans-serif;color:#1f2430">
      <tr><td style="font-size:20px;font-weight:600;padding-bottom:12px">📄 Your PDF is ready</td></tr>
      <tr><td style="font-size:14px;line-height:1.6;color:#444">
        Thanks for your purchase! Your watermarked copy is ready to download.
        The link below is <strong>single-use</strong> and expires
        <strong>${input.expiresAt}</strong>.
      </td></tr>
      <tr><td style="padding:20px 0">
        <a href="${input.downloadUrl}"
           style="background:#4f46e5;color:#ffffff;padding:12px 24px;border-radius:8px;
                  text-decoration:none;font-size:14px;font-weight:600">
          Download your PDF
        </a>
      </td></tr>
      <tr><td style="font-size:12px;color:#888;padding-top:8px">
        If the button doesn't work, open this link: ${input.downloadUrl}
      </td></tr>
      <tr><td style="font-size:12px;color:#888;padding-top:16px;border-top:1px solid #eee">
        Need help? Contact <a href="mailto:${supportEmailFor()}" style="color:#4f46e5">${supportEmailFor()}</a>
      </td></tr>
    </table>
  </td></tr>
</table>`;

export type { DownloadRecord } from "@/lib/store";
export { isEmailConfigured } from "@/lib/config";