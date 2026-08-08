import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

import type { Match } from './matches';

/**
 * Matches record when they start but not when they finish, so an event needs a
 * length. Three hours is a normal sitting, and an approximate end is far more
 * useful in a calendar than an event with no duration at all.
 */
const AssumedHours = 3;

/** Google's template URL wants basic-format UTC: 20260811T233000Z. */
function toBasicUTC(date: Date) {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/**
 * A Google Calendar "create event" link, prefilled from the match.
 *
 * Deliberately omits who else is playing. The roster would end up in a URL sent
 * to a third party, and other members' names are not this member's to hand over
 * — the venue, the time and the host's own notes are enough to be useful.
 */
export function googleCalendarUrl(match: Match) {
  const start = new Date(match.date_time);
  const end = new Date(start.getTime() + AssumedHours * 60 * 60 * 1000);

  const details = [match.notes, match.league ? `Counts toward ${match.league.name}.` : null]
    .filter(Boolean)
    .join('\n\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Mahjong at ${match.location}`,
    dates: `${toBasicUTC(start)}/${toBasicUTC(end)}`,
    location: [match.location, match.location_detail].filter(Boolean).join(', '),
  });

  if (details) params.set('details', details);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Hands the match to Google Calendar. On web this opens a tab rather than
 * navigating, because `Linking.openURL` would replace the app itself and lose
 * whatever the member was in the middle of.
 */
export async function addMatchToCalendar(match: Match) {
  const url = googleCalendarUrl(match);

  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  await Linking.openURL(url);
}

/**
 * Which matches have been handed to a calendar, so the button can stop looking
 * like an untouched action.
 *
 * This records that the member *sent* the match to Google, not that Google saved
 * it — handing off to a template page means the answer never comes back, and they
 * may well have closed the tab. It is a reminder of what they have already dealt
 * with rather than a claim about their calendar's contents, which is also why
 * pressing it again is still allowed.
 *
 * Kept on the device rather than in the database for the same reason: it is a
 * local note about a local action, and it would be wrong to sync it as fact.
 */
function storageKey(userId: string) {
  return `calendar-sent:${userId}`;
}

export async function loadCalendarSent(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    // A note about which buttons look pressed is not worth failing a screen over.
    return new Set();
  }
}

export async function recordCalendarSent(userId: string, matchId: string, current: Set<string>) {
  const next = new Set(current).add(matchId);

  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify([...next]));
  } catch {
    // Ignored for the same reason as above; the in-memory set still updates.
  }

  return next;
}
