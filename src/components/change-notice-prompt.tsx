import { StyleSheet } from 'react-native';

import { GradientButton, OutlineButton } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeChanges, type Change } from '@/lib/change-notice';

/**
 * Offered after a change is saved, not before it.
 *
 * The edit is already done by the time this appears, which is deliberate: the two
 * decisions are separate, and a member who declines to send a note has still
 * moved their game. Making the save wait on this question would mean somebody
 * dismissing the prompt loses the edit as well.
 *
 * Not a modal of its own either. Both callers already sit inside one — the match
 * sheet is a Modal, the league screen raises this inside its own card — and
 * presenting a second in the same frame drops it on iOS. It is a step, not a
 * layer.
 */
export function ChangeNoticePrompt({
  changes,
  recipients,
  busy,
  onSend,
  onSkip,
}: {
  changes: Change[];
  /** How many people would get it, so the prompt can be specific about who. */
  recipients: number;
  busy: boolean;
  onSend: () => void;
  onSkip: () => void;
}) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundSelected"
      style={[styles.panel, { borderColor: theme.accentWarm }]}>
      <ThemedText type="defaultSemiBold">Saved. Tell everyone?</ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        {recipients === 0
          ? `You changed ${describeChanges(changes)}. Nobody else has joined yet, so there is nobody to tell.`
          : `You changed ${describeChanges(changes)}. ${
              recipients === 1 ? 'One person has' : `${recipients} people have`
            } this in their calendar and ${
              recipients === 1 ? 'does' : 'do'
            } not know yet.`}
      </ThemedText>

      {recipients > 0 ? (
        <>
          {/* Opens their own mail client with the message written and everyone in
              BCC — the app sends nothing itself, so the note arrives from a person
              the reader knows rather than from a no-reply address. */}
          <GradientButton
            label={busy ? 'Opening…' : 'Write the email'}
            onPress={onSend}
            busy={busy}
            wide
          />
          <OutlineButton label="Not now" onPress={onSkip} disabled={busy} wide />
        </>
      ) : (
        <OutlineButton label="Done" onPress={onSkip} wide />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 1,
    gap: Spacing.two,
  },
});
