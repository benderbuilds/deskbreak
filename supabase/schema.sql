-- DeskBreak V2 schema.
-- Apply with: psql "$SUPABASE_DB_URL" -f supabase/schema.sql
--
-- Keep this minimal. Entitlement lives in `subscriptions` and is written only by
-- the Stripe webhook, never by the client.

create table if not exists profiles (
  id uuid primary key,
  email text unique,
  anonymous_id text unique,
  created_at timestamptz not null default now(),
  primary_need text,
  preferred_setup text,
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
  primary_need text not null,
  setup text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_seconds integer not null default 0,
  perceived_effect text
);

create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_anonymous_id_idx on sessions (anonymous_id);

-- Everything is reached through the service role from route handlers, so no
-- anon policies are granted here.
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table sessions enable row level security;
