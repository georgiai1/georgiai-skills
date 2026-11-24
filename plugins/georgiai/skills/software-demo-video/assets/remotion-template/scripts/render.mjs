import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync,mkdirSync} from 'node:fs';
import {readConfig,newOutput,probe} from './io.mjs';
export async function render(configFile,output,stillFrame){
  const inputProps=readConfig(configFile),target=newOutput(output),publicDir=resolve('public');mkdirSync(publicDir,{recursive:true});
  for(const s of inputProps.scenes.filter(s=>s.kind==='screen')){
    const path=resolve(publicDir,s.file);if(!existsSync(path))throw Error(`Missing real capture: ${s.file}. Use npm run smoke only for labeled synthetic testing.`);
    const meta=probe(path),v=meta.streams.find(s=>s.codec_type==='video');
    if(v?.width!==s.sourceWidth||v?.height!==s.sourceHeight||Number(meta.format.duration)+1/inputProps.fps<s.frames/inputProps.fps)throw Error(`Source dimensions/duration mismatch: ${s.file}`);
  }
  const serveUrl=await bundle({entryPoint:resolve('src/index.jsx'),publicDir});
  const base={serveUrl,inputProps,logLevel:'warn',...(process.env.BROWSER_EXECUTABLE?{browserExecutable:process.env.BROWSER_EXECUTABLE}:{})};
  const composition=await selectComposition({...base,id:'SoftwareDemo'});
  if(stillFrame!==undefined){if(!Number.isInteger(stillFrame)||stillFrame<0||stillFrame>=composition.durationInFrames)throw Error('Invalid still frame');await renderStill({...base,composition,frame:stillFrame,output:target,imageFormat:'png'});}
  else await renderMedia({...base,composition,codec:'h264',pixelFormat:'yuv420p',colorSpace:'bt709',crf:18,x264Preset:'fast',concurrency:2,outputLocation:target});
  return target;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [config='demo.json',output='out/master.mp4',frame]=process.argv.slice(2);
  console.log(await render(config,output,frame===undefined?undefined:Number(frame)));
}
