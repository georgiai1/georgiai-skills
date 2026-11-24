import React from 'react';
import {registerRoot, Composition, getInputProps, AbsoluteFill, Sequence, OffthreadVideo, Img, staticFile, useCurrentFrame, interpolate} from 'remotion';
import {totalFrames, validateConfig} from '../scripts/config.mjs';

const smooth=(frame,a,b)=>{if(a===b)return frame>=b?1:0;const t=interpolate(frame,[a,b],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});return t*t*(3-2*t);};
const Keys=({scene,accent})=>{
  const frame=useCurrentFrame(),down=scene.pressFrame!==undefined && frame>=scene.pressFrame && frame<scene.pressFrame+8;
  return <div style={{display:'flex',gap:14}}>{scene.keys?.split('+').map((k,i)=><div key={i} style={{padding:'15px 25px',borderRadius:12,border:'2px solid #c9d0dd',background:down?accent:'white',color:down?'white':'#182033',boxShadow:down?'0 2px #aab1c0':'0 7px #aab1c0',transform:down?'translateY(5px)':'none',fontSize:32,fontWeight:700}}>{k}</div>)}</div>;
};
function Scene({scene:s,config:c}) {
  const frame=useCurrentFrame(),b=c.brand??{},accent=b.accent??'#176bda';
  const fw=1800,fh=770,sw=s.sourceWidth,sh=s.sourceHeight;
  const base=s.kind==='screen'?Math.min(fw/sw,fh/sh):1;
  const f=s.focus,z=f?smooth(frame,s.zoomStartFrame,s.zoomEndFrame):0;
  const target=f?Math.min(fw/f.width,fh/f.height):base;
  const scale=base+(target-base)*z;
  const x=(fw-sw*base)/2*(1-z)+(f?fw/2-(f.x+f.width/2)*target:0)*z;
  const y=(fh-sh*base)/2*(1-z)+(f?fh/2-(f.y+f.height/2)*target:0)*z;
  return <AbsoluteFill style={{color:b.ink??'#182033',background:b.background??'#f4f6fa',fontFamily:b.fontFile?'DemoBrand':(b.fontFamily??'Arial, sans-serif')}}>
    {b.fontFile&&<style>{`@font-face{font-family:DemoBrand;src:url(${JSON.stringify(staticFile(b.fontFile))});}`}</style>}
    <div style={{position:'absolute',left:60,top:25,right:60,height:65,display:'flex',alignItems:'center',gap:25,fontSize:30,fontWeight:700}}>{b.logo&&<Img src={staticFile(b.logo)} style={{width:220,height:60,objectFit:'contain'}}/>}{b.name}<span style={{marginLeft:'auto',fontSize:24,fontWeight:400}}>{s.loadingCut?c.waitingLabel:''}</span></div>
    {s.kind==='screen'?<>
      <div style={{position:'absolute',left:60,top:110,width:fw,height:fh,overflow:'hidden',borderRadius:15,background:'#dce2ea'}}><OffthreadVideo muted src={staticFile(s.file)} style={{position:'absolute',left:x,top:y,width:sw*scale,height:sh*scale}}/></div>
      <div style={{position:'absolute',top:924,left:65,right:65,display:'flex',alignItems:'center',gap:35}}><Keys scene={s} accent={accent}/><div><div style={{fontSize:39,fontWeight:700}}>{s.title}</div><div style={{fontSize:25,marginTop:10}}>{s.caption}</div></div></div>
    </>:<div style={{position:'absolute',left:100,right:100,top:300,opacity:smooth(frame,0,Math.min(18,s.frames-1))}}><div style={{fontSize:82,fontWeight:700,lineHeight:1.2,color:accent}}>{s.title}</div><div style={{fontSize:34,marginTop:40,marginBottom:50}}>{s.caption}</div><Keys scene={s} accent={accent}/></div>}
    {s.synthetic&&<div style={{position:'absolute',top:120,left:75,padding:12,background:'#fff2b8',color:'#463500',fontSize:24,fontWeight:700}}>{c.syntheticLabel}</div>}
  </AbsoluteFill>;
}
function Demo(c) {
  let at=0;
  const scale=Math.min(c.width/1920,c.height/1080);
  return <AbsoluteFill style={{background:c.brand?.background??'#f4f6fa'}}><div style={{position:'absolute',width:1920,height:1080,left:(c.width-1920*scale)/2,top:(c.height-1080*scale)/2,transform:`scale(${scale})`,transformOrigin:'top left'}}>{c.scenes.map(s=>{const from=at;at+=s.frames;return <Sequence key={s.id} from={from} durationInFrames={s.frames}><Scene scene={s} config={c}/></Sequence>;})}</div></AbsoluteFill>;
}
function Root(){const c=validateConfig(getInputProps());return <Composition id="SoftwareDemo" component={Demo} defaultProps={c} width={c.width} height={c.height} fps={c.fps} durationInFrames={totalFrames(c)}/>;}
registerRoot(Root);
