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
 * The ribbon's course, as points its spine passes through with the width of the band
 * at each.
 *
 * Written out rather than generated. A generated serpentine gave a wave that
 * oscillated about a line, and a wave about a line is either a snake or a border
 * depending on how wide you make it — neither is a ribbon someone laid across a
 * page. This is one continuous gesture: it enters near the middle of the top, bows
 * out to the left edge at half height, then comes back and flattens toward the
 * horizontal as it leaves at the bottom.
 *
 * First and last points sit outside the frame so both ends are clipped, which is
 * what makes it read as a length of something rather than a shape with two ends.
 */
const Frame = { width: 560, height: 1000 } as const;

const Course: readonly { x: number; y: number; width: number }[] = [
  // Above the top edge, near the middle, broad.
  { x: 335, y: -60, width: 104 },
  { x: 248, y: 200, width: 94 },
  // The far left, at half height.
  { x: 58, y: 505, width: 100 },
  { x: 176, y: 762, width: 82 },
  { x: 392, y: 936, width: 66 },
  // Beyond the right edge and almost level, so it leaves travelling sideways rather
  // than running out of the bottom.
  { x: 640, y: 1010, width: 54 },
] as const;


/**
 * A Catmull-Rom spline through the course, sampled for position and direction.
 *
 * Catmull-Rom because it passes *through* its points rather than being pulled near
 * them, so the course above reads as the shape it describes — move a point and the
 * ribbon goes there. The ends are duplicated, which is the usual way to give the
 * first and last segments the neighbour they lack.
 *
 * Returns the width alongside, interpolated the same way, so the taper follows the
 * course instead of being applied afterwards.
 */
function sampleCourse(t: number) {
  const last = Course.length - 1;
  const scaled = t * last;
  const index = Math.min(Math.floor(scaled), last - 1);
  const s = scaled - index;

  const p0 = Course[Math.max(index - 1, 0)];
  const p1 = Course[index];
  const p2 = Course[index + 1];
  const p3 = Course[Math.min(index + 2, last)];

  const at = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (-a + 3 * b - 3 * c + d) * s ** 3);

  // The derivative, for the tangent. Needed rather than a difference of two samples
  // because the band's width is offset along the normal, and a normal from a coarse
  // difference wobbles visibly where the curve turns hardest.
  const slope = (a: number, b: number, c: number, d: number) =>
    0.5 * (-a + c + 2 * (2 * a - 5 * b + 4 * c - d) * s + 3 * (-a + 3 * b - 3 * c + d) * s * s);

  const x = at(p0.x, p1.x, p2.x, p3.x);
  const y = at(p0.y, p1.y, p2.y, p3.y);
  const dx = slope(p0.x, p1.x, p2.x, p3.x);
  const dy = slope(p0.y, p1.y, p2.y, p3.y);
  const length = Math.hypot(dx, dy) || 1;

  return {
    x,
    y,
    // Unit normal: the tangent turned a quarter turn. Offsetting along this rather
    // than horizontally is what lets the ribbon keep its width where it runs level —
    // a horizontal offset would collapse the band to nothing at the bottom, where
    // the course deliberately flattens out.
    nx: -dy / length,
    ny: dx / length,
    half: at(p0.width, p1.width, p2.width, p3.width) / 2,
  };
}

/** How finely the outline is sampled. At this count the facets are sub-pixel. */
const Samples = 160;

/**
 * The ribbon, as a closed outline rather than a stroked line.
 *
 * A stroke cannot taper — it is one width for its whole length — and that is what
 * made the first attempt look like a snake: a constant-thickness tube winding down
 * the page. Here the two edges are traced separately, offset along the spine's normal
 * by a width that varies, and the shape between them is filled. A flat band catches
 * the eye where it is broad and vanishes where it turns edge-on, which is what reads
 * as ribbon rather than tube.
 */
function ribbonPath() {
  const edge: string[] = [];
  const back: string[] = [];

  for (let i = 0; i <= Samples; i += 1) {
    const { x, y, nx, ny, half } = sampleCourse(i / Samples);

    edge.push(`${(x + nx * half).toFixed(1)} ${(y + ny * half).toFixed(1)}`);
    back.push(`${(x - nx * half).toFixed(1)} ${(y - ny * half).toFixed(1)}`);
  }

  // Down one edge, across the end, back up the other, closed.
  return {
    path: `M${edge[0]} L${edge.slice(1).join(' L')} L${back.reverse().join(' L')} Z`,
    height: Frame.height,
  };
}

function gradientStops() {
  return BrandGradient.map(
    (color, index) =>
      `<stop offset="${(index / (BrandGradient.length - 1)).toFixed(2)}" stop-color="${color}"/>`
  ).join('');
}

function svgSource(
  body: string,
  viewBox: string,
  gradient = 'x1="0" y1="0" x2="0.9" y2="1"',
  /**
   * `none` lets the artwork stretch to whatever box it is given instead of keeping
   * its proportions.
   *
   * Safe here only because the ribbon is a filled outline: a fill scales on both
   * axes without artefacts, so a stretched ribbon is still a ribbon. The same trick
   * on a stroked path thins the line on one axis and looks broken — which is why the
   * corner fragment above keeps its aspect.
   */
  preserveAspectRatio = 'xMidYMid meet'
) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ` +
    `preserveAspectRatio="${preserveAspectRatio}" fill="none">` +
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
    `0 0 ${Frame.width} ${height}`,
    /*
     * Bottom to top, so the warm end of the gradient is at the head of the ribbon
     * and the teal at its foot — the way the guide prints this element.
     *
     * Purely vertical, with no horizontal component. A diagonal vector looks more
     * like the printed gradient but maps colour across the width as well as the
     * height, and part of this ribbon is always outside the frame: the teal end fell
     * in the clipped part, so the whole thing rendered coral-to-gold with no green
     * in it at all.
     */
    'x1="0" y1="1" x2="0" y2="0"',
    'none'
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
  /**
   * How far across the page the ribbon's travel reaches, as the width of the box it
   * is stretched into. The sweep ends near the far edge of that box, so this is
   * effectively where the ribbon finishes: at 62% it lands just short of centre,
   * under the content rather than beside it.
   */
  reach = '62%',
}: {
  opacity?: number;
  reach?: `${number}%`;
}) {
  return (
    <Image
      source={waveSource(opacity)}
      style={[styles.edge, { width: reach }]}
      accessible={false}
      pointerEvents="none"
      /*
       * Stretched to the box rather than fitted inside it, which is what guarantees
       * the ribbon starts at the very top and finishes at the very bottom whatever
       * shape the window is. The horizontal squash on a narrow screen only makes the
       * sweep steeper, which is the right answer there anyway.
       *
       * `contain` was the previous attempt: it fits by the smaller ratio, so on a
       * narrow window the width bound and the ribbon stopped short of the bottom.
       * `cover` fails the other way, scaling past 1.5× and cropping half the height.
       * Both are the wrong tool because both preserve an aspect ratio that nothing
       * here needs — see the note on `preserveAspectRatio` in svgSource.
       */
      contentFit="fill"
    />
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    // Flush with the left edge; the ribbon's own first turn sits outside the frame,
    // so the bleed comes from the artwork rather than from negative positioning.
    left: 0,
  },
});
