import { supabase } from './supabase';

/**
 * A row of the standings. Mirrors the public.leaderboard view, which is where
 * the ranking formula lives — change it there, not here.
 */
export type LeaderboardRow = {
  player_id: string;
  name: string | null;
  games_played: number;
  total_points: number;
  average_points: number | null;
  wins: number;
  average_placement: number | null;
};

/**
 * Standings ordered by total points, following NMJL practice where accumulated
 * hand values are what rankings are built on. Members who have not finished a
 * match yet come back with zeroes and sort to the bottom.
 */
export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('total_points', { ascending: false })
    .order('wins', { ascending: false })
    .order('name');

  if (error) throw error;

  return (data ?? []).map((row) => ({
    player_id: row.player_id ?? '',
    name: row.name,
    games_played: row.games_played ?? 0,
    total_points: row.total_points ?? 0,
    average_points: row.average_points,
    wins: row.wins ?? 0,
    average_placement: row.average_placement,
  }));
}
