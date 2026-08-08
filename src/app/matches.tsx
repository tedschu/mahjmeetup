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

import { Icon, type IconName } from '@/components/icon';
import { MatchCard } from '@/components/match-card';
import { MatchSheet } from '@/components/match-sheet';
import { ScoreEntrySheet } from '@/components/score-entry-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const theme = useTheme();

  const isHost = match.host_id === userId;
  const scored = match.players.some((player) => player.score !== null);
  const isOver = match.status === 'canceled' || match.status === 'completed';
  // Only the host records the card, and a called-off match has nothing to record.
  const canScore = isHost && match.status !== 'canceled' && match.players.length > 0;

  // Icons rather than words: three labelled buttons could not share a line with
  // the player names at any width, and stacking them made a card action look
  // like a form's submit. Each carries its label for screen readers instead.
  return (
    <View style={styles.actions}>
      {/* Every match on this screen is one the member is part of, so there is
          always something worth putting in a calendar — until it is past. */}
      {isOver ? null : (
        <IconButton
          name={sentToCalendar ? 'calendarCheck' : 'calendarPlus'}
          label={sentToCalendar ? 'Already sent to calendar — send again' : 'Add to calendar'}
          onPress={onAddToCalendar}
        />
      )}

      {isHost && !isOver ? (
        <IconButton name="pencil" label="Edit match" onPress={onEdit} />
      ) : null}

      {canScore ? (
        <IconButton
          name="scorecard"
          label={scored ? 'Edit scores' : 'Enter scores'}
          onPress={onEnterScores}
          tone={theme.accent}
        />
      ) : null}
    </View>
  );
}

/**
 * A square control that says what it does only to assistive tech. `tone` fills it
 * for the one action worth drawing the eye — recording the card — and the rest
 * stay quiet.
 */
function IconButton({
  name,
  label,
  onPress,
  tone,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  tone?: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.iconButton,
          tone
            ? // Border matched to the fill rather than left to default to black,
              // which was drawing a dark outline around the filled button.
              { backgroundColor: tone, borderColor: tone }
            : { backgroundColor: theme.backgroundSelected, borderColor: theme.rule },
        ]}>
        <Icon name={name} color={tone ? '#ffffff' : theme.textSecondary} size={18} />
      </View>
    </Pressable>
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
  const upcoming = matches.filter((m) => m.status === 'open' || m.status === 'full');
  const past = matches
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
          <ThemedText type="label" themeColor="accent">
            {upcoming.length === 0 ? 'Nothing booked' : `${upcoming.length} coming up`}
          </ThemedText>
          <ThemedText type="title">My Matches</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Upcoming and past games
          </ThemedText>
        </View>

        {isLoading ? (
          <ActivityIndicator style={styles.centered} />
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
              <ThemedText style={styles.centered} themeColor="textSecondary">
                {error ?? 'No matches yet. Join one from Browse to get started.'}
              </ThemedText>
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
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  sectionHeader: {
    marginTop: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  /**
   * Square and 34px: small enough that three of them sit in a card's bottom row
   * at phone width, large enough to hit. Below the 44px ideal, which is the
   * trade for keeping the card short.
   */
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  centered: {
    marginTop: Spacing.six,
    textAlign: 'center',
  },
});
