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
 * filled in. Where they do both exist, the coordinates still make the better link
 * — see below.
 */
export function canMap(place: Mappable) {
  return Boolean(place.location_detail);
}

/**
 * Where to send someone who wants directions. Only meaningful when `canMap` is
 * true; callers check that first.
 *
 * Coordinates win when the venue was picked from the suggestions, because they
 * drop a pin on the exact building rather than trusting Maps to re-resolve a
 * string it already resolved once. An address without a position falls back to
 * searching for the text, which Maps handles well because it is a real address.
 */
export function mapsUrlFor(place: Mappable) {
  if (typeof place.latitude === 'number' && typeof place.longitude === 'number') {
    return `${SearchUrl}${place.latitude},${place.longitude}`;
  }

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
