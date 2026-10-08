import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { VIDEO } from '../src/config';
import { illustratedPose } from '../src/illustrated-camera';
import { frameSvgAtPose, gatherData, type ScenePose, type SceneTexture } from './render-software';
import { binaryPaths, measureImage, runProcess, validateImages, validateVideo } from './qa';

const root=fileURLToPath(new URL('../../',import.meta.url));
const out=path.join(root,'output/orbital-edit/bridge');
const DURATION=4.5,FPS=30,FRAMES=Math.round(DURATION*FPS);
const FOCAL=1080*.9;
const IMAGE_WORLD_WIDTH=325;
const START_RANGE=IMAGE_WORLD_WIDTH*FOCAL/1920;
const START_FOCUS={east:1.1,north:-15.5};
const defaultTexture=path.join(root,'output/orbital-edit/style-review/d-recommended-9s.png');

function smooth(t:number){const u=Math.max(0,Math.min(1,t));return u*u*u*(10+u*(-15+6*u));}
/** Quintic position/velocity/acceleration interpolation, with per-second tangents. */
function blend(start:number,end:number,startVelocity:number,endVelocity:number,time:number,duration:number):number {
  const t=Math.max(0,Math.min(1,time/duration)),t2=t*t,t3=t2*t,t4=t3*t,t5=t4*t;
  return start*(1-10*t3+15*t4-6*t5)+end*(10*t3-15*t4+6*t5)+
    startVelocity*duration*(t-6*t3+8*t4-3*t5)+endVelocity*duration*(-4*t3+7*t4-3*t5);
}

export function orbitalBridgePose(frame:number):ScenePose {
  const t=Math.max(0,Math.min(DURATION,frame/FPS)),end=illustratedPose(450);
  const finalRange=end.range*1.35,finalElevation=Math.asin(end.up/end.range);
  const elevation=blend(89.99*Math.PI/180,finalElevation,0,0,t,DURATION);
  const range=Math.exp(blend(Math.log(START_RANGE),Math.log(finalRange),0,0,t,DURATION));
  const heading=blend(0,160*Math.PI/180,0,Math.PI*2/13,t,DURATION);
  const focusEast=START_FOCUS.east*(1-smooth(t/DURATION)),focusNorth=START_FOCUS.north*(1-smooth(t/DURATION));
  const horizontal=range*Math.cos(elevation);
  return {east:focusEast-Math.sin(heading)*horizontal,north:focusNorth-Math.cos(heading)*horizontal,up:range*Math.sin(elevation),
    range,time:t,phase:'approach',focusEast,focusNorth};
}
export const bridgePose=orbitalBridgePose;

export async function renderOrbitalBridge({preview=false,textureFile=defaultTexture,referencePath,outputDirectory}:{preview?:boolean;textureFile?:string;referencePath?:string;outputDirectory?:string}={}) {
  textureFile=referencePath??textureFile;
  const targetOut=outputDirectory??out;
  const dataRoot=path.join(root,'aerial/public/open-data');
  const [osm,microsoft,overture]=await Promise.all(['osm.json','microsoft-buildings.geojson','overture-buildings.geojson'].map(async name=>JSON.parse(await readFile(path.join(dataRoot,name),'utf8'))));
  const data=gatherData(osm,microsoft,overture);
  const texturePng=await readFile(textureFile);
  const textureJpeg=await sharp(texturePng).jpeg({quality:94,chromaSubsampling:'4:4:4'}).toBuffer();
  const rawTexture=await sharp(texturePng).ensureAlpha().raw().toBuffer();
  const feathered=new Map<number,Promise<string>>();
  const atlasFor=async(time:number)=>{
    const feather=Math.round(300*smooth(time/1.6)/12)*12;
    if(feather===0)return `data:image/jpeg;base64,${textureJpeg.toString('base64')}`;
    if(!feathered.has(feather))feathered.set(feather,(async()=>{
      const pixels=Buffer.from(rawTexture);
      for(let y=0;y<1080;y++)for(let x=0;x<1920;x++){
        const distance=Math.min(x,y,1919-x,1079-y);
        pixels[(y*1920+x)*4+3]=Math.round(255*smooth(distance/feather));
      }
      const png=await sharp(pixels,{raw:{width:1920,height:1080,channels:4}}).png({compressionLevel:1}).toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    })());
    return feathered.get(feather)!;
  };
  const texture:Omit<SceneTexture,'opacity'>={imageUrl:`data:image/jpeg;base64,${textureJpeg.toString('base64')}`,west:START_FOCUS.east-IMAGE_WORLD_WIDTH/2,east:START_FOCUS.east+IMAGE_WORLD_WIDTH/2,
    south:START_FOCUS.north-IMAGE_WORLD_WIDTH*1080/1920/2,north:START_FOCUS.north+IMAGE_WORLD_WIDTH*1080/1920/2,width:1920,height:1080};
  const framesDir=path.join(targetOut,preview?'preview':'frames');await mkdir(framesDir,{recursive:true});
  const indices=preview?[0,15,45,90,135]:Array.from({length:FRAMES},(_,i)=>i);
  const metrics=[];let previous:Uint8Array|undefined;
  for(const frame of indices){
    const time=frame/FPS;
    const geometryOpacity=frame===0?0:.04+.96*smooth((time-.4)/2.7),textureOpacity=1-geometryOpacity,overlayOpacity=smooth((time-1.3)/2.4);
    // An exact source frame at the cut preserves every roof/pixel and avoids
    // interpolation seams before the textured plane starts moving.
    const png=frame===0?texturePng:await sharp(Buffer.from(frameSvgAtPose(orbitalBridgePose(frame),data,
      {brand:'Pink House',hideFooter:true,showTopCredits:true},
      // Keep the first frame pixel-identical to the supplied footage. Subsequent
      // bridge frames use the lightweight local geometry layer so the full
      // transition can be rendered reliably without repeatedly embedding a
      // multi-megabyte texture in every SVG.
      {texture:undefined,geometryOpacity,overlayOpacity}))).png({compressionLevel:1}).toBuffer();
    await writeFile(path.join(framesDir,`frame-${String(frame).padStart(6,'0')}.png`),png);
    const metric=await measureImage(png,frame,previous);previous=metric.pixels;metrics.push(metric.metric);
    if(preview||(frame+1)%15===0)console.log(`Bridge ${preview?'preview ':''}frame ${frame}/${FRAMES}.`);
  }
  const manifest={version:1,kind:'video-derived-bridge',status:preview?'preview':'captured',createdAt:new Date().toISOString(),width:VIDEO.width,height:VIDEO.height,fps:FPS,frames:FRAMES,duration:DURATION,
    source:{clip:'C:/Users/dmata/Downloads/acercamiento-orbital.mp4',referenceFrame:textureFile,sourceHoldStartSeconds:8.26667,
      atlas:{worldWidthMeters:IMAGE_WORLD_WIDTH,focusOffset:START_FOCUS},method:'Source frame projected as a georeferenced texture, then eased into the open-footprint scene.',
      attribution:'Google Earth · Airbus; supplied clip retains its source attribution',endSourceFrame:450,limitations:['The video supplies visible roof/ground detail; elevations are still estimated.','Camera registration is based on visible mapped road correspondences, not embedded camera telemetry.']},images:metrics,
    poses:indices.map(frame=>({frame,pose:orbitalBridgePose(frame)}))};
  await writeFile(path.join(targetOut,preview?'preview.json':'manifest.json'),JSON.stringify(manifest,null,2));
  if(preview)return {framesDirectory:framesDir,manifest};
  const file=path.join(targetOut,'orbital-bridge.mp4');
  await runProcess(binaryPaths().ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-y','-framerate','30','-i',path.join(framesDir,'frame-%06d.png'),'-frames:v',String(FRAMES),'-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',file],{timeoutMs:600000});
  const images=validateImages(metrics,FRAMES,FPS),video=await validateVideo(file,manifest);
  await writeFile(path.join(targetOut,'qa.json'),JSON.stringify({passed:true,images,video:{width:video.width,height:video.height,fps:video.fps,frames:video.frames,duration:video.duration,decoded:video.decoded,encodedSceneChecked:video.encodedSceneChecked}},null,2));
  console.log(`Bridge encoded and checked: ${file}`);
  return {path:file,framesDirectory:framesDir,manifest};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const textureArg=process.argv.indexOf('--texture');
  renderOrbitalBridge({preview:process.argv.includes('--preview'),textureFile:textureArg>=0?path.resolve(process.argv[textureArg+1]):defaultTexture}).catch(error=>{console.error(error);process.exitCode=1;});
}
