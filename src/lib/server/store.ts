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
  /**
   * The address Stripe collected at checkout, for a profile that has never
   * signed in. Not a login identity: it is only used to attach the purchase to
   * an account once that address is verified by a magic link.
   */
  billing_email?: string | null;
  created_at: string;
  updated_at?: string;
  display_name?: string | null;
  primary_need: string | null;
  preferred_setup: string | null;
  preferred_duration?: number | null;
  intensity_preference?: string | null;
  notification_level?: string | null;
  onboarding_completed_at?: string | null;
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
  program_name?: string | null;
  primary_need: string;
  setup: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number;
  duration_minutes?: number | null;
  perceived_effect: string | null;
  recommendation_id?: string | null;
  algorithm_version?: string | null;
  source?: string | null;
  scheduled_break_id?: string | null;
  generated?: boolean | null;
};

export type SessionExerciseRow = {
  id: string;
  session_id: string;
  exercise_id: string;
  sequence: number;
  planned_duration: number;
  actual_duration: number;
  completed: boolean;
  skipped: boolean;
  swapped: boolean;
  swapped_to_exercise_id: string | null;
  discomfort_reported: boolean;
  discomfort_reason: string | null;
};

export type RecommendationRow = {
  id: string;
  profile_id: string | null;
  anonymous_id: string | null;
  need: string;
  setup: string;
  requested_duration: number;
  recommended_duration: number;
  time_of_day: string;
  algorithm_version: string;
  recommendation_reason: string;
  program_id: string;
  program_name: string;
  inputs: Record<string, unknown> | null;
  created_at: string;
};

export type RecommendationExerciseRow = {
  id: string;
  recommendation_id: string;
  exercise_id: string;
  sequence: number;
  score: number;
  duration_seconds: number;
  phase: string | null;
};

export type FunctionalConstraintRow = {
  id: string;
  profile_id: string;
  constraint_key: string;
  created_at: string;
};

export type WorkdayPreferencesRow = {
  profile_id: string;
  timezone: string | null;
  workday_start: number;
  workday_end: number;
  monday_enabled: boolean;
  tuesday_enabled: boolean;
  wednesday_enabled: boolean;
  thursday_enabled: boolean;
  friday_enabled: boolean;
  saturday_enabled: boolean;
  sunday_enabled: boolean;
  reminder_level: string;
  updated_at: string;
};

export type PlannedBreakRow = {
  id: string;
  profile_id: string;
  date: string;
  start_window: number;
  end_window: number;
  type: string;
  need: string;
  duration_minutes: number;
  recommendation_id: string | null;
  status: string;
  snoozed_until: number | null;
  completed_session_id: string | null;
  delivered_at: string | null;
  updated_at: string;
};

export type FavoriteRow = {
  id: string;
  profile_id: string;
  item_id: string;
  item_type: string;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  profile_id: string | null;
  anonymous_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_label: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  revoked_at: string | null;
};

export type LoginTokenRow = {
  id: string;
  profile_id: string;
  token_hash: string;
  next_path: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  /** The requesting browser, applied only if that browser opens the link. */
  anonymous_id: string | null;
  /** Hash of the nonce cookie set on the requesting browser. */
  nonce_hash: string | null;
  /** Preferences captured at request time, applied only after verification. */
  pending: Record<string, unknown> | null;
};

export type NotificationDeliveryRow = {
  id: string;
  profile_id: string | null;
  kind: string;
  /** One row per logical send. Uniqueness is what makes retries safe. */
  dedupe_key: string;
  /** Endpoint for push; a hash of the address for email. Never the address. */
  target: string | null;
  status: string;
  attempted_at: string;
  delivered_at: string | null;
  error: string | null;
  retry_after: string | null;
  /**
   * The rendered message, captured on the first attempt so a retry sends the
   * identical payload under the same provider idempotency key.
   */
  payload?: Record<string, unknown> | null;
};

/** One sign-in link request. Hashes only: no address, no IP. */
export type AuthRequestRow = {
  id: string;
  email_hash: string;
  requester_hash: string;
  /** Whether the request passed the limits and produced a link. */
  allowed: boolean;
  created_at: string;
};

export type Tables = {
  profiles: Profile;
  subscriptions: Subscription;
  sessions: SessionRow;
  session_exercises: SessionExerciseRow;
  recommendations: RecommendationRow;
  recommendation_exercises: RecommendationExerciseRow;
  functional_constraints: FunctionalConstraintRow;
  workday_preferences: WorkdayPreferencesRow;
  planned_breaks: PlannedBreakRow;
  favorites: FavoriteRow;
  push_subscriptions: PushSubscriptionRow;
  login_tokens: LoginTokenRow;
  notification_deliveries: NotificationDeliveryRow;
  auth_requests: AuthRequestRow;
};

const memory: { [K in keyof Tables]: Tables[K][] } = {
  profiles: [],
  subscriptions: [],
  sessions: [],
  session_exercises: [],
  recommendations: [],
  recommendation_exercises: [],
  functional_constraints: [],
  workday_preferences: [],
  planned_breaks: [],
  favorites: [],
  push_subscriptions: [],
  login_tokens: [],
  notification_deliveries: [],
  auth_requests: [],
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
    throw new Error(`supabase ${table} ${response.status}: ${await response.text()}`);
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as T[]) : [];
}

function matches<T extends Record<string, unknown>>(row: T, where: Partial<T>): boolean {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

function encode(where: Record<string, unknown>): string {
  const parts = Object.entries(where)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) =>
      value === null ? `${key}=is.null` : `${key}=eq.${encodeURIComponent(String(value))}`,
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
    query: `${encode(where as Record<string, unknown>)}${Object.keys(where).length ? "&" : "?"}limit=1`,
  });
  return rows[0] ?? null;
}

export type FindManyOptions<T> = {
  orderBy?: keyof T & string;
  descending?: boolean;
  limit?: number;
  /** Column, comparison and value. Applied after `where`. */
  filters?: { column: keyof T & string; op: "gte" | "lte" | "gt" | "lt" | "in"; value: unknown }[];
};

export async function findMany<K extends keyof Tables>(
  table: K,
  where: Partial<Tables[K]>,
  options: FindManyOptions<Tables[K]> = {},
): Promise<Tables[K][]> {
  const applyFilters = (rows: Tables[K][]) =>
    rows.filter((row) =>
      (options.filters ?? []).every(({ column, op, value }) => {
        const actual = (row as Record<string, unknown>)[column] as string | number | null;
        if (actual === null || actual === undefined) return false;
        switch (op) {
          case "gte":
            return actual >= (value as string | number);
          case "lte":
            return actual <= (value as string | number);
          case "gt":
            return actual > (value as string | number);
          case "lt":
            return actual < (value as string | number);
          case "in":
            return (value as unknown[]).includes(actual);
        }
      }),
    );

  if (!isDurable()) {
    let rows = (memory[table] as Tables[K][]).filter((row) =>
      matches(row as Record<string, unknown>, where),
    );
    rows = applyFilters(rows);
    if (options.orderBy) {
      const key = options.orderBy;
      rows = [...rows].sort((a, b) => {
        const av = (a as Record<string, unknown>)[key] as string | number;
        const bv = (b as Record<string, unknown>)[key] as string | number;
        return av < bv ? -1 : av > bv ? 1 : 0;
      });
      if (options.descending) rows.reverse();
    }
    return options.limit ? rows.slice(0, options.limit) : rows;
  }

  const params: string[] = [];
  const base = encode(where as Record<string, unknown>);
  if (base) params.push(base.slice(1));
  for (const { column, op, value } of options.filters ?? []) {
    if (op === "in") {
      params.push(`${column}=in.(${(value as unknown[]).map((v) => encodeURIComponent(String(v))).join(",")})`);
    } else {
      params.push(`${column}=${op}.${encodeURIComponent(String(value))}`);
    }
  }
  if (options.orderBy) params.push(`order=${options.orderBy}.${options.descending ? "desc" : "asc"}`);
  if (options.limit) params.push(`limit=${options.limit}`);
  return rest<Tables[K]>(table, { method: "GET", query: params.length ? `?${params.join("&")}` : "" });
}

export async function insert<K extends keyof Tables>(table: K, row: Tables[K]): Promise<Tables[K]> {
  if (!isDurable()) {
    (memory[table] as Tables[K][]).push(row);
    return row;
  }
  const rows = await rest<Tables[K]>(table, { method: "POST", body: JSON.stringify(row) });
  return rows[0] ?? row;
}

/**
 * Inserts a row unless one already exists with the same value in
 * `uniqueColumn`; returns null when it does. This is the claim primitive the
 * scheduler relies on: two overlapping runs can both try, only one wins.
 *
 * In memory the check and the push happen in one synchronous step, so
 * concurrent claims within a process cannot both succeed. Against Postgres the
 * unique constraint decides, and a 409 means someone else got there first.
 */
export async function insertUnique<K extends keyof Tables>(
  table: K,
  row: Tables[K],
  uniqueColumn: keyof Tables[K] & string,
): Promise<Tables[K] | null> {
  if (!isDurable()) {
    const rows = memory[table] as Tables[K][];
    if (rows.some((existing) => existing[uniqueColumn] === row[uniqueColumn])) return null;
    rows.push(row);
    return row;
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: SUPABASE_KEY as string,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (response.status === 409) return null;
  if (!response.ok) {
    throw new Error(`supabase ${table} ${response.status}: ${await response.text()}`);
  }
  const text = await response.text();
  const rows = text ? (JSON.parse(text) as Tables[K][]) : [];
  return rows[0] ?? row;
}

/** Updates every matching row and returns how many matched. */
export async function updateMany<K extends keyof Tables>(
  table: K,
  where: Partial<Tables[K]>,
  patch: Partial<Tables[K]>,
): Promise<number> {
  if (!Object.keys(where).length) throw new Error("refusing to update without a filter");
  if (!isDurable()) {
    const rows = memory[table] as Tables[K][];
    let count = 0;
    rows.forEach((row, index) => {
      if (matches(row as Record<string, unknown>, where)) {
        rows[index] = { ...rows[index], ...patch };
        count += 1;
      }
    });
    return count;
  }
  const rows = await rest<Tables[K]>(table, {
    method: "PATCH",
    query: encode(where as Record<string, unknown>),
    body: JSON.stringify(patch),
  });
  return rows.length;
}

export async function insertMany<K extends keyof Tables>(table: K, rows: Tables[K][]): Promise<void> {
  if (!rows.length) return;
  if (!isDurable()) {
    (memory[table] as Tables[K][]).push(...rows);
    return;
  }
  await rest<Tables[K]>(table, { method: "POST", body: JSON.stringify(rows) });
}

export async function upsert<K extends keyof Tables>(
  table: K,
  row: Tables[K],
  conflictColumn: keyof Tables[K] & string,
): Promise<Tables[K]> {
  if (!isDurable()) {
    const rows = memory[table] as Tables[K][];
    const index = rows.findIndex((existing) => existing[conflictColumn] === row[conflictColumn]);
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
    let first: Tables[K] | null = null;
    rows.forEach((row, index) => {
      if (matches(row as Record<string, unknown>, where)) {
        rows[index] = { ...rows[index], ...patch };
        first = first ?? rows[index];
      }
    });
    return first;
  }
  const rows = await rest<Tables[K]>(table, {
    method: "PATCH",
    query: encode(where as Record<string, unknown>),
    body: JSON.stringify(patch),
  });
  return rows[0] ?? null;
}

export async function remove<K extends keyof Tables>(
  table: K,
  where: Partial<Tables[K]>,
): Promise<void> {
  if (!Object.keys(where).length) throw new Error("refusing to delete without a filter");
  if (!isDurable()) {
    const rows = memory[table] as Tables[K][];
    memory[table] = rows.filter((row) => !matches(row as Record<string, unknown>, where)) as never;
    return;
  }
  await rest<Tables[K]>(table, { method: "DELETE", query: encode(where as Record<string, unknown>) });
}

/** Deletes rows matching a comparison filter, e.g. everything older than a date. */
export async function removeWhere<K extends keyof Tables>(
  table: K,
  filter: { column: keyof Tables[K] & string; op: "lt" | "lte" | "gt" | "gte"; value: string | number },
): Promise<void> {
  if (!isDurable()) {
    const rows = memory[table] as Tables[K][];
    memory[table] = rows.filter((row) => {
      const actual = (row as Record<string, unknown>)[filter.column] as string | number | null;
      if (actual === null || actual === undefined) return true;
      switch (filter.op) {
        case "lt":
          return !(actual < filter.value);
        case "lte":
          return !(actual <= filter.value);
        case "gt":
          return !(actual > filter.value);
        case "gte":
          return !(actual >= filter.value);
      }
    }) as never;
    return;
  }
  await rest<Tables[K]>(table, {
    method: "DELETE",
    query: `?${filter.column}=${filter.op}.${encodeURIComponent(String(filter.value))}`,
  });
}

/** Test seam: drops everything held in the in-memory store. */
export function resetMemoryStore(): void {
  for (const key of Object.keys(memory) as (keyof Tables)[]) {
    memory[key] = [] as never;
  }
}
