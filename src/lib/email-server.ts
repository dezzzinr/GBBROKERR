// Outbound email, server-only. Uses Resend (https://resend.com) over plain
// fetch (no SDK dependency needed - it's a single JSON POST). If no API key
// is configured, every send is "stubbed": logged to the server console and
// recorded as such on the notification row, so the whole notification
// pipeline works out of the box in any environment (including this sandbox)
// without requiring a real email account, and starts actually delivering
// the moment RESEND_API_KEY is added to .env - no other code changes.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Denary Drill Capital Markets <onboarding@resend.dev>";

export type SendEmailResult =
  | { status: "sent" }
  | { status: "stubbed" }
  | { status: "failed"; error: string };

export async function sendEmail(input: { to: string; subject: string; html: string; text: string }): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    console.log(`[email:stub] to=${input.to} subject="${input.subject}" (set RESEND_API_KEY in .env to actually send this)`);
    return { status: "stubbed" };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: input.to, subject: input.subject, html: input.html, text: input.text }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email:failed]", res.status, body.slice(0, 500));
      return { status: "failed", error: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }
    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    console.error("[email:failed]", message);
    return { status: "failed", error: message.slice(0, 300) };
  }
}

// Base URL used for the "Open Denary Drill Capital Markets" link in emails. Falls back to
// Vercel's auto-populated host if APP_URL isn't set, and omits the button
// entirely if neither is available (e.g. local dev with no env set).
export function appUrl(): string | null {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return null;
}

// Email-safe approximation of the app's tapered drill mark. The small
// nested tables and inline colors keep the logo and layout intact in clients
// that strip SVGs and external stylesheets.
function emailShell(content: string, footer: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:32px 16px;background:#f5faf7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2ece6;border-radius:18px;overflow:hidden;">
    <tr><td style="padding:21px 28px;background:#103d2c;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle" style="width:34px;height:34px;background:#34d59a;border-radius:10px;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
            <tr><td style="width:19px;height:3px;background:#103d2c;border-radius:3px;"></td></tr>
            <tr><td style="height:3px;font-size:0;line-height:0;"></td></tr>
            <tr><td style="width:14px;height:3px;background:#103d2c;border-radius:3px;"></td></tr>
            <tr><td style="height:3px;font-size:0;line-height:0;"></td></tr>
            <tr><td style="width:8px;height:3px;background:#103d2c;border-radius:3px;"></td></tr>
          </table>
        </td>
        <td valign="middle" style="padding-left:11px;color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-.4px;">DDCM</td>
      </tr></table>
      <div style="padding:13px 0 0;color:#a9d9c2;font-size:10px;font-weight:700;letter-spacing:1.5px;">DENARY DRILL CAPITAL MARKETS</div>
    </td></tr>
    <tr><td style="padding:30px 28px 32px;">${content}</td></tr>
    <tr><td style="padding:17px 28px;background:#f5faf7;border-top:1px solid #e2ece6;color:#718078;font-size:11px;line-height:1.6;">${footer}</td></tr>
  </table>
</body>
</html>`;
}

// Shared branded wrapper for every notification email - a simple, readable
// card rather than per-event bespoke HTML, so all the emails look and feel
// consistent and new event types are just a title/message away.
export function notificationEmailHtml(input: { name: string; title: string; message: string }): string {
  const link = appUrl();
  const button = link
    ? `<tr><td style="padding-top:24px;"><a href="${link}" style="display:inline-block;background:#147b55;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:9px;">Open your account</a></td></tr>`
    : "";
  const content = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="font-size:13px;color:#718078;padding-bottom:8px;">Hi ${escapeHtml(input.name)},</td></tr>
    <tr><td style="font-size:21px;font-weight:800;color:#14211b;letter-spacing:-.4px;padding-bottom:12px;">${escapeHtml(input.title)}</td></tr>
    <tr><td style="font-size:14px;line-height:1.7;color:#405148;">${escapeHtml(input.message)}</td></tr>
    ${button}
  </table>`;
  return emailShell(content, "You're receiving this because account activity notifications are on for your Denary Drill Capital Markets account. You can change this anytime from Profile → Notifications.");
}

// Dedicated template for the "reset your password" email - needs its own
// CTA (a tokenized link, or a plain-text code to paste in if no APP_URL is
// configured in this environment) rather than the generic "Open Denary Drill Capital Markets"
// button every other notification uses.
export function passwordResetEmailHtml(input: { name: string; token: string }): { html: string; text: string } {
  const base = appUrl();
  const link = base ? `${base}/reset-password?token=${input.token}` : null;
  const action = link
    ? `<tr><td style="padding-top:24px;"><a href="${link}" style="display:inline-block;background:#147b55;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:9px;">Reset your password</a></td></tr>
       <tr><td style="padding-top:14px;font-size:12px;color:#718078;word-break:break-all;">Or paste this link into your browser: ${link}</td></tr>`
    : `<tr><td style="padding-top:18px;font-size:13px;line-height:1.6;color:#405148;">Open the Reset Password page in Denary Drill Capital Markets and paste in this reset token:</td></tr>
       <tr><td style="padding-top:10px;"><span style="display:inline-block;font-family:monospace;font-size:16px;letter-spacing:1px;background:#e5f7ef;border:1px solid #bfead5;border-radius:9px;padding:11px 16px;color:#14211b;">${escapeHtml(input.token)}</span></td></tr>`;
  const content = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="font-size:13px;color:#718078;padding-bottom:8px;">Hi ${escapeHtml(input.name)},</td></tr>
    <tr><td style="font-size:21px;font-weight:800;color:#14211b;letter-spacing:-.4px;padding-bottom:12px;">Reset your password</td></tr>
    <tr><td style="font-size:14px;line-height:1.7;color:#405148;">We received a request to reset your Denary Drill Capital Markets password. This link expires in 30 minutes. If you didn't request this, you can safely ignore this email - your password won't change.</td></tr>
    ${action}
  </table>`;
  const html = emailShell(content, "Copyright Denary Drill Capital Markets. All rights reserved.");
  const text = link
    ? `Hi ${input.name},\n\nWe received a request to reset your Denary Drill Capital Markets password. This link expires in 30 minutes:\n${link}\n\nIf you didn't request this, you can ignore this email.`
    : `Hi ${input.name},\n\nWe received a request to reset your Denary Drill Capital Markets password. Open the Reset Password page in Denary Drill Capital Markets and paste in this reset token (expires in 30 minutes): ${input.token}\n\nIf you didn't request this, you can ignore this email.`;
  return { html, text };
}

// Dedicated template for the signup "verify your email" code - a big,
// easy-to-read 4-digit code rather than a link, since it's meant to be
// retyped into the app.
export function verificationCodeEmailHtml(input: { name: string; code: string }): { html: string; text: string } {
  const content = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="font-size:13px;color:#718078;padding-bottom:8px;">Hi ${escapeHtml(input.name)},</td></tr>
    <tr><td style="font-size:21px;font-weight:800;color:#14211b;letter-spacing:-.4px;padding-bottom:12px;">Verify your email</td></tr>
    <tr><td style="font-size:14px;line-height:1.7;color:#405148;">Enter this code in Denary Drill Capital Markets to activate your account. It expires in 15 minutes.</td></tr>
    <tr><td style="padding-top:20px;"><span style="display:inline-block;font-family:monospace;font-size:34px;font-weight:800;letter-spacing:11px;background:#e5f7ef;border:1px solid #bfead5;border-radius:12px;padding:15px 19px;color:#103d2c;">${escapeHtml(input.code)}</span></td></tr>
    <tr><td style="padding-top:18px;font-size:12px;line-height:1.6;color:#718078;">If you didn't create a Denary Drill Capital Markets account, you can safely ignore this email.</td></tr>
  </table>`;
  const html = emailShell(content, "A secure email verification code for your account.");
  const text = `Hi ${input.name},\n\nEnter this code in Denary Drill Capital Markets to activate your account (expires in 15 minutes): ${input.code}\n\nIf you didn't create a Denary Drill Capital Markets account, you can ignore this email.`;
  return { html, text };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
