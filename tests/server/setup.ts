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
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;

export function setTestCookies(cookies: Record<string, string>): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require(stubs["next/headers"]) as { setTestCookies(c: Record<string, string>): void }).setTestCookies(cookies);
}
