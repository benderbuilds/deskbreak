import { NextResponse } from "next/server";
import { emailConfigured, reminderEmail, sendEmail } from "@/lib/server/email";
import { isDurable } from "@/lib/server/store";
import { reminderLineFor } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Sends the day's reminder emails. Meant to be hit by a scheduler (Vercel Cron,
 * GitHub Actions, anything) once an hour.
 *
 * Email is the reminder channel a subscription can actually rest on: a browser
 * tab is not open at 3 PM, and DeskBreak should not claim to know that you have
 * been sitting when it does not.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDurable()) {
    return NextResponse.json(
      { error: "no_store", sent: 0, message: "No durable profile store configured." },
      { status: 503 },
    );
  }
  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "no_email_provider", sent: 0 },
      { status: 503 },
    );
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.app").replace(
    /\/$/,
    "",
  );
  const today = new Date().toISOString().slice(0, 10);
  const line = reminderLineFor(today);

  let body: { recipients?: { email: string; need?: string | null }[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const recipients = body.recipients ?? [];
  let sent = 0;
  for (const recipient of recipients) {
    const message = reminderEmail({ line, need: recipient.need ?? null, appUrl });
    const result = await sendEmail({ to: recipient.email, ...message });
    if (result.delivered) sent += 1;
  }

  return NextResponse.json({ ok: true, sent, attempted: recipients.length });
}
