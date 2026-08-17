import { StyleSheet, View } from 'react-native';

import { GradientButton } from './button';
import { Sheet, SheetFooter, SheetTitle } from './sheet';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MobilePlatform } from '@/lib/home-screen-prompt';

/**
 * Steps for putting Seven Bam on a phone's home screen, shown once, just after a
 * member takes their first seat.
 *
 * The timing is the point. Somebody who has just joined a game now has a reason to
 * come back to a particular date, which is exactly when a shortcut is worth having
 * — and it is the first moment they have anything of their own in the app. The same
 * words on the sign-in screen would be an install prompt from a stranger.
 *
 * Written for one platform at a time rather than listing both. Whoever reads this
 * is holding a phone, and half a set of instructions that do not match the phone in
 * their hand is how people conclude the app is broken.
 */
export function HomeScreenSheet({
  visible,
  platform,
  onClose,
}: {
  visible: boolean;
  /** Which set of steps to show. Never rendered without one. */
  platform: MobilePlatform;
  onClose: () => void;
}) {
  const theme = useTheme();

  /**
   * Written for the platform, not for one browser. Safari is the common case on
   * iOS but not the only one, and on Android the menu belongs to Chrome, Samsung
   * Internet, Firefox or Edge depending on the phone — naming the wrong browser is
   * how somebody concludes these instructions are not for them and gives up. So
   * each step describes the control and where it sits, which is the same in all of
   * them, and hedges the label where the wording differs.
   */
  const steps =
    platform === 'ios'
      ? [
          'Tap the Share button in your browser — a square with an arrow pointing up.',
          'Scroll down the list and choose Add to Home Screen.',
          'Tap Add.',
        ]
      : [
          "Open your browser's menu — usually ⋮ at the top right.",
          'Choose Add to Home screen, or Install app.',
          'Confirm with Add or Install.',
        ];

  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetTitle
        title="Keep Seven Bam one tap away"
        eyebrow={
          <ThemedText type="small" themeColor="textSecondary">
            You are in — nice one
          </ThemedText>
        }
        onClose={onClose}
      />

      {/* Leads with what this is, because somebody who has just joined a game is
          entitled to wonder where the app is. Saying "web app, apps coming" first
          turns the steps below from a workaround into the interim answer. */}
      <ThemedText type="small" themeColor="textSecondary">
        This is the web version of Seven Bam — the iOS and Android apps are coming
        soon. Until then, add it to your home screen and it opens just like a native
        app, straight to your matches. Nothing to install, and you stay signed in.
      </ThemedText>

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={step} style={styles.step}>
            {/* Numbered rather than bulleted: these have to happen in order, and
                the second one is the step people miss. */}
            <ThemedView
              type="backgroundSelected"
              style={[styles.number, { borderColor: theme.accentWarm }]}>
              <ThemedText type="label" style={{ color: theme.accentWarmInk }}>
                {index + 1}
              </ThemedText>
            </ThemedView>
            <ThemedText style={styles.stepText}>{step}</ThemedText>
          </View>
        ))}
      </View>

      <SheetFooter>
        {/* One way out, and it is not a refusal. There is nothing to decline here —
            the sheet has already said everything it has to say, so "Got it" is the
            honest label and the close button in the corner does the same job. */}
        <GradientButton label="Got it" onPress={onClose} wide />
      </SheetFooter>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  steps: {
    gap: Spacing.three,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  number: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Takes the slack so a wrapping step stays aligned under itself. */
  stepText: {
    flex: 1,
  },
});
