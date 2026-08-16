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
        {/* The tagline, kept in step with the one on the login screen — this is the
            line that shows in a search result or a shared link. */}
        <meta name="description" content="Your next game starts here." />

        {/* Matches the body grounds set in global.css, so the browser's own chrome
            and the overscroll area agree with the page in both schemes. */}
        <meta name="theme-color" content="#f4f5f7" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#141821" media="(prefers-color-scheme: dark)" />

        {/*
          Home screen installation.

          There is no app.json setting for any of this — Expo's own guide says to
          write `public/manifest.json` by hand and link it here, because only the
          `public` directory is copied verbatim into the export.

          The manifest alone is enough for Android. iOS ignores it almost entirely
          and reads the three `apple-` tags below instead, which is why both sets
          exist: without them, adding Seven Bam to an iPhone home screen produces a
          screenshot-of-the-page icon that opens in a Safari tab with the address bar
          showing. With them it gets the real mark and opens standalone.

          `apple-touch-icon` is flattened onto white on purpose. iOS composites these
          over black, so the logo's transparent corners would otherwise come out as
          black wedges behind a rounded mask.
        */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* `default` keeps the status bar legible against the light page ground;
            `black-translucent` would draw the page under the clock. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* What appears under the icon. Without it iOS uses the <title>, which is
            the same string here — set explicitly so a future title change to
            something longer does not silently become the home screen label. */}
        <meta name="apple-mobile-web-app-title" content="Seven Bam" />

        {/* Disables body scrolling on web, which makes ScrollView components work
            closer to how they do on native. Remove if a page needs the body to
            scroll instead. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
