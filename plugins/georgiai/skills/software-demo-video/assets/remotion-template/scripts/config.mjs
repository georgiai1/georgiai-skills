export function validateConfig(c) {
  const integer = (n, min = 1) => Number.isInteger(n) && n >= min;
  const safeFile = p => typeof p === 'string' && p.length > 0 && !/[:\\?#]/.test(p) && !p.startsWith('/') && !p.split('/').some(s => s === '..' || s === '.' || !s);
  if (![c.width, c.height].every(n => integer(n) && n % 2 === 0) || !integer(c.fps)) throw Error('Use positive even dimensions and an integer fps.');
  if (!Array.isArray(c.scenes) || !c.scenes.length) throw Error('At least one scene is required.');
  const ids = new Set();
  for (const s of c.scenes) {
    if (!s.id || ids.has(s.id)) throw Error('Scene IDs must be unique.');
    ids.add(s.id);
    if (!integer(s.frames) || !['screen', 'card'].includes(s.kind) || typeof s.title !== 'string') throw Error('Invalid scene.');
    if (s.pressFrame !== undefined && (!integer(s.pressFrame, 0) || s.pressFrame + Math.ceil(c.fps * .18) > s.frames || !s.keys)) throw Error('Press needs keys and room for the 180ms sound.');
    if (s.kind === 'screen') {
      if (!safeFile(s.file) || !integer(s.sourceWidth) || !integer(s.sourceHeight)) throw Error('Screen needs a relative public file and source dimensions.');
      if (s.focus) {
        const r = s.focus;
        if (![r.x,r.y,r.width,r.height].every(Number.isFinite) || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x+r.width>s.sourceWidth || r.y+r.height>s.sourceHeight) throw Error('Focus rectangle is outside the source.');
        if (!integer(s.zoomStartFrame,0) || !integer(s.zoomEndFrame) || s.zoomEndFrame<=s.zoomStartFrame || s.zoomEndFrame>=s.frames) throw Error('Focus needs valid zoom frame bounds.');
      }
    }
  }
  for (const p of [c.brand?.logo, c.brand?.fontFile]) if (p !== undefined && !safeFile(p)) throw Error('Brand assets must be relative public paths.');
  const a=c.audio ?? {};
  if (a.clickStyle !== undefined && !['mechanical','soft','digital','double'].includes(a.clickStyle)) throw Error('Unknown click style.');
  for (const [key,min,max] of [['clickGain',0,2],['musicGainDb',-90,0],['duckDepth',0,1],['fadeSeconds',.01,30]]) {
    if (a[key] !== undefined && (!Number.isFinite(a[key]) || a[key]<min || a[key]>max)) throw Error(`Invalid ${key}.`);
  }
  if (c.scenes.some(s=>s.loadingCut) && !c.waitingLabel) throw Error('Shortened waits require a visible label.');
  if (c.scenes.some(s=>s.synthetic) && !c.syntheticLabel) throw Error('Synthetic scenes require a visible label.');
  return c;
}

export const totalFrames = c => c.scenes.reduce((n,s)=>n+s.frames,0);
export function clickTimes(c) {
  let offset=0;
  return c.scenes.flatMap(s=>{const t=s.pressFrame === undefined?[]:[(offset+s.pressFrame)/c.fps];offset+=s.frames;return t;});
}
