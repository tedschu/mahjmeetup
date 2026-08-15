import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openContact, type Contact } from '@/lib/contact';

/**
 * How to reach the host or organizer, once you have earned the right to.
 *
 * Rendered only when the lookup returned something, which the database allows only
 * for someone seated at the match or in the league — so this component never has to
 * decide whether the viewer is entitled. It either has details or it does not.
 *
 * The address is drawn in full rather than hidden behind "Contact host". Somebody
 * may want to copy it, forward it, or just see who they are dealing with, and a
 * label that hides the value is a worse version of all three.
 */
export function ContactRows({ contact }: { contact: Contact }) {
  const theme = useTheme();

  return (
    <View style={styles.rows}>
      {contact.email ? (
        <Pressable
          onPress={() => openContact('mailto', contact.email as string)}
          accessibilityRole="link"
          accessibilityLabel={`Email ${contact.name ?? 'the host'} at ${contact.email}`}
          style={({ pressed }) => [
            styles.row,
            { borderColor: theme.rule },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="label" themeColor="textSecondary">
            Email
          </ThemedText>
          <ThemedText type="smallBold" style={{ color: theme.accentInk }} numberOfLines={1}>
            {contact.email}
          </ThemedText>
        </Pressable>
      ) : null}

      {/* Only if they gave one. Most members will not have, and an empty "Phone"
          row would read as a missing feature rather than a personal choice. */}
      {contact.phone ? (
        <Pressable
          onPress={() => openContact('tel', contact.phone as string)}
          accessibilityRole="link"
          accessibilityLabel={`Call ${contact.name ?? 'the host'} on ${contact.phone}`}
          style={({ pressed }) => [
            styles.row,
            { borderColor: theme.rule },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="label" themeColor="textSecondary">
            Phone
          </ThemedText>
          <ThemedText type="smallBold" style={{ color: theme.accentInk }} numberOfLines={1}>
            {contact.phone}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  row: {
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.small,
  },
  pressed: {
    opacity: 0.7,
  },
});
