import { Platform, StyleSheet, View } from 'react-native';

import { GradientButton } from './button';
import { ThemedText } from './themed-text';

import { CardShadow, LeagueColors, Radius, Spacing, type LeagueColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMiles } from '@/lib/geo';
import type { PublicLeague } from '@/lib/leagues';
import { formatWhen } from '@/lib/matches';

/**
 * A public league offered in Browse.
 *
 * Shaped like a match card on purpose — same lift, same radius, same coloured
 * left edge — because it sits in the same list and should read as another thing
 * you can join, not as an advertisement. What distinguishes it is the LEAGUE
 * eyebrow and that its heading is a league rather than a venue.
 */
export function LeagueCard({
  league,
  distance,
  busy,
  onJoin,
}: {
  league: PublicLeague;
  /** Miles to the next meetup, when both ends have coordinates. */
  distance?: number | null;
  busy: boolean;
  onJoin: () => void;
}) {
  const theme = useTheme();
  const tint = LeagueColors[league.color as LeagueColor] ?? theme.accent;
  const full = league.seats_left !== null && league.seats_left <= 0;

  return (
    <View
      style={[
        styles.card,
        styles.raised,
        { backgroundColor: theme.background, borderLeftColor: tint },
        full && styles.muted,
      ]}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          {/* Says what kind of thing this is before the name does, since the
              surrounding cards are matches. */}
          <ThemedText type="label" style={{ color: theme.accentAltInk }}>
            League
          </ThemedText>
          <ThemedText type="subtitle" numberOfLines={2}>
            {league.name}
          </ThemedText>
          {typeof distance === 'number' ? (
            <ThemedText type="small" style={{ color: theme.accentInk }}>
              {formatMiles(distance)}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <View style={styles.metaRow}>
        <ThemedText type="defaultSemiBold" themeColor="textSecondary">
          {league.member_count} {league.member_count === 1 ? 'member' : 'members'}
        </ThemedText>
        {/* Null seats_left means the organizer set no cap, which is not the same
            as knowing how many are free — so it says nothing rather than a
            number it does not have. */}
        {league.seats_left !== null ? (
          <ThemedText type="label" style={{ color: full ? theme.textSecondary : theme.accentInk }}>
            {full ? 'Full' : `${league.seats_left} ${league.seats_left === 1 ? 'seat' : 'seats'} left`}
          </ThemedText>
        ) : null}
        {league.is_member ? (
          <ThemedText type="label" style={{ color: theme.accentAltInk }}>
            You&apos;re in
          </ThemedText>
        ) : null}
      </View>

      {league.next_meetup ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          Next: {formatWhen(league.next_meetup)}
          {league.next_location ? ` · ${league.next_location}` : ''}
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          No meetups scheduled yet.
        </ThemedText>
      )}

      {/* Nothing to press once you are in or once it is full. Joining a league is
          the one action here, and the seats you play are dealt by its draw
          afterwards rather than picked now. */}
      {league.is_member || full ? null : (
        <View style={styles.actionRow}>
          <GradientButton label="Join league" onPress={onJoin} busy={busy} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.three,
    paddingRight: Spacing.three,
    paddingLeft: Spacing.three,
    borderLeftWidth: 4,
    borderRadius: Radius.card,
    gap: Spacing.one,
  },
  /** The same lift as a match card; see CardShadow for why it is a boxShadow. */
  raised: Platform.select({
    android: { elevation: 2 },
    default: { boxShadow: CardShadow },
  }),
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: Spacing.two,
  },
});
