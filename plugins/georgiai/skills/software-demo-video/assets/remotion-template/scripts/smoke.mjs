import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {ffmpeg,run,newOutput} from './io.mjs';
import {render} from './render.mjs';
import {mix,trim,verify} from './media.mjs';
import {RATE,timeline} from './audio.mjs';
import {clickTimes,validateConfig} from './config.mjs';

const id=`smoke-${Date.now()}`,out=resolve('out',id),assets=resolve('public',id);
mkdirSync(out,{recursive:true});mkdirSync(assets,{recursive:true});
const raw=join(assets,'source.mp4'),clip=join(assets,'trimmed.mp4'),music=join(out,'test-tone.wav');
run(ffmpeg,['-v','error','-n','-f','lavfi','-i','testsrc2=size=640x360:rate=30:duration=4','-an','-c:v','libx264','-pix_fmt','yuv420p',newOutput(raw)]);
const edit=trim(raw,clip,{keep:[[0,1],[2,4]],fps:30,pressSeconds:.5});
assert.equal(edit.pressFrame,15);assert.equal(edit.loadingCut,true);
run(ffmpeg,['-v','error','-n','-f','lavfi','-i','sine=frequency=220:sample_rate=48000:duration=5','-c:a','pcm_s16le',newOutput(music)]);
const c=validateConfig({width:1920,height:1080,fps:30,brand:{name:'Example Software',accent:'#176bda'},waitingLabel:'Изчакването е съкратено',syntheticLabel:'SYNTHETIC TEST — NOT A PRODUCT RECORDING',audio:{clickStyle:'double',clickGain:.35,musicGainDb:-24,duckDepth:.55,fadeSeconds:.4},scenes:[
  {id:'intro',kind:'card',frames:30,title:'Synthetic smoke test',caption:'Generated test pattern; no customer media',synthetic:true},
  {id:'screen',kind:'screen',frames:90,title:'Отваряне на екран',caption:'Изкуствен тест на надписи, клавиши и zoom',keys:'Alt+D',pressFrame:edit.pressFrame,file:`${id}/trimmed.mp4`,sourceWidth:640,sourceHeight:360,loadingCut:true,synthetic:true,focus:{x:100,y:50,width:440,height:260},zoomStartFrame:25,zoomEndFrame:65},
  {id:'end',kind:'card',frames:30,title:'Test complete',caption:'Real capture is a separate step',synthetic:true}
]});
const config=join(out,'smoke.json');writeFileSync(config,JSON.stringify(c,null,2));
const master=join(out,'master.mp4');await render(config,master);
await render(config,join(out,'preview.png'),60);
const clicks=join(out,'clicks.mp4'),final=join(out,'final.mp4'),bed=join(out,'bed.mp4');
mix(c,master,clicks);mix(c,master,final,music);mix({...c,audio:{...c.audio,clickGain:0}},master,bed,music);
const clickReport=verify(c,clicks,master),finalReport=verify(c,final,master);
const decode=file=>run(ffmpeg,['-v','error','-i',file,'-map','0:a:0','-ac','1','-ar',String(RATE),'-f','f32le','-'],true);
const pcm=decode(final),background=decode(bed),dry=decode(clicks),expected=timeline(5,clickTimes(c),'double',.35);
const sample=(b,i)=>i>=0&&i*4+4<=b.length?b.readFloatLE(i*4):0;
function correlation(read,reference,start,end,shift=0){let dot=0,aa=0,bb=0;for(let i=start;i<end;i++){const a=read(i+shift),b=reference(i);dot+=a*b;aa+=a*a;bb+=b*b;}return dot/Math.sqrt(aa*bb);}
const sync=[];
for(const time of clickTimes(c)){
  const start=Math.round(time*RATE),end=start+Math.round(.18*RATE);
  const r=correlation(i=>sample(pcm,i)-sample(background,i),i=>sample(dry,i),start,end);assert(r>.85,`Mixed click residual correlation ${r}`);
  let best={r:-1,shift:0};for(let shift=-240;shift<=240;shift++){const r=correlation(i=>sample(dry,i),i=>expected[i]??0,start,end,shift);if(r>best.r)best={r,shift};}
  assert(Math.abs(best.shift)<=48,`Click onset drift ${best.shift/RATE}s`);assert(best.r>.8);
  // Both taps must survive AAC, including the gap before the second onset.
  for(const offset of [0,.062]){let p=0;for(let i=start+Math.round(offset*RATE);i<start+Math.round((offset+.02)*RATE);i++)p=Math.max(p,Math.abs(sample(dry,i)));assert(p>.01,'Missing tap');}
  sync.push({time,residualCorrelation:r,bestOffsetSamples:best.shift,sourceCorrelation:best.r});
}
let endPeak=0;for(let i=Math.round(4.99*RATE);i<5*RATE;i++)endPeak=Math.max(endPeak,Math.abs(sample(pcm,i)));assert(endPeak<.001,'Music does not fade out');
const report={syntheticOnly:true,clickOnly:clickReport,withMusic:finalReport,sync,endingPeak:endPeak,trim:edit,notTested:['real application capture','HyperFrames','other operating systems','subjective listening']};
writeFileSync(join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output:out,report},null,2));
