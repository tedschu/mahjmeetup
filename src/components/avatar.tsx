import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/**
 * First and last initial. A single-word name gives one letter rather than
 * padding it with something invented, and a member with no name at all gets a
 * dash instead of an empty circle that looks broken.
 */
export function initialsFor(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';

  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

export type AvatarPerson = {
  name: string | null;
  avatar_url?: string | null;
};

/**
 * A member's Google photo, or their initials when there is none — which is every
 * member until they have signed in with Google at least once.
 */
export function Avatar({
  person,
  size = 28,
  ring,
}: {
  person: AvatarPerson;
  size?: number;
  /** Colour of the outline. Used to separate overlapping avatars from each other. */
  ring?: string;
}) {
  const theme = useTheme();
  const border = ring ?? theme.background;

  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderColor: border,
  };

  if (person.avatar_url) {
    return (
      <Image
        source={{ uri: person.avatar_url }}
        style={[styles.frame, frame]}
        contentFit="cover"
        accessibilityLabel={person.name ?? 'Member'}
      />
    );
  }

  return (
    <View
      style={[styles.frame, styles.initials, frame, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText
        type="label"
        themeColor="textSecondary"
        // Scaled off the circle so one component covers both the card row and the
        // larger avatars in the who's-coming list.
        style={{ fontSize: Math.round(size * 0.38), lineHeight: Math.round(size * 0.38) + 2 }}>
        {initialsFor(person.name)}
      </ThemedText>
    </View>
  );
}

/** An unfilled seat, drawn at the same size so the row does not shift as people join. */
export function EmptySeat({ size = 28, ring }: { size?: number; ring?: string }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: ring ?? theme.background,
          backgroundColor: theme.backgroundElement,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    // The ring is what keeps overlapping avatars legible as separate people.
    borderWidth: 2,
  },
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
