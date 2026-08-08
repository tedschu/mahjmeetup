import { useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, EmptySeat } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { formatWhen, SEATS_PER_MATCH, type Match } from '@/lib/matches';

/**
 * Where the signed-in member stands in relation to a match. This is the one
 * thing a card has to convey before anything is read, so it drives the colour of
 * the edge bar rather than only appearing as a word somewhere in the text.
 */
export type Standing = 'hosting' | 'seated' | 'joinable' | 'full' | 'canceled' | 'completed';

export function standingFor(match: Match, userId: string): Standing {
  if (match.status === 'canceled') return 'canceled';
  if (match.status === 'completed') return 'completed';
  if (match.host_id === userId) return 'hosting';
  if (match.players.some((player) => player.player_id === userId)) return 'seated';
  if (match.players.length >= SEATS_PER_MATCH) return 'full';
  return 'joinable';
}

/**
 * Gold for yours, orange for the one thing you can act on, a quiet blue once
 * you are in, and the hairline grey for matches that want to recede. Every
 * colour is already in the palette; none are invented here.
 */
function appearance(standing: Standing, theme: Theme) {
  switch (standing) {
    case 'hosting':
      return { bar: theme.accentGold, note: 'Hosting', muted: false };
    case 'seated':
      return { bar: theme.textSecondary, note: "You're in", muted: false };
    case 'joinable':
      return { bar: theme.accent, note: null, muted: false };
    case 'full':
      return { bar: theme.rule, note: 'Full', muted: true };
    case 'canceled':
      return { bar: theme.rule, note: 'Canceled', muted: true };
    case 'completed':
      return { bar: theme.rule, note: 'Played', muted: true };
  }
}

const AvatarSize = 30;

/**
 * Who is at the table, as faces rather than a count. Overlapping keeps four of
 * them inside the space "2/4" used to take, and the empty rings mean the row
 * still says how many seats are left without spelling it out.
 */
function SeatAvatars({ match, onPress }: { match: Match; onPress: () => void }) {
  const theme = useTheme();
  const empty = Math.max(0, SEATS_PER_MATCH - match.players.length);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${match.players.length} of ${SEATS_PER_MATCH} seats taken. See who is coming.`}
      style={({ pressed }) => [styles.avatars, pressed && styles.pressed]}>
      {match.players.map((player, index) => (
        <View key={player.player_id} style={index > 0 ? styles.overlap : undefined}>
          <Avatar
            person={player.profile ?? { name: null }}
            size={AvatarSize}
            ring={theme.background}
          />
        </View>
      ))}
      {Array.from({ length: empty }, (_, seat) => (
        <View
          key={`empty-${seat}`}
          style={match.players.length + seat > 0 ? styles.overlap : undefined}>
          <EmptySeat size={AvatarSize} ring={theme.background} />
        </View>
      ))}
    </Pressable>
  );
}

/** The roster, opened from the avatars. Small because it answers one question. */
function WhoIsComingSheet({
  match,
  visible,
  onClose,
}: {
  match: Match;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const empty = Math.max(0, SEATS_PER_MATCH - match.players.length);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      {/* The backdrop closes it, so there is no dismiss button to place. */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <ThemedView style={styles.rosterSheet}>
          <ThemedText type="subtitle">{match.location}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {match.players.length} of {SEATS_PER_MATCH} seats taken
          </ThemedText>

          <View style={styles.roster}>
            {match.players.map((player) => (
              <View key={player.player_id} style={styles.rosterRow}>
                <Avatar person={player.profile ?? { name: null }} size={36} ring={theme.rule} />
                <View style={styles.rosterName}>
                  <ThemedText type="defaultSemiBold" numberOfLines={1}>
                    {player.profile?.name ?? 'Unnamed member'}
                  </ThemedText>
                  {player.player_id === match.host_id ? (
                    <ThemedText type="label" style={{ color: theme.accentGold }}>
                      Host
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ))}

            {Array.from({ length: empty }, (_, seat) => (
              <View key={`open-${seat}`} style={styles.rosterRow}>
                <EmptySeat size={36} ring={theme.rule} />
                <ThemedText type="small" themeColor="textSecondary">
                  Open seat
                </ThemedText>
              </View>
            ))}
          </View>
        </ThemedView>
      </Pressable>
    </Modal>
  );
}

/**
 * One card shape for Browse and My Matches. The screens differ only in what a
 * member can do from them, which arrives as `action`, so the two cannot drift
 * apart in how a match reads.
 */
export function MatchCard({
  match,
  userId,
  action,
}: {
  match: Match;
  userId: string;
  /** The screen's own button — Join, Leave, Edit, Enter scores. */
  action?: ReactNode;
}) {
  const theme = useTheme();
  const [showRoster, setShowRoster] = useState(false);
  const standing = standingFor(match, userId);
  const { bar, note, muted } = appearance(standing, theme);

  return (
    <View
      style={[
        styles.card,
        styles.raised,
        {
          // White against the tinted page. The reverse — pale blue cards on
          // white — left barely any contrast between card and page, which is
          // what made them read as flat regardless of the shadow.
          backgroundColor: theme.background,
          borderLeftColor: bar,
          shadowColor: theme.text,
        },
        muted && styles.muted,
      ]}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {match.location}
          </ThemedText>
          {match.location_detail ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {match.location_detail}
            </ThemedText>
          ) : null}
        </View>
        <SeatAvatars match={match} onPress={() => setShowRoster(true)} />
      </View>

      {/* When, kind, and standing share one line: three short facts that used to
          take three full-width rows between them. */}
      <View style={styles.metaRow}>
        <ThemedText type="defaultSemiBold" themeColor="textSecondary">
          {formatWhen(match.date_time)}
        </ThemedText>
        {match.is_league ? (
          <ThemedText type="label" themeColor="accent">
            League
          </ThemedText>
        ) : null}
        {match.supplies_provided ? (
          <ThemedText type="label" themeColor="textSecondary">
            Tiles provided
          </ThemedText>
        ) : null}
        {note ? (
          <ThemedText type="label" style={{ color: bar === theme.rule ? theme.textSecondary : bar }}>
            {note}
          </ThemedText>
        ) : null}
      </View>

      {match.notes ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {match.notes}
        </ThemedText>
      ) : null}

      {/* Controls get the bottom row to themselves at every width. Sharing a line
          with the player names meant one or the other was always being squeezed,
          and it needed a different layout on a phone; this needs neither. */}
      {action ? <View style={styles.actionRow}>{action}</View> : null}

      <WhoIsComingSheet
        match={match}
        visible={showRoster}
        onClose={() => setShowRoster(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.three,
    paddingRight: Spacing.three,
    // The bar is part of the card's edge rather than a floating stripe, so it
    // survives any width without a second absolutely positioned view.
    paddingLeft: Spacing.three,
    borderLeftWidth: 4,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
  /**
   * A hairline border read as flat, so the cards lift off the page instead.
   * Android needs `elevation`; the web and iOS shadow props map to a box shadow.
   */
  raised: Platform.select({
    android: { elevation: 2 },
    default: {
      // Deliberately faint. The card already separates from the page by being
      // white on a tint; the shadow only has to suggest that it sits on top,
      // and anything heavier starts to look like a dialog.
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
  }),
  /** Full, canceled and played matches step back rather than competing. */
  muted: {
    opacity: 0.62,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  titleBlock: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  /** Each face sits partly under the one before it; the ring keeps them separable. */
  overlap: {
    marginLeft: -10,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  rosterSheet: {
    width: '100%',
    maxWidth: 360,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  roster: {
    marginTop: Spacing.two,
    gap: Spacing.three,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rosterName: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
});
