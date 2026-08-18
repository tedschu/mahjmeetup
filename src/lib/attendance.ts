import { supabase } from './supabase';

/**
 * Who is coming to which meetup.
 *
 * Kept against the meetup rather than against a table, because it has to be
 * answerable before there is a table — that ordering is what lets the draw skip
 * people who are away and produce three tables of three instead of four tables
 * with a hole in one of them. See the migration for the full reasoning.
 */

export type Availability = 'in' | 'out';

export type SessionAttendance = {
  /** What the signed-in member has said, or null if they have not answered. */
  mine: Availability | null;
  /** Members of the league, closed accounts excluded. */
  roster: number;
  /**
   * Everyone who has not said they are out — which is everyone, until somebody
   * says otherwise. Joining a league is the commitment; the only news is when a
   * member cannot make one of its meetups.
   */
  going: number;
  not_going: number;
  /** What a draw would produce right now. */
  expected_tables: number;
};

export const EmptyAttendance: SessionAttendance = {
  mine: null,
  roster: 0,
  going: 0,
  not_going: 0,
  expected_tables: 0,
};

/**
 * Availability for every meetup in a season, keyed by meetup.
 *
 * Two reads rather than one: the counts come from a view that aggregates the whole
 * roster, and "what did I say" is a single row of the underlying table. Joining
 * them in the database would mean a function taking the caller's id, which is
 * exactly the sort of thing RLS already answers for free.
 */
export async function fetchSessionAttendance(
  sessionIds: string[],
  userId: string
): Promise<Record<string, SessionAttendance>> {
  if (sessionIds.length === 0) return {};

  const [summary, mine] = await Promise.all([
    supabase
      .from('session_attendance_summary')
      .select('session_id, roster, going, not_going, expected_tables')
      .in('session_id', sessionIds),
    supabase
      .from('session_attendance')
      .select('session_id, status')
      .eq('profile_id', userId)
      .in('session_id', sessionIds),
  ]);

  if (summary.error) throw summary.error;
  if (mine.error) throw mine.error;

  const answers = new Map(
    (mine.data ?? []).map((row) => [row.session_id, row.status as Availability])
  );

  const byId: Record<string, SessionAttendance> = {};
  for (const row of summary.data ?? []) {
    if (!row.session_id) continue;
    byId[row.session_id] = {
      mine: answers.get(row.session_id) ?? null,
      roster: row.roster ?? 0,
      going: row.going ?? 0,
      not_going: row.not_going ?? 0,
      expected_tables: row.expected_tables ?? 0,
    };
  }

  return byId;
}

/**
 * Say whether you are coming.
 *
 * Runs in the database because saying no after the tables are drawn also has to
 * give the seat up — and that means writing a match hosted by somebody else, which
 * the host-only update policy refuses. Returns how many tables the member has just
 * left, so the screen can say what happened rather than assume.
 */
export async function setAttendance(sessionId: string, status: Availability): Promise<number> {
  const { data, error } = await supabase.rpc('set_session_attendance', {
    p_session_id: sessionId,
    p_status: status,
  });

  if (error) throw error;
  return (data as number) ?? 0;
}

/**
 * Offer a meetup's short tables to people outside the league, or stop.
 *
 * Organizers only, and only tables with an empty chair — flagging a full one would
 * put a table in Browse that nobody can join. Returns how many were opened.
 */
export async function openSessionToSubs(sessionId: string, open: boolean): Promise<number> {
  const { data, error } = await supabase.rpc('open_session_to_subs', {
    p_session_id: sessionId,
    p_open: open,
  });

  if (error) throw error;
  return (data as number) ?? 0;
}
