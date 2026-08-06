import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchLeaderboard, type LeaderboardRow } from '@/lib/leaderboard';
import { supabase } from '@/lib/supabase';

type RankedRow = LeaderboardRow & { rank: number };

/** Equal totals share a rank, and the next rank skips accordingly (1, 2, 2, 4). */
function withRanks(rows: LeaderboardRow[]): RankedRow[] {
  let lastPoints: number | null = null;
  let lastRank = 0;

  return rows.map((row, index) => {
    if (row.total_points !== lastPoints) {
      lastRank = index + 1;
      lastPoints = row.total_points;
    }
    return { ...row, rank: lastRank };
  });
}

function summarise(row: RankedRow) {
  if (row.games_played === 0) return 'No completed matches yet';

  const games = `${row.games_played} ${row.games_played === 1 ? 'game' : 'games'}`;
  const wins = `${row.wins} ${row.wins === 1 ? 'win' : 'wins'}`;
  // toFixed keeps the column even: the view returns 40.0, which JS would
  // otherwise render as "40" next to "53.3".
  const average = row.average_points === null ? null : `avg ${row.average_points.toFixed(1)}`;

  return [games, wins, average].filter(Boolean).join(' · ');
}

function StandingRow({ row, isCurrentUser }: { row: RankedRow; isCurrentUser: boolean }) {
  const theme = useTheme();
  const unplayed = row.games_played === 0;

  return (
    <ThemedView
      type={isCurrentUser ? 'backgroundSelected' : 'backgroundElement'}
      style={styles.row}>
      <ThemedText
        type="defaultSemiBold"
        style={[styles.rank, unplayed && styles.muted]}
        themeColor={unplayed ? 'textSecondary' : 'text'}>
        {unplayed ? '—' : row.rank}
      </ThemedText>

      <View style={styles.identity}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>
          {row.name ?? 'Unnamed member'}
          {isCurrentUser ? ' (you)' : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {summarise(row)}
        </ThemedText>
      </View>

      <ThemedText
        type="defaultSemiBold"
        style={[styles.points, { color: row.rank === 1 && !unplayed ? theme.accentGold : theme.text }]}>
        {row.total_points}
      </ThemedText>
    </ThemedView>
  );
}

export default function LeaderboardScreen() {
  const [rows, setRows] = useState<RankedRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserId(user?.id ?? null);
      setRows(withRanks(await fetchLeaderboard()));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the standings.');
    }
  }, []);

  // Standings move whenever a host enters scores, so refetch on focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        await load();
        if (active) setIsLoading(false);
      })();

      return () => {
        active = false;
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title">Leaderboard</ThemedText>
          <ThemedText style={styles.subtitle}>Ranked by total points</ThemedText>
        </View>

        {error ? (
          <ThemedText type="small" style={styles.errorBanner}>
            {error}
          </ThemedText>
        ) : null}

        {isLoading ? (
          <ActivityIndicator style={styles.centered} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.player_id}
            renderItem={({ item }) => (
              <StandingRow row={item} isCurrentUser={item.player_id === userId} />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <ThemedText style={styles.centered} themeColor="textSecondary">
                No members yet.
              </ThemedText>
            }
            ListFooterComponent={
              rows.some((row) => row.games_played > 0) ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
                  Totals count finished matches with scores entered.
                </ThemedText>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  subtitle: {
    opacity: 0.7,
    marginTop: 4,
  },
  errorBanner: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    color: '#c0392b',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  rank: {
    minWidth: 24,
    textAlign: 'center',
  },
  muted: {
    opacity: 0.6,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  points: {
    fontVariant: ['tabular-nums'],
  },
  footnote: {
    marginTop: Spacing.three,
    textAlign: 'center',
  },
  centered: {
    marginTop: Spacing.six,
    textAlign: 'center',
  },
});
