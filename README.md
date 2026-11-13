<div align="center">

<img src="public/icon-192.png" width="96" height="96" alt="00OO App Icon" />

# 00OO — Hokkaido Winter Honeymoon 2027

[![Quality Gate](https://github.com/Timmatt-Lee/00OOhoneymoon2027/actions/workflows/ci.yml/badge.svg)](https://github.com/Timmatt-Lee/00OOhoneymoon2027/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/Timmatt-Lee/00OOhoneymoon2027/actions/workflows/deploy.yml/badge.svg)](https://github.com/Timmatt-Lee/00OOhoneymoon2027/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Interactive_Web_App-38bdf8?style=flat&logo=github)](https://timmatt-lee.github.io/00OOhoneymoon2027/)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9_Strict-3178c6?style=flat&logo=typescript&logoColor=white)
![Vitest](https://img.shields.io/badge/Coverage-100%25-6e9f18?style=flat&logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-Visual_E2E-2ead33?style=flat&logo=playwright&logoColor=white)

A bespoke, portrait-first interactive itinerary and multi-layer parallax visual experience crafted for a 12-day winter journey across Hokkaido (`2027.03.02 – 03.13`).

[**Explore Live Experience ↗**](https://timmatt-lee.github.io/00OOhoneymoon2027/)

</div>

---

## Visual Storyboard

|                   Day 01 · New Chitose & Sapporo                   |                   Day 02 · Sapporo Urban Stroll                    |                   Day 03 · Sapporo to Asahikawa                    |                    Day 04 · Asahikawa Snowfall                     |
| :----------------------------------------------------------------: | :----------------------------------------------------------------: | :----------------------------------------------------------------: | :----------------------------------------------------------------: |
| <img src="tests/screenshots/day-01.png" width="190" alt="Day 01"/> | <img src="tests/screenshots/day-02.png" width="190" alt="Day 02"/> | <img src="tests/screenshots/day-03.png" width="190" alt="Day 03"/> | <img src="tests/screenshots/day-04.png" width="190" alt="Day 04"/> |
|                    **Day 05 · Biei Snowfields**                    |                  **Day 06 · Lake Shikotsu Onsen**                  |                  **Day 07 · Noboribetsu Valley**                   |                 **Day 08 · Lake Toya & Mt. Yotei**                 |
| <img src="tests/screenshots/day-05.png" width="190" alt="Day 05"/> | <img src="tests/screenshots/day-06.png" width="190" alt="Day 06"/> | <img src="tests/screenshots/day-07.png" width="190" alt="Day 07"/> | <img src="tests/screenshots/day-08.png" width="190" alt="Day 08"/> |
|                  **Day 09 · Otaru Coastal Rail**                   |                   **Day 10 · Historic Akarenga**                   |                **Day 11 · Susukino & Clock Tower**                 |                   **Day 12 · Skyward Departure**                   |
| <img src="tests/screenshots/day-09.png" width="190" alt="Day 09"/> | <img src="tests/screenshots/day-10.png" width="190" alt="Day 10"/> | <img src="tests/screenshots/day-11.png" width="190" alt="Day 11"/> | <img src="tests/screenshots/day-12.png" width="190" alt="Day 12"/> |

---

## Engineering Highlights

- **60 Hz iOS Low Power Mode Compositor Architecture** — Settle glides run off the main thread on WebKit's CoreAnimation compositor (`#app-shell.is-gliding` `transform` + `opacity` transitions), paired with bidirectional Porter-Duff sky cross-fading (`opacity: 1` base + fractional upper layer, zero runtime CSS gradient repaints), pre-built story-pill DOM nodes (zero mid-swipe layout thrashing), and 3-layer `xMidYMax meet` vector landscapes (`0.38x` / `0.68x` / `1.0x`) spanning mobile and ultra-wide viewports.
- **2x-Capped HiDPI Zero-Allocation Particle Stage** — Pre-allocated `Mulberry32`-seeded particle pools with offscreen radial-gradient sprite caches, capped at `2x` DPR on `3x` Retina screens and automatically paused via `MutationObserver` during active swipes and glides while honoring `prefers-reduced-motion`.
- **Zero-Runtime-Dependency Offline PWA (`~176 KiB` Precache)** — Zero runtime npm dependencies (`dependencies: {}`). Build-time Vite plugins minify raw SVGs, dynamically subset `Huninn-Regular.woff2` (`~91 KiB`) across repository glyphs via `subset-font`, inject a strict `default-src 'none'` Content Security Policy, and compile `src/pwa/sw.ts` with a SHA-256 content-addressed precache (`~176 KiB` total) for instant cold-offline startups across rural Hokkaido.
- **Native Universal Links, Blind-Box Privacy & Semantic Accessibility** — Automatic `Asia/Tokyo` honeymoon date routing, `#day-1`..`#day-12` deep-linking, native `<a target="_blank" rel="noopener noreferrer">` Google Maps Universal Links on schedule items and the cityscape footer (with swipe click suppression and spoiler-free surprise blind-box rows), `<button>` story slots, `Home`/`End` keyboard shortcuts, `aria-live="polite"` announcements, and `inert` background panels.
- **100% Per-File V8 Coverage & Real-Browser Visual/WCAG Gate** — Enforced via strict TypeScript, ESLint (`strictTypeChecked` + `is*` boolean naming invariants), `100.00%` per-file Vitest V8 coverage across statements, branches, functions, and lines, plus Playwright visual regression snapshots, real-browser WCAG 2.1 AA (`>= 4.5:1`) computed-style contrast checks, and precache byte-budget gates.

---

## Development

```bash
npm ci
npm run dev          # Start local Vite dev server
npm run lint         # Run strict type-checked ESLint rules
npm run typecheck    # Run TypeScript compiler checks
npm run test:unit    # Run Vitest unit & integrity suites with 100% per-file V8 coverage gate
npm run test:e2e     # Build & run Playwright visual regression, WCAG, and PWA budget suites
npm test             # Run full quality gate (lint, format, typecheck, unit, build, e2e)
```
