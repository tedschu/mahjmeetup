/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, type ThemeColor } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * The resolved palette for the active scheme, for helpers that take it as an
 * argument. Widened to plain strings: `Colors` is `as const`, so the light and
 * dark palettes have different literal types and neither can stand for both.
 */
export type Theme = Record<ThemeColor, string>;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const theme = scheme === 'unspecified' ? 'light' : scheme;

  return Colors[theme];
}
