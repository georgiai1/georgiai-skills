// Load metrics from a Chrome trace (DevTools / Lighthouse --save-assets).
// usage: node trace-stats.cjs <trace.json[.gz]> [urlSubstring]
// Prints FCP, LCP, TBT, long tasks, CLS and main-thread time by category for the
// first main-frame navigation whose URL contains urlSubstring (default: any http).
const fs = require('fs')
const zlib = require('zlib')

const [file, sub = 'http'] = process.argv.slice(2)
const raw = fs.readFileSync(file)
const data = JSON.parse(file.endsWith('.gz') ? zlib.gunzipSync(raw) : raw)
const ev = data.traceEvents || data

const nav = ev.find(e => e.name === 'navigationStart' && e.args?.data?.isLoadingMainFrame && e.args?.data?.documentLoaderURL?.includes(sub))
if (!nav) { console.log('no matching navigation'); process.exit(1) }
const t0 = nav.ts
const main = `${nav.pid}:${nav.tid}`
const ms = ts => Math.round((ts - t0) / 1000)
const onMain = e => `${e.pid}:${e.tid}` === main

const fcp = ev.find(e => e.name === 'firstContentfulPaint' && e.ts > t0 && e.pid === nav.pid)
const lcps = ev.filter(e => e.name === 'largestContentfulPaint::Candidate' && e.ts > t0 && e.pid === nav.pid)
const lcp = lcps[lcps.length - 1]

let tbt = 0
const longTasks = []
for (const t of ev.filter(e => e.name === 'RunTask' && e.ph === 'X' && onMain(e) && e.ts >= (fcp?.ts || t0))) {
  const d = t.dur / 1000
  if (d > 50) { tbt += d - 50; longTasks.push([ms(t.ts), Math.round(d)]) }
}

const groups = { EvaluateScript: 'script', 'v8.compile': 'script', 'v8.evaluateModule': 'script', FunctionCall: 'script', UpdateLayoutTree: 'style', Layout: 'layout', ParseHTML: 'html', ParseAuthorStyleSheet: 'cssParse', Paint: 'paint' }
const mainThread = {}
for (const e of ev) {
  if (!onMain(e) || e.ph !== 'X' || e.ts < t0) continue
  const g = groups[e.name]
  if (g) mainThread[g] = (mainThread[g] || 0) + e.dur / 1000
}
for (const k in mainThread) mainThread[k] = Math.round(mainThread[k])

let cls = 0
for (const e of ev) if (e.name === 'LayoutShift' && e.ts > t0 && e.pid === nav.pid && !e.args?.data?.had_recent_input) cls += e.args?.data?.score || 0

console.log(JSON.stringify({ FCP: fcp && ms(fcp.ts), LCP: lcp && ms(lcp.ts), TBT: Math.round(tbt), longTasks, CLS: +cls.toFixed(3), mainThreadMs: mainThread }, null, 1))
