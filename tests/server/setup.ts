/**
 * Redirects the two Next-only imports the server modules make. Import this
 * first in every server spec, before anything under `src/lib/server`.
 */
import Module from "node:module";
import path from "node:path";

const stubs: Record<string, string> = {
  "server-only": path.resolve(__dirname, "../stubs/server-only.cjs"),
  "next/headers": path.resolve(__dirname, "../stubs/next-headers.cjs"),
};

type Resolver = (request: string, ...rest: unknown[]) => string;
const loader = Module as unknown as { _resolveFilename: Resolver };
const original = loader._resolveFilename;
if (!(loader as unknown as { __deskbreakStubbed?: boolean }).__deskbreakStubbed) {
  loader._resolveFilename = function resolve(request: string, ...rest: unknown[]) {
    return stubs[request] ? stubs[request] : original.call(this, request, ...rest);
  };
  (loader as unknown as { __deskbreakStubbed?: boolean }).__deskbreakStubbed = true;
}

process.env.AUTH_SECRET ??= "server-tests-signing-secret";
process.env.NEXT_PUBLIC_APP_URL ??= "http://127.0.0.1:3100";
// By default the in-memory store. With DESKBREAK_TEST_STORE=postgres the
// SUPABASE_* variables are kept and every test runs against that database
// (see tests/postgres/README.md).
export const POSTGRES = process.env.DESKBREAK_TEST_STORE === "postgres";
if (!POSTGRES) {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
}

const TABLES: { table: string; column: string }[] = [
  { table: "notification_deliveries", column: "id" },
  { table: "auth_requests", column: "id" },
  { table: "login_tokens", column: "id" },
  { table: "push_subscriptions", column: "id" },
  { table: "favorites", column: "id" },
  { table: "planned_breaks", column: "id" },
  { table: "workday_preferences", column: "profile_id" },
  { table: "functional_constraints", column: "id" },
  { table: "recommendation_exercises", column: "id" },
  { table: "recommendations", column: "id" },
  { table: "session_exercises", column: "id" },
  { table: "sessions", column: "id" },
  { table: "subscriptions", column: "id" },
  { table: "profiles", column: "id" },
];

/** Empties the store under test: memory, or every table of the database. */
export async function resetStore(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const store = require("../../src/lib/server/store") as { resetMemoryStore(): void };
  store.resetMemoryStore();
  if (!POSTGRES) return;
  for (const { table, column } of TABLES) {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?${column}=not.is.null`, {
      method: "DELETE",
      headers: {
        apikey: process.env.SUPABASE_SECRET_KEY as string,
        Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      },
    });
    if (!response.ok) throw new Error(`reset ${table}: ${response.status} ${await response.text()}`);
  }
}

export function setTestCookies(cookies: Record<string, string>): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require(stubs["next/headers"]) as { setTestCookies(c: Record<string, string>): void }).setTestCookies(cookies);
}
