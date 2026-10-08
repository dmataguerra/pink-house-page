import test from 'node:test';
import assert from 'node:assert/strict';
import { gatherData, overlays } from '../scripts/render-software';
import { TARGET } from '../src/config';
import { illustratedPose } from '../src/illustrated-camera';

const dx = 1 / (111320 * Math.cos(TARGET.latitude * Math.PI / 180));
const dy = 1 / 110540;
const ring = [[-10,-10],[10,-10],[10,10],[-10,10],[-10,-10]].map(([x,y]) => [TARGET.longitude+x*dx,TARGET.latitude+y*dy]);
const geometry = ring.map(([lon,lat])=>({lon,lat}));

test('a repeated open footprint retains one mapped structure and its actual height',()=>{
  const data=gatherData({elements:[{id:1,tags:{building:'house',height:'9.2'},geometry}]},
    {features:[{id:'ms',geometry:{type:'Polygon',coordinates:[ring]}}]},
    {features:[{id:'overture',geometry:{type:'Polygon',coordinates:[ring]}}]});
  assert.equal(data.structures.length,1);
  assert.equal(data.duplicateCount,2);
  assert.equal(data.structures[0].height,9.2);
  assert.equal(data.structures[0].heightEstimated,false);
  assert.equal(data.structures[0].target,true);
});

test('roads retain geographic widths and mapped parks retain surface outlines',()=>{
  const data=gatherData({elements:[
    {id:1,tags:{highway:'primary',lanes:'3'},geometry:geometry.slice(0,2)},
    {id:2,tags:{highway:'footway',width:'1.8'},geometry:geometry.slice(0,2)},
    {id:3,tags:{leisure:'park'},geometry},
  ]},{});
  assert.equal(data.roads[0].width,9.75);
  assert.equal(data.roads[1].width,1.8);
  assert.equal(data.surfaces[0].kind,'green');
  assert.deepEqual(data.surfaces[0].ring,ring.slice(0,-1));
});

test('the local overlay omits the regional title and emphasizes Pink House',()=>{
  for(const frame of [300,500,800]){
    const overlay=overlays(illustratedPose(frame));
    assert.doesNotMatch(overlay,/JURIQUILLA/);
    assert.match(overlay,/font-size="17"[^>]*letter-spacing="2">PINK HOUSE/);
  }
});
