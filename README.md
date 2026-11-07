<div align="center">

# 00OO — Hokkaido Winter Honeymoon 2027

[![Deploy to GitHub Pages](https://github.com/Timmatt-Lee/00OOhoneymoon2027/actions/workflows/deploy.yml/badge.svg)](https://github.com/Timmatt-Lee/00OOhoneymoon2027/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Interactive_Web_App-38bdf8?style=flat&logo=github)](https://timmatt-lee.github.io/00OOhoneymoon2027/)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.0-646cff?style=flat&logo=vite&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-E2E_Verified-2ead33?style=flat&logo=playwright&logoColor=white)

A bespoke, mobile-first interactive itinerary and multi-layer parallax visual experience crafted for a 12-day winter journey across Hokkaido (`2027.03.02 – 03.13`).

[**Explore Live Experience ↗**](https://timmatt-lee.github.io/00OOhoneymoon2027/)

</div>

---

## Visual Storyboard

| Day 01 · New Chitose & Sapporo | Day 02 · Sapporo Urban Stroll | Day 03 · Sapporo to Asahikawa | Day 04 · Asahikawa Snowfall |
| :---: | :---: | :---: | :---: |
| <img src="tests/screenshots/day-01.png" width="190" alt="Day 01"/> | <img src="tests/screenshots/day-02.png" width="190" alt="Day 02"/> | <img src="tests/screenshots/day-03.png" width="190" alt="Day 03"/> | <img src="tests/screenshots/day-04.png" width="190" alt="Day 04"/> |
| **Day 05 · Biei Snowfields** | **Day 06 · Lake Shikotsu Onsen** | **Day 07 · Noboribetsu Valley** | **Day 08 · Lake Toya & Mt. Yotei** |
| <img src="tests/screenshots/day-05.png" width="190" alt="Day 05"/> | <img src="tests/screenshots/day-06.png" width="190" alt="Day 06"/> | <img src="tests/screenshots/day-07.png" width="190" alt="Day 07"/> | <img src="tests/screenshots/day-08.png" width="190" alt="Day 08"/> |
| **Day 09 · Otaru Coastal Rail** | **Day 10 · Historic Akarenga** | **Day 11 · Susukino & Clock Tower** | **Day 12 · Skyward Departure** |
| <img src="tests/screenshots/day-09.png" width="190" alt="Day 09"/> | <img src="tests/screenshots/day-10.png" width="190" alt="Day 10"/> | <img src="tests/screenshots/day-11.png" width="190" alt="Day 11"/> | <img src="tests/screenshots/day-12.png" width="190" alt="Day 12"/> |

---

## Engineering Highlights

* **Continuous Gesture & Parallax Engine** — Sub-pixel pointer interpolation driving 3-layer SVG vector landscapes (`0.38x` / `0.68x` / `1.0x`), cross-fading atmospheric sky gradients, and synchronized timeline rail transitions at 60 FPS.
* **Zero-Allocation Canvas Particle Physics** — Pre-allocated particle pools powered by a seeded `Mulberry32` PRNG, rendering real-time snowfall, lakeside *rotenburo* steam wisps, and urban night-glow bokeh with zero runtime GC overhead.
* **Deterministic Visual Regression Gate** — End-to-end Playwright suite enforcing zero bounding-box collisions, strict schema invariants, and pixel-verified 12-day viewport snapshots on every commit.

---

## Development

```bash
npm ci
npm run dev        # Start local Vite dev server
npm run test:e2e   # Run Playwright visual & interaction suite
```
