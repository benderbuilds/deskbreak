# Server tests against Postgres

The server unit tests and the HTTP security tests normally run on the
in-memory store. To run them against the real schema, real unique constraints
and real row-level update atomicity:

```bash
# 1. A Postgres with the schema applied.
createdb deskbreak_test
psql deskbreak_test -f supabase/schema.sql

# 2. A PostgREST-compatible front for it (see postgrest-shim.mjs for what it
#    does and does not implement).
DATABASE_URL=postgres://user:pass@127.0.0.1:5432/deskbreak_test npm run postgres:shim   # port 3210

# 3. The suites, pointed at it.
DESKBREAK_TEST_STORE=postgres SUPABASE_URL=http://127.0.0.1:3210 SUPABASE_SECRET_KEY=any npm run test:server:postgres
```

For the HTTP tests, start `next start` with the same `SUPABASE_URL` and
`SUPABASE_SECRET_KEY` plus the test env from `playwright.config.ts`, then run
`npm run test:security`.

The shim is not PostgREST. Before trusting a behaviour it cannot show (row
level security, PostgREST's exact error bodies, connection pooling), point
`SUPABASE_URL` and `SUPABASE_SECRET_KEY` at a staging Supabase project instead;
the same commands apply.
