import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/avatar';
import { ContactRows } from '@/components/contact-rows';
import { EmailGroupButton } from '@/components/email-group-button';
import { Icon } from '@/components/icon';
import { PlaceAutocompleteInput } from '@/components/place-autocomplete-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, LeagueColors, OnAccent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  createSeason,
  createSession,
  deleteLeague,
  deleteSession,
  drawSession,
  fetchLeagueFootprint,
  fetchLeagueMembers,
  fetchSeasons,
  fetchSessions,
  inviteUrlFor,
  leaveLeague,
  setLeagueArchived,
  updateLeagueVisibility,
  type LeagueFootprint,
  type LeagueMember,
  type LeagueSession,
  type MyLeague,
  type Season,
} from '@/lib/leagues';
import {
  fetchLeagueMemberEmails,
  fetchLeagueOrganizerContact,
  type Contact,
} from '@/lib/contact';
import { type Coordinates } from '@/lib/geo';
import { formatWhen, parseTimeOfDay, SEATS_PER_MATCH } from '@/lib/matches';
import { fetchPlaceLocation } from '@/lib/places';

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
  /**
   * The league's own colour. A fill only — bars, filled buttons, a chosen chip's
   * border. Never type: four of the six league colours are pastels sitting between
   * 1.4:1 and 2.5:1 on white, which had "ORGANIZER" and "+ NEW SEASON" rendering
   * as pale yellow on white. Labels use `accentInk`; the league's identity is
   * carried by the shapes around them.
   */
  const tint = LeagueColors[league.color] ?? theme.accent;
  const isOrganizer = league.role === 'organizer';
  /**
   * An archived league is read-only: no new seasons, no new meetups, no draws, and
   * nobody joining through either door. Everything already in it stays visible,
   * which is the point of archiving rather than deleting.
   */
  const isArchived = league.archived_at !== null;
  /** Organizers may act on the league itself; members may only leave it. */
  const canRun = isOrganizer && !isArchived;

  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<LeagueSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [isPublic, setIsPublic] = useState(league.is_public);
  const [maxMembers, setMaxMembers] = useState(
    league.max_members === null ? '' : String(league.max_members)
  );

  const [isAddingSession, setIsAddingSession] = useState(false);
  const [sessionDate, setSessionDate] = useState(todayISO());
  const [sessionTime, setSessionTime] = useState('7:00 pm');
  const [sessionDetail, setSessionDetail] = useState<string | null>(null);
  const [sessionVenue, setSessionVenue] = useState('');
  /**
   * The meetup's position, resolved when a suggestion is picked. This is what
   * Browse measures a public league's distance against, so a league that wants to
   * be findable wants its meetups picked from the list rather than typed.
   */
  const [sessionAt, setSessionAt] = useState<Coordinates | null>(null);

  /**
   * What deleting would destroy. Read for organizers only, and only so the
   * confirmation can state counts instead of gesturing at "all data" — which is
   * the difference between a warning somebody reads and one they click past.
   */
  const [footprint, setFootprint] = useState<LeagueFootprint | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  /**
   * How to reach the organizer. Only members get an answer — this whole screen is
   * members-only, so in practice it is always available; the check lives in the
   * database rather than here because that is where it has to hold.
   */
  const [organizer, setOrganizer] = useState<Contact | null>(null);

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

    // Never throws, and deliberately after the block above: neither of these is
    // worth failing the screen over. The footprint only decides what the delete
    // confirmation is allowed to say, and a missing contact card is a missing
    // card rather than a broken league.
    setOrganizer(await fetchLeagueOrganizerContact(league.id));

    if (isOrganizer) {
      setFootprint(await fetchLeagueFootprint(league.id).catch(() => null));
    }
  }, [isOrganizer, league.id]);

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
        location_detail: sessionDetail,
        latitude: sessionAt?.latitude ?? null,
        longitude: sessionAt?.longitude ?? null,
      });
      setIsAddingSession(false);
      setSessionVenue('');
      setSessionDetail(null);
      setSessionAt(null);
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

  /**
   * Writes both fields together, because they are one decision: a cap is
   * meaningless while the league is invite-only, and publishing without one is a
   * different offer than publishing with one.
   *
   * Optimistic on the switch so it does not lag a tap, and reverted if the write
   * fails — leaving a switch showing "open" on a league that is not would be worse
   * than a flicker.
   */
  const saveVisibility = async (nextPublic: boolean, nextMax: string) => {
    const previous = { isPublic, maxMembers };
    setIsPublic(nextPublic);
    setMaxMembers(nextMax);
    setBusy('visibility');

    try {
      await updateLeagueVisibility(league.id, {
        is_public: nextPublic,
        max_members: nextPublic && nextMax ? Number(nextMax) : null,
      });
      onChanged();
      setError(null);
    } catch (cause) {
      setIsPublic(previous.isPublic);
      setMaxMembers(previous.maxMembers);
      setError(cause instanceof Error ? cause.message : 'Could not change who can join.');
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

  /**
   * Archive, or bring back. Stays on the screen either way rather than returning
   * to the list, because the state it just changed is stated at the top of this
   * one — going back would make the result invisible.
   */
  const toggleArchive = async () => {
    setBusy('archive');
    try {
      await setLeagueArchived(league.id, !isArchived);
      onChanged();
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not archive this league.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('delete');
    try {
      await deleteLeague(league.id);
      onChanged();
      onBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this league.');
      setIsConfirmingDelete(false);
    } finally {
      setBusy(null);
    }
  };

  /**
   * Deleting is offered only while nothing has been played.
   *
   * The same rule as a host deleting a match: once there is a record other people
   * are in, it stops being one person's to erase, and archiving keeps the
   * standings intact. Until the footprint has loaded the answer is "no", because
   * offering an irreversible action on unknown data is the one mistake here that
   * cannot be undone.
   */
  const canDelete = isOrganizer && footprint !== null && footprint.played === 0;

  const expectedTables = Math.ceil(members.length / SEATS_PER_MATCH);

  /**
   * The soonest meetup still to come, for prefilling a message to the members —
   * a change of plan is the commonest thing an organizer writes about. Drawn from
   * the season on screen, which is the one they are looking at.
   */
  const nextSession =
    sessions.find((session) => new Date(session.date_time) >= new Date()) ?? null;

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

      {/* Stated once, at the top, before anything below it looks broken for no
          apparent reason. */}
      {isArchived ? (
        <ThemedView
          type="backgroundSelected"
          style={[styles.notice, { borderColor: theme.accentWarm }]}>
          <Icon name="archive" color={theme.accentWarmInk} size={18} />
          <ThemedText type="small" style={[styles.noticeText, { color: theme.accentWarmInk }]}>
            Archived. The standings and every table played are still here, but the
            league is not listed anywhere, its invite link no longer works, and no
            new meetups can be added.
          </ThemedText>
        </ThemedView>
      ) : null}

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
          <Pressable
            onPress={copyInvite}
            disabled={isArchived}
            style={({ pressed }) => pressed && styles.pressed}>
            <View
              style={[
                styles.primaryButton,
                { backgroundColor: tint },
                isArchived && styles.disabled,
              ]}>
              <ThemedText type="label" style={styles.primaryLabel}>
                {copied ? 'Copied' : 'Copy link'}
              </ThemedText>
            </View>
          </Pressable>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {isArchived
            ? 'This link stops working while the league is archived. Unarchive it to let people join again.'
            : 'Anyone who opens this link and signs in joins the league.'}
        </ThemedText>
      </ThemedView>

      {/* Discoverability, organizers only. A member should not be able to publish
          a group they do not run. The database agrees — the update policy on
          leagues is organizer-only — so this is the UI matching the rule rather
          than the rule itself. */}
      {isOrganizer ? (
        <ThemedView type="background" style={[styles.card, { borderColor: theme.rule }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <ThemedText type="label" themeColor="textSecondary">
                Open to join
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {isArchived
                  ? 'Archived leagues are never listed, whichever way this is set. The setting is kept for when you bring it back.'
                  : isPublic
                    ? 'Listed in Browse for anyone signed in, until it is full.'
                    : 'Invite-only. Only people with the link above can join.'}
              </ThemedText>
            </View>
            <Switch
              value={isPublic}
              onValueChange={(next) => saveVisibility(next, maxMembers)}
              disabled={busy === 'visibility' || isArchived}
              trackColor={{ true: theme.accent, false: theme.rule }}
            />
          </View>

          {isPublic ? (
            <View style={styles.field}>
              <ThemedText type="label" themeColor="textSecondary">
                Member limit
              </ThemedText>
              <TextInput
                value={maxMembers}
                onChangeText={(next) => setMaxMembers(next.replace(/[^0-9]/g, ''))}
                // Saved on blur rather than per keystroke, so typing "12" does not
                // briefly publish a league capped at 1.
                onBlur={() => saveVisibility(isPublic, maxMembers)}
                placeholder="No limit"
                keyboardType="number-pad"
                placeholderTextColor={theme.placeholder}
                style={[styles.input, { color: theme.text, borderColor: theme.rule }]}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {members.length} of {maxMembers || '∞'} taken. Blank means no limit.
              </ThemedText>
            </View>
          ) : null}
        </ThemedView>
      ) : null}

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
              <ThemedText type="label" style={{ color: theme.accentInk }}>
                Organizer
              </ThemedText>
            ) : null}
          </View>
        ))}

        {/* Writing to the league, for whoever runs it. Under the roster it reaches,
            and still offered on an archived league: telling members a season has
            been wound up is exactly when it is wanted. */}
        {isOrganizer && members.length > 1 ? (
          <View style={styles.emailMembers}>
            <EmailGroupButton
              label="Email members"
              gather={() => fetchLeagueMemberEmails(league.id)}
              subject={`${league.name} · update`}
              // The next meetup, when there is one, so the commonest message — a
              // change of plan — starts from the thing being changed.
              body={[
                '',
                '',
                '—',
                league.name,
                nextSession
                  ? `Next meetup: ${formatWhen(nextSession.date_time)} · ${nextSession.location}`
                  : '',
              ]
                .filter((line, index) => index < 3 || line.length > 0)
                .join('\n')}
            />
          </View>
        ) : null}

        {/* The organizer's details, for members of this league only. Worded from
            the reader's side: an organizer looking at their own league should see
            what everyone else can see about them, not be told how to email
            themselves. */}
        {organizer && (organizer.email || organizer.phone) ? (
          <View style={[styles.contactBlock, { borderColor: theme.rule }]}>
            <ThemedText type="label" themeColor="textSecondary">
              {isOrganizer ? 'What members see' : `Reach ${organizer.name ?? 'the organizer'}`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {isOrganizer
                ? 'Everyone in this league can see these, so they can reach you.'
                : 'Visible to members of this league.'}
            </ThemedText>
            <ContactRows contact={organizer} />
          </View>
        ) : null}
      </ThemedView>

      {/* Seasons. A league with none yet shows nothing to switch between, so the
          picker only appears once there is a choice to make. */}
      <ThemedView type="background" style={[styles.card, { borderColor: theme.rule }]}>
        <View style={styles.cardHeader}>
          <ThemedText type="label" themeColor="textSecondary">
            Season
          </ThemedText>
          {canRun ? (
            <Pressable onPress={addSeason} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="label" style={{ color: theme.accentInk }}>
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
            {canRun ? (
              <Pressable
                onPress={() => setIsAddingSession((current) => !current)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="label" style={{ color: theme.accentInk }}>
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
                  placeholderTextColor={theme.placeholder}
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
                  placeholderTextColor={theme.placeholder}
                  autoCapitalize="none"
                  style={[
                    styles.input,
                    styles.pairItem,
                    { color: theme.text, borderColor: theme.rule },
                  ]}
                />
              </View>
              {/* Autocompleted rather than typed, so the meetup carries a
                  position — which is how far away Browse says this league is. */}
              <PlaceAutocompleteInput
                label="Venue"
                value={sessionVenue}
                onChangeText={(next) => {
                  setSessionVenue(next);
                  setSessionDetail(null);
                  setSessionAt(null);
                }}
                onSelectPlace={(suggestion) => {
                  setSessionVenue(suggestion.mainText);
                  setSessionDetail(suggestion.secondaryText);
                  setSessionAt(null);
                  fetchPlaceLocation(suggestion.placeId).then(setSessionAt);
                }}
                placeholder="Where everyone meets"
                kind="venue"
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

              {canRun ? (
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

      {/* Winding the league up, organizers only.
          Archiving leads because it is the reversible one, and because it is
          almost always what "I'm done with this league" actually means. */}
      {isOrganizer ? (
        <ThemedView type="background" style={[styles.card, { borderColor: theme.rule }]}>
          <ThemedText type="label" themeColor="textSecondary">
            Wind it up
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            {isArchived
              ? 'Bring the league back and it is listed and joinable again exactly as it was.'
              : 'Archiving keeps every season, table and score, and stops the league taking anyone new. You can undo it.'}
          </ThemedText>

          <View style={styles.cardActions}>
            <Pressable
              onPress={toggleArchive}
              disabled={busy === 'archive'}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView
                type="backgroundElement"
                style={[styles.wideButton, { borderColor: theme.rule }]}>
                <Icon name="archive" color={theme.textSecondary} size={18} />
                <ThemedText type="label" themeColor="textSecondary">
                  {busy === 'archive'
                    ? 'Saving…'
                    : isArchived
                      ? 'Unarchive league'
                      : 'Archive league'}
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>

          {/* Deleting, when there is nothing played to lose. Two steps, and the
              second one counts what goes rather than warning in the abstract. */}
          <View style={[styles.removal, { borderColor: theme.rule }]}>
            {canDelete ? (
              isConfirmingDelete ? (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    This erases the league for all {members.length}{' '}
                    {members.length === 1 ? 'member' : 'members'}
                    {footprint && footprint.seasons > 0
                      ? `, along with ${footprint.seasons} ${
                          footprint.seasons === 1 ? 'season' : 'seasons'
                        }`
                      : ''}
                    {footprint && footprint.tables > 0
                      ? ` and ${footprint.tables} drawn ${
                          footprint.tables === 1 ? 'table' : 'tables'
                        }`
                      : ''}
                    . It cannot be undone. Matches somebody tagged with this league
                    stay, as pick-up games.
                  </ThemedText>
                  <View style={styles.removalActions}>
                    <Pressable
                      onPress={() => setIsConfirmingDelete(false)}
                      style={({ pressed }) => pressed && styles.pressed}>
                      <ThemedText type="label" themeColor="textSecondary">
                        Keep it
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={remove}
                      disabled={busy === 'delete'}
                      style={({ pressed }) => pressed && styles.pressed}>
                      <ThemedText type="label" style={{ color: theme.danger }}>
                        {busy === 'delete' ? 'Deleting…' : 'Yes, delete this league'}
                      </ThemedText>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={() => setIsConfirmingDelete(true)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedText type="label" style={{ color: theme.danger }}>
                    Delete league
                  </ThemedText>
                </Pressable>
              )
            ) : (
              // Not offered rather than offered-and-refused, and it says why.
              // Deleting here would cascade through the sessions and take the
              // recorded scores with them — see deleteLeague.
              <ThemedText type="small" themeColor="textSecondary">
                {footprint === null
                  ? 'Checking what this league holds…'
                  : `${footprint.played} ${
                      footprint.played === 1 ? 'table has' : 'tables have'
                    } been played, so this league can no longer be deleted — the scores are part of everyone's standings. Archive it instead.`}
              </ThemedText>
            )}
          </View>
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
  /** The archived banner: an outlined highlight rather than a card, so it reads as a state and not another section. */
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  noticeText: {
    flex: 1,
  },
  emailMembers: {
    marginTop: Spacing.two,
  },
  /** Ruled off from the roster above it: it is about one member, not all of them. */
  contactBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
    marginTop: Spacing.one,
    gap: Spacing.half,
  },
  /** A labelled outline button, for an action that is neither primary nor destructive. */
  wideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    minHeight: 40,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  /** Separates the irreversible action from the reversible one above it. */
  removal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
    marginTop: Spacing.one,
    gap: Spacing.two,
  },
  removalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    minHeight: 44,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  toggleText: {
    flex: 1,
    gap: Spacing.half,
  },
  field: {
    gap: Spacing.one,
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
