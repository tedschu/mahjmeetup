import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './icon';
import { ThemedText } from './themed-text';

import { BrandGradient, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Common = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Swaps the label for a spinner and blocks presses. */
  busy?: boolean;
  icon?: IconName;
  /** Stretches to the container's width. Off by default. */
  wide?: boolean;
  style?: ViewStyle;
};

/**
 * The primary button: a flat surface inside a thin gradient border.
 *
 * The gradient is the outline rather than the fill. A fully filled gradient made
 * the button the loudest thing on every screen it appeared on, and it forced the
 * label dark — white type over the gradient's `#ffd44d` midpoint is 1.4:1. As a
 * hairline it still reads unmistakably as the brand while the label sits on plain
 * ink at full contrast.
 *
 * Still deliberately scarce: **at most one per screen**, on the single thing that
 * screen exists to do.
 *
 * Built as a gradient view padded by the border width with the flat surface laid
 * inside it, because a border cannot itself take a gradient on either platform.
 */
export function GradientButton({
  label,
  onPress,
  disabled,
  busy,
  icon,
  wide,
  style,
}: Common) {
  const theme = useTheme();
  const inert = disabled || busy;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(inert), busy: Boolean(busy) }}
      style={({ pressed }) => [wide && styles.wide, pressed && styles.pressed, style]}>
      <LinearGradient
        colors={BrandGradient}
        // Left to right, as the guide prints it. On web `start`/`end` set only the
        // angle, which is all this needs.
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradientEdge, wide && styles.wide, disabled && styles.disabled]}>
        <View style={[styles.button, styles.inset, { backgroundColor: theme.background }]}>
          {busy ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <>
              {icon ? <Icon name={icon} color={theme.text} size={18} /> : null}
              <ThemedText type="smallBold">{label}</ThemedText>
            </>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/**
 * The secondary button: the card surface behind a teal outline, per the guide.
 *
 * The label is `accentInk` rather than the teal of the border, because the border
 * can be light where type cannot.
 */
export function OutlineButton({
  label,
  onPress,
  disabled,
  busy,
  icon,
  wide,
  style,
}: Common) {
  const theme = useTheme();
  const inert = disabled || busy;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(inert), busy: Boolean(busy) }}
      style={({ pressed }) => [
        styles.button,
        styles.outline,
        { backgroundColor: theme.background, borderColor: theme.accent },
        wide && styles.wide,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={theme.accentInk} />
      ) : (
        <>
          {icon ? <Icon name={icon} color={theme.accentInk} size={18} /> : null}
          <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
            {label}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

/**
 * An icon-only control, for the row at the foot of a match card. Three labelled
 * buttons cannot share that line at phone width, so each says what it does only
 * to assistive tech.
 *
 * Tones, quietest first:
 * - `default` — the page ground, secondary ink. Most of them.
 * - `done` — the highlight, for a state already reached: added to a calendar.
 * - `primary` — a solid teal fill for the one action worth the eye, in the deeper
 *   `accentButton` so its stroke can be white and still read.
 * - `danger` — destructive, and never filled: a filled red button invites the
 *   press it is warning about.
 */
export function QuietButton({
  icon,
  label,
  onPress,
  disabled,
  tone = 'default',
}: {
  icon: IconName;
  /** Not drawn — the control is icon-only — but announced. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'done' | 'primary' | 'danger';
}) {
  const theme = useTheme();

  const fill =
    tone === 'primary'
      ? theme.accentButton
      : tone === 'done'
        ? theme.backgroundSelected
        : theme.backgroundElement;
  const color =
    tone === 'primary'
      ? theme.onAccentButton
      : tone === 'done'
        ? theme.accentWarmInk
        : tone === 'danger'
          ? theme.danger
          : theme.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.quiet,
        { backgroundColor: fill },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Icon name={icon} color={color} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    // Comfortably tappable; below this a thumb starts missing.
    minHeight: 44,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
  },
  outline: {
    borderWidth: 1.5,
  },
  /**
   * The gradient itself, showing only as the ring left around the inset surface.
   * `padding` is the border's thickness.
   */
  gradientEdge: {
    padding: 1.5,
    borderRadius: Radius.pill,
  },
  /** Sits inside the ring; the pill radius means both curves agree at any size. */
  inset: {
    minHeight: 41,
  },
  wide: {
    alignSelf: 'stretch',
  },
  quiet: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
});
