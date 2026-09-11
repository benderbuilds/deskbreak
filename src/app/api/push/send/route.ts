import { NextResponse } from "next/server";
import { pushConfigured } from "@/lib/server/push";
import { runPushScheduler } from "@/lib/server/push-scheduler";
import { isDurable } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/**
 * The push scheduler endpoint. Hit every 15 minutes by the GitHub Actions
 * workflow; the work itself lives in `push-scheduler.ts`.
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
  if (!isDurable()) {
    return NextResponse.json({ error: "no_store", sent: 0 }, { status: 503 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ error: "push_not_configured", sent: 0 }, { status: 503 });
  }
  try {
    const result = await runPushScheduler();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[deskbreak] push send failed:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

/** Both verbs need the bearer secret; the workflow POSTs. */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
