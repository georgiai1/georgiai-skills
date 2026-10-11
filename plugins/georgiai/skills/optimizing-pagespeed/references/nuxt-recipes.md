# Nuxt / Vercel recipes (proven in production)

All server pieces live in one Nitro `render:response` hook that only touches ISR pages (`getRouteRules(event).isr`). Rendering cost there is paid once per revalidation.

## Detect HTML (Nuxt ≥4.6 leaves `response.headers` empty)

```ts
export function isHtmlResponse(r: { body?: unknown, headers?: Record<string, unknown> }) {
  const type = r.headers?.['content-type']
  if (type) return String(type).includes('text/html')
  return typeof r.body === 'string' && /^\s*<!doctype html/i.test(r.body)
}
```

## Critical CSS + full sheet after `load`

```ts
import Beasties from 'beasties'
class OriginBeasties extends Beasties {
  constructor(private origin: string) {
    super({ preload: 'media', noscriptFallback: true, inlineFonts: true, reduceInlineStyles: false, pruneSource: false, logLevel: 'silent' })
  }
  override async getCssAsset(href: string) { /* fetch(new URL(href, this.origin)), memoize per href */ }
}
// then turn beasties' media="print" links into a load-event loader:
const ASYNC_LINK = /<link rel="stylesheet" href="(\/_nuxt\/[^"]+\.css)"[^>]*media="print" onload="this\.media='all'">/g
// strip them, inject before </head>:
// <script>addEventListener('load',function(){[hrefs].forEach(function(h){var l=document.createElement('link');l.rel='stylesheet';l.href=h;l.crossOrigin='';document.head.appendChild(l)})})</script>
```

## App bundle after first paint

```ts
const ENTRY = /<script type="module" src="(\/_nuxt\/[^"]+\.js)" crossorigin><\/script>/
const PRELOAD = /<link rel="modulepreload" as="script" crossorigin href="\/_nuxt\/[^"]+\.js">/g
// replace ENTRY with:
// <script>(function(){function load(){var s=document.createElement('script');s.type='module';s.src=SRC;s.crossOrigin='';document.head.appendChild(s)}
// function afterPaint(){requestAnimationFrame(function(){requestAnimationFrame(load)})}
// document.readyState==='loading'?document.addEventListener('DOMContentLoaded',afterPaint):afterPaint()})()</script>
```
Wait for DOMContentLoaded: hydration needs the full DOM (module scripts were deferred).

## ISR renders as anonymous

```ts
nitro.hooks.hook('request', (event) => {
  if (getRouteRules(event).isr) delete event.node.req.headers.cookie
})
```

## Lazy auth client (example: @nuxtjs/supabase)

- `app:resolve` hook: drop the module's `supabase.client` plugin from `app.plugins`.
- Own `enforce: 'pre'` plugin providing `$supabase` with a `client` getter that throws a clear error until it is loaded.
- `import('~/lib/supabase-browser')` when a session cookie exists, or from a global route middleware for routes in a list.
- A vitest test scans `pages/` for `useSupabaseClient(` and asserts each page's route is in the list.

## Smooth scroll on desktop only

```ts
export default defineNuxtPlugin(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
  onNuxtReady(async () => {
    const { default: Lenis } = await import('lenis')
    useSmoothScroll().value = new Lenis({ autoRaf: true }) // shallowRef composable; callers use `?.`
  })
})
```

## Metric-matched fallback font

Compute with fontTools: `size-adjust` = avg advance (sample text) of the web font ÷ Arial; `ascent-override` = ascender ÷ (UPM × size-adjust); the same for descent.

```css
@font-face { font-family: 'Display Fallback'; src: local('Arial Bold'), local('Liberation Sans Bold');
  font-weight: 700 900; size-adjust: 96.44%; ascent-override: 100.45%; descent-override: 25.01%; line-gap-override: 0%; }
h1 { font-family: 'Display', 'Display Fallback', sans-serif; }
```
Put it next to the rule that uses it (inline component style) so critical-CSS pruning can't drop it.

## Assets

- Subset self-hosted fonts to the scripts you use (`pyftsubset … --unicodes=U+0000-017F,U+0400-045F,…`) and add a matching `unicode-range` (47 → 26 KB per weight).
- Resize images to about 2× their display size. Give images `width`/`height`, `loading="lazy"` and `fetchpriority="low"` below the hero, and `fetchpriority="high"` + `srcset` on the LCP image.
- routeRules: `/fonts/**` immutable 1 year; `/images/**` 1 week + SWR; hashed i18n messages `isr: true`.

## Third parties

gtag/Hotjar: start on the first `pointerdown|keydown|scroll|touchstart`, with gtag falling back to `setTimeout(…, 6000)`.
