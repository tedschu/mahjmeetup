import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/button';
import { MatchCard } from '@/components/match-card';
import { MatchSheet } from '@/components/match-sheet';
import { Ribbon } from '@/components/ribbon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
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
              style={[
                styles.filterChip,
                // The chosen chip is outlined in teal as well as filled with the
                // highlight, so it still reads as chosen in dark mode where the
                // highlight is a muted warm brown rather than a pale yellow.
                { borderColor: selected ? theme.accent : theme.rule },
              ]}>
              <ThemedText type="label" themeColor={selected ? 'text' : 'textSecondary'}>
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
        <View
          style={[styles.seatButton, styles.outlined, { borderColor: theme.rule }]}>
          <ThemedText type="label" themeColor="textSecondary">
            Leave
          </ThemedText>
        </View>
      </Pressable>
    );
  }

  if (match.players.length >= SEATS_PER_MATCH) return null;

  return (
    <Pressable onPress={onJoin} style={({ pressed }) => pressed && styles.pressed}>
      <View style={[styles.seatButton, { backgroundColor: theme.accent }]}>
        {/* Dark type on the teal, not white: white on `#2fb7a6` is 2.5:1. */}
        <ThemedText type="label" style={{ color: theme.onAccent }}>
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
              {/* `accentInk`, not `accent`: the teal fill is 2.5:1 on white and
                  this is 11px type. */}
              <ThemedText type="label" themeColor="accentInk">
                {openCount === 0
                  ? 'No open tables'
                  : `${openCount} ${openCount === 1 ? 'table' : 'tables'} open`}
              </ThemedText>
              <ThemedText type="title">Browse</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                Find a table to join
              </ThemedText>
            </View>
            {/* This screen's one gradient. */}
            <GradientButton label="Propose" onPress={() => setIsProposing(true)} />
          </View>
        </View>

        <FilterBar value={filter} onChange={setFilter} />

        {error ? (
          <ThemedText type="small" style={[styles.errorBanner, { color: theme.danger }]}>
            {error}
          </ThemedText>
        ) : null}

        {isLoading ? (
          <ActivityIndicator style={styles.spinner} />
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
              <View style={styles.empty}>
                {/* Something to look at where there was previously one grey line
                    of text in the middle of a blank screen. */}
                <Ribbon width={120} height={160} opacity={0.5} />
                <ThemedText style={styles.centered} themeColor="textSecondary">
                  {filter === 'all'
                    ? 'No upcoming matches. Propose one to get a table going.'
                    : 'No matches match this filter.'}
                </ThemedText>
              </View>
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
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  errorBanner: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  /** Same scale as the host controls on My Matches, so cards read consistently. */
  seatButton: {
    paddingVertical: Spacing.one,
    minHeight: 34,
    minWidth: 104,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  /** Leaving is not the encouraged action, so it gets an outline, not a fill. */
  outlined: {
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  empty: {
    marginTop: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
  spinner: {
    marginTop: Spacing.six,
  },
});
