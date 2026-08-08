import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { supabase } from './supabase';

import type { LeagueColor } from '@/constants/theme';

export type LeagueRole = 'organizer' | 'member';

export type League = {
  id: string;
  name: string;
  color: LeagueColor;
  created_by: string;
  invite_token: string;
};

/** A league plus where the signed-in member stands in it. */
export type MyLeague = League & { role: LeagueRole };

export type LeagueMember = {
  profile_id: string;
  role: LeagueRole;
  profile: { id: string; name: string | null; avatar_url: string | null } | null;
};

export type Season = {
  id: string;
  name: string;
  status: 'active' | 'complete';
};

export type LeagueSession = {
  id: string;
  sequence: number;
  date_time: string;
  location: string;
  location_detail: string | null;
  /** How many tables the draw produced. Zero until it has been drawn. */
  tables: number;
  /** True once any table has been played, at which point redrawing is refused. */
  played: boolean;
};

export type LeagueStanding = {
  player_id: string;
  name: string | null;
  avatar_url: string | null;
  games_played: number;
  total_points: number;
  average_points: number | null;
  wins: number;
  average_placement: number | null;
};

/**
 * Leagues the signed-in member belongs to. Read through league_members rather
 * than leagues, because the row that says which of them you organize is there.
 */
export async function fetchMyLeagues(userId: string): Promise<MyLeague[]> {
  const { data, error } = await supabase
    .from('league_members')
    .select('role, league:leagues (id, name, color, created_by, invite_token)')
    .eq('profile_id', userId)
    .order('joined_at');

  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const league = row.league as League | null;
      return league ? { ...league, role: row.role as LeagueRole } : null;
    })
    .filter((league): league is MyLeague => league !== null);
}

/**
 * Create a league. The creator is made its organizer by a trigger, so there is
 * no second write here that could fail and leave a league nobody administers.
 */
export async function createLeague(
  userId: string,
  name: string,
  color: LeagueColor
): Promise<string> {
  const { data, error } = await supabase
    .from('leagues')
    .insert({ name: name.trim(), color, created_by: userId })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function updateLeague(leagueId: string, changes: { name: string; color: LeagueColor }) {
  const { error } = await supabase
    .from('leagues')
    .update({ name: changes.name.trim(), color: changes.color })
    .eq('id', leagueId);

  if (error) throw error;
}

export async function fetchLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  const { data, error } = await supabase
    .from('league_members')
    .select('profile_id, role, profile:profiles (id, name, avatar_url)')
    .eq('league_id', leagueId)
    .order('joined_at');

  if (error) throw error;
  return (data ?? []) as LeagueMember[];
}

export async function leaveLeague(leagueId: string, userId: string) {
  const { error } = await supabase
    .from('league_members')
    .delete()
    .eq('league_id', leagueId)
    .eq('profile_id', userId);

  if (error) throw error;
}

export async function fetchSeasons(leagueId: string): Promise<Season[]> {
  const { data, error } = await supabase
    .from('seasons')
    .select('id, name, status')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Season[];
}

export async function createSeason(leagueId: string, name: string): Promise<string> {
  const { data, error } = await supabase
    .from('seasons')
    .insert({ league_id: leagueId, name: name.trim() })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * The meetups in a season, each carrying how many tables it has been drawn into.
 * The count comes from the matches pointing back at the session, so it cannot
 * disagree with what was actually drawn.
 */
export async function fetchSessions(seasonId: string): Promise<LeagueSession[]> {
  const { data, error } = await supabase
    .from('league_sessions')
    .select('id, sequence, date_time, location, location_detail, matches (id, status)')
    .eq('season_id', seasonId)
    .order('sequence');

  if (error) throw error;

  return (data ?? []).map((row) => {
    const matches = (row.matches ?? []) as { id: string; status: string | null }[];
    return {
      id: row.id,
      sequence: row.sequence,
      date_time: row.date_time,
      location: row.location,
      location_detail: row.location_detail,
      tables: matches.length,
      played: matches.some((match) => match.status === 'completed'),
    };
  });
}

export async function createSession(
  seasonId: string,
  session: { sequence: number; date_time: string; location: string; location_detail: string | null }
): Promise<string> {
  const { data, error } = await supabase
    .from('league_sessions')
    .insert({ season_id: seasonId, ...session })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function deleteSession(sessionId: string) {
  const { error } = await supabase.from('league_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

/**
 * Shuffle the roster and deal it across as many tables as it takes. Runs in the
 * database because seating other people is something no client is permitted to
 * do. Returns the number of tables.
 */
export async function drawSession(sessionId: string): Promise<number> {
  const { data, error } = await supabase.rpc('draw_league_session', {
    p_session_id: sessionId,
  });

  if (error) throw error;
  return (data as number) ?? 0;
}

export async function joinLeagueWithToken(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_league_with_token', {
    p_token: token.trim(),
  });

  if (error) throw error;
  return data as string;
}

export async function fetchLeagueStandings(leagueId: string): Promise<LeagueStanding[]> {
  const { data, error } = await supabase
    .from('league_standings')
    .select('*')
    .eq('league_id', leagueId)
    .order('total_points', { ascending: false })
    .order('wins', { ascending: false })
    .order('name');

  if (error) throw error;

  return (data ?? []).map((row) => ({
    player_id: row.player_id ?? '',
    name: row.name,
    avatar_url: row.avatar_url,
    games_played: row.games_played ?? 0,
    total_points: row.total_points ?? 0,
    average_points: row.average_points,
    wins: row.wins ?? 0,
    average_placement: row.average_placement,
  }));
}

/**
 * The link that adds someone to a league.
 *
 * The token rides as a query parameter on /leagues rather than as its own
 * /join/<token> route. `expo-router/ui` Tabs only routes what has a TabTrigger,
 * so a standalone route silently fell through to the first tab — the link
 * appeared to work and quietly did nothing.
 *
 * Built from the running origin on web, so a link copied from localhost points at
 * localhost and one copied from the deployed site points there. Native has no
 * origin to read and falls back to the production host, because a link shared
 * from a phone has to work for whoever receives it.
 */
export function inviteUrlFor(league: League) {
  const origin =
    Platform.OS === 'web' ? window.location.origin : 'https://tschusters-team-mahjong.expo.app';

  return `${origin}/leagues?invite=${league.invite_token}`;
}

/**
 * An invite token held over a sign-in.
 *
 * Google sends people back to the app's origin, not to the URL they started on,
 * so a signed-out person opening an invite link would otherwise land on Browse
 * with the token gone and no idea they had missed anything. Stashing it lets the
 * join finish itself once there is a session.
 */
const PendingInviteKey = 'pending-league-invite';

/** Reads an invite token off the current URL, where an invite link puts it. */
export function inviteTokenFromUrl(): string | null {
  if (Platform.OS !== 'web') return null;

  try {
    return new URL(window.location.href).searchParams.get('invite');
  } catch {
    return null;
  }
}

export async function rememberPendingInvite(token: string) {
  try {
    await AsyncStorage.setItem(PendingInviteKey, token);
  } catch {
    // Worst case the member opens the link again once signed in.
  }
}

export async function takePendingInvite(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(PendingInviteKey);
    // Read once: a token that failed to redeem should not be retried forever.
    if (token) await AsyncStorage.removeItem(PendingInviteKey);
    return token;
  } catch {
    return null;
  }
}
