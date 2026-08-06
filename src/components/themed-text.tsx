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
    /** Uppercase, tracked section header, after the NMJL card's category rows. */
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
        { color: theme[themeColor ?? 'text'] },
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
  title: {
    fontFamily: DisplayFont,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: DisplayFont,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.2,
  },
  label: {
    fontFamily: DisplayFont,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  figure: {
    fontFamily: DisplayFont,
    fontSize: 26,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  figureSmall: {
    fontFamily: DisplayFont,
    fontSize: 15,
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
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
