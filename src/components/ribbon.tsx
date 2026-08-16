import { Image } from 'expo-image';
import { StyleSheet, type ImageStyle } from 'react-native';

import { BrandGradient } from '@/constants/theme';

/**
 * The brand ribbon — the gradient squiggle from the guide's GRAPHIC ELEMENTS.
 *
 * Drawn here as a stroked path rather than loaded as an asset, so it takes its
 * colours from `BrandGradient` and cannot drift from the gradient on the primary
 * button. Built as an SVG data URI and handed to `expo-image`, the same approach
 * `icon.tsx` uses, which needs no extra renderer on any platform.
 *
 * It differs from the printed ribbon in one way: the guide's tapers along its
 * length, and a uniform stroke cannot. Swap in a real export if that matters.
 *
 * This is the graphic element, not the primary mark — the mark itself is locked
 * and is used only as the supplied `logo.png`.
 */

/** Two turns and a hook, read top to bottom. Drawn on a 200×340 grid. */
const Curve = 'M148 18C58 66 40 128 122 168 204 208 152 274 58 322';

const StrokeWidth = 30;

function source(opacity: number) {
  const stops = BrandGradient.map(
    (color, index) =>
      `<stop offset="${(index / (BrandGradient.length - 1)).toFixed(2)}" stop-color="${color}"/>`
  ).join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 340" fill="none">` +
    `<defs><linearGradient id="r" x1="0" y1="0" x2="0.9" y2="1">${stops}</linearGradient></defs>` +
    `<path d="${Curve}" stroke="url(#r)" stroke-width="${StrokeWidth}" ` +
    `stroke-linecap="round" opacity="${opacity}"/></svg>`;

  return { uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
}

export function Ribbon({
  width,
  height,
  /**
   * Baked into the SVG rather than applied as a view opacity, so the ribbon does
   * not need its own compositing layer on the platforms that give one to any
   * partially transparent view.
   */
  opacity = 1,
  style,
}: {
  width: number;
  height: number;
  opacity?: number;
  style?: ImageStyle;
}) {
  return (
    <Image
      source={source(opacity)}
      style={[{ width, height }, style]}
      // Decoration. Nothing here is information a screen reader should stop on.
      accessible={false}
      pointerEvents="none"
      // `cover` rather than `contain`: the ribbon is meant to run off the edge of
      // whatever it decorates, not to sit politely inside it.
      contentFit="cover"
    />
  );
}

/**
 * A large ribbon bleeding off the top-right of a screen, for the login screen and
 * for empty states — the two places the app is otherwise a blank field.
 *
 * Absolutely positioned and non-interactive, so it never takes a press meant for
 * the content in front of it.
 */
export function CornerRibbon({ opacity = 0.16 }: { opacity?: number }) {
  return <Ribbon width={240} height={400} opacity={opacity} style={styles.corner} />;
}

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
    // Off the edge on two sides, so it reads as a fragment of something larger
    // rather than as an illustration that happens to be in the corner.
    top: -80,
    right: -70,
  },
});
