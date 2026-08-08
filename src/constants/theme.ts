/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1e3a5f',
    background: '#ffffff',
    backgroundElement: '#eef5fc',
    backgroundSelected: '#d0e3f5',
    textSecondary: '#668bb3',
    accent: '#f26a36', // Vibrant orange/red from the tile's center
    accentGold: '#b8860b', // Gold from the tile's ring
    rule: '#cddff0', // Hairline, the leader rule on the card
  },
  dark: {
    text: '#ffffff',
    background: '#0a192f',
    backgroundElement: '#112240',
    backgroundSelected: '#233554',
    textSecondary: '#8892b0',
    accent: '#ff7f50', // Brighter orange for dark mode
    accentGold: '#d4af37',
    rule: '#1e3a5f',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * Archivo Narrow carries headings, section labels, and every number. The NMJL
 * card is a densely typeset printed form, and a condensed face with tabular
 * figures is what lets a column of point values line up the way it does there.
 * Body copy stays on the system face, which is the more legible of the two at
 * small sizes and keeps the download to one family.
 */
export const DisplayFont = 'ArchivoNarrow_600SemiBold';

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * The lift under cards and leaderboard rows.
 *
 * Declared as a `boxShadow` string rather than with `shadowOffset` /
 * `shadowOpacity` / `shadowRadius`: react-native-web 0.21 drops those legacy
 * props on the floor, keeping only `shadowColor`, which renders as a zero-size
 * shadow — visually nothing. `boxShadow` is the standard style and is honoured.
 *
 * The colour is a fixed navy-black rather than the theme's ink, because in dark
 * mode the ink is white and a white glow is not a shadow.
 */
export const CardShadow = '0px 2px 12px rgba(20, 45, 78, 0.1)';

/**
 * Colours a league can be given, so its matches are recognisable at a glance.
 *
 * The database stores the token, not the hex, so what each one looks like is
 * settled here and can change without touching data. Two are the app's own
 * accents; the rest are muted enough to sit beside them without competing.
 */
export const LeagueColors = {
  blue: '#3d6f9e',
  orange: '#f26a36',
  gold: '#b8860b',
  green: '#4a8c6f',
  plum: '#8c4a6f',
  teal: '#3d8c8c',
} as const;

export type LeagueColor = keyof typeof LeagueColors;

export const LeagueColorNames = Object.keys(LeagueColors) as LeagueColor[];

/**
 * Height of the floating web tab bar. It is positioned absolutely so it can
 * overlay scrolling content, which means page content has to be inset by this
 * much or headings slide underneath it. The height is set by the tallest thing
 * in the bar, the 48px brand mark, plus the container's padding above and below.
 */
export const WebTabBarInset = 80;

/**
 * Below this width the top bar cannot hold four labels and a brand mark, so the
 * web navigation moves to the bottom of the screen the way the native tabs do.
 */
export const CompactBreakpoint = 700;

/** Height of that bottom bar, used to inset content above it. */
export const CompactTabBarHeight = 64;
