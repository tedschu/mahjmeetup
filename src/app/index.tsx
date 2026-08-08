import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MatchCard } from '@/components/match-card';
import { MatchSheet } from '@/components/match-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchUpcomingMatches,
  isSeated,
  joinMatch,
  leaveMatch,
  SEATS_PER_MATCH,
  type Match,
} from '@/lib/matches';
import { supabase } from '@/lib/supabase';

// Scramble and League are gone: this screen only lists pick-up games now, so
// every row was a Scramble and the League filter always came back empty.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'supplies', label: 'Tiles provided' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function matchesFilter(match: Match, filter: FilterKey) {
  switch (filter) {
    case 'open':
      return match.status === 'open';
    case 'supplies':
      return Boolean(match.supplies_provided);
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
              type={selected ? 'backgroundSelected' : 'background'}
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

/**
 * Only genuinely actionable states get a control. "Hosting" and "Full" used to
 * sit here styled like buttons while doing nothing; the card's edge bar and
 * standing label carry that now.
 */
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

  // The host holds a seat for the life of the match; leaving would orphan it.
  // Calling a match off is an edit, and lives on My Matches.
  if (match.host_id === userId) return null;
  if (busy) return <ActivityIndicator />;

  if (isSeated(match, userId)) {
    return (
      <Pressable onPress={onLeave} style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="backgroundSelected" style={styles.seatButton}>
          <ThemedText type="label" themeColor="textSecondary">
            Leave
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }

  if (match.players.length >= SEATS_PER_MATCH) return null;

  return (
    <Pressable onPress={onJoin} style={({ pressed }) => pressed && styles.pressed}>
      <View style={[styles.seatButton, { backgroundColor: theme.accent }]}>
        <ThemedText type="label" style={styles.joinLabel}>
          Join
        </ThemedText>
      </View>
    </Pressable>
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
    <ThemedView type="backgroundElement" style={styles.container}>
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
                action={
                  <SeatButton
                    match={item}
                    userId={userId ?? ''}
                    busy={busyMatchId === item.id}
                    onJoin={() => changeSeat(item.id, joinMatch)}
                    onLeave={() => changeSeat(item.id, leaveMatch)}
                  />
                }
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

        {/* Keyed on open so each visit starts from a blank form: the sheet reads
            its initial state once, when it mounts. */}
        <MatchSheet
          key={isProposing ? 'proposing' : 'closed'}
          hostId={userId}
          match={null}
          visible={isProposing}
          onClose={() => setIsProposing(false)}
          onSaved={async () => {
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
  filterBar: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  filterChip: {
    paddingVertical: Spacing.two,
    minHeight: 40,
    justifyContent: 'center',
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
  /** Same scale as the host controls on My Matches, so cards read consistently. */
  seatButton: {
    paddingVertical: Spacing.one,
    minHeight: 32,
    minWidth: 104,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
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
