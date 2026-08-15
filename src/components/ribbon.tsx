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

/**
 * The same ribbon, continued for as many turns as it takes to run the height of a
 * screen.
 *
 * Each half-turn is a cubic whose two control points sit directly above and below
 * its endpoints. That puts a vertical tangent at every join, so the turns meet
 * without a kink, and — because every control point shares an x with an endpoint —
 * the curve provably stays inside `swing` either side of centre.
 *
 * The first attempt chained `T` commands instead, letting each control point be the
 * reflection of the last. That looks like the elegant way to write a serpentine and
 * is a trap: with an asymmetric first control the reflections compound, so the
 * control x ran 315 → -155 → 595 and each turn swung wider than the one before
 * until the curve left the frame and was cut off square by the viewBox.
 */
const Wave = {
  /** Just wider than the band needs at its widest, turns and taper included. */
  frame: 320,
  centre: 150,
  /**
   * How far the control points reach along the segment, as a fraction of its height.
   * Above 0.5 the turns round out; at 0.5 they are noticeably tighter.
   */
  reach: 0.6,
  /** Height of one half-turn. */
  segment: 175,
  turns: 6,
  /**
   * How far each turn swings from centre. Varied rather than constant: a fixed swing
   * makes a sine wave, and a sine wave in a uniform stroke is what read as a snake.
   */
  swings: [78, 58, 84, 62, 74, 66, 80],
  /**
   * The band's width at each turn. This is the taper, and it is what makes the thing
   * a ribbon: a flat band catches the eye where it is broad and disappears where it
   * turns edge-on, so alternating wide and narrow reads as a length of ribbon
   * twisting as it falls.
   */
  widths: [104, 58, 98, 54, 92, 62, 100],
} as const;


/**
 * The turn points of the ribbon's spine, with the band's width at each.
 *
 * Sides alternate, so the ribbon crosses back and forth as it descends.
 */
function turnPoints() {
  const { centre, segment, turns, swings, widths } = Wave;

  return Array.from({ length: turns + 1 }, (_, index) => ({
    x: centre + (index % 2 === 0 ? swings[index] : -swings[index]),
    y: segment * index,
    half: widths[index] / 2,
  }));
}

/**
 * The ribbon, as a closed outline rather than a stroked line.
 *
 * A stroke cannot taper — it is one width for its whole length — and that is exactly
 * what made the first version look like a snake: a constant-thickness tube winding
 * down the page. So the two edges of the band are drawn as separate curves with the
 * gap between them varying, and the shape is filled.
 *
 * Both edges use control points sitting directly above and below their endpoints,
 * which puts a vertical tangent at every turn. That keeps the turns smooth, keeps
 * the outline provably inside the frame, and means the horizontal offset used for
 * the band's width is exactly perpendicular to the spine at the turns — where the
 * width is most visible.
 */
function ribbonPath() {
  const { reach, segment, turns } = Wave;
  const points = turnPoints();

  const edge = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const lead = from.y < to.y ? segment * reach : -segment * reach;
    return (
      ` C${from.x.toFixed(1)} ${(from.y + lead).toFixed(1)}` +
      ` ${to.x.toFixed(1)} ${(to.y - lead).toFixed(1)}` +
      ` ${to.x.toFixed(1)} ${to.y.toFixed(1)}`
    );
  };

  // Down the outer edge...
  let path = `M${(points[0].x + points[0].half).toFixed(1)} ${points[0].y}`;
  for (let i = 1; i <= turns; i += 1) {
    path += edge(
      { x: points[i - 1].x + points[i - 1].half, y: points[i - 1].y },
      { x: points[i].x + points[i].half, y: points[i].y }
    );
  }

  // ...across the bottom, which is flush with the frame so it reads as running off
  // the edge rather than stopping.
  path += ` L${(points[turns].x - points[turns].half).toFixed(1)} ${points[turns].y}`;

  // ...and back up the inner edge.
  for (let i = turns; i >= 1; i -= 1) {
    path += edge(
      { x: points[i].x - points[i].half, y: points[i].y },
      { x: points[i - 1].x - points[i - 1].half, y: points[i - 1].y }
    );
  }

  return { path: `${path} Z`, height: segment * turns };
}

function gradientStops() {
  return BrandGradient.map(
    (color, index) =>
      `<stop offset="${(index / (BrandGradient.length - 1)).toFixed(2)}" stop-color="${color}"/>`
  ).join('');
}

function svgSource(body: string, viewBox: string, gradient = 'x1="0" y1="0" x2="0.9" y2="1"') {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">` +
    `<defs><linearGradient id="r" ${gradient}>${gradientStops()}</linearGradient>` +
    `</defs>${body}</svg>`;

  return { uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
}

function source(opacity: number) {
  return svgSource(
    `<path d="${Curve}" stroke="url(#r)" stroke-width="${StrokeWidth}" ` +
      `stroke-linecap="round" opacity="${opacity}"/>`,
    '0 0 200 340'
  );
}

function waveSource(opacity: number) {
  const { path, height } = ribbonPath();

  // Filled, not stroked. See ribbonPath for why.
  return svgSource(
    `<path d="${path}" fill="url(#r)" opacity="${opacity}"/>`,
    `0 0 ${Wave.frame} ${height}`,
    /*
     * Bottom to top, so the warm end of the gradient is at the head of the ribbon
     * and the teal at its foot — the way the guide prints this element.
     *
     * Purely vertical, with no horizontal component. A diagonal vector looks more
     * like the printed gradient but maps colour across the width as well as the
     * height, and this ribbon is anchored half off the edge: the teal end fell in
     * the part that is cropped away, so the whole thing rendered coral-to-gold with
     * no green in it at all.
     */
    'x1="0" y1="1" x2="0" y2="0"'
  );
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
 * The ribbon running the full height of a screen, hugging one side and bleeding off
 * it, with the content sitting clear of it.
 *
 * Side-aligned on purpose, the way the guide lays this element out: anchored to an
 * edge and half off it, so it reads as a deliberate margin rather than as a graphic
 * someone dropped behind the text. Two earlier attempts were worse for the same
 * underlying reason — a fragment in the top-right corner looked parked out of the
 * way, and running it up the middle put it under the content it was framing.
 *
 * Anchored top and bottom rather than given a height, so it spans whatever the
 * window is without anyone measuring it.
 *
 * Non-interactive, so it never takes a press meant for the form beside it.
 */
export function EdgeRibbon({
  opacity = 0.85,
  width = 360,
  /**
   * How far past the edge the ribbon sits. Negative pulls it off-screen, which is
   * what makes the turns run out of frame instead of stopping inside it.
   */
  bleed = -120,
}: {
  opacity?: number;
  width?: number;
  bleed?: number;
}) {
  return (
    <Image
      source={waveSource(opacity)}
      style={[styles.edge, { width, left: bleed }]}
      accessible={false}
      pointerEvents="none"
      /*
       * `contain`, so the full wave is fitted to the height — every turn shows and
       * the line reads as one continuous travel down the page.
       *
       * `cover` was the first attempt and was wrong: it scales to the *larger* of
       * the two ratios, which on any normal window is the width, so the wave was
       * blown up past 1.5× and better than half its height cropped away. What
       * remained was three enormous slabs with hard edges. Stretching with `fill`
       * fails differently again, thinning the stroke on one axis only.
       */
      contentFit="contain"
      // Pinned to the left of its box rather than centred in it, so `bleed` means
      // what it says. Without this, `contain` letterboxes the wave and the overhang
      // depends on the window's proportions.
      contentPosition="left"
    />
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});
