import { supabase } from './supabase';

/** Seats at a mahjong table. Mirrors public.match_seat_limit() in the database. */
export const SEATS_PER_MATCH = 4;

const MATCH_SELECT = `
  id, date_time, location, notes, supplies_provided, is_league, status, host_id,
  host:profiles!matches_host_id_fkey (id, name),
  players:match_players (player_id, score, profile:profiles (id, name))
`;

export type Match = {
  id: string;
  date_time: string;
  location: string;
  notes: string | null;
  supplies_provided: boolean | null;
  is_league: boolean | null;
  status: string | null;
  host_id: string;
  host: { id: string; name: string | null } | null;
  players: {
    player_id: string;
    score: number | null;
    profile: { id: string; name: string | null } | null;
  }[];
};

export function isSeated(match: Match, userId: string) {
  return match.players.some((player) => player.player_id === userId);
}

export function formatWhen(dateTime: string) {
  const date = new Date(dateTime);
  const day = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} @ ${time}`;
}

/** Matches the signed-in member is seated at, plus any they host but have not taken a seat in. */
export async function fetchMyMatches(userId: string): Promise<Match[]> {
  const { data: seats, error: seatsError } = await supabase
    .from('match_players')
    .select('match_id')
    .eq('player_id', userId);

  if (seatsError) throw seatsError;

  const seatedIds = seats.map((seat) => seat.match_id);
  const query = supabase.from('matches').select(MATCH_SELECT).order('date_time');

  // `id.in.()` is not valid PostgREST, so only widen the filter when there are seats.
  const { data, error } = await (seatedIds.length
    ? query.or(`host_id.eq.${userId},id.in.(${seatedIds.join(',')})`)
    : query.eq('host_id', userId));

  if (error) throw error;
  return (data ?? []) as Match[];
}

export type NewMatch = {
  date_time: string;
  location: string;
  notes: string | null;
  supplies_provided: boolean;
  is_league: boolean;
};

/**
 * Post a match with the signed-in member as host. The host's seat is taken by
 * the seat_host_after_match_insert trigger, so this does not insert one.
 */
export async function createMatch(hostId: string, match: NewMatch): Promise<string> {
  const { data, error } = await supabase
    .from('matches')
    .insert({ ...match, host_id: hostId })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

/** Upcoming matches still accepting players or already closed, soonest first. */
export async function fetchUpcomingMatches(): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .in('status', ['open', 'full'])
    .gte('date_time', new Date().toISOString())
    .order('date_time');

  if (error) throw error;
  return (data ?? []) as Match[];
}

/**
 * Take a seat. Capacity and the open/full status are enforced by database
 * triggers, so a full or closed match rejects the insert rather than silently
 * overfilling.
 */
export async function joinMatch(matchId: string, userId: string) {
  const { error } = await supabase
    .from('match_players')
    .insert({ match_id: matchId, player_id: userId });

  if (error) throw error;
}

/**
 * Record the card and close the match, in one server-side step. The database
 * checks that the caller hosts the match and that every seat has a score, so a
 * half-entered card can never close a match or leave someone on zero in the
 * standings. Safe to call again to correct a mistake.
 */
export async function enterMatchScores(
  matchId: string,
  scores: { player_id: string; score: number }[]
) {
  const { error } = await supabase.rpc('enter_match_scores', {
    p_match_id: matchId,
    p_scores: scores,
  });

  if (error) throw error;
}

export async function leaveMatch(matchId: string, userId: string) {
  const { error } = await supabase
    .from('match_players')
    .delete()
    .eq('match_id', matchId)
    .eq('player_id', userId);

  if (error) throw error;
}
