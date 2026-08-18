# SEVEN BAM

Find a mahjong game near you, or run the league you already play in.

**v1 — a web app.** It runs in a phone browser and is meant to be added to the
home screen, where it behaves like an installed app. iOS and Android builds come
later; the code is Expo and already targets all three, but only the web build is
released.

Live at **https://tschusters-team-mahjong.expo.app** · marketing site at
**https://sevenbam.com**

## What it does

- **Browse** — open tables near you, with distance from your town, and public
  leagues taking members. Cards flag what is new or about to happen.
- **My Matches** — what you have joined, split into what is coming and what has
  been. Add to calendar, enter scores, or say you cannot make it.
- **Leagues** — seasons of meetups, optionally repeating daily, weekly or monthly.
  The organizer draws the tables and the app shuffles everyone who is coming into
  fours, then puts each table into their My Matches. Short tables can be opened to
  subs from outside the league.
- **Ranking** — standings across every match, or within one league. Totals count
  finished matches with scores entered.

Contact details are never published: a member's email and phone are readable only
by them, and reachable by co-players through functions scoped to the match or
league they share.

## Running it

Node 22 is required — the web export server-renders the Supabase client.

```bash
nvm use 22
npm install
npx supabase start   # local Postgres, auth and mail catcher
npm run web
```

`.env.local` points at the local stack by default; the production values are
commented out in the same file.

## Layout

| Path | What is in it |
| --- | --- |
| `src/app` | Screens, one per tab, on Expo Router |
| `src/components` | Cards, sheets and the shared controls |
| `src/lib` | Data access and the rules that are not the database's |
| `src/constants/theme.ts` | Palette, spacing and type scale — read before styling anything |
| `supabase/migrations` | Every schema change, in order |
| `marketing-site/` | The static site at sevenbam.com, published by GitHub Actions |

Most of the app's rules live in the database rather than the client: capacity,
who may draw or score a table, who can read a phone number. The client is written
to match, never to be the only thing enforcing it.

## Deploying

```bash
npx supabase db push                     # schema first — the client assumes it
npx expo export -p web                   # with production EXPO_PUBLIC_* values
npx eas-cli@latest deploy --prod
```

Exporting without the production environment variables ships a build pointing at
`127.0.0.1`, which fails silently for everyone but you. Check the bundle for the
remote Supabase host before promoting it.
