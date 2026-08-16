# marketing-site

The public site at **sevenbam.com**. Plain static HTML — no build step, no
dependencies, no toolchain. Open `index.html` in a browser and what you see is what
ships.

It is deliberately *not* part of the Expo app. The app is a React Native web export
deployed to EAS Hosting; this is five HTML files on a CDN. They share a repo because
the site quotes the app — screenshots, the sign-in link, and `delete-account.html`,
which describes behaviour the database actually implements. When that behaviour
changes, the page documenting it should change in the same commit.

## Deploying

Push to `main` with anything under `marketing-site/` changed.
`.github/workflows/marketing-site.yml` publishes this directory to GitHub Pages.

To republish without a commit: Actions → *Deploy marketing site* → Run workflow.

There is no `CNAME` file on purpose. With Actions-based publishing GitHub ignores
one; the custom domain is set in the repo's Settings → Pages instead.

## Previewing locally

```sh
cd marketing-site && python3 -m http.server 8097
```

Then <http://localhost:8097/>. Opening the files over `file://` mostly works but
relative asset paths and the tour's image swapping are more faithful over HTTP.

## Layout

```
index.html              the one real page
privacy.html            \
terms.html               |  standalone, linked from the footer.
support.html             |  Flat .html files because sitemap.xml already
delete-account.html     /   advertises those exact URLs.
robots.txt
sitemap.xml
assets/
  logo.png              the mark, used five times on the page
  screen-browse.png     \
  screen-matches.png     |  real app screenshots, one per tour tab
  screen-leagues.png     |
  screen-rankings.png   /
```

## Things worth knowing before editing

**The images were inlined and are not any more.** `index.html` arrived as 4.2 MB,
of which 99.4% was base64 — the 424 KB logo alone was embedded five separate times.
Extracted, the HTML is ~26 KB and the logo downloads once and caches. If you
regenerate this page from a design tool, extract the images again rather than
committing a multi-megabyte HTML file.

**The tour's screenshots are matched to their tabs by hand.** The `data-screen`
attribute on each `.tour-tab` holds a bare filename; the script prepends `assets/`.
They were mispaired when this site was first produced — every tab showed the
previous tab's screen — so if you add or reorder tabs, open the images and check,
rather than trusting their order in the file.

**There is no Profile tab.** No screenshot of that screen exists. Add one to
`assets/` and a fifth `.tour-tab` (plus a fifth dot in `.tour-dots`) if you want it
back.

**The logo is a 1024×1024 PNG shown at 44px.** 424 KB for the largest asset on the
page. Worth resizing, and generating a real favicon, if page weight matters.

**The buttons match the app on purpose.** White fill inside a 1.5px gradient ring,
not a gradient fill — the app made that choice because a filled gradient forces the
label dark, and white type over the gradient's `#ffd44d` midpoint is 1.4:1. Keep
them in step with `GradientButton` in `src/components/button.tsx`.

**The app URL is hardcoded**, about eight times across the five pages. There is no
build step to interpolate it from, and adding templating for one string would cost
more than it saves. To move the app to its own subdomain later:

```sh
cd marketing-site
grep -rl 'tschusters-team-mahjong.expo.app' . \
  | xargs sed -i '' 's|https://tschusters-team-mahjong.expo.app|https://app.sevenbam.com|g'
```

Note that pointing `app.sevenbam.com` at the Expo deployment needs a paid EAS
Hosting plan — custom domains are a premium feature, one per project.
