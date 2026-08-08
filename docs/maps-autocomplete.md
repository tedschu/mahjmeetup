# Venue and town autocomplete

The Venue field on **Propose a match** and the Town field on **Profile** suggest
real places as you type, backed by Google Places Autocomplete.

Both fields still accept anything typed. A member's living room is not in Places
and has to remain a valid venue, so a suggestion is an offer, never a
requirement. If the lookup is not configured or is failing, the fields behave
exactly as plain text fields did.

## How it is wired

```
PlaceAutocompleteInput  ->  src/lib/places.ts  ->  places-autocomplete edge function  ->  Google Places
   (debounced 300ms)         (supabase.functions.invoke)      (holds the API key)
```

The app never talks to Google directly. `EXPO_PUBLIC_*` values are baked into
the web bundle in plain text, so a key shipped that way is readable by anyone who
views source — and Places bills per request, which makes a leaked key a spending
liability rather than just a privacy one. The key lives only in Supabase secrets,
and the function requires a valid member JWT (`auth: 'user'`), so an anon key
alone gets a 401.

The client sends `{ input, kind }` where kind is `venue` or `city`. It cannot
pass Places parameters through, so a signed-in member cannot craft arbitrary
requests against the project's quota.

## One-time setup

### 1. Enable the API and make a key

In the [Google Cloud console](https://console.cloud.google.com/), using the same
project as the Google sign-in credentials:

1. **APIs & Services → Library** → enable **Places API (New)**. (The old "Places
   API" is a different product; this code calls the New endpoint.)
2. **APIs & Services → Credentials → Create credentials → API key**.
3. On the new key, under **API restrictions**, restrict it to **Places API (New)**.
   Leave **Application restrictions** set to None — the key is used from a server,
   which has no referrer or bundle ID to match on.
4. Billing must be enabled on the project. Places will not serve requests without
   it, even inside the free allowance.

### 2. Cap the spend

The **Autocomplete Requests** SKU gives 10,000 free requests a month, then costs
$2.83 per 1,000. A group this size will not approach the free cap in normal use —
but signups are open, so an account could hammer the field. Set a ceiling that
does not depend on nobody trying:

- **APIs & Services → Places API (New) → Quotas** → lower the per-minute request
  quota to something a handful of people cannot exceed.
- **Billing → Budgets & alerts** → a budget alert as a backstop.

### 3. Give the key to Supabase

```bash
npx supabase secrets set GOOGLE_MAPS_API_KEY=<the key>
```

Optionally confine suggestions to particular countries:

```bash
npx supabase secrets set PLACES_REGION_CODES=US
```

Unset, Google biases suggestions by the caller's region, which is usually what
you want.

### 4. Deploy the function

```bash
npx supabase functions deploy places-autocomplete
```

## Local development

`npx supabase functions serve` reads `supabase/functions/.env`, which is
gitignored. Put a key there to exercise the real lookup:

```
GOOGLE_MAPS_API_KEY=<the key>
```

Without one, the function returns `501 not_configured`, the client stops asking,
and both fields stay plain text — which is the correct behaviour for a checkout
that has no key, not a bug to fix.

Note that `supabase start` alone does not serve functions. Run
`npx supabase functions serve` alongside `npx expo start`, or the app gets a 404
and shows "Suggestions are unavailable".

## Attribution

Google Maps Platform policy requires a "Powered by Google" credit wherever Places
results appear without an accompanying Google map. It is rendered under the
suggestion list. Do not remove it.

## If it is ever extended

Only the prediction text is used today, which is why no session token is sent:
tokens only change billing when a session terminates in a Place Details call, and
this proxy never makes one. If coordinates are ever wanted — a directions link, a
map — that means adding Place Details, and a session token should be added at the
same time so the autocomplete requests in that session stop being billed
individually.
