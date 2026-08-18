/**
 * Turning "every week until December" into a list of dates.
 *
 * Deliberately not a recurrence rule kept in the database. A league's meetups are
 * handled one at a time once they exist — drawn, redrawn, deleted, and one of them
 * moved when a venue falls through — so a stored rule would have to be reconciled
 * against a list of exceptions on every read, which is most of what makes calendar
 * software hard. Expanding the pattern once, at the moment the organizer asks for
 * it, costs a single insert and leaves every meetup exactly as editable as one
 * typed by hand. Nothing downstream needs to know a series ever existed.
 *
 * All arithmetic is in local wall-clock terms on purpose: a league that meets at
 * 7pm on Tuesdays means 7pm local, and expects to still mean 7pm local after the
 * clocks change. Stepping in fixed 24-hour increments would drift an hour twice a
 * year, which is exactly the kind of quiet wrong that nobody reports as a bug.
 */

export type Frequency = 'once' | 'daily' | 'weekly' | 'monthly';

export const Frequencies: { value: Frequency; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

/**
 * The most meetups one run will create.
 *
 * Daily for a year is 365 rows nobody meant to make and would then have to delete
 * one at a time. The cap is stated in the form rather than enforced silently, and
 * a longer season is served by running it again from where it stopped.
 */
export const MaxOccurrences = 60;

export type Expansion = {
  /** `yyyy-mm-dd`, in order, starting with the first date itself. */
  dates: string[];
  /** The run stopped at `MaxOccurrences` with the end date not yet reached. */
  capped: boolean;
  /**
   * Months the pattern does not occur in — a fifth Tuesday in a month that has
   * only four. Skipped rather than pulled back to the fourth, because a group that
   * meets on the fifth Tuesday does not meet in a month without one, and inventing
   * a date would put a meetup on a day nobody chose.
   */
  skipped: number;
};

const Empty: Expansion = { dates: [], capped: false, skipped: 0 };

/** `yyyy-mm-dd` for a Date, read in local time rather than UTC. */
function isoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Local midnight for a `yyyy-mm-dd`, or null if it is not a real date. */
function parseDate(value: string): Date | null {
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  // Rejects the 31st of a 30-day month, which the constructor would roll forward.
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/**
 * Which weekday a date is, and which one of those it is in its month.
 *
 * This is what "monthly" means here: the first Tuesday, the third Saturday. A
 * group meeting monthly meets on a weekday, and a rule keyed to the day number
 * would wander across the week — the 5th falling on a Saturday one month and a
 * Wednesday the next, which is no use to anyone with a standing Tuesday evening.
 * Both parts are read off the first date, so the pattern is stated by picking it
 * rather than by answering another question.
 */
function weekdayPositionOf(date: Date) {
  return { weekday: date.getDay(), ordinal: Math.ceil(date.getDate() / 7) };
}

/**
 * The nth given weekday of a month, or null when the month does not have one —
 * a fifth Monday exists in some months and not others.
 */
function nthWeekdayOf(monthStart: Date, weekday: number, ordinal: number): Date | null {
  const offset = (weekday - monthStart.getDay() + 7) % 7;
  const day = 1 + offset + (ordinal - 1) * 7;

  const candidate = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
  // Rolled into the next month, so this one has no such weekday.
  if (candidate.getMonth() !== monthStart.getMonth()) return null;

  return candidate;
}

const Ordinals = ['first', 'second', 'third', 'fourth', 'fifth'];

/**
 * "the first Tuesday of each month" — so the form can state the rule it inferred
 * from the date, rather than leaving "Monthly" to be guessed at.
 */
export function describeMonthly(start: string): string | null {
  const from = parseDate(start);
  if (!from) return null;

  const { ordinal } = weekdayPositionOf(from);
  const day = from.toLocaleDateString(undefined, { weekday: 'long' });

  return `the ${Ordinals[ordinal - 1] ?? `${ordinal}th`} ${day} of each month`;
}

/**
 * Every date the pattern lands on, from `start` up to and including `end`.
 *
 * Returns nothing at all for an end date before the start, rather than a single
 * meetup — an organizer who has the dates the wrong way round has not asked for
 * one meetup, and the form says so instead of quietly creating it.
 */
export function expandDates(start: string, end: string, frequency: Frequency): Expansion {
  const from = parseDate(start);
  if (!from) return Empty;

  if (frequency === 'once') return { dates: [isoDate(from)], capped: false, skipped: 0 };

  const until = parseDate(end);
  if (!until || until < from) return Empty;

  // Gathered one past the cap and sliced back, so `capped` states whether there
  // were genuinely more to come rather than guessing from a round number — a
  // series that happens to end on its 60th meetup is not truncated.
  const limit = MaxOccurrences + 1;
  const dates: string[] = [];
  let skipped = 0;

  if (frequency === 'monthly') {
    const { weekday, ordinal } = weekdayPositionOf(from);

    for (let step = 0; dates.length < limit; step += 1) {
      // The first of the target month, which advances even in a month the pattern
      // misses — so a February without a fifth Tuesday cannot end the run.
      const monthStart = new Date(from.getFullYear(), from.getMonth() + step, 1);
      if (monthStart > until) break;

      const candidate = nthWeekdayOf(monthStart, weekday, ordinal);
      if (!candidate) {
        skipped += 1;
        continue;
      }
      if (candidate > until) break;

      dates.push(isoDate(candidate));
    }
  } else {
    const stride = frequency === 'daily' ? 1 : 7;

    for (let step = 0; dates.length < limit; step += 1) {
      // Rebuilt from the start date each time rather than accumulated, so a
      // daylight saving boundary cannot shift the series by an hour.
      const candidate = new Date(from.getFullYear(), from.getMonth(), from.getDate() + step * stride);
      if (candidate > until) break;

      dates.push(isoDate(candidate));
    }
  }

  const capped = dates.length > MaxOccurrences;
  return { dates: capped ? dates.slice(0, MaxOccurrences) : dates, capped, skipped };
}

/** "Sat, Sep 5" — for telling the organizer what they are about to create. */
export function formatDateOnly(date: string) {
  const parsed = parseDate(date);
  if (!parsed) return date;

  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
