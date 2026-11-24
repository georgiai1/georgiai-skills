import {spawnSync} from 'node:child_process';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import {validateConfig} from './config.mjs';
export const ffmpeg=process.env.FFMPEG_PATH || ffmpegStatic;
export const ffprobe=process.env.FFPROBE_PATH || ffprobeStatic.path;
export function run(exe,args,binary=false) {
  const r=spawnSync(exe,args,{windowsHide:true,encoding:binary?undefined:'utf8',maxBuffer:512*1024*1024});
  if(r.error) throw r.error;
  if(r.status!==0) throw Error(`${exe}: ${String(r.stderr).slice(-5000)}`);
  return r.stdout;
}
export const readConfig=file=>validateConfig(JSON.parse(readFileSync(file,'utf8')));
export const probe=file=>JSON.parse(run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',file]));
export function newOutput(file){if(!file)throw Error('Output path required');const p=resolve(file);if(existsSync(p))throw Error(`Refusing to overwrite ${p}`);mkdirSync(dirname(p),{recursive:true});return p;}
