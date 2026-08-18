import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { OnAccent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The flag on a card that is new or about to happen.
 *
 * Filled rather than set as coloured type, and sitting on its own above the venue
 * rather than in the row of remarks below it. As one more label among "Tiles
 * provided" and a league tag it was read as more of the same and skipped, which is
 * the opposite of the job: these two are the reason to look at this card before
 * the eleven others.
 *
 * Amber, which is this palette's alert — deliberately not `danger`, which is the
 * red reserved for something having gone wrong. A table filling up is not a
 * failure. The label is set in `onAccent`, the dark ink, because `accentWarm` is
 * a pale fill in both schemes and white on it measures 2.0:1.
 *
 * Both states take the same colour. They are the same kind of interruption — look
 * at this one first — and giving them two colours would have the card teaching a
 * legend before it could be read; the words already say which is which.
 */
export function TimingChip({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={[styles.chip, { backgroundColor: theme.accentWarm }]}>
        <ThemedText type="label" style={styles.label}>
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Holds the chip to its own width at the left, rather than stretching it. */
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  chip: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
  },
  label: {
    color: OnAccent,
  },
});
