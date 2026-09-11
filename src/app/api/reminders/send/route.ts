import { NextResponse } from "next/server";
import { emailConfigured, reminderEmail, sendEmail } from "@/lib/server/email";
import { findMany, isDurable } from "@/lib/server/store";
import { reminderLineFor } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Sends the day's reminder emails. Meant to be hit by a scheduler once an hour.
 *
 * Email is the channel that reaches people who have not enabled push. With no
 * body, recipients are every profile with an email whose workday afternoon is
 * now; a body can name recipients explicitly for testing.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function localHour(timezone: string | null): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone ?? "UTC", hour12: false, hour: "2-digit" }).formatToParts(new Date());
    return Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  } catch {
    return new Date().getUTCHours();
  }
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDurable()) {
    return NextResponse.json({ error: "no_store", sent: 0 }, { status: 503 });
  }
  if (!emailConfigured()) {
    return NextResponse.json({ error: "no_email_provider", sent: 0 }, { status: 503 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://deskbreak.app").replace(/\/$/, "");
  const today = new Date().toISOString().slice(0, 10);
  const line = reminderLineFor(today);

  let body: { recipients?: { email: string; need?: string | null }[] } = {};
  if (request.method === "POST") {
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }
  }

  let recipients = body.recipients ?? [];
  if (!recipients.length) {
    // Default: everyone with an email and a daily reminder, at 2 PM local time.
    const profiles = await findMany("profiles", {}, { limit: 5000 });
    recipients = profiles
      .filter((profile) => profile.email && profile.reminder_frequency !== "off")
      .filter((profile) => localHour(profile.timezone) === 14)
      .map((profile) => ({ email: profile.email as string, need: profile.primary_need }));
  }

  let sent = 0;
  for (const recipient of recipients) {
    const message = reminderEmail({ line, need: recipient.need ?? null, appUrl });
    const result = await sendEmail({ to: recipient.email, ...message });
    if (result.delivered) sent += 1;
  }

  return NextResponse.json({ ok: true, sent, attempted: recipients.length });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
