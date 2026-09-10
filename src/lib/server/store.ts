import "server-only";

/**
 * Server-side persistence.
 *
 * Backed by Supabase over PostgREST when it is configured; otherwise an
 * in-process map so local dev and CI work without credentials. The in-memory
 * store is deliberately not durable, and `isDurable()` says so, so the app can
 * tell the difference rather than quietly pretending a purchase was saved.
 */

// Both are provided automatically by the Supabase integration for Vercel.
// Nothing here should ever be copied by hand, and neither is NEXT_PUBLIC_:
// the secret key bypasses row-level security and must stay server-side.
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

export function isDurable(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export type Profile = {
  id: string;
  email: string | null;
  anonymous_id: string | null;
  created_at: string;
  primary_need: string | null;
  preferred_setup: string | null;
  workday_start: number | null;
  workday_end: number | null;
  timezone: string | null;
  reminder_frequency: string | null;
  first_utm_source: string | null;
  first_utm_medium: string | null;
  first_utm_campaign: string | null;
  first_utm_content: string | null;
  first_landing_path: string | null;
};

export type Subscription = {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

export type SessionRow = {
  id: string;
  user_id: string | null;
  anonymous_id: string | null;
  program_id: string;
  primary_need: string;
  setup: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number;
  perceived_effect: string | null;
};

type Tables = {
  profiles: Profile;
  subscriptions: Subscription;
  sessions: SessionRow;
};

const memory: { [K in keyof Tables]: Tables[K][] } = {
  profiles: [],
  subscriptions: [],
  sessions: [],
};

async function rest<T>(
  table: keyof Tables,
  init: RequestInit & { query?: string },
): Promise<T[]> {
  const { query = "", ...rest } = init;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    ...rest,
    cache: "no-store",
    headers: {
      apikey: SUPABASE_KEY as string,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...rest.headers,
    },
  });
  if (!response.ok) {
    throw new Error(
      `supabase ${table} ${response.status}: ${await response.text()}`,
    );
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as T[]) : [];
}

function matches<T extends Record<string, unknown>>(
  row: T,
  where: Partial<T>,
): boolean {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

function encode(where: Record<string, string>): string {
  const parts = Object.entries(where).map(
    ([key, value]) => `${key}=eq.${encodeURIComponent(value)}`,
  );
  return parts.length ? `?${parts.join("&")}` : "";
}

export async function findOne<K extends keyof Tables>(
  table: K,
  where: Partial<Tables[K]>,
): Promise<Tables[K] | null> {
  if (!isDurable()) {
    const rows = memory[table] as Tables[K][];
    return rows.find((row) => matches(row as Record<string, unknown>, where)) ?? null;
  }
  const rows = await rest<Tables[K]>(table, {
    method: "GET",
    query: `${encode(where as Record<string, string>)}${
      Object.keys(where).length ? "&" : "?"
    }limit=1`,
  });
  return rows[0] ?? null;
}

export async function insert<K extends keyof Tables>(
  table: K,
  row: Tables[K],
): Promise<Tables[K]> {
  if (!isDurable()) {
    (memory[table] as Tables[K][]).push(row);
    return row;
  }
  const rows = await rest<Tables[K]>(table, {
    method: "POST",
    body: JSON.stringify(row),
  });
  return rows[0] ?? row;
}

export async function upsert<K extends keyof Tables>(
  table: K,
  row: Tables[K],
  conflictColumn: keyof Tables[K] & string,
): Promise<Tables[K]> {
  if (!isDurable()) {
    const rows = memory[table] as Tables[K][];
    const index = rows.findIndex(
      (existing) => existing[conflictColumn] === row[conflictColumn],
    );
    if (index >= 0) {
      rows[index] = { ...rows[index], ...row };
      return rows[index];
    }
    rows.push(row);
    return row;
  }
  const rows = await rest<Tables[K]>(table, {
    method: "POST",
    query: `?on_conflict=${conflictColumn}`,
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(row),
  });
  return rows[0] ?? row;
}

export async function update<K extends keyof Tables>(
  table: K,
  where: Partial<Tables[K]>,
  patch: Partial<Tables[K]>,
): Promise<Tables[K] | null> {
  if (!isDurable()) {
    const rows = memory[table] as Tables[K][];
    const index = rows.findIndex((row) =>
      matches(row as Record<string, unknown>, where),
    );
    if (index < 0) return null;
    rows[index] = { ...rows[index], ...patch };
    return rows[index];
  }
  const rows = await rest<Tables[K]>(table, {
    method: "PATCH",
    query: encode(where as Record<string, string>),
    body: JSON.stringify(patch),
  });
  return rows[0] ?? null;
}

/** Test seam: drops everything held in the in-memory store. */
export function resetMemoryStore(): void {
  memory.profiles = [];
  memory.subscriptions = [];
  memory.sessions = [];
}
