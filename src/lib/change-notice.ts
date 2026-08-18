import { Platform } from 'react-native';

import type { Contact } from './contact';
import { formatFullWhen } from './matches';

/**
 * Telling people a plan has moved.
 *
 * The app can change a date under somebody's feet in one tap, and until now it did
 * exactly that: the row in My Matches quietly said something different the next
 * time they looked, which is not how anyone finds out their Saturday moved. Every
 * edit that touches when or where is followed by an offer to say so.
 *
 * The message is composed here rather than in the screens because both callers —
 * a host editing one table, an organizer moving a whole meetup — are announcing
 * the same thing, and a change of plan is not the place for two dialects.
 */

/** The parts of a match or meetup that are worth telling people about. */
export type EventDetails = {
  date_time: string;
  location: string;
  location_detail: string | null;
};

export type Change = {
  /** "When" or "Where" — what the reader lost, in their terms rather than the schema's. */
  label: string;
  from: string;
  to: string;
};

/** The app's own address, for a link people can act on. See `inviteUrlFor`. */
export const AppOrigin =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : 'https://tschusters-team-mahjong.expo.app';

function venueOf(details: EventDetails) {
  return details.location_detail
    ? `${details.location}, ${details.location_detail}`
    : details.location;
}

/**
 * What changed, in the reader's terms.
 *
 * Date and time are one field in the database and one fact to a person, so they
 * are compared as an instant and reported as "When" — moving a game from Friday
 * 7pm to Saturday 7pm is one change, not two. Venue and its address are likewise
 * one line, because "the address changed but the name did not" describes a data
 * model rather than an evening.
 *
 * Returns an empty list when nothing a player would care about moved, which is
 * what keeps notes and the supplies switch from raising a "tell everyone" prompt.
 */
export function changesBetween(before: EventDetails, after: EventDetails): Change[] {
  const changes: Change[] = [];

  if (new Date(before.date_time).getTime() !== new Date(after.date_time).getTime()) {
    changes.push({
      label: 'When',
      from: formatFullWhen(before.date_time),
      to: formatFullWhen(after.date_time),
    });
  }

  if (venueOf(before) !== venueOf(after)) {
    changes.push({ label: 'Where', from: venueOf(before), to: venueOf(after) });
  }

  return changes;
}

/** "the date and the venue" — for a prompt that says what it is about to announce. */
export function describeChanges(changes: Change[]) {
  const parts = changes.map((change) => (change.label === 'When' ? 'the date' : 'the venue'));
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * The message itself.
 *
 * Plain text with the new details first and the old ones in brackets under them,
 * because the reader's question is "when is it now" and only then "did I have this
 * wrong". No greeting and no sign-off beyond the app's name: it goes out from the
 * organizer's own mail client under their own address, and words put in their
 * mouth would read as a form letter from a person they know.
 *
 * `mailto:` bodies are plain text in every client, so this is laid out with line
 * breaks rather than markup — a bulleted list would arrive as literal asterisks.
 */
export function changeNotice({
  title,
  changes,
  after,
  where,
  from,
}: {
  /** What moved, named the way the recipient knows it. */
  title: string;
  changes: Change[];
  after: EventDetails;
  /** Where in the app to look — "My Matches" for a table, the league for a meetup. */
  where: string;
  /**
   * Whoever made the change, named and reachable in the body of the message.
   *
   * The address it is sent from would carry the same information for most people,
   * but not reliably: it goes out through BCC, some clients hide the sender on a
   * phone, and a member who signed in with Google may be writing from an address
   * nobody in the group recognises. A plan moving is also exactly when somebody
   * needs to ask "can I still make it?" — so the person who moved it is stated
   * outright, with a phone number when they have given one.
   */
  from: Contact;
}) {
  const lines = [
    `${title} has changed.`,
    '',
    `When: ${formatFullWhen(after.date_time)}`,
    `Where: ${venueOf(after)}`,
    '',
  ];

  if (changes.length > 0) {
    lines.push(
      'What changed:',
      ...changes.map((change) => `  ${change.label}: was ${change.from}`),
      ''
    );
  }

  lines.push(`Details and everyone who is coming: ${AppOrigin}`, `Look under ${where}.`, '');

  // Always, even when there is only a name to give: "changed by Ted" is worth
  // more to the reader than an unattributed announcement.
  const reach = [from.email, from.phone].filter(Boolean);
  lines.push(
    from.name ? `Changed by ${from.name}.` : 'Changed by the organizer.',
    ...(reach.length > 0 ? [`Questions: ${reach.join(' · ')}`] : []),
    '',
    '— SEVEN BAM'
  );

  return {
    subject: `Change of plan · ${title}`,
    body: lines.join('\n'),
  };
}
