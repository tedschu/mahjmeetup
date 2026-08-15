import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AllKinds, keepKind, MatchKindChips, type MatchKinds } from '@/components/browse-filters';
import { QuietButton } from '@/components/button';
import { MatchCard } from '@/components/match-card';
import { MatchSheet } from '@/components/match-sheet';
import { Ribbon } from '@/components/ribbon';
import { ScoreEntrySheet } from '@/components/score-entry-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  addMatchToCalendar,
  loadCalendarSent,
  recordCalendarSent,
} from '@/lib/calendar';
import { fetchMyMatches, type Match } from '@/lib/matches';
import { supabase } from '@/lib/supabase';

/**
 * What a member can do with a match they are part of. Calling a match off lives
 * inside the edit sheet rather than here, where there is room to say what
 * happens to everyone else who joined.
 */
function MatchActions({
  match,
  userId,
  sentToCalendar,
  onAddToCalendar,
  onEdit,
  onEnterScores,
}: {
  match: Match;
  userId: string;
  sentToCalendar: boolean;
  onAddToCalendar: () => void;
  onEdit: () => void;
  onEnterScores: () => void;
}) {
  const isHost = match.host_id === userId;
  const scored = match.players.some((player) => player.score !== null);
  const isOver = match.status === 'canceled' || match.status === 'completed';
  // Only the host records the card, and a called-off match has nothing to record.
  const canScore = isHost && match.status !== 'canceled' && match.players.length > 0;

  return (
    <View style={styles.actions}>
      {/* Every match on this screen is one the member is part of, so there is
          always something worth putting in a calendar — until it is past. */}
      {isOver ? null : (
        <QuietButton
          icon={sentToCalendar ? 'calendarCheck' : 'calendarPlus'}
          label={sentToCalendar ? 'Already sent to calendar — send again' : 'Add to calendar'}
          onPress={onAddToCalendar}
          tone={sentToCalendar ? 'done' : 'default'}
        />
      )}

      {isHost && !isOver ? (
        <QuietButton icon="pencil" label="Edit match" onPress={onEdit} />
      ) : null}

      {canScore ? (
        <QuietButton
          icon="scorecard"
          label={scored ? 'Edit scores' : 'Enter scores'}
          onPress={onEnterScores}
          tone="primary"
        />
      ) : null}
    </View>
  );
}

export default function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scoringMatchId, setScoringMatchId] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [calendarSent, setCalendarSent] = useState<Set<string>>(new Set());
  const [kinds, setKinds] = useState<MatchKinds>(AllKinds);

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
      setCalendarSent(await loadCalendarSent(user.id));
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

  const sendToCalendar = useCallback(
    async (match: Match) => {
      await addMatchToCalendar(match);
      if (!userId) return;
      setCalendarSent(await recordCalendarSent(userId, match.id, calendarSent));
    },
    [calendarSent, userId]
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  // Soonest first for upcoming; most recent first for past.
  const ofChosenKind = matches.filter((m) => keepKind(m.league_id, kinds));
  const upcoming = ofChosenKind.filter((m) => m.status === 'open' || m.status === 'full');
  const past = ofChosenKind
    .filter((m) => m.status === 'completed' || m.status === 'canceled')
    .reverse();

  const sections = [
    { title: 'Upcoming', data: upcoming },
    { title: 'Past', data: past },
  ].filter((section) => section.data.length > 0);

  // Read from the freshly loaded list, so the sheets show current seats rather
  // than a snapshot taken when the button was tapped.
  const scoringMatch = matches.find((match) => match.id === scoringMatchId) ?? null;
  const editingMatch = matches.find((match) => match.id === editingMatchId) ?? null;

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="label" themeColor="accentInk">
            {upcoming.length === 0 ? 'Nothing booked' : `${upcoming.length} coming up`}
          </ThemedText>
          <ThemedText type="title">My Matches</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Upcoming and past games
          </ThemedText>
        </View>

        {/* Only worth offering once there is something of each kind to tell apart. */}
        {matches.some((m) => m.league_id === null) && matches.some((m) => m.league_id !== null) ? (
          <View style={styles.kinds}>
            <MatchKindChips kinds={kinds} onChange={setKinds} />
          </View>
        ) : null}

        {isLoading ? (
          <ActivityIndicator style={styles.spinner} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MatchCard
                match={item}
                userId={userId ?? ''}
                action={
                  <MatchActions
                    match={item}
                    userId={userId ?? ''}
                    sentToCalendar={calendarSent.has(item.id)}
                    onAddToCalendar={() => sendToCalendar(item)}
                    onEdit={() => setEditingMatchId(item.id)}
                    onEnterScores={() => setScoringMatchId(item.id)}
                  />
                }
              />
            )}
            renderSectionHeader={({ section }) => (
              <ThemedText type="label" themeColor="textSecondary" style={styles.sectionHeader}>
                {section.title}
              </ThemedText>
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ribbon width={120} height={160} opacity={0.5} />
                <ThemedText style={styles.centered} themeColor="textSecondary">
                  {error ?? 'No matches yet. Join one from Browse to get started.'}
                </ThemedText>
              </View>
            }
            stickySectionHeadersEnabled={false}
          />
        )}

        <ScoreEntrySheet
          key={scoringMatch?.id ?? 'none'}
          match={scoringMatch}
          visible={scoringMatch !== null}
          onClose={() => setScoringMatchId(null)}
          onSaved={async () => {
            setScoringMatchId(null);
            await load();
          }}
        />

        {/* Keyed on the match so the form is rebuilt from that match's details
            rather than keeping whatever the last one was edited to. */}
        <MatchSheet
          key={`edit-${editingMatch?.id ?? 'none'}`}
          hostId={userId}
          match={editingMatch}
          visible={editingMatch !== null}
          onClose={() => setEditingMatchId(null)}
          onSaved={async () => {
            setEditingMatchId(null);
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
  subtitle: {
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  sectionHeader: {
    marginTop: Spacing.two,
  },
  kinds: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
  spinner: {
    marginTop: Spacing.six,
  },
  empty: {
    marginTop: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
});
