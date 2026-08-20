import { Image } from 'expo-image';

/**
 * Google's four-colour G, for the button that signs in with it.
 *
 * Not part of the `Icon` set, and it cannot be: that set bakes a single stroke
 * colour into each path so one glyph can be drawn in whatever ink its
 * surroundings need. This mark is four filled shapes in four fixed colours, and
 * recolouring it is the one thing Google's identity guidelines do not allow — the
 * whole point of the mark on a sign-in button is that it is recognisably theirs.
 *
 * Inlined as a data URI like every other icon here, so it needs no network request
 * and survives the strict CSP the deployed site runs under.
 *
 * Drawn on Google's own 48×48 grid rather than the 24×24 the rest of the set uses,
 * because the published paths are specified on that grid and redrawing them by
 * hand is how a logo ends up subtly wrong.
 */
const Paths = [
  ['#4285f4', 'M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z'],
  ['#34a853', 'M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z'],
  ['#fbbc05', 'M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z'],
  ['#ea4335', 'M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z'],
] as const;

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
  Paths.map(([fill, d]) => `<path fill="${fill}" d="${d}"/>`).join('') +
  `</svg>`;

const source = { uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };

export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      contentFit="contain"
      // The button it sits in already says "Continue with Google", so announcing
      // the mark again would only repeat the label.
      accessible={false}
    />
  );
}
