// Proxies Google Places Autocomplete so the Maps API key never reaches a
// client. `EXPO_PUBLIC_*` values are baked into the web bundle in plain text,
// and Places bills per keystroke, so shipping the key would hand anyone who
// views source a spendable credential.
//
// This file runs on Deno, not React Native. It is excluded from the app's
// tsconfig and eslint for that reason.
import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

const AutocompleteUrl = 'https://places.googleapis.com/v1/places:autocomplete';

/**
 * Google returns every prediction field unless told otherwise. The mask is
 * narrowed to exactly what a suggestion row renders: the full display string,
 * the two-part split used for the row's title and subtitle, and the place id.
 */
const FieldMask = [
  'suggestions.placePrediction.placeId',
  'suggestions.placePrediction.text.text',
  'suggestions.placePrediction.structuredFormat.mainText.text',
  'suggestions.placePrediction.structuredFormat.secondaryText.text',
].join(',');

/** Under three characters the predictions are noise, and each one is billable. */
const MinInput = 3;
const MaxInput = 200;

/** More than this and the list stops being scannable. */
const MaxSuggestions = 5;

/** A slow upstream should fail the keystroke, not hold the function open. */
const UpstreamTimeoutMs = 5_000;

/**
 * Callers name a kind instead of passing Places parameters through, so a signed-in
 * member cannot craft arbitrary requests against the project's quota.
 *
 * A venue can be a business, a community hall, or somebody's street address, so
 * the venue kind deliberately applies no type filter.
 */
const PrimaryTypesByKind: Record<string, string[] | undefined> = {
  venue: undefined,
  city: ['(cities)'],
};

type PlacePrediction = {
  placeId?: string;
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
};

function bad(status: number, error: string) {
  return Response.json({ error }, { status });
}

/**
 * Reads `PLACES_BIAS` as `latitude,longitude,radiusMetres`, e.g.
 * `41.8875,-88.3054,50000` for the Fox Valley.
 *
 * A bias, not a restriction: results outside the circle are ranked lower but
 * still offered, so a match proposed while travelling is still findable.
 *
 * Returns undefined for anything malformed rather than throwing. A typo in a
 * secret should cost you the ranking hint, not every suggestion.
 */
function parseBias(raw: string | undefined) {
  if (!raw) return undefined;

  const [latitude, longitude, radius] = raw.split(',').map((part) => Number(part.trim()));

  const valid =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Number.isFinite(radius) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    // Google rejects anything outside this range outright.
    radius > 0 &&
    radius <= 50_000;

  if (!valid) {
    console.error('Ignoring malformed PLACES_BIAS; expected "lat,lng,radiusMetres"');
    return undefined;
  }

  return { circle: { center: { latitude, longitude }, radius } };
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req) => {
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

    // 501 rather than 500: the deployment is fine, the feature just is not set
    // up. The client treats this as "fall back to a plain text field" and stops
    // asking, so a project without a key behaves the way it did before.
    if (!apiKey) return bad(501, 'not_configured');

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return bad(400, 'invalid_body');
    }

    const { input, kind } = (body ?? {}) as { input?: unknown; kind?: unknown };

    if (typeof input !== 'string' || typeof kind !== 'string') return bad(400, 'invalid_body');
    if (!(kind in PrimaryTypesByKind)) return bad(400, 'invalid_kind');

    const trimmed = input.trim();
    if (trimmed.length < MinInput || trimmed.length > MaxInput) return bad(400, 'invalid_input');

    const includedPrimaryTypes = PrimaryTypesByKind[kind];

    // Optional, because hard-coding a country would be wrong for a group that
    // plays somewhere else. Unset lets Google bias by the caller's region.
    const regionCodes = Deno.env
      .get('PLACES_REGION_CODES')
      ?.split(',')
      .map((code) => code.trim())
      .filter(Boolean);

    // Requests leave from an edge server rather than from the member's device,
    // so Google's own IP-based biasing points at the wrong place. Naming where
    // the group actually plays puts nearby towns and venues at the top of the
    // list, where they belong.
    const locationBias = parseBias(Deno.env.get('PLACES_BIAS'));

    // No session token: tokens only change billing when a session ends in a
    // Place Details call, and this proxy never makes one — the prediction text
    // is the whole answer. Add one alongside Place Details if coordinates are
    // ever needed.
    let upstream: Response;
    try {
      upstream = await fetch(AutocompleteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FieldMask,
        },
        body: JSON.stringify({
          input: trimmed,
          ...(includedPrimaryTypes ? { includedPrimaryTypes } : {}),
          ...(regionCodes?.length ? { includedRegionCodes: regionCodes } : {}),
          ...(locationBias ? { locationBias } : {}),
        }),
        signal: AbortSignal.timeout(UpstreamTimeoutMs),
      });
    } catch {
      return bad(504, 'upstream_unreachable');
    }

    if (!upstream.ok) {
      // The upstream body can name the project and the key's restrictions, so
      // it goes to the function log rather than back to the caller.
      console.error('Places autocomplete failed', upstream.status, await upstream.text());
      return bad(502, 'upstream_error');
    }

    const payload = (await upstream.json()) as {
      suggestions?: { placePrediction?: PlacePrediction }[];
    };

    // Query predictions are filtered out by having no placePrediction: they are
    // search strings rather than places, and cannot be used as a venue.
    const suggestions = (payload.suggestions ?? [])
      .map((suggestion) => suggestion.placePrediction)
      .filter((prediction): prediction is PlacePrediction => Boolean(prediction?.placeId))
      .slice(0, MaxSuggestions)
      .map((prediction) => ({
        placeId: prediction.placeId,
        text: prediction.text?.text ?? prediction.structuredFormat?.mainText?.text ?? '',
        mainText: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? '',
        secondaryText: prediction.structuredFormat?.secondaryText?.text ?? null,
      }))
      .filter((suggestion) => suggestion.text.length > 0);

    return Response.json({ suggestions });
  }),
};
