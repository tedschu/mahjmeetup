import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, LeagueColors, OnAccent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  createSeason,
  createSession,
  deleteSession,
  drawSession,
  fetchLeagueMembers,
  fetchSeasons,
  fetchSessions,
  inviteUrlFor,
  leaveLeague,
  type LeagueMember,
  type LeagueSession,
  type MyLeague,
  type Season,
} from '@/lib/leagues';
import { formatWhen, parseTimeOfDay, SEATS_PER_MATCH } from '@/lib/matches';

/** Local wall-clock date, matching the match sheet's field. */
function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function toTimestamp(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return null;
  const clock = parseTimeOfDay(time);
  if (!clock) return null;

  const [year, month, day] = date.trim().split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const at = new Date(year, month - 1, day, clock.hour, clock.minute);
  if (at.getMonth() !== month - 1 || at.getDate() !== day) return null;

  return at.toISOString();
}

/**
 * Everything about one league: who is in it, the link that adds people, and the
 * season's meetups with the draw that seats everyone.
 */
export function LeagueDetail({
  league,
  userId,
  onBack,
  onChanged,
}: {
  league: MyLeague;
  userId: string;
  onBack: () => void;
  /** Called when membership changes, so the list behind this can refresh. */
  onChanged: () => void;
}) {
  const theme = useTheme();
  const tint = LeagueColors[league.color] ?? theme.accent;
  const isOrganizer = league.role === 'organizer';

  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LeagueSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [isAddingSession, setIsAddingSession] = useState(false);
  const [sessionDate, setSessionDate] = useState(todayISO());
  const [sessionTime, setSessionTime] = useState('7:00 pm');
  const [sessionVenue, setSessionVenue] = useState('');

  const load = useCallback(async () => {
    try {
      const [roster, found] = await Promise.all([
        fetchLeagueMembers(league.id),
        fetchSeasons(league.id),
      ]);
      setMembers(roster);
      setSeasons(found);

      // Default to the season being played rather than the newest, which may
      // already be finished.
      const active = found.find((season) => season.status === 'active') ?? found[0] ?? null;
      setSeasonId((current) => current ?? active?.id ?? null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this league.');
    }
  }, [league.id]);

  useEffect(() => {
    (async () => {
      await load();
      setIsLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!seasonId) {
        if (active) setSessions([]);
        return;
      }

      try {
        const found = await fetchSessions(seasonId);
        if (active) setSessions(found);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Could not load meetups.');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [seasonId]);

  const reloadSessions = useCallback(async () => {
    if (!seasonId) return;
    setSessions(await fetchSessions(seasonId));
  }, [seasonId]);

  const copyInvite = async () => {
    await Clipboard.setStringAsync(inviteUrlFor(league));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addSeason = async () => {
    setBusy('season');
    try {
      const name = `Season ${seasons.length + 1}`;
      const id = await createSeason(league.id, name);
      setSeasons([{ id, name, status: 'active' }, ...seasons]);
      setSeasonId(id);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add a season.');
    } finally {
      setBusy(null);
    }
  };

  const addSession = async () => {
    if (!seasonId) return;
    const at = toTimestamp(sessionDate, sessionTime);
    if (!at || sessionVenue.trim().length === 0) {
      setError('Give the meetup a date, a time like 6:30 pm, and a venue.');
      return;
    }

    setBusy('session');
    try {
      await createSession(seasonId, {
        // Sequence follows the existing meetups, so the list stays in order.
        sequence: sessions.length + 1,
        date_time: at,
        location: sessionVenue.trim(),
        location_detail: null,
      });
      setIsAddingSession(false);
      setSessionVenue('');
      await reloadSessions();
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add that meetup.');
    } finally {
      setBusy(null);
    }
  };

  const draw = async (session: LeagueSession) => {
    setBusy(session.id);
    try {
      await drawSession(session.id);
      await reloadSessions();
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not draw the tables.');
    } finally {
      setBusy(null);
    }
  };

  const removeSession = async (session: LeagueSession) => {
    setBusy(session.id);
    try {
      await deleteSession(session.id);
      await reloadSessions();
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove that meetup.');
    } finally {
      setBusy(null);
    }
  };

  const leave = async () => {
    setBusy('leave');
    try {
      await leaveLeague(league.id, userId);
      onChanged();
      onBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not leave this league.');
    } finally {
      setBusy(null);
    }
  };

  const expectedTables = Math.ceil(members.length / SEATS_PER_MATCH);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <ThemedText type="label" themeColor="textSecondary">
          ← All leagues
        </ThemedText>
      </Pressable>

      <View style={styles.titleRow}>
        <View style={[styles.titleBar, { backgroundColor: tint }]} />
        <View style={styles.titleText}>
          <ThemedText type="title">{league.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {members.length} {members.length === 1 ? 'member' : 'members'} ·{' '}
            {isOrganizer ? 'You organize this' : 'You are a member'}
          </ThemedText>
        </View>
      </View>

      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}

      {isLoading ? <ActivityIndicator style={styles.centered} /> : null}

      {/* Invite link. Anyone with it can join, which is the whole mechanism —
          there is no separate approval step, by design. */}
      <ThemedView type="background" style={[styles.card, { borderColor: theme.rule }]}>
        <ThemedText type="label" themeColor="textSecondary">
          Invite link
        </ThemedText>
        <ThemedText type="small" numberOfLines={1} style={styles.link}>
          {inviteUrlFor(league)}
        </ThemedText>
        <View style={styles.cardActions}>
          <Pressable onPress={copyInvite} style={({ pressed }) => pressed && styles.pressed}>
            <View style={[styles.primaryButton, { backgroundColor: tint }]}>
              <ThemedText type="label" style={styles.primaryLabel}>
                {copied ? 'Copied' : 'Copy link'}
              </ThemedText>
            </View>
          </Pressable>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Anyone who opens this link and signs in joins the league.
        </ThemedText>
      </ThemedView>

      <ThemedView type="background" style={[styles.card, { borderColor: theme.rule }]}>
        <ThemedText type="label" themeColor="textSecondary">
          Members
        </ThemedText>
        {members.map((member) => (
          <View key={member.profile_id} style={styles.memberRow}>
            <Avatar person={member.profile ?? { name: null }} size={32} ring={theme.rule} />
            <ThemedText type="default" numberOfLines={1} style={styles.memberName}>
              {member.profile?.name ?? 'Unnamed member'}
              {member.profile_id === userId ? ' (you)' : ''}
            </ThemedText>
            {member.role === 'organizer' ? (
              <ThemedText type="label" style={{ color: tint }}>
                Organizer
              </ThemedText>
            ) : null}
          </View>
        ))}
      </ThemedView>

      {/* Seasons. A league with none yet shows nothing to switch between, so the
          picker only appears once there is a choice to make. */}
      <ThemedView type="background" style={[styles.card, { borderColor: theme.rule }]}>
        <View style={styles.cardHeader}>
          <ThemedText type="label" themeColor="textSecondary">
            Season
          </ThemedText>
          {isOrganizer ? (
            <Pressable onPress={addSeason} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="label" style={{ color: tint }}>
                {busy === 'season' ? 'Adding…' : '+ New season'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {seasons.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {isOrganizer
              ? 'Add a season, then add the meetups in it.'
              : 'No season has been set up yet.'}
          </ThemedText>
        ) : (
          <View style={styles.chips}>
            {seasons.map((season) => {
              const selected = season.id === seasonId;
              return (
                <Pressable
                  key={season.id}
                  onPress={() => setSeasonId(season.id)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedView
                    type={selected ? 'backgroundSelected' : 'backgroundElement'}
                    style={[styles.chip, { borderColor: selected ? tint : theme.rule }]}>
                    <ThemedText type="label" themeColor={selected ? 'text' : 'textSecondary'}>
                      {season.name}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </View>
        )}
      </ThemedView>

      {seasonId ? (
        <ThemedView type="background" style={[styles.card, { borderColor: theme.rule }]}>
          <View style={styles.cardHeader}>
            <ThemedText type="label" themeColor="textSecondary">
              Meetups
            </ThemedText>
            {isOrganizer ? (
              <Pressable
                onPress={() => setIsAddingSession((current) => !current)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="label" style={{ color: tint }}>
                  {isAddingSession ? 'Cancel' : '+ Add meetup'}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {isAddingSession ? (
            <View style={styles.newSession}>
              <View style={styles.pair}>
                <TextInput
                  value={sessionDate}
                  onChangeText={setSessionDate}
                  placeholder="2026-09-05"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    styles.pairItem,
                    { color: theme.text, borderColor: theme.rule },
                  ]}
                />
                <TextInput
                  value={sessionTime}
                  onChangeText={setSessionTime}
                  placeholder="7:00 pm"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  style={[
                    styles.input,
                    styles.pairItem,
                    { color: theme.text, borderColor: theme.rule },
                  ]}
                />
              </View>
              <TextInput
                value={sessionVenue}
                onChangeText={setSessionVenue}
                placeholder="Where everyone meets"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.rule }]}
              />
              <Pressable onPress={addSession} style={({ pressed }) => pressed && styles.pressed}>
                <View style={[styles.primaryButton, { backgroundColor: tint }]}>
                  <ThemedText type="label" style={styles.primaryLabel}>
                    {busy === 'session' ? 'Adding…' : 'Add meetup'}
                  </ThemedText>
                </View>
              </Pressable>
            </View>
          ) : null}

          {sessions.length === 0 && !isAddingSession ? (
            <ThemedText type="small" themeColor="textSecondary">
              No meetups in this season yet.
            </ThemedText>
          ) : null}

          {sessions.map((session) => (
            <View key={session.id} style={[styles.sessionRow, { borderColor: theme.rule }]}>
              <View style={styles.sessionText}>
                <ThemedText type="defaultSemiBold">
                  {session.sequence}. {session.location}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatWhen(session.date_time)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {session.tables === 0
                    ? `Not drawn — ${expectedTables} ${expectedTables === 1 ? 'table' : 'tables'} from ${members.length} members`
                    : `${session.tables} ${session.tables === 1 ? 'table' : 'tables'} drawn${
                        session.played ? ' · played' : ''
                      }`}
                </ThemedText>
              </View>

              {isOrganizer ? (
                <View style={styles.sessionActions}>
                  {busy === session.id ? (
                    <ActivityIndicator />
                  ) : (
                    <>
                      {/* Redrawing is allowed until a table has been played, which
                          the database enforces rather than this button. */}
                      <Pressable
                        onPress={() => draw(session)}
                        disabled={session.played}
                        accessibilityLabel={session.tables === 0 ? 'Draw tables' : 'Redraw tables'}
                        style={({ pressed }) => pressed && styles.pressed}>
                        <View
                          style={[
                            styles.iconButton,
                            { backgroundColor: tint, borderColor: tint },
                            session.played && styles.disabled,
                          ]}>
                          <Icon name="shuffle" color={OnAccent} size={18} />
                        </View>
                      </Pressable>

                      {session.tables === 0 ? (
                        <Pressable
                          onPress={() => removeSession(session)}
                          accessibilityLabel="Remove meetup"
                          style={({ pressed }) => pressed && styles.pressed}>
                          <ThemedView
                            type="backgroundElement"
                            style={[styles.iconButton, { borderColor: theme.rule }]}>
                            <Icon name="trash" color={theme.textSecondary} size={18} />
                          </ThemedView>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </View>
              ) : null}
            </View>
          ))}

          {sessions.some((session) => session.tables > 0) ? (
            <ThemedText type="small" themeColor="textSecondary">
              Drawn tables show up in My Matches for everyone seated at them.
            </ThemedText>
          ) : null}
        </ThemedView>
      ) : null}

      <Pressable onPress={leave} style={({ pressed }) => pressed && styles.pressed}>
        <ThemedText type="label" style={[styles.destructive, { color: theme.danger }]}>
          {busy === 'leave' ? 'Leaving…' : 'Leave this league'}
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  back: {
    minHeight: 32,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  /** The league's colour, stated once at the top so the tint below reads as its. */
  titleBar: {
    width: 6,
    alignSelf: 'stretch',
    minHeight: 44,
    borderRadius: 3,
  },
  titleText: {
    flex: 1,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
    boxShadow: CardShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  link: {
    fontFamily: 'monospace',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 40,
  },
  memberName: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  newSession: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  pair: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pairItem: {
    flex: 1,
  },
  input: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sessionText: {
    flex: 1,
  },
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  primaryLabel: {
    color: OnAccent,
  },
  disabled: {
    opacity: 0.4,
  },
  destructive: {
    minHeight: 40,
    textAlignVertical: 'center',
  },
  centered: {
    marginTop: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
});
