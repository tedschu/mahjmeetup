import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AllKinds, keepKind, MatchKindChips, type MatchKinds } from '@/components/browse-filters';
import { QuietButton } from '@/components/button';
import { MatchCard } from '@/components/match-card';
import { MatchSheet } from '@/components/match-sheet';
import { Ribbon } from '@/components/ribbon';
import { ScoreEntrySheet } from '@/components/score-entry-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addMatchToCalendar,
  loadCalendarSent,
  recordCalendarSent,
} from '@/lib/calendar';
import { fetchMyMatches, hasFinished, isSeated, leaveMatch, type Match } from '@/lib/matches';
import { supabase } from '@/lib/supabase';

/**
 * Whether giving up a seat is something this member can do on this match.
 *
 * The host is excluded, and not as an oversight: they hold a seat for the life of
 * the match, so leaving would orphan the table. Their equivalent is calling the
 * match off, which lives in the edit sheet where there is room to say what happens
 * to everyone else. Past matches are excluded too — a seat at a game that has
 * already been played is a record, not a commitment.
 *
 * Same predicate as Browse's, deliberately: the two screens offer the same action
 * on the same rows.
 */
function canLeave(match: Match, userId: string, now: number) {
  if (match.host_id === userId) return false;
  // Once the game has been and gone, a seat is a record of who was there rather
  // than a commitment somebody can withdraw. "I cannot make it" has stopped being
  // a thing you can say about last Tuesday.
  if (hasFinished(match, now)) return false;
  return isSeated(match, userId);
}

/**
 * Give up a seat. Styled as an outlined pill with a word on it rather than as one
 * of the icon buttons beside it, which is how Browse already draws this — leaving
 * is not a thing to offer behind a glyph somebody has to guess at.
 */
function LeaveButton({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  const theme = useTheme();

  if (busy) return <ActivityIndicator />;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <View style={[styles.leaveButton, { borderColor: theme.rule }]}>
        <ThemedText type="label" themeColor="textSecondary">
          Leave
        </ThemedText>
      </View>
    </Pressable>
  );
}

/**
 * What a member can do with a match they are part of. Calling a match off lives
 * inside the edit sheet rather than here, where there is room to say what
 * happens to everyone else who joined.
 */
function MatchActions({
  match,
  userId,
  sentToCalendar,
  leaving,
  now,
  onAddToCalendar,
  onEdit,
  onEnterScores,
  onLeave,
}: {
  match: Match;
  userId: string;
  sentToCalendar: boolean;
  leaving: boolean;
  /** The instant the list was classified against — see `loadedAt`. */
  now: number;
  onAddToCalendar: () => void;
  onEdit: () => void;
  onEnterScores: () => void;
  onLeave: () => void;
}) {
  const isHost = match.host_id === userId;
  const scored = match.players.some((player) => player.score !== null);
  /**
   * Two different questions, which the old code answered with one variable.
   *
   * `isClosed` is what was recorded: somebody scored it or called it off, so there
   * is nothing left to change. `hasFinished` also covers a match whose time has
   * simply passed with neither having happened — which is the ambiguous case, and
   * the reason these have to be separate. Such a match either took place and needs
   * its card entered, or it fell through and needs a new date, and the host must be
   * able to do both.
   */
  const isClosed = match.status === 'canceled' || match.status === 'completed';
  const isPast = hasFinished(match, now);
  // Only the host records the card, and a called-off match has nothing to record.
  const canScore = isHost && match.status !== 'canceled' && match.players.length > 0;

  return (
    <View style={styles.actions}>
      {/* Every match on this screen is one the member is part of, so there is
          always something worth putting in a calendar — until it is past. Keyed on
          the date, not the status: nobody needs a reminder for last Tuesday. */}
      {isPast ? null : (
        <QuietButton
          icon={sentToCalendar ? 'calendarCheck' : 'calendarPlus'}
          label={sentToCalendar ? 'Already sent to calendar — send again' : 'Add to calendar'}
          onPress={onAddToCalendar}
          tone={sentToCalendar ? 'done' : 'default'}
        />
      )}

      {/* Deliberately `isClosed` rather than `isPast`. A match that quietly went by
          without being scored is exactly the one a host may need to edit — to move
          it to a date that has not happened yet. Hiding this once the clock passed
          would leave rescheduling impossible and cancel-and-recreate the only way
          out. */}
      {isHost && !isClosed ? (
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

      {canLeave(match, userId, now) ? <LeaveButton busy={leaving} onPress={onLeave} /> : null}
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
  /** Which match is mid-leave, so only that row shows a spinner. */
  const [leavingMatchId, setLeavingMatchId] = useState<string | null>(null);
  /**
   * The instant every row is classified against, captured when the list loads
   * rather than read during render.
   *
   * Reading the clock while rendering is impure — two renders can disagree, and a
   * row could move between sections without the data changing. Tying it to the
   * fetch also puts the boundary where it belongs: the screen already refetches on
   * focus, so returning to it is exactly when "has this happened yet" should be
   * asked again.
   */
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

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
      setLoadedAt(Date.now());
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

  /**
   * Give up a seat, then reload — the match drops off this screen entirely, since
   * the list is "matches I am part of". Reloading rather than filtering locally
   * keeps the seat counts on every other row honest too.
   */
  const giveUpSeat = useCallback(
    async (match: Match) => {
      if (!userId) return;

      setLeavingMatchId(match.id);
      try {
        await leaveMatch(match.id, userId);
        await load();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not leave this match.');
      } finally {
        setLeavingMatchId(null);
      }
    },
    [load, userId]
  );

  // Soonest first for upcoming; most recent first for past.
  //
  // Split on one predicate and its negation rather than on two lists of statuses.
  // The old pair tested `open`/`full` against `completed`/`canceled`, which was
  // wrong twice: it ignored the date, so a game nobody scored stayed "Upcoming"
  // forever, and the two filters were not complements, so any match matching
  // neither would have quietly appeared in no section at all.
  //
  // One `now` for the whole pass, so a row cannot land in both sections or neither
  // because the clock moved between two filters.
  const ofChosenKind = matches.filter((m) => keepKind(m.league_id, kinds));
  const upcoming = ofChosenKind.filter((m) => !hasFinished(m, loadedAt));
  const past = ofChosenKind.filter((m) => hasFinished(m, loadedAt)).reverse();

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
                // Tapping the card opens its details, and the host can go
                // straight from there into the same sheet this row's pencil opens.
                onEdit={() => setEditingMatchId(item.id)}
                action={
                  <MatchActions
                    match={item}
                    userId={userId ?? ''}
                    sentToCalendar={calendarSent.has(item.id)}
                    leaving={leavingMatchId === item.id}
                    now={loadedAt}
                    onAddToCalendar={() => sendToCalendar(item)}
                    onEdit={() => setEditingMatchId(item.id)}
                    onEnterScores={() => setScoringMatchId(item.id)}
                    onLeave={() => giveUpSeat(item)}
                  />
                }
                // Also in the detail sheet, where somebody who opened a match to
                // check the date can act on it without closing the sheet first.
                // Guarded by the same predicate the row uses, because the sheet
                // draws a rule above its footer and a rule over an empty row is
                // just a line across the screen.
                detailAction={
                  canLeave(item, userId ?? '', loadedAt) ? (
                    <LeaveButton
                      busy={leavingMatchId === item.id}
                      onPress={() => giveUpSeat(item)}
                    />
                  ) : undefined
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
  /** Matches the Leave pill on Browse, so the same action looks the same. */
  leaveButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.7,
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
