import { StyleSheet, View } from 'react-native';

import { SolidButton } from '@/components/button';
import { MapLink } from '@/components/match-detail-sheet';
import { Sheet, SheetFooter, SheetSection, SheetTitle } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { LeagueColors, Spacing, type LeagueColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMiles } from '@/lib/geo';
import type { PublicLeague } from '@/lib/leagues';
import { canMap, openMap } from '@/lib/maps';
import { formatFullWhen } from '@/lib/matches';

/**
 * A public league, opened from its card in Browse.
 *
 * Answers the question the card cannot: where the next meetup actually is, and what
 * joining a league gets you — which is not a seat, because league seats come from a
 * draw. Somebody about to commit to a season deserves to know that before they
 * press the button rather than after.
 *
 * There is no roster here, and that is not an omission. `league_members` is
 * readable only by members, so a league you have not joined genuinely cannot tell
 * you who is in it — the sheet says so instead of leaving a gap where a list should
 * be.
 */
export function PublicLeagueSheet({
  league,
  distance,
  visible,
  busy,
  onClose,
  onJoin,
}: {
  league: PublicLeague;
  /** Miles to the next meetup, when both ends have coordinates. */
  distance?: number | null;
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onJoin: () => void;
}) {
  const theme = useTheme();
  const tint = LeagueColors[league.color as LeagueColor] ?? theme.accent;
  const full = league.seats_left !== null && league.seats_left <= 0;
  /** The next meetup shaped as somewhere mappable, which is all `openMap` wants. */
  const meetup = {
    location: league.next_location ?? '',
    location_detail: league.next_location_detail,
    latitude: league.next_latitude,
    longitude: league.next_longitude,
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetTitle
        title={league.name}
        onClose={onClose}
        eyebrow={
          <View style={styles.tag}>
            <View style={[styles.dot, { backgroundColor: tint }]} />
            <ThemedText type="label" style={{ color: theme.accentAltInk }}>
              League
            </ThemedText>
          </View>
        }
      />

      <SheetSection title="Members">
        <ThemedText type="defaultSemiBold">
          {league.member_count} {league.member_count === 1 ? 'member' : 'members'}
        </ThemedText>
        {/* Null seats_left means the organizer set no cap, which is not the same as
            knowing how many are free — so it says that rather than a number it does
            not have. */}
        <ThemedText type="small" themeColor="textSecondary">
          {league.seats_left === null
            ? 'No member limit set.'
            : full
              ? 'Full — no seats left.'
              : `${league.seats_left} ${league.seats_left === 1 ? 'seat' : 'seats'} left of ${
                  league.max_members
                }.`}
        </ThemedText>
        {league.is_member ? (
          <ThemedText type="small" style={{ color: theme.accentAltInk }}>
            You are already in this league.
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Who is in it is visible to members.
          </ThemedText>
        )}
      </SheetSection>

      <SheetSection title="Next meetup">
        {league.next_meetup ? (
          <>
            <ThemedText type="defaultSemiBold">{formatFullWhen(league.next_meetup)}</ThemedText>
            {league.next_location ? (
              <ThemedText type="small" themeColor="textSecondary">
                {league.next_location}
              </ThemedText>
            ) : null}
            {league.next_location_detail ? (
              <ThemedText type="small" themeColor="textSecondary">
                {league.next_location_detail}
              </ThemedText>
            ) : null}
            {typeof distance === 'number' ? (
              <ThemedText type="small" style={{ color: theme.accentInk }}>
                {formatMiles(distance)}
              </ThemedText>
            ) : null}
            {canMap(meetup) ? <MapLink onPress={() => openMap(meetup)} /> : null}
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Nothing on the calendar yet. The organizer sets the meetups, and they show
            up in My Matches once the tables are drawn.
          </ThemedText>
        )}
      </SheetSection>

      {/* The part a card has no room for and nobody should have to infer. */}
      <SheetSection title="How a league works">
        <ThemedText type="small" themeColor="textSecondary">
          Meetups are scheduled by the organizer, and the tables are drawn — you are
          seated with different people each time rather than picking a seat. Every
          table you play counts toward the league&apos;s own standings.
        </ThemedText>
      </SheetSection>

      {league.is_member || full ? null : (
        <SheetFooter>
          <SolidButton label="Join league" onPress={onJoin} busy={busy} wide />
        </SheetFooter>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
