import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const MATCH_SELECT = `
  id, date_time, location, notes, supplies_provided, is_league, status, host_id,
  host:profiles!matches_host_id_fkey (id, name),
  players:match_players (player_id, score, profile:profiles (id, name))
`;

type Match = {
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

const SEATS_PER_MATCH = 4;

/** Matches the signed-in member is seated at, plus any they host but have not taken a seat in. */
async function fetchMyMatches(userId: string): Promise<Match[]> {
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

function formatWhen(dateTime: string) {
  const date = new Date(dateTime);
  const day = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} @ ${time}`;
}

function MatchCard({ match, userId }: { match: Match; userId: string }) {
  const theme = useTheme();
  const isHosting = match.host_id === userId;
  const names = match.players
    .map((player) => player.profile?.name)
    .filter((name): name is string => Boolean(name));
  const scored = match.players.filter((player) => player.score !== null);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="defaultSemiBold">{formatWhen(match.date_time)}</ThemedText>
        <ThemedText type="small" style={[styles.badge, { color: theme.accent }]}>
          {match.is_league ? 'League' : 'Scramble'}
        </ThemedText>
      </View>

      <ThemedText>{match.location}</ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        {match.players.length}/{SEATS_PER_MATCH} seated
        {names.length ? ` · ${names.join(', ')}` : ''}
      </ThemedText>

      {match.notes ? (
        <ThemedText type="small" themeColor="textSecondary">
          {match.notes}
        </ThemedText>
      ) : null}

      <View style={styles.cardFooter}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {match.status ?? 'open'}
        </ThemedText>
        {isHosting ? (
          <ThemedText type="smallBold" style={{ color: theme.accentGold }}>
            Hosting
          </ThemedText>
        ) : null}
        {scored.length ? (
          <ThemedText type="small" themeColor="textSecondary">
            Scores in
          </ThemedText>
        ) : null}
      </View>
    </ThemedView>
  );
}

export default function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('You are signed out.');
        return;
      }

      setUserId(user.id);
      setMatches(await fetchMyMatches(user.id));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your matches.');
    }
  }, []);

  // Refetch on focus so seats taken elsewhere in the app show up on return.
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

  // Soonest first for upcoming; most recent first for past.
  const upcoming = matches.filter((m) => m.status === 'open' || m.status === 'full');
  const past = matches
    .filter((m) => m.status === 'completed' || m.status === 'canceled')
    .reverse();

  const sections = [
    { title: 'Upcoming', data: upcoming },
    { title: 'Past', data: past },
  ].filter((section) => section.data.length > 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title">My Matches</ThemedText>
          <ThemedText style={styles.subtitle}>Upcoming and past games</ThemedText>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.centered} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MatchCard match={item} userId={userId ?? ''} />}
            renderSectionHeader={({ section }) => (
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
                {section.title.toUpperCase()}
              </ThemedText>
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <ThemedText style={styles.centered} themeColor="textSecondary">
                {error ?? 'No matches yet. Join one from Browse to get started.'}
              </ThemedText>
            }
            stickySectionHeadersEnabled={false}
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
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  sectionHeader: {
    marginTop: Spacing.two,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  centered: {
    marginTop: Spacing.six,
    textAlign: 'center',
  },
});
