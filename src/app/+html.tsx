import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The HTML document every web page is rendered into. Web only — Expo Router
 * ignores this file on native, and it runs at build time rather than in the app,
 * so nothing here can use hooks or the theme.
 *
 * It exists because `expo.name` in app.json does not reach the document: without
 * it the served `<title>` was empty and the browser tab showed the bare URL.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>SEVEN BAM</title>
        <meta name="description" content="Make connections. Start something." />

        {/* Matches the body grounds set in global.css, so the browser's own chrome
            and the overscroll area agree with the page in both schemes. */}
        <meta name="theme-color" content="#f4f5f7" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#141821" media="(prefers-color-scheme: dark)" />

        {/* Disables body scrolling on web, which makes ScrollView components work
            closer to how they do on native. Remove if a page needs the body to
            scroll instead. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
