// Main-thread cost per second in an idle trace (no navigation: start a trace,
// wait ~3 s, stop). Close other tabs first - traces record every renderer.
// usage: node idle-cpu.cjs <trace.json[.gz]>
// Healthy idle page: busy < ~50 ms/s and 0 style recalcs/s.
const fs = require('fs')
const zlib = require('zlib')

const file = process.argv[2]
const raw = fs.readFileSync(file)
const data = JSON.parse(file.endsWith('.gz') ? zlib.gunzipSync(raw) : raw)
const ev = data.traceEvents || data

const rendererMains = new Set(ev.filter(e => e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map(e => `${e.pid}:${e.tid}`))
const busy = {}
for (const t of ev) {
  if (t.name !== 'RunTask' || t.ph !== 'X') continue
  const k = `${t.pid}:${t.tid}`
  if (rendererMains.has(k)) busy[k] = (busy[k] || 0) + t.dur
}
const main = Object.entries(busy).sort((a, b) => b[1] - a[1])[0]?.[0]
if (!main) { console.log('no renderer main thread found'); process.exit(1) }

const evm = ev.filter(e => `${e.pid}:${e.tid}` === main && e.ph === 'X')
const start = Math.min(...evm.map(e => e.ts))
const end = Math.max(...evm.map(e => e.ts + e.dur))
const secs = (end - start) / 1e6
const perSec = name => Math.round(evm.filter(e => e.name === name).reduce((a, e) => a + e.dur, 0) / 1000 / secs)

const rafFns = {}
for (const e of evm.filter(e => e.name === 'FunctionCall')) {
  const k = `${(e.args?.data?.url || '').split('/').pop()}:${e.args?.data?.functionName || '?'}`
  rafFns[k] = (rafFns[k] || 0) + e.dur / 1000
}
const topFunctions = Object.entries(rafFns).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${Math.round(v / secs)}ms/s`)

console.log(JSON.stringify({
  seconds: +secs.toFixed(1),
  msPerSecond: { busy: perSec('RunTask'), style: perSec('UpdateLayoutTree'), layout: perSec('Layout'), animationFrames: perSec('FireAnimationFrame') },
  styleRecalcsPerSec: Math.round(evm.filter(e => e.name === 'UpdateLayoutTree').length / secs),
  topFunctions,
}, null, 1))
