import { Linking, Platform } from 'react-native';

/**
 * Links out to a map for a venue.
 *
 * The Google Maps Search URL scheme, which is the one documented as stable and
 * which behaves the same on the web, iOS and Android — the platform hands it to
 * the installed Maps app where there is one and falls back to the browser
 * otherwise, so this needs no per-platform branch of its own.
 */
const SearchUrl = 'https://www.google.com/maps/search/?api=1&query=';

export type Mappable = {
  /** The venue's name, which is all some matches have. */
  location: string;
  location_detail?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/**
 * Whether there is an address worth putting on a map.
 *
 * Keyed on the address specifically, not on the coordinates. A venue typed by hand
 * has neither, and sending someone to Maps to search "Ted's House" lands them on a
 * stranger's street in another state — so no link at all is the honest answer.
 *
 * Coordinates are deliberately not enough on their own. A sheet that says "no
 * street address given" and then offers directions anyway contradicts itself, and
 * in practice the pair always arrive together: coordinates are only ever resolved
 * for a venue picked from the suggestions, which is the same moment the address is
 * filled in.
 */
export function canMap(place: Mappable) {
  return Boolean(place.location_detail);
}

/**
 * Where to send someone who wants directions. Only meaningful when `canMap` is
 * true; callers check that first.
 *
 * Searches for the venue's name and address as text, which lands on the place
 * itself — "The Beer Cellar", with its hours, photos and reviews.
 *
 * This used to prefer the stored coordinates, on the reasoning that a position is
 * more exact than a string Maps has to re-resolve. That was wrong in a way only
 * visible on the screen: `query=41.88,-88.30` drops an anonymous pin labelled with
 * the numbers, so a member tapping "Open in Google Maps" for a named pub got a
 * blank marker in a field. Exactness was never the problem — Maps resolves a real
 * street address perfectly well — and identifying the destination matters more than
 * pinning it to the metre.
 *
 * The name goes first because it is what disambiguates: an address alone can land
 * on the building rather than the business inside it.
 *
 * A place id would be better still — `query_place_id` names the exact
 * establishment with no searching — but ids are not stored. Places autocomplete
 * returns one and it is used only to look up coordinates, then dropped. Persisting
 * it would be the proper fix if this is ever wrong.
 */
export function mapsUrlFor(place: Mappable) {
  const query = place.location_detail
    ? `${place.location}, ${place.location_detail}`
    : place.location;

  return `${SearchUrl}${encodeURIComponent(query)}`;
}

/**
 * Opens the venue in a map.
 *
 * A new tab on web rather than a navigation, for the same reason as the calendar
 * hand-off: `Linking.openURL` would replace the app and lose whatever the member
 * was in the middle of — here, an open sheet.
 */
export async function openMap(place: Mappable) {
  const url = mapsUrlFor(place);

  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  await Linking.openURL(url);
}
