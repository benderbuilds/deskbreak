# Staging acceptance checklist

Run against a deployed staging environment with real services before a
production release. Never against production data, never with live Stripe
keys. Every step names the evidence to keep (redact addresses, ids and keys
before sharing).

## Preconditions

| Item | Where |
| --- | --- |
| Staging deployment of the commit under test | Vercel project, Preview or a dedicated staging project, `VERCEL_ENV` not `production` unless it is the staging project's own production target |
| Supabase staging project with `supabase/schema.sql` applied | Supabase dashboard, SQL editor, or `psql "$SUPABASE_DB_URL" -f supabase/schema.sql` |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `AUTH_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, `REMINDER_FROM_EMAIL` (verified sending domain), `STRIPE_SECRET_KEY` (test mode `sk_test_`), `STRIPE_WEBHOOK_SECRET` (for the staging endpoint), the two `STRIPE_PRO_*_PRICE_ID` (test mode prices), `VAPID_*`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_APP_URL` (the staging https origin) | Vercel project settings, Environment Variables, scoped to the staging environment only |
| Stripe test-mode webhook endpoint `https://<staging>/api/stripe/webhook` subscribed to `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_succeeded`, `invoice.payment_failed` | Stripe dashboard, Developers, Webhooks (test mode toggle on) |
| Stripe Customer Portal configured in test mode (cancel enabled) | Stripe dashboard, Settings, Billing, Customer portal (test mode) |
| GitHub repository secrets `APP_URL` and `CRON_SECRET` for the staging origin, or call the endpoints by hand with `curl -X POST "$APP_URL/api/push/send" -H "Authorization: Bearer $CRON_SECRET"` | GitHub repository, Settings, Secrets and variables, Actions |
| Two designated test inboxes (A and B) and two test devices or browser profiles | Team-owned test accounts only |
| `GET https://<staging>/api/health` returns 200, `configured` all true | Sanity only; not evidence of delivery |

## Tests

Record for each: PASS / FAIL / NOT RUN, commit sha, deployment URL, timestamp, and the redacted evidence named.

### Email (Resend)

| # | Test | Steps | Expected | Evidence |
| --- | --- | --- | --- | --- |
| E1 | Sign-in link email | On device 1, do one reset, tap Save my progress, enter inbox A | Email arrives from `REMINDER_FROM_EMAIL` within a minute; link signs in; `?signed_in=1&merged=1` in the landing URL | Resend dashboard, Emails: message id and status "delivered"; screenshot of You showing the account |
| E2 | Link is single use and expires | Open the same link again; request another and wait past `AUTH_LINK_TTL_MINUTES` | Second open lands on `/app/save?error=expired`; expired link likewise | Screenshots |
| E3 | Reminder email, once per day | Sign in on device 1, You, turn Daily reminder on; set `timezone` so the local time is inside 14:00-16:00 (or wait for it); call `/api/reminders/send` three times a minute apart, then once more an hour later | Exactly one email in inbox A; endpoint responses show `sent: 1` then `duplicates: 1`; `notification_deliveries` has one `delivered` row for the profile and local date | Resend dashboard entry with `Idempotency-Key` `deskbreak-email-<delivery id>`; SQL `select status, delivered_at from notification_deliveries where kind='email'` |
| E4 | Opt-out | Turn Daily reminder off; call the endpoint inside the window next day | No email; `skipped.opted_out` or profile absent from candidates | Endpoint JSON |
| E5 | Non-working day and time zone | Set workday to Mon-Fri; call on a Saturday in the profile's zone; set timezone to one where it is currently outside the window and call again | No email either time; `skipped.not_workday` / `skipped.outside_window` | Endpoint JSON |
| E6 | Rate limit does not reveal accounts | Request a link for inbox A six times in a row, then for a never-used address six times | Sixth request returns 429 `rate_limited` in both cases with identical body shape; A's earlier link still works | Response bodies |

### Stripe (test mode only)

| # | Test | Steps | Expected | Evidence |
| --- | --- | --- | --- | --- |
| S1 | Checkout before sign-in | Anonymous device 2, open a Pro routine, pay with card 4242 4242 4242 4242 using inbox B's address | Returned to `/app/welcome`, Pro badge shown; `subscriptions` row with `user_id` = the anonymous profile; that profile has `billing_email` = B and `email` null | Stripe test dashboard: checkout session and subscription ids; SQL |
| S2 | Webhook | Stripe dashboard, Webhooks, the staging endpoint | `checkout.session.completed` and `customer.subscription.created` delivered with 200 | Webhook attempt log |
| S3 | Entitlement | Reload device 2; `GET /api/entitlement?anonymousId=<device 2 id>` | `pro: true`, status active or trialing | Response JSON |
| S4 | Restore on another device | Device 1 (signed out), You, enter B, Restore Pro, open the link from inbox B on device 1 | Device 1 signed in as B and Pro; `subscriptions.user_id` now the B profile; device 2 still Pro | SQL before and after; screenshots |
| S5 | Checkout after sign-in | Sign in as inbox A on a fresh device, then buy | `subscriptions.user_id` = A's profile directly; no shell profile created | SQL |
| S6 | Billing portal | Signed in as B, You, Manage subscription | Portal opens for the right customer; signed-out device gets the "sign in first" notice and no portal link (`POST /api/billing/portal` returns 401) | Screenshot; response status |
| S7 | Cancellation | In the portal, cancel at period end; then in Stripe test dashboard, cancel immediately | After the first, `cancel_at_period_end` true and still Pro; after the second, webhook `customer.subscription.deleted` lands, `/api/entitlement` returns `pro: false`, app shows Free on reload | Webhook log; response JSON; screenshot |
| S8 | Failed payment | Use card 4000 0000 0000 0341 for a new subscription in test mode | `invoice.payment_failed` handled; status `past_due` still grants Pro (documented) | Webhook log; SQL |

### Accounts and history

| # | Test | Steps | Expected | Evidence |
| --- | --- | --- | --- | --- |
| A1 | Anonymous history migrates | Device 3: three resets anonymously, then Save my progress with inbox A, open link on device 3 | Landing URL has `merged=3`; Progress shows all three; `sessions.user_id` set for the three rows | SQL; screenshot |
| A2 | Second-device sign-in | Device 4: You, enter A, open link on device 4 (no prior history) | Signed in; the three sessions appear; nothing merged from device 4 (no `merged=`) | Screenshot; URL |
| A3 | Link opened elsewhere merges nothing | Device 5 anonymous with one reset requests a link for A; open that link on device 4 | Device 4 signed in; A's constraints unchanged; device 5's reset not in A's history; device 5 not signed in | SQL `select count(*) from sessions where user_id=<A>` before and after |
| A4 | Isolation | With sessions for A and B in two browsers, `GET /api/auth/me`, `/api/profile`, `/api/planned-breaks?date=today`, `/api/sessions` | Each sees only its own rows; `POST /api/sessions` with the other's session id returns 403 | Response bodies |

### Push (real devices)

| # | Test | Steps | Expected | Evidence |
| --- | --- | --- | --- | --- |
| P1 | Delivery | Pro account, You, Push reminders on (installed PWA on phone, or desktop Chrome); set a workday plan with a window opening in the next 15 minutes; call `/api/push/send` (or wait for the workflow) | One notification with Start / 15 min / Skip actions; endpoint `sent: 1`; `notification_deliveries` row `delivered` | Screenshot; SQL |
| P2 | Duplicate prevention | Call `/api/push/send` three more times inside the window, two of them concurrently | No further notification; responses show `duplicates` | Endpoint JSON |
| P3 | Snooze | Tap 15 min; call the endpoint before and after the snoozed time | Nothing before; one new notification after; new `notification_deliveries` row keyed on the snooze attempt | Screenshot; SQL |
| P4 | Skip | Tap Skip on the next window; call the endpoint | Nothing sent; break status `skipped` | SQL |
| P5 | Opt-out | You, Push reminders off; call the endpoint at the next window | Nothing sent; subscription row has `revoked_at` | SQL |
| P6 | Scheduler drives it | With repository secrets set, watch the Scheduler workflow run | Both steps return 200 JSON; no Vercel Cron configured | Actions run log |

## Sign-off

| Field | Value |
| --- | --- |
| Commit | |
| Deployment URL | |
| Run by / date | |
| Failures | |
