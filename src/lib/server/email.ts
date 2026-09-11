import "server-only";

/**
 * Transactional email.
 *
 * Deliberately a thin wrapper over Resend's HTTP API rather than an email engine
 * of our own. When it is not configured, sends are logged and reported as not
 * delivered, so nothing pretends a reminder went out that did not.
 */
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.REMINDER_FROM_EMAIL || "DeskBreak <hello@deskbreak.app>";

export function emailConfigured(): boolean {
  return Boolean(RESEND_KEY);
}

export type SendResult = { delivered: boolean; reason?: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendResult> {
  if (!RESEND_KEY) {
    console.warn(`[deskbreak] email not configured; skipping send to ${input.to}`);
    return { delivered: false, reason: "not_configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
    if (!response.ok) {
      console.error(`[deskbreak] email send failed: ${await response.text()}`);
      return { delivered: false, reason: "send_failed" };
    }
    return { delivered: true };
  } catch (error) {
    console.error("[deskbreak] email send threw:", error);
    return { delivered: false, reason: "send_failed" };
  }
}

function shell(inner: string): string {
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;background:#F7F4EF;color:#1C1917;padding:32px 20px">
  <div style="max-width:420px;margin:0 auto">${inner}</div>
</div>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#FF5A36;color:#fff;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:14px">${escapeHtml(label)}</a>`;
}

/** Plain, single-purpose reminder. One link, one job. */
export function reminderEmail(input: {
  line: string;
  need: string | null;
  appUrl: string;
}): { subject: string; text: string; html: string } {
  const link = input.need
    ? `${input.appUrl}/app/start?need=${input.need}&source=push&utm_source=deskbreak&utm_medium=email&utm_campaign=daily_reminder`
    : `${input.appUrl}/app/start?source=push&utm_source=deskbreak&utm_medium=email&utm_campaign=daily_reminder`;

  const text = `${input.line}\n\nStart your reset: ${link}\n\nNot useful? Turn reminders off under You.`;
  const html = shell(`
    <p style="font-size:20px;line-height:1.35;font-weight:600;margin:0 0 20px">${escapeHtml(input.line)}</p>
    ${button(link, "Start my reset")}
    <p style="font-size:13px;color:#1C191799;margin:24px 0 0">Not useful? Turn reminders off under You.</p>`);

  return { subject: input.line, text, html };
}

/** The sign-in link. No password, no account form. */
export function magicLinkEmail(input: { link: string; minutes: number }): {
  subject: string;
  text: string;
  html: string;
} {
  const text = `Here is your DeskBreak sign-in link. It works once and expires in ${input.minutes} minutes.\n\n${input.link}\n\nIf you didn't ask for this, you can ignore it.`;
  const html = shell(`
    <p style="font-size:20px;line-height:1.35;font-weight:600;margin:0 0 8px">Save what works for you.</p>
    <p style="font-size:15px;line-height:1.5;color:#1C1917B3;margin:0 0 20px">This link signs you in on any device. It works once and expires in ${input.minutes} minutes.</p>
    ${button(input.link, "Sign in to DeskBreak")}
    <p style="font-size:13px;color:#1C191799;margin:24px 0 0">If you didn't ask for this, you can ignore it.</p>`);
  return { subject: "Your DeskBreak sign-in link", text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
