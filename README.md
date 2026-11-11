<div align="center">

<img src="public/icon-192.png" width="96" height="96" alt="00OO App Icon" />

# 00OO — Hokkaido Winter Honeymoon 2027

[![Quality Gate](https://github.com/Timmatt-Lee/00OOhoneymoon2027/actions/workflows/ci.yml/badge.svg)](https://github.com/Timmatt-Lee/00OOhoneymoon2027/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/Timmatt-Lee/00OOhoneymoon2027/actions/workflows/deploy.yml/badge.svg)](https://github.com/Timmatt-Lee/00OOhoneymoon2027/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Interactive_Web_App-38bdf8?style=flat&logo=github)](https://timmatt-lee.github.io/00OOhoneymoon2027/)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6_Strict-3178c6?style=flat&logo=typescript&logoColor=white)
![Vitest](https://img.shields.io/badge/Coverage-%E2%89%A599%25-6e9f18?style=flat&logo=vitest&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-Visual_E2E-2ead33?style=flat&logo=playwright&logoColor=white)

A bespoke, mobile-first interactive itinerary and multi-layer parallax visual experience crafted for a 12-day winter journey across Hokkaido (`2027.03.02 – 03.13`).

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

- **Continuous Gesture & Wide-Viewport Parallax Engine** — Sub-pixel pointer interpolation driving 3-layer SVG vector landscapes (`0.38x` / `0.68x` / `1.0x`) that dynamically expand across mobile and ultra-wide desktop viewports, paired with cross-fading atmospheric sky gradients and synchronized timeline rail transitions at 60 FPS.
- **HiDPI Zero-Allocation Canvas Particle Physics** — `devicePixelRatio`-scaled backing store and pre-allocated particle pools powered by a seeded `Mulberry32` PRNG, rendering crisp snowfall, lakeside _rotenburo_ steam wisps, and urban night-glow bokeh while honoring `prefers-reduced-motion`.
- **True Offline-First Typed PWA** — Custom Vite build plugin compiles `src/pwa/sw.ts` with a deterministic SHA-256 cache version and full precache manifest (hashed JS/CSS bundles, `Huninn-Regular.woff2`, icons, and HTML shell) for reliable offline access across rural Hokkaido.
- **Context-Aware Routing & Semantic Accessibility** — Automatic `Asia/Tokyo` honeymoon date detection, `#day-1`..`#day-12` deep-linking, inline Google Maps landmark anchors (preserving surprise blind-box items), semantic `<button>` story slots, `inert` background panels, and crisp CJK stroke-first typography (`font-synthesis: none`).
- **99%+ Coverage & Visual Regression Gate** — Enforced via strict TypeScript, ESLint (`strictTypeChecked`), Vitest V8 unit coverage (`≥ 99%` across lines, branches, functions, and statements), and Playwright visual regression + smoke suites on every commit and PR.

---

## Development

```bash
npm ci
npm run dev          # Start local Vite dev server
npm run lint         # Run strict type-checked ESLint rules
npm run typecheck    # Run TypeScript compiler checks
npm run test:unit    # Run Vitest unit suite with ≥99% V8 coverage gate
npm run test:e2e     # Build & run Playwright visual regression + smoke suite
npm test             # Run full quality gate (format, lint, typecheck, unit, e2e)
```
