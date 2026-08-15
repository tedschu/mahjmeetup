import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { DisplayFont, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'defaultSemiBold'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    /** Uppercase, tracked section header. */
    | 'label'
    /** Tabular figures for the value column. Never use for prose. */
    | 'figure'
    /** The same figures at row scale, for counts sitting inside a line. */
    | 'figureSmall'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        // `linkPrimary` is the one type that carries its own colour, and it has to
        // come from the theme rather than the stylesheet so it inverts in dark
        // mode. Resolved here because a StyleSheet entry cannot read the theme.
        { color: theme[themeColor ?? (type === 'linkPrimary' ? 'accentInk' : 'text')] },
        type === 'default' && styles.default,
        type === 'defaultSemiBold' && styles.defaultSemiBold,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'label' && styles.label,
        type === 'figure' && styles.figure,
        type === 'figureSmall' && styles.figureSmall,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 600,
  },
  /**
   * Sizes across the display types stepped down from where Archivo Narrow had
   * them. Poppins is a geometric sans with wide, round bowls; set at the old
   * 44/28/26 it overflowed headings and pushed score columns into the leader
   * rules. These are the sizes at which each takes roughly the width the
   * condensed face used to.
   */
  title: {
    fontFamily: DisplayFont,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: DisplayFont,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  label: {
    fontFamily: DisplayFont,
    fontSize: 11,
    lineHeight: 16,
    // Tighter than the condensed face wanted: Poppins is already open, and 1.4
    // read as gappy rather than as tracked.
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  /**
   * Score columns line up on `tabular-nums` now rather than on the face's own
   * proportions, which is what a condensed figure set gave for free.
   */
  figure: {
    fontFamily: DisplayFont,
    fontSize: 22,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  figureSmall: {
    fontFamily: DisplayFont,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
