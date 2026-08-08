import { useWindowDimensions } from 'react-native';

import { CompactBreakpoint } from '@/constants/theme';

/**
 * True on a phone-width window. Drives the layouts that cannot simply reflow —
 * navigation moving to the bottom of the screen, and rows of controls stacking
 * so they stop competing with the text beside them.
 */
export function useCompact() {
  const { width } = useWindowDimensions();
  return width < CompactBreakpoint;
}
