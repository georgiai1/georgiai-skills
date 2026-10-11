---
name: optimizing-pagespeed
description: Use when a PageSpeed Insights / Lighthouse score is low or swings between runs, lab FCP/LCP/Speed Index is far worse than real Chrome, a page lags or heats phones while idle, or when speeding up a Nuxt/Vue/Vercel site (critical CSS, hydration JS, fonts, third-party scripts, CSS animations, ISR caching).
license: MIT
---

# Optimizing PageSpeed

## Overview

PSI mobile is **Lighthouse Lantern**: it records an *unthrottled* trace, then simulates Slow 4G + 4× CPU. Find the mechanism in a trace before changing code; most "slow" scores come from what starts before the observed paint, late layouts, or one bad animation.

## How Lantern scores (non-obvious)

| Metric | What it really charges |
|---|---|
| FCP / LCP | Every request that **starts before the observed paint** (pessimistic graph). JS modulepreloads, async CSS, fonts and eager images all count, render-blocking or not. |
| Speed Index | Estimated from **Layout events** after FCP. Per-frame layout animations (`width`, `height`, `top`) add hundreds of late layouts. |
| LCP element | Text faded in from `opacity: 0` counts only once visible. The LCP element can differ by locale (a longer tagline beats a short headline). |
| Variance (85↔99) | PSI's headless Chrome sometimes holds the first frame 1–2 s (GPU idle, no BeginFrames). Then everything requested before it is charged. You can't fix the stall; make the pre-paint window tiny. |

## Measuring

- **PSI**: use pagespeed.web.dev; the API key quota is often exhausted. Results are cached ~5 min per URL; wait before re-running. Run each URL 2–3 times and expand "LCP breakdown" / "Layout shift culprits".
- **Lighthouse CLI** at PSI's version against **production**: `npx lighthouse@<ver> URL --only-categories=performance --form-factor=mobile --output=json --save-assets`. Never compare against a local `node .output/server`: no compression, so the simulated bytes are wrong.
- **Traces** (DevTools MCP): emulate `412x823x1.75,mobile,touch`, Slow 4G, CPU 4×. **Close other tabs**: traces record every renderer. Analyse with `node scripts/trace-stats.cjs <trace.json.gz>` (load) and `node scripts/idle-cpu.cjs <trace.json.gz>` (3 s idle trace).
- **Bundle**: `npx nuxi analyze --no-serve`, then check which packages sit in the entry chunk.

## Fix catalog

| Symptom | Cause | Fix |
|---|---|---|
| HTML 3× larger than content; style recalc 1 s+ | Whole Tailwind sheet inlined in every page | Critical CSS (beasties) on cached pages; full sheet **after `load`** |
| Lab FCP/LCP ≫ real | App JS fetched during parse | On static/ISR pages load the entry module after DOMContentLoaded + double rAF; drop its modulepreload |
| Entry chunk huge | SDK (auth/DB client) in a global plugin | Lazy client plugin: load on session cookie or listed routes, with a test guarding the route list |
| Main thread busy while idle | Smooth-scroll rAF loop forcing style recalc; `filter`/layout animations | Measure (below); drop the scroll lib on touch, animate transform/opacity only |
| CLS on hero | %-based absolute offsets in a growing container; font swap | Fixed offsets; metric-matched fallback `@font-face` (size-adjust/ascent-override) |
| SI late | JS-driven counters after hydration; width animations | CSS-only keyframes from first paint, transform-only |
| TBT spikes | gtag/Hotjar on idle (~600 ms) | Start on first interaction or after ~6 s |
| Slow TTFB on content pages | SSR per request | ISR for marketing routes |

Snippets for each fix: `references/nuxt-recipes.md`.

## Idle-CPU recipe

1. Trace 3 s of idle. If main thread is >10% busy or there are >0 style recalcs/s, keep going.
2. `document.getAnimations()`: list running animations and their properties.
3. Pause suspects one at a time (`anim.pause()`) and re-trace. Check the trace for `compositeFailed` reasons on `Animation` events.
4. Any rAF loop reading layout (`scrollTop`) forces a recalc of every animating element, even composited ones.

## Traps (each broke production once)

- **Deferring CSS changes cascade order.** Global `@keyframes`/classes sharing a name with Tailwind config entries (`marquee`, `shine`) silently switch to the later definition. Use unique names in global `<style>` blocks; scoped styles are safe.
- **ISR + cookies**: a cached render can serialize a visitor's session. Strip cookies on ISR renders.
- **ISR + `Accept: text/markdown`**: the cache is path-keyed, so rewrite markdown requests before the cache for every ISR route.
- **Nuxt ≥4.6**: `response.headers` is empty in `render:response`; detect HTML from the body.
- **Late-loaded full CSS**: only classes added client-side miss it briefly; verify menus and modals after `load`.
- **Delaying analytics** drops bounced visitors' pageviews. Tell the owner.
- **Removing a global scroll library**: find every consumer (`useLenis`) and keep a native fallback.

## Verify before claiming

Run tests, a production build, and a visual full-page screenshot diff against production (pixel delta ≈ 0). Test interactive states after `load`, then PSI ×2–3 on production for each locale's homepage plus desktop. Report the range, not the best run.
