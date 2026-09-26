import { WIDTH, HEIGHT, schedule, progressAt, brushPath, prefixPath, strokeState, brushTip, sandThreshold, clamp } from './core.mjs';
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;};
export const HAND_ASSET=Symbol('hand image');
export async function loadAssets(project,handSource='./assets/hand-pen.png') {
 const assets=new Map();
 const hand=new Image();hand.src=handSource;await hand.decode();assets.set(HAND_ASSET,hand);
 await Promise.all(project.items.filter(i=>i.type==='image').map(async item=>{
  const image=new Image(); image.src=item.src;
  await image.decode();
  if(image.naturalWidth*image.naturalHeight>24000000) throw new Error('图片像素超过 2400 万，请先缩小图片');
  assets.set(item.id,image);
 }));
 return assets;
}
function line(ctx,points) {
 if(!points.length)return;
 ctx.beginPath();ctx.moveTo(...points[0]); for(const p of points.slice(1))ctx.lineTo(...p);ctx.stroke();
}
function drawPaths(ctx,item,progress) {
 ctx.save(); ctx.scale(item.width/item.viewWidth,item.height/item.viewHeight);
 ctx.strokeStyle=item.color;ctx.lineWidth=item.brush;ctx.lineCap='round';ctx.lineJoin='round';
 for(const path of strokeState(item.paths,progress).paths)line(ctx,path);
 ctx.restore();
}
function art(ctx,item) {
 ctx.save();ctx.scale(item.width/455,item.height/300);
 ctx.lineWidth=2.6;ctx.lineCap='round';ctx.lineJoin='round';
 if(item.art==='landscape') {
  ctx.fillStyle='#f0e9d8';ctx.fillRect(0,0,455,300);
  ctx.fillStyle='#d58b54';ctx.beginPath();ctx.arc(335,78,35,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#a8b8a5';ctx.beginPath();ctx.moveTo(0,206);ctx.lineTo(115,65);ctx.lineTo(255,244);ctx.lineTo(345,153);ctx.lineTo(455,230);ctx.lineTo(455,300);ctx.lineTo(0,300);ctx.fill();
  ctx.fillStyle='#6e9081';ctx.beginPath();ctx.moveTo(0,263);ctx.bezierCurveTo(102,177,161,199,253,246);ctx.bezierCurveTo(324,277,363,237,455,257);ctx.lineTo(455,300);ctx.lineTo(0,300);ctx.fill();
  ctx.strokeStyle='#314c49';line(ctx,[[4,208],[116,66],[256,244]]);line(ctx,[[91,99],[116,112],[129,95],[147,109]]);
  ctx.beginPath();ctx.moveTo(20,263);ctx.bezierCurveTo(108,189,164,201,240,241);ctx.stroke();
  ctx.strokeStyle='#f7f2df';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(266,265);ctx.bezierCurveTo(230,272,225,284,205,300);ctx.stroke();
  ctx.strokeStyle='#314c49';ctx.lineWidth=2;line(ctx,[[45,57],[58,51],[70,57]]);line(ctx,[[70,43],[81,38],[91,43]]);
  ctx.font='12px ui-monospace, monospace';ctx.fillStyle='#314c49';ctx.fillText('A LITTLE ROOM TO WANDER',22,284);
 } else {
  ctx.fillStyle='#eceadf';ctx.beginPath();ctx.ellipse(222,163,141,112,-.16,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#375e51';ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(209,280);ctx.bezierCurveTo(220,210,199,113,265,37);ctx.stroke();
  const leaves=[[218,227,149,186,-.5],[219,192,293,139,.3],[223,158,161,104,-.5],[237,122,312,78,.3],[248,83,220,28,-.4]];
  for(const [x,y,tx,ty,tilt] of leaves){ctx.fillStyle=tilt<0?'#86a18a':'#537d67';ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(tx-18,ty+30,tx,ty);ctx.quadraticCurveTo(tx+51,ty-10,x,y);ctx.fill();ctx.lineWidth=1.8;line(ctx,[[x,y],[tx,ty]]);}
  ctx.strokeStyle='#b87951';ctx.lineWidth=2;line(ctx,[[171,281],[249,280]]);
 }
 ctx.restore();
}
function drawSource(ctx,item,assets) {
 if(item.type==='path')drawPaths(ctx,item,1);
 else if(item.type==='art')art(ctx,item);
 else if(item.type==='image') {
  const image=assets.get(item.id); if(!image)return;
  const scale=Math.min(item.width/image.naturalWidth,item.height/image.naturalHeight);
  const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  ctx.drawImage(image,(item.width-w)/2,(item.height-h)/2,w,h);
 } else {
  ctx.fillStyle=item.color;ctx.font=`500 ${item.fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;ctx.textBaseline='top';
  let y=3;
  for(const paragraph of item.text.split('\n')) {
   let row='';
   for(const char of paragraph){if(row && ctx.measureText(row+char).width>item.width-4){ctx.fillText(row,2,y);y+=item.fontSize*1.35;row='';}row+=char;}
   ctx.fillText(row,2,y);y+=item.fontSize*1.35;
  }
 }
}
// ponytail: cache only this canvas's current scene; avoids a growing global texture cache.
const caches=new WeakMap();
function prepare(canvas,project,assets) {
 let cache=caches.get(canvas);
 if(cache?.project===project && cache.assets===assets)return cache;
 cache={project,assets,layers:project.items.map(item=>{
  const source=surface(item.width,item.height);drawSource(source.getContext('2d'),item,assets);
  const path=brushPath(item.width,item.height,item.direction,item.brush);
  let thresholds;
  if(item.effect==='sand'){
   thresholds=new Float32Array(source.width*source.height);
   for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)thresholds[y*source.width+x]=sandThreshold(x,y,source.width,source.height,item.direction);
  }
  const mask=surface(item.width,item.height), layer=surface(item.width,item.height);
  return {source,path,mask,layer,thresholds,maskData:item.effect==='sand'?mask.getContext('2d').createImageData(mask.width,mask.height):null};
 })};
 caches.set(canvas,cache);return cache;
}
// Calibrated on the original 720 × 1280 PNG: pen tip (276, 1); extend the forearm past the canvas edge.
function drawPointer(ctx,point,image,angle=0,lift=0) {
 if(!image)return;
 const scale=HEIGHT/image.naturalHeight;
 ctx.save();ctx.translate(point[0],point[1]-lift*7);ctx.rotate(Math.cos(angle)*.04);
 ctx.globalAlpha=1-lift*.15;
 ctx.drawImage(image,-276*scale,-scale,image.naturalWidth*scale,image.naturalHeight*scale);
 ctx.restore();
}
export function renderScene(canvas,project,time,assets=new Map()) {
 const ctx=canvas.getContext('2d');
 ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.fillStyle=project.background;ctx.fillRect(0,0,WIDTH,HEIGHT);
 const cache=prepare(canvas,project,assets), slots=schedule(project.items), pointers=[];
 project.items.forEach((item,index)=>{
  const p=progressAt(time,slots[index]);if(p<=0)return;
  ctx.save();ctx.translate(item.x,item.y);ctx.beginPath();ctx.rect(0,0,item.width,item.height);ctx.clip();
  const entry=cache.layers[index];
  if(p<1 && item.pointer && item.pointer!=='none' && item.effect!=='sand') {
   const state=item.effect==='stroke'?strokeState(item.paths,p):null;
   const tip=state?.tip?{point:[state.tip[0]*item.width/item.viewWidth,state.tip[1]*item.height/item.viewHeight],lift:state.lift,angle:0}:brushTip(entry.path,p);
   if(tip)pointers.push({point:[item.x+tip.point[0],item.y+tip.point[1]],angle:tip.angle,lift:tip.lift});
  }
  if(p>=1){ctx.drawImage(entry.source,0,0);ctx.restore();return;}
  if(item.effect==='stroke'){drawPaths(ctx,item,p);ctx.restore();return;}
  const m=entry.mask.getContext('2d');m.clearRect(0,0,item.width,item.height);
  if(item.effect==='brush') {
   m.strokeStyle='#fff';m.lineWidth=item.brush;m.lineCap='round';m.lineJoin='round';
   const path=prefixPath(entry.path,p);line(m,path);
   m.globalAlpha=.3;m.lineWidth=item.brush+3;line(m,path);m.globalAlpha=1;
  } else {
   const data=entry.maskData.data;
   for(let i=0;i<entry.thresholds.length;i++) {data[i*4]=255;data[i*4+1]=255;data[i*4+2]=255;data[i*4+3]=Math.round(clamp((p-entry.thresholds[i])/.055)*255);}
   m.putImageData(entry.maskData,0,0);
  }
  const l=entry.layer.getContext('2d');l.clearRect(0,0,item.width,item.height);l.globalCompositeOperation='source-over';l.drawImage(entry.source,0,0);l.globalCompositeOperation='destination-in';l.drawImage(entry.mask,0,0);l.globalCompositeOperation='source-over';
  ctx.drawImage(entry.layer,0,0);ctx.restore();
 });
 for(const pen of pointers)drawPointer(ctx,pen.point,assets.get(HAND_ASSET),pen.angle,pen.lift);
}
