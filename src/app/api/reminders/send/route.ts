import { NextResponse } from "next/server";
import { emailConfigured } from "@/lib/server/email";
import { runEmailScheduler } from "@/lib/server/email-scheduler";
import { isDurable } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * The reminder mailer endpoint. Hit every 15 minutes by the GitHub Actions
 * workflow; the work itself lives in `email-scheduler.ts`. `?dryRun=1`
 * reports who is due without sending or claiming anything.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  if (!isDurable()) {
    return NextResponse.json({ error: "no_store", sent: 0 }, { status: 503 });
  }
  if (!emailConfigured() && !dryRun) {
    return NextResponse.json({ error: "no_email_provider", sent: 0 }, { status: 503 });
  }
  try {
    const result = await runEmailScheduler({ dryRun });
    return NextResponse.json({ ok: true, dryRun, ...result });
  } catch (error) {
    console.error("[deskbreak] reminder send failed:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
