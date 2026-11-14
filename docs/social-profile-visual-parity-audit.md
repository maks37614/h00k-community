# Visual and functional parity audit — social → h00k-community

Source: `maks37614/social`, `src/App.tsx`, `src/components/TraderProfileView.tsx`, `src/components/LeftTraderSidebar.tsx`, `src/index.css`. Target: `maks37614/h00k-community`, public `/u/maks` plus authenticated Community workspace.

## Dimensions now aligned with the reference source (code audit)

| Element | social source | Community implementation |
| --- | --- | --- |
| Main application max-width | 1720px | 1720px for public `/u/maks` and authenticated workspace |
| Public cover | 160px mobile / 208px from sm | 160px <= 640px / 208px above 640px |
| Public profile avatar | 112px mobile / 128px from sm | 112px <= 640px / 128px above 640px; square with rounded corners |
| Public info / KPI cards | 6 columns large, 3 medium, 2 small | 6 / 3 / 2 at responsive breakpoints |
| Authenticated profile avatar | source 112/128px | 112/128px |
| Authenticated left-side avatar | 64px | 64px desktop; adjusted further on mobile |
| Panel corners | rounded-3xl ~24px | 24px for public source-style panels |
| Palette | dark navy #080d17, mint #00e5bf | aligned for Community host shell and source-style public profile |
| Navigation | wall, articles, chart, results, about | real, shareable tab URLs with browser history |
| Gallery filters | symbol, venue, timeframe, markings | local-only filters; now keyboard- and scroll-reachable from the gallery header |

**Scope:** `publicProfileSocialSourceClone.css` is intentionally limited to `/u/maks` for full-width `social` parity. Other public profiles retain the previously shipped three-column Community layout. The authenticated workspace follows social's broad grid, without replacing actual backend permissions.

## Live review versus GitHub release

An anonymous browser audit of `https://community-stage.h00k.top/u/maks` on 14 November 2026 observed a compact two-column layout and the older generic statistics cards. The current GitHub `main` already contains the source-style full-width six-KPI `/u/maks` skin. This indicates the deployed staging build may be behind GitHub; it is **not** evidence that the recent CSS changes failed.

The live browser was approximately desktop width (around 1000–1200px); a real viewport resize to 320/375/768/1440/1920px was not available. Therefore **do not claim pixel-perfect visual parity** or real-device mobile verification until the newest image is deployed and inspected.

The same run saw navigation to HookChart and About and read-only posts, but was unsure whether the Articles tab changed; source code and existing tests show a separate articles route and a server-side `category=education` filter. It also noted that the gallery share and filter controls were not visible at the inspected scroll position; their DOM and CSS do not contain `display:none`. A button now scrolls/focuses the filter panel.

## Functional test matrix after deploying staging

1. Desktop 1920, 1440, 1024: verify cover height, 128px avatar, source-width center alignment, no overlap among four hero actions, six KPI cells, awards row and wall/article tabs.
2. Tablet 768: three KPI columns, no clipped action buttons, readable title, preserved navigation.
3. Mobile 390, 375, 320 (including iOS Safari input focus): 160px cover, 112px avatar, two KPI columns, action wrapping, horizontal tab navigation, no body horizontal overflow.
4. Open `/u/maks?tab=articles` and `?tab=hookchart`, verify titles/empty state, gallery filter focus and share link, reload and browser back.
5. Open `?tab=statistics`, check selected 7- versus 30-day window; with zero imported orders both panels can look similarly empty but label and `aria-pressed` must change.
6. Check linked comment, public HookChart, public photos, copying permalink, Telegram sharing. All anonymous flows must remain read-only; friends and private messages must take visitors to authenticated Community.
7. Compare against `social` reference at the **same viewport and same content**. The public profile has no real cover or avatar until the owner uploads and publishes these assets. Do not copy placeholder images or mock PnL from `social` as verified results.

## Known non-parity by design

- Demo `social` shows fabricated Win Rate, Profit Factor, R:R, followers, awards, online status, location and top trade. Community shows `—` or hides records until it has permission-backed data; a generic PnL card cannot count as verified.
- Source uses remotely loaded Plus Jakarta Sans and JetBrains Mono. Community uses font-family fallbacks under a strict self-hosted content-security policy. Font shapes will not be pixel-identical until an approved locally hosted font pipeline is added; do not weaken the CSP or add runtime font requests silently.
- The authenticated Community feed and guest read-only page are intentionally different contexts. Access controls, exchange-request budget and PostgreSQL persistence remain unchanged by the scale pass.

**Deploy:** publish and verify a Community Docker image from the latest main SHA. Migrate PostgreSQL from the updated image if releases since the last VPS install require it; back up DB and media first. No change to h00k.top's app image.
