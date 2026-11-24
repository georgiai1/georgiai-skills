import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {clickTimes,totalFrames} from './config.mjs';
import {click,timeline,writeWav,RATE} from './audio.mjs';
import {ffmpeg,run,probe,readConfig,newOutput} from './io.mjs';

export function videoHash(file){return run(ffmpeg,['-v','error','-i',file,'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-']).trim();}
export function atoms(buffer){
  const result=[];
  for(let p=0;p<buffer.length;){
    assert(p+8<=buffer.length,'Truncated MP4 atom');
    let size=buffer.readUInt32BE(p);const type=buffer.toString('ascii',p+4,p+8);let header=8;
    if(size===1){assert(p+16<=buffer.length);size=Number(buffer.readBigUInt64BE(p+8));header=16;}
    if(size===0)size=buffer.length-p;
    assert(Number.isSafeInteger(size)&&size>=header&&p+size<=buffer.length,'Invalid MP4 atom size');
    result.push(type);p+=size;
  }return result;
}
export function verify(config,file,reference){
  const meta=probe(file),v=meta.streams.find(s=>s.codec_type==='video'),a=meta.streams.find(s=>s.codec_type==='audio'),duration=totalFrames(config)/config.fps;
  assert(v&&a,'Video and audio required');
  assert.equal(v.codec_name,'h264');assert.equal(a.codec_name,'aac');assert.equal(v.pix_fmt,'yuv420p');
  assert.equal(v.width,config.width);assert.equal(v.height,config.height);
  const [n,d]=v.avg_frame_rate.split('/').map(Number);assert(Math.abs(n/d-config.fps)<.001,'FPS mismatch');
  assert(Math.abs(Number(meta.format.duration)-duration)<Math.max(.1,2/config.fps),'Duration mismatch');
  const count=Number(run(ffmpeg,['-v','error','-i',file,'-map','0:v:0','-f','framehash','-']).split('\n').filter(l=>/^0,/.test(l)).length);
  assert.equal(count,totalFrames(config),'Unexpected decoded frame count');
  run(ffmpeg,['-v','error','-xerror','-i',file,'-f','null','-']);
  const pcm=run(ffmpeg,['-v','error','-i',file,'-map','0:a:0','-ar',String(RATE),'-ac','2','-f','f32le','-'],true);
  let peak=0;for(let i=0;i<pcm.length;i+=4){const sample=pcm.readFloatLE(i);assert(Number.isFinite(sample));peak=Math.max(peak,Math.abs(sample));}
  assert(peak<.95,`Audio sample peak ${peak} leaves insufficient headroom`);
  const boxes=atoms(readFileSync(file));assert(boxes.includes('moov')&&boxes.includes('mdat')&&boxes.indexOf('moov')<boxes.indexOf('mdat'),'MP4 is not faststart');
  if(reference)assert.equal(videoHash(file),videoHash(reference),'Video packets changed');
  return {durationSeconds:Number(meta.format.duration),width:v.width,height:v.height,fps:n/d,decodedFrames:count,videoCodec:v.codec_name,audioCodec:a.codec_name,samplePeak:peak,fullDecode:true,faststart:true,videoPacketsIdentical:reference?true:null,plannedClickTimes:clickTimes(config),sync:'Inspect frames and listen; use smoke test for automated synthetic correlation.'};
}
export function mix(config,video,output,music){
  const target=newOutput(output),duration=totalFrames(config)/config.fps,a=config.audio??{},times=clickTimes(config);
  const input=probe(video),v=input.streams.find(s=>s.codec_type==='video');
  assert.equal(v?.codec_name,'h264','The master must already be H.264');
  assert(Math.abs(Number(input.format.duration)-duration)<.1,'Master duration does not match config');
  const scratch=mkdtempSync(join(tmpdir(),'software-demo-audio-'));
  try{
    const wav=join(scratch,'clicks.wav');writeWav(wav,timeline(duration,times,a.clickStyle??'double',a.clickGain??.35));
    const args=['-v','error','-n','-i',resolve(video),'-i',wav];
    let filter='[1:a]aformat=sample_rates=48000:channel_layouts=stereo[clicks]';
    if(music){
      args.push('-i',resolve(music));
      const fades=Math.min(a.fadeSeconds??.6,duration/2),depth=a.duckDepth??.55;
      const sum=times.map(t=>`exp(-pow((t-${(t+.06).toFixed(6)})/0.10,2))`).join('+')||'0';
      const duck=`max(${1-depth},1-${depth}*(${sum}))`;
      filter+=`;[2:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS,volume=${a.musicGainDb??-24}dB,volume='${duck}':eval=frame,afade=t=in:d=${fades},afade=t=out:st=${duration-fades}:d=${fades},apad,atrim=duration=${duration}[bed];[clicks][bed]amix=inputs=2:normalize=0:duration=longest,atrim=duration=${duration}[out]`;
    }else filter+=';[clicks]anull[out]';
    args.push('-filter_complex',filter,'-map','0:v:0','-map','[out]','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(duration),'-movflags','+faststart',target);
    run(ffmpeg,args);assert.equal(videoHash(target),videoHash(video),'Video packets changed during audio mix');
    return target;
  }finally{rmSync(scratch,{recursive:true,force:true});}
}
// Keep intervals are in source seconds; omitted regions are cuts, never interpolated UI.
export function trim(input,output,plan){
  const {keep,fps=30,pressSeconds}=plan;
  if(!Number.isInteger(fps)||fps<1||!Array.isArray(keep)||!keep.length)throw Error('Need fps and keep intervals');
  const duration=Number(probe(input).format.duration);let previous=0;
  for(const r of keep){if(!Array.isArray(r)||r.length!==2||!r.every(Number.isFinite)||r[0]<previous||r[1]<=r[0]||r[1]>duration+.001)throw Error('Invalid/overlapping keep intervals');previous=r[1];}
  let pressFrame=null,offset=0;
  for(const [a,b] of keep){if(pressSeconds>=a&&pressSeconds<b)pressFrame=Math.round((offset+pressSeconds-a)*fps);offset+=b-a;}
  if(pressSeconds!==undefined&&pressFrame===null)throw Error('The key press was cut out');
  const chains=keep.map(([a,b],i)=>`[0:v]trim=start=${a}:end=${b},setpts=PTS-STARTPTS[v${i}]`);
  chains.push(`${keep.map((_,i)=>`[v${i}]`).join('')}concat=n=${keep.length}:v=1:a=0,fps=${fps},pad=ceil(iw/2)*2:ceil(ih/2)*2[out]`);
  run(ffmpeg,['-v','error','-n','-i',input,'-filter_complex',chains.join(';'),'-map','[out]','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',newOutput(output)]);
  return {pressFrame,fps,plannedDuration:offset,loadingCut:keep.length>1,keep,reminder:'Inspect the edited press frame; add the visible waiting label if a wait was removed.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [command,...args]=process.argv.slice(2);
  if(command==='clicks'){const folder=args[0];if(!folder)throw Error('clicks <output-directory>');for(const style of ['mechanical','soft','digital','double'])writeWav(newOutput(join(folder,`${style}.wav`)),click(style));}
  else if(command==='mix'){const [config,video,output,music]=args;console.log(mix(readConfig(config),video,output,music));}
  else if(command==='verify'){const [config,video,reference]=args;console.log(JSON.stringify(verify(readConfig(config),video,reference),null,2));}
  else if(command==='trim'){const [input,output,plan]=args;console.log(JSON.stringify(trim(input,output,JSON.parse(readFileSync(plan,'utf8'))),null,2));}
  else throw Error('Commands: clicks <dir> | trim <input> <output> <plan.json> | mix <config.json> <master.mp4> <output.mp4> [music] | verify <config.json> <final.mp4> [master.mp4]');
}
