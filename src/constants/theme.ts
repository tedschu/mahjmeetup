/**
 * The SEVEN BAM palette, spacing, and type scale.
 *
 * Colours come from the brand guide's UI COLOR ROLES. Two things about that
 * palette shape everything below:
 *
 * 1. It is bright and pastel, so most of the brand colours fail text contrast on
 *    white — `#FFD44D` is 1.4:1 and both `#2FB7A6` and `#FF7D72` are 2.5:1,
 *    against the 4.5:1 that small text needs. So each accent comes in two parts:
 *    a `*Fill` used for bars, dots, chips and icon strokes, and a `*Ink` deep
 *    enough to set type in. Never set text in a `*Fill`.
 * 2. For the same reason, text and icons sitting *on* a filled brand colour are
 *    dark, not white — white on the gradient's yellow midpoint is illegible.
 *    That is what `onAccent` is for, and it is dark in both schemes because the
 *    fills it sits on are light in both.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Type and icons drawn on top of any filled brand colour.
 *
 * Dark in both schemes, because the fills it sits on are light in both — so it is
 * also safe to use from a `StyleSheet`, which cannot read the theme. Exposed as
 * `onAccent` on each palette as well, for code that already has one in hand.
 */
export const OnAccent = '#10131a';

/**
 * The ground behind the launch mark, in `app.json` and in the native splash
 * overlay both — they have to agree or the screen flashes as one hands over to
 * the other.
 *
 * White, not a brand colour: the logo is itself a white rounded square with a
 * gradient inside it, so any tint just draws a box around it. It replaces
 * `#208AEF`, which was Expo's scaffold blue and belonged to no palette here.
 */
export const SplashBackground = '#ffffff';

export const Colors = {
  light: {
    /** Primary Text. */
    text: '#151a26',
    /**
     * Secondary Text, a step darker than the guide's swatch. Sampled it comes out
     * near `#8e939b`, which is 3.1:1 on white — below AA for body copy, and this
     * ink carries dates, score summaries and every hint in the app. Darkened
     * until it passes at 4.7:1.
     */
    textSecondary: '#6e7480',
    /** Card. */
    background: '#ffffff',
    /** Background — the page the cards sit on. */
    backgroundElement: '#f4f5f7',
    /** Highlight. Marks the signed-in member's own row and the chosen chip. */
    backgroundSelected: '#fcefc4',
    /** Divider / Subtle. */
    rule: '#e7e9ee',
    /** Teal, the interactive colour. Fills and strokes only. */
    accent: '#2fb7a6',
    /** The same teal taken deep enough to set type and links in. 5.4:1. */
    accentInk: '#17786c',
    /** Amber. Marks a match you are hosting. */
    accentWarm: '#ffa35a',
    /** Amber as type. 5.4:1; the fill itself is 2.0:1 and unusable for text. */
    accentWarmInk: '#9a5b12',
    /** The guide's Accent role — lavender. Used for league identity. */
    accentAlt: '#8b74ff',
    /** Lavender as type. 6.2:1. */
    accentAltInk: '#5a48db',
    /** A deepened coral, so failures read as part of the palette. 4.9:1. */
    danger: '#c4453a',
    onAccent: OnAccent,
  },
  dark: {
    text: '#f2f3f5',
    textSecondary: '#9ba1ac',
    /** The card surface, kept lighter than the page so cards still lift off it. */
    background: '#1e2430',
    backgroundElement: '#141821',
    /** The Highlight role restated as a warm dark rather than a pale yellow. */
    backgroundSelected: '#3a3320',
    rule: '#2e3542',
    accent: '#4fd1be',
    /**
     * Identical to `accent`. The ink variants exist because the brand colours are
     * too light for type on white; on a dark ground that is no longer true, and a
     * deepened teal would be the unreadable one.
     */
    accentInk: '#4fd1be',
    accentWarm: '#ffb870',
    accentWarmInk: '#ffc98d',
    accentAlt: '#a692ff',
    accentAltInk: '#bcacff',
    danger: '#ff8a7e',
    /** Still dark: the fills it sits on are light in this scheme too. */
    onAccent: OnAccent,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * The brand gradient, left to right, as printed in the guide.
 *
 * Shared by the primary button and the ribbon, so the two cannot drift. It does
 * not vary by scheme — the gradient *is* the mark, and a dark-mode variant of it
 * would read as a different brand.
 */
export const BrandGradient = ['#2fb7a6', '#c7d84a', '#ffd44d', '#ffa35a', '#ff7d72'] as const;

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
 * Poppins SemiBold carries the wordmark, headings, section labels, and every
 * number — Option 1 in the guide's typography.
 *
 * It replaces Archivo Narrow, which was picked for the condensed tabular figures
 * of a printed NMJL card. Poppins is neither condensed nor narrow, so score
 * columns now line up on `fontVariant: tabular-nums` rather than on the face's
 * own proportions. Body copy stays on the system face, which is more legible at
 * small sizes and keeps the download to one family.
 */
export const DisplayFont = 'Poppins_600SemiBold';

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
 * The colour is a fixed near-black rather than the theme's ink, because in dark
 * mode the ink is near-white and a white glow is not a shadow.
 */
export const CardShadow = '0px 2px 12px rgba(21, 26, 38, 0.08)';

/**
 * Corner radius. The guide's cards and buttons are noticeably rounder than the
 * 8px this app used, which is most of what made them read as severe.
 */
export const Radius = {
  /** Chips, small controls. */
  small: 10,
  /** Cards, sheets, inputs. */
  card: 16,
  /** Fully round — pills and avatars. */
  pill: 999,
} as const;

/**
 * Colours a league can be given, so its matches are recognisable at a glance.
 *
 * The keys are constrained by the database (`leagues.color`), so they stay as
 * they are and only the hexes are redrawn from the brand palette — a rename
 * would need a migration and would invalidate existing rows.
 *
 * These are fills. A league tag pairs a dot in its colour with a label in the
 * secondary ink, rather than setting the label itself in the league colour,
 * because four of the six are too light to read as type.
 */
export const LeagueColors = {
  blue: '#35c3e6',
  orange: '#ffa35a',
  gold: '#ffd44d',
  green: '#c7d84a',
  plum: '#8b74ff',
  teal: '#2fb7a6',
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
