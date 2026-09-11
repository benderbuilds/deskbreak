import { NextResponse } from "next/server";
import { capabilityReport } from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

/**
 * Which capabilities this deployment actually has.
 *
 * Booleans only: never a key, a URL or an address. In production, `ready`
 * is false until every capability the product depends on is configured, and
 * `missingForProduction` names what is absent so the fix is obvious.
 */
export async function GET() {
  const report = capabilityReport();
  return NextResponse.json(
    {
      ok: report.ready,
      ...report,
      scheduler: {
        driver: "github-actions",
        workflow: ".github/workflows/scheduler.yml",
        endpoints: ["/api/push/send", "/api/reminders/send"],
        vercelCron: false,
      },
    },
    { status: report.ready ? 200 : 503 },
  );
}
