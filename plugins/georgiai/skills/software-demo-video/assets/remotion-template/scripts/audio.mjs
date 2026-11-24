import {writeFileSync} from 'node:fs';
export const RATE=48000;
export function click(style='double') {
  if(!['mechanical','soft','digital','double'].includes(style))throw Error('Unknown click style');
  const a=new Float64Array(Math.round(.18*RATE));
  let seed=701,low=0;
  const tap=(time)=>{
    if(time<0||time>.045)return 0;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const n=seed/2147483648-1;low+=.22*(n-low);
    const attack=Math.min(1,time/.0005),decay=Math.exp(-time*210);
    if(style==='digital')return attack*decay*Math.sin(2*Math.PI*1450*time);
    if(style==='soft')return attack*decay*(.8*low+.2*Math.sin(2*Math.PI*550*time));
    return attack*decay*(.65*(n-low)+.35*Math.sin(2*Math.PI*420*time));
  };
  // Two independently synthesized taps; the second starts exactly 2976 samples later.
  for(let i=0;i<a.length;i++)a[i]=tap(i/RATE)+(style==='double'?.8*tap(i/RATE-.062):0);
  const peak=Math.max(...a.map(Math.abs));
  for(let i=0;i<a.length;i++)a[i]=a[i]/peak*.36;
  return a;
}
export function timeline(duration,times,style,gain=.35){
  const samples=new Float64Array(Math.round(duration*RATE)),one=click(style);
  for(const t of times){const start=Math.round(t*RATE);for(let i=0;i<one.length&&start+i<samples.length;i++)samples[start+i]+=one[i]*gain;}
  return samples;
}
export function writeWav(file,samples){
  const b=Buffer.alloc(44+samples.length*2);
  b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(RATE,24);b.writeUInt32LE(RATE*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);
  samples.forEach((v,i)=>{if(!Number.isFinite(v)||Math.abs(v)>=1)throw Error('Clipping or invalid sample');b.writeInt16LE(Math.round(v*32767),44+i*2);});
  writeFileSync(file,b);
}
