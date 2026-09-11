# Stripe Integration

DeskBreak already had a working Stripe Checkout integration, so this was a
parameter update to one existing call, not a new integration.

**The only file changed:** [src/app/api/checkout/route.ts](src/app/api/checkout/route.ts)

## Values to Replace

**None.** Every `sample_only` parameter already held a real, non-placeholder
value and was preserved as required.

| Field | Current Value | Status |
|-------|--------------|--------|
| mode | `subscription` | Correct. DeskBreak Pro is recurring billing, monthly or annual. |
| success_url | `${origin}/app/welcome?session_id={CHECKOUT_SESSION_ID}` | Real route. Origin comes from `NEXT_PUBLIC_APP_URL` or the request host. Keeps the `{CHECKOUT_SESSION_ID}` template, which `/app/welcome` reads to confirm entitlement. |
| cancel_url | `${origin}/app/pro?checkout=cancelled` | Real route, returns to the paywall. |
| line_items[].price | `STRIPE_PRO_ANNUAL_PRICE_ID` / `STRIPE_PRO_MONTHLY_PRICE_ID` | Read from environment, never hardcoded. Set in Vercel. |

## Configured Parameters

Set in Checkout Studio and now applied. Change them there, not in code.

**File containing these parameters:**
- [src/app/api/checkout/route.ts](src/app/api/checkout/route.ts)

| Parameter | Value |
|-----------|-------|
| ui_mode | `hosted_page` |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| allow_promotion_codes | `false` |
| payment_method_collection | `always` |
| submit_type | `auto` |
| integration_identifier | `hosted_web_0001` |
| origin_context | `web` |

`ui_mode` is `hosted_page` because the installed SDK is **stripe 22.6.1**, which
is at or above 21.0.0. On an SDK below 21.0.0 this value must be `hosted`
instead, so check it if the dependency is ever downgraded.

## Two behaviour changes worth knowing

**Promotion codes are now off.** The call previously sent
`allow_promotion_codes: true`, so the Stripe page showed a promo code field.
Checkout Studio specifies `false`, so that field is gone and any launch discount
codes will stop working at checkout. Turn it back on in Checkout Studio if you
want founder or launch codes.

**Billing address collection is now `auto` rather than Stripe's default.** For a
digital subscription this is usually what you want, and it means fewer fields
between a customer and paying.

## Parameters deliberately kept

The integration brief said to remove parameters absent from its field list.
Four were kept, because they are not Checkout Studio presentation settings at
all. They are identity wiring that carries a DeskBreak profile id into Stripe so
the webhook can carry it back:

| Parameter | Why it has to stay |
|-----------|--------------------|
| `subscription_data.metadata.user_id` | The **primary** way `/api/stripe/webhook` resolves a Stripe subscription to a DeskBreak profile (`resolveUserId`). |
| `client_reference_id` | The **fallback** path, used when subscription metadata is absent on `checkout.session.completed`. |
| `metadata.anonymous_id` | Links the purchase to the browser that made it, so Pro unlocks on that device without a login. |
| `customer_email` | Prefills checkout and lets **Restore Pro** find the subscription later from Settings. |

Removing them would not have thrown an error. It would have meant a customer is
charged successfully and never granted Pro, with nothing in the UI to explain
why. That is the worst failure this product has, so they stayed. They are absent
from the field list because Checkout Studio does not manage them, not because
they were switched off.

If you do want them gone, say so and they can be removed, but the webhook in
[src/app/api/stripe/webhook/route.ts](src/app/api/stripe/webhook/route.ts) would
need reworking first to identify customers by email alone.

## Verification

- `tsc --noEmit` clean. All nine parameters exist in stripe 22.6.1's types.
- `submit_type` is valid in `subscription` mode and is only disallowed with
  `ui_mode: elements`, which is not used here.
- `payment_method_collection` is only settable in `subscription` mode, which is
  the mode used, matching the brief's rule 8.
- The full parameter set was serialized through the real Stripe SDK against a
  local stub to confirm the exact wire format, including `ui_mode=hosted_page`,
  `integration_identifier=hosted_web_0001` and `origin_context=web`.

## Setup

Environment variables, all server-side, none browser-exposed. This is Next.js,
not Vite, so no `VITE_` prefix applies; anything browser-readable would need
`NEXT_PUBLIC_`, and no Stripe secret uses it.

```
STRIPE_SECRET_KEY=sk_live_...          # provided by the Vercel Stripe integration
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://your-domain
```

Vercel bakes environment variables in at build time, so **redeploy** after
changing any of them.

## How the integration works

```
/app/pro  ->  POST /api/checkout        creates the Checkout Session
          ->  Stripe hosted page        customer pays
          ->  /app/welcome?session_id   reads entitlement from the server
          POST /api/stripe/webhook      writes the subscriptions row
          ->  GET /api/entitlement      what every page load asks
```

The webhook is the only writer of subscription state, using Stripe's own status
and period end. No code path invents an expiry date, and local storage caches
the answer but never decides it.

## Testing

Use test mode with card `4242 4242 4242 4242`, any future expiry, any CVC. Other
useful numbers: `4000 0000 0000 9995` (insufficient funds), `4000 0025 0000 3155`
(requires 3D Secure authentication).

You cannot use test cards against a live key. For live, buy your own
subscription and refund it.

After a successful purchase, confirm:

1. A row appears in Supabase `subscriptions` with `status = active`.
2. A hard refresh of `/app` still shows the Pro badge.
3. Cancelling in Stripe flips the row's status.

## Next steps

- Confirm `STRIPE_WEBHOOK_SECRET` points at the production domain. Without it
  the charge succeeds and the customer never gets Pro, which looks identical to
  a working checkout from the outside.
- Decide whether to re-enable promotion codes in Checkout Studio.
- Apply [supabase/schema.sql](supabase/schema.sql) if it has not been run, or
  the checkout call fails before it reaches Stripe.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
