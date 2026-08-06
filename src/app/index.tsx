import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProposeMatchSheet } from '@/components/propose-match-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchUpcomingMatches,
  formatWhen,
  isSeated,
  joinMatch,
  leaveMatch,
  SEATS_PER_MATCH,
  type Match,
} from '@/lib/matches';
import { supabase } from '@/lib/supabase';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'scramble', label: 'Scramble' },
  { key: 'league', label: 'League' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function matchesFilter(match: Match, filter: FilterKey) {
  switch (filter) {
    case 'open':
      return match.status === 'open';
    case 'scramble':
      return !match.is_league;
    case 'league':
      return Boolean(match.is_league);
    default:
      return true;
  }
}

function FilterBar({ value, onChange }: { value: FilterKey; onChange: (next: FilterKey) => void }) {
  const theme = useTheme();

  return (
    <View style={styles.filterBar}>
      {FILTERS.map((filter) => {
        const selected = filter.key === value;
        return (
          <Pressable
            key={filter.key}
            onPress={() => onChange(filter.key)}
            style={({ pressed }) => [pressed && styles.pressed]}>
            <ThemedView
              type={selected ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.filterChip}>
              <ThemedText
                type="label"
                themeColor={selected ? 'text' : 'textSecondary'}
                style={selected ? { color: theme.text } : undefined}>
                {filter.label}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </View>
  );
}

function SeatButton({
  match,
  userId,
  busy,
  onJoin,
  onLeave,
}: {
  match: Match;
  userId: string;
  busy: boolean;
  onJoin: () => void;
  onLeave: () => void;
}) {
  const theme = useTheme();
  const seated = isSeated(match, userId);
  const isHost = match.host_id === userId;
  const full = match.players.length >= SEATS_PER_MATCH;

  // The host holds a seat for the life of the match; leaving would orphan it.
  // Cancelling a match is a separate action, not yet built.
  if (isHost) {
    return (
      <ThemedText type="smallBold" style={{ color: theme.accentGold }}>
        Hosting
      </ThemedText>
    );
  }

  if (busy) return <ActivityIndicator />;

  if (seated) {
    return (
      <Pressable onPress={onLeave} style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundSelected" style={styles.seatButton}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Leave
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }

  if (full) {
    return (
      <ThemedText type="smallBold" themeColor="textSecondary">
        Full
      </ThemedText>
    );
  }

  return (
    <Pressable onPress={onJoin} style={({ pressed }) => pressed && styles.pressed}>
      <View style={[styles.seatButton, { backgroundColor: theme.accent }]}>
        <ThemedText type="smallBold" style={styles.joinLabel}>
          Join
        </ThemedText>
      </View>
    </Pressable>
  );
}

function MatchCard({
  match,
  userId,
  busy,
  onJoin,
  onLeave,
}: {
  match: Match;
  userId: string;
  busy: boolean;
  onJoin: () => void;
  onLeave: () => void;
}) {
  const theme = useTheme();
  const names = match.players
    .map((player) => player.profile?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.rule }]}>
      <View style={styles.cardHeader}>
        <ThemedText type="label" themeColor="accent">
          {match.is_league ? 'League' : 'Scramble'}
        </ThemedText>
        <ThemedText type="figureSmall" themeColor="textSecondary">
          {match.players.length}/{SEATS_PER_MATCH}
        </ThemedText>
      </View>

      <ThemedText type="subtitle">{match.location}</ThemedText>

      <ThemedText type="defaultSemiBold" themeColor="textSecondary">
        {formatWhen(match.date_time)}
      </ThemedText>

      <View style={[styles.divider, { borderColor: theme.rule }]} />

      <ThemedText type="small" themeColor="textSecondary">
        Hosted by {match.host?.name ?? 'a member'}
        {match.supplies_provided ? ' · supplies provided' : ''}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        {names.length ? names.join(', ') : 'No one seated yet'}
      </ThemedText>

      {match.notes ? (
        <ThemedText type="small" themeColor="textSecondary">
          {match.notes}
        </ThemedText>
      ) : null}

      <View style={styles.cardFooter}>
        <SeatButton
          match={match}
          userId={userId}
          busy={busy}
          onJoin={onJoin}
          onLeave={onLeave}
        />
      </View>
    </ThemedView>
  );
}

export default function BrowseMatchesScreen() {
  const theme = useTheme();
  const [matches, setMatches] = useState<Match[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [isProposing, setIsProposing] = useState(false);

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
      setMatches(await fetchUpcomingMatches());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load matches.');
    }
  }, []);

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

  // Refetch rather than patching local state: the seat triggers may also have
  // flipped the match between open and full.
  const changeSeat = useCallback(
    async (matchId: string, action: (matchId: string, userId: string) => Promise<void>) => {
      if (!userId) return;

      setBusyMatchId(matchId);
      try {
        await action(matchId, userId);
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'That did not work. Try again.');
      } finally {
        setBusyMatchId(null);
      }
    },
    [load, userId]
  );

  const visible = matches.filter((match) => matchesFilter(match, filter));
  const openCount = matches.filter((match) => match.status === 'open').length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              {/* Carries a count rather than restating the title, so the
                  eyebrow tells you something the heading does not. */}
              <ThemedText type="label" themeColor="accent">
                {openCount === 0
                  ? 'No open tables'
                  : `${openCount} ${openCount === 1 ? 'table' : 'tables'} open`}
              </ThemedText>
              <ThemedText type="title">Browse</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                Find a table to join
              </ThemedText>
            </View>
            <Pressable
              onPress={() => setIsProposing(true)}
              style={({ pressed }) => pressed && styles.pressed}>
              <View style={[styles.proposeButton, { backgroundColor: theme.accent }]}>
                <ThemedText type="smallBold" style={styles.proposeLabel}>
                  Propose
                </ThemedText>
              </View>
            </Pressable>
          </View>
        </View>

        <FilterBar value={filter} onChange={setFilter} />

        {error ? (
          <ThemedText type="small" style={styles.errorBanner}>
            {error}
          </ThemedText>
        ) : null}

        {isLoading ? (
          <ActivityIndicator style={styles.centered} />
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MatchCard
                match={item}
                userId={userId ?? ''}
                busy={busyMatchId === item.id}
                onJoin={() => changeSeat(item.id, joinMatch)}
                onLeave={() => changeSeat(item.id, leaveMatch)}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <ThemedText style={styles.centered} themeColor="textSecondary">
                {filter === 'all'
                  ? 'No upcoming matches. Propose one to get a table going.'
                  : 'No matches match this filter.'}
              </ThemedText>
            }
          />
        )}

        <ProposeMatchSheet
          hostId={userId}
          visible={isProposing}
          onClose={() => setIsProposing(false)}
          onCreated={async () => {
            setIsProposing(false);
            await load();
          }}
        />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
  },
  proposeButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  proposeLabel: {
    color: '#ffffff',
  },
  subtitle: {
    marginTop: 2,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
  },
  filterBar: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  filterChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  errorBanner: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    color: '#c0392b',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 32,
    marginTop: Spacing.one,
  },
  seatButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  joinLabel: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.7,
  },
  centered: {
    marginTop: Spacing.six,
    textAlign: 'center',
  },
});
