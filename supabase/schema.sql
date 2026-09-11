-- DeskBreak V3 schema.
-- Apply with: psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--
-- Additive over V2: every statement is idempotent, existing rows are kept, and
-- nothing here rewrites entitlement. `subscriptions` is still written only by
-- the Stripe webhook, never by the client.

create table if not exists profiles (
  id uuid primary key,
  email text unique,
  anonymous_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  display_name text,
  primary_need text,
  preferred_setup text,
  preferred_duration integer,
  intensity_preference text,
  notification_level text,
  onboarding_completed_at timestamptz,
  workday_start integer,          -- minutes past local midnight
  workday_end integer,
  timezone text,
  reminder_frequency text,
  first_utm_source text,
  first_utm_medium text,
  first_utm_campaign text,
  first_utm_content text,
  first_landing_path text
);

alter table profiles add column if not exists updated_at timestamptz not null default now();
alter table profiles add column if not exists display_name text;
alter table profiles add column if not exists preferred_duration integer;
alter table profiles add column if not exists intensity_preference text;
alter table profiles add column if not exists notification_level text;
alter table profiles add column if not exists onboarding_completed_at timestamptz;
-- The address Stripe collected at checkout for a profile that has never signed
-- in. Not a login identity; a verified sign-in with the same address claims it.
alter table profiles add column if not exists billing_email text;
create index if not exists profiles_billing_email_idx on profiles (billing_email);

create table if not exists subscriptions (
  id uuid primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on subscriptions (user_id);

create table if not exists sessions (
  id uuid primary key,
  user_id uuid references profiles (id) on delete set null,
  anonymous_id text,
  program_id text not null,
  program_name text,
  primary_need text not null,
  setup text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_seconds integer not null default 0,
  duration_minutes integer,
  perceived_effect text,
  recommendation_id text,
  algorithm_version text,
  source text,
  scheduled_break_id text,
  generated boolean
);

alter table sessions add column if not exists program_name text;
alter table sessions add column if not exists duration_minutes integer;
alter table sessions add column if not exists recommendation_id text;
alter table sessions add column if not exists algorithm_version text;
alter table sessions add column if not exists source text;
alter table sessions add column if not exists scheduled_break_id text;
alter table sessions add column if not exists generated boolean;

create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_anonymous_id_idx on sessions (anonymous_id);
create index if not exists sessions_started_at_idx on sessions (started_at desc);

create table if not exists session_exercises (
  id uuid primary key,
  session_id uuid not null references sessions (id) on delete cascade,
  exercise_id text not null,
  sequence integer not null,
  planned_duration integer not null default 0,
  actual_duration integer not null default 0,
  completed boolean not null default false,
  skipped boolean not null default false,
  swapped boolean not null default false,
  swapped_to_exercise_id text,
  discomfort_reported boolean not null default false,
  discomfort_reason text
);

create index if not exists session_exercises_session_id_idx on session_exercises (session_id);

create table if not exists recommendations (
  id text primary key,
  profile_id uuid references profiles (id) on delete set null,
  anonymous_id text,
  need text not null,
  setup text not null,
  requested_duration integer not null,
  recommended_duration integer not null,
  time_of_day text not null,
  algorithm_version text not null,
  recommendation_reason text not null,
  program_id text not null,
  program_name text not null,
  inputs jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recommendations_profile_id_idx on recommendations (profile_id);
create index if not exists recommendations_anonymous_id_idx on recommendations (anonymous_id);

create table if not exists recommendation_exercises (
  id uuid primary key,
  recommendation_id text not null references recommendations (id) on delete cascade,
  exercise_id text not null,
  sequence integer not null,
  score numeric not null default 0,
  duration_seconds integer not null default 0,
  phase text
);

create index if not exists recommendation_exercises_recommendation_id_idx
  on recommendation_exercises (recommendation_id);

create table if not exists functional_constraints (
  id uuid primary key,
  profile_id uuid not null references profiles (id) on delete cascade,
  constraint_key text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, constraint_key)
);

create table if not exists workday_preferences (
  profile_id uuid primary key references profiles (id) on delete cascade,
  timezone text,
  workday_start integer not null,
  workday_end integer not null,
  monday_enabled boolean not null default true,
  tuesday_enabled boolean not null default true,
  wednesday_enabled boolean not null default true,
  thursday_enabled boolean not null default true,
  friday_enabled boolean not null default true,
  saturday_enabled boolean not null default false,
  sunday_enabled boolean not null default false,
  reminder_level text not null default 'balanced',
  updated_at timestamptz not null default now()
);

create table if not exists planned_breaks (
  id text primary key,
  profile_id uuid not null references profiles (id) on delete cascade,
  date date not null,
  start_window integer not null,
  end_window integer not null,
  type text not null,
  need text not null,
  duration_minutes integer not null,
  recommendation_id text,
  status text not null default 'planned',
  snoozed_until integer,
  completed_session_id uuid,
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists planned_breaks_profile_date_idx on planned_breaks (profile_id, date);
create index if not exists planned_breaks_status_idx on planned_breaks (status);

create table if not exists favorites (
  id uuid primary key,
  profile_id uuid not null references profiles (id) on delete cascade,
  item_id text not null,
  item_type text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, item_id)
);

create table if not exists push_subscriptions (
  id uuid primary key,
  profile_id uuid references profiles (id) on delete cascade,
  anonymous_id text,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  revoked_at timestamptz
);

create index if not exists push_subscriptions_profile_id_idx on push_subscriptions (profile_id);

create table if not exists login_tokens (
  id uuid primary key,
  profile_id uuid not null references profiles (id) on delete cascade,
  token_hash text not null unique,
  next_path text not null default '/app',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- V3 hardening: what a link brings with it is stored on the token and applied
-- only when the link is opened by the browser that asked for it.
alter table login_tokens add column if not exists anonymous_id text;
alter table login_tokens add column if not exists nonce_hash text;
alter table login_tokens add column if not exists pending jsonb;

-- One row per logical notification send. The unique dedupe key is what makes
-- overlapping, late or retried scheduler runs safe: only one insert wins.
create table if not exists notification_deliveries (
  id uuid primary key,
  profile_id uuid references profiles (id) on delete cascade,
  kind text not null,                 -- push | email
  dedupe_key text not null unique,
  target text,                        -- push endpoint, or a hash of the address
  status text not null,               -- sending | delivered | failed | skipped
  attempted_at timestamptz not null default now(),
  delivered_at timestamptz,
  error text,
  retry_after timestamptz
);

-- The rendered message, so a retry resends identical bytes under the same
-- provider idempotency key.
alter table notification_deliveries add column if not exists payload jsonb;

create index if not exists notification_deliveries_profile_id_idx on notification_deliveries (profile_id);
create index if not exists notification_deliveries_attempted_at_idx on notification_deliveries (attempted_at);

-- Sign-in link requests, for abuse limits that hold across server instances.
-- Hashes only; rows older than a day are pruned by the endpoint itself.
create table if not exists auth_requests (
  id uuid primary key,
  email_hash text not null,
  requester_hash text not null,
  allowed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists auth_requests_email_hash_idx on auth_requests (email_hash, created_at);
create index if not exists auth_requests_requester_hash_idx on auth_requests (requester_hash, created_at);

-- Everything is reached through the service role from route handlers, so no
-- anon policies are granted here.
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table sessions enable row level security;
alter table session_exercises enable row level security;
alter table recommendations enable row level security;
alter table recommendation_exercises enable row level security;
alter table functional_constraints enable row level security;
alter table workday_preferences enable row level security;
alter table planned_breaks enable row level security;
alter table favorites enable row level security;
alter table push_subscriptions enable row level security;
alter table login_tokens enable row level security;
alter table notification_deliveries enable row level security;
alter table auth_requests enable row level security;
