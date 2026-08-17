import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './icon';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Radius, Spacing } from '@/constants/theme';
import { useNeedsProfileSetup } from '@/hooks/use-profile-setup';
import { useTheme } from '@/hooks/use-theme';

/**
 * The prompt for a member who has no name yet.
 *
 * A dot on the Profile tab is not enough on its own. The people who see it are the
 * ones who signed up with an email address, so nothing pre-filled their profile —
 * and a small coloured dot tells them something wants attention without saying
 * what, which is precisely the wrong ratio of alarm to information for someone who
 * has been using the app for ten seconds. Left at that, they carry on as "Unnamed
 * member" on every match card and never learn why.
 *
 * So this sits at the top of Browse, which is where everybody lands. It is a
 * banner rather than a modal on purpose: a dialog on first launch gets dismissed
 * reflexively, and once dismissed it is gone for good. This stays until it is
 * answered, and answering it is one tap because the whole banner is the control.
 *
 * Renders nothing once a name is set, from the same condition that draws the dot,
 * so the two can never disagree.
 */
export function ProfileSetupBanner() {
  const theme = useTheme();
  const router = useRouter();
  const needsSetup = useNeedsProfileSetup();

  if (!needsSetup) return null;

  return (
    <Pressable
      onPress={() => router.push('/profile')}
      accessibilityRole="button"
      accessibilityLabel="Finish setting up your profile"
      style={({ pressed }) => pressed && styles.pressed}>
      {/* The amber highlight, which this app already uses for "this row is you" on
          the leaderboard — so it reads as being about the member rather than as a
          warning. A red banner for an unfinished profile would be a lie about how
          much trouble anyone is in. */}
      <ThemedView
        type="backgroundSelected"
        style={[styles.banner, { borderColor: theme.accentWarm }]}>
        <View style={styles.text}>
          <ThemedText type="smallBold" style={{ color: theme.accentWarmInk }}>
            Add your name to finish setting up
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Until you do, other players see you as an unnamed player on match cards
            and the leaderboard.
          </ThemedText>
        </View>
        {/* Points at the tap rather than repeating it as a second control: the
            whole banner is already the button. */}
        <Icon name="person" color={theme.accentWarmInk} size={20} />
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  /** Takes the slack so the icon stays pinned to the right edge. */
  text: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
