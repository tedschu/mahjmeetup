import { supabase } from './supabase';

/**
 * Venue and town lookup, served by the `places-autocomplete` edge function
 * rather than by Google directly: the Maps key is billed per request and would
 * be readable in the web bundle if the app called Places itself.
 */
export type PlaceSuggestion = {
  placeId: string;
  /** The full string to drop into the field when this row is picked. */
  text: string;
  /** Google's split of that string, for a two-line suggestion row. */
  mainText: string;
  secondaryText: string | null;
};

/**
 * `venue` suggests anything you could play at — a business, a hall, a street
 * address. `city` suggests towns only, which is what a profile wants.
 */
export type PlaceKind = 'venue' | 'city';

/** Matches the proxy's floor. Shorter queries are noise and still cost money. */
export const MinPlaceQuery = 3;

/**
 * Set when the proxy reports it has no Google key configured. Autocomplete is
 * an enhancement on top of a working text field, so a project without a key
 * should quietly stop asking rather than surface an error on every keystroke.
 */
let missingKey = false;

export function isPlaceSearchConfigured() {
  return !missingKey;
}

export async function searchPlaces(input: string, kind: PlaceKind): Promise<PlaceSuggestion[]> {
  const trimmed = input.trim();
  if (missingKey || trimmed.length < MinPlaceQuery) return [];

  const { data, error } = await supabase.functions.invoke<{ suggestions: PlaceSuggestion[] }>(
    'places-autocomplete',
    { body: { input: trimmed, kind } }
  );

  if (error) {
    // supabase-js wraps a non-2xx response, putting the status on `context`.
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 501) {
      missingKey = true;
      return [];
    }
    throw error;
  }

  return data?.suggestions ?? [];
}
