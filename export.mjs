import { validateProject, sceneDuration } from './core.mjs';

export async function createHTML(project) {
  const sources=await Promise.all(['core.mjs','renderer.mjs'].map(async name=>{
    const response=await fetch(new URL(name,import.meta.url));
    if(!response.ok)throw new Error(`无法读取 ${name}，请确认本地服务仍在运行`);
    return response.text();
  }));
  const [hand,license]=await Promise.all(['assets/hand-pen.png','assets/LICENSE-hand.txt'].map(async name=>{
    const response=await fetch(new URL(name,import.meta.url));
    if(!response.ok)throw new Error(`无法读取 ${name}`);
    if(name.endsWith('.txt'))return response.text();
    const blob=await response.blob();
    return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('手持笔图片打包失败'));r.readAsDataURL(blob);});
  }));
  return buildHTML(project,sources,{hand,license});
}
export function buildHTML(value,sources,{hand,license}) {
  if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(hand))throw new Error('手持笔图片缺失');
  const project=validateProject(value),duration=sceneDuration(project.items);
  if(!duration)throw new Error('请先添加图片、文字或笔画');
  const json=JSON.stringify(project).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const runtime=sources.map(s=>s.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')).join('\n');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>描画 · 单画面动画</title>
<link rel="icon" href="data:,">
<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${project.background}}#drawing-board{width:100%;height:100%}canvas{display:block;width:100%;height:100%;object-fit:contain}#controls{position:fixed;z-index:2;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:12px;align-items:center;padding:12px 16px;border:1px solid #ddd;border-radius:10px;background:#fffefaeF;font:12px system-ui;box-shadow:0 3px 16px #0001;max-width:95vw}button{cursor:pointer;border:0;border-radius:5px;padding:8px 12px;color:#fff;background:#283a36;font:inherit;white-space:nowrap}input{width:min(36vw,300px);accent-color:#b96141}output{white-space:nowrap}button:focus-visible,input:focus-visible{outline:2px solid #b96141;outline-offset:3px}[data-capture] #controls{display:none}#error{position:fixed;inset:20px;color:#a33;pointer-events:none;font:14px system-ui}</style></head><body>
<div id="drawing-board" data-composition-id="drawing-board" data-no-timeline data-start="0" data-duration="${duration}" data-width="1280" data-height="720"><canvas id="drawing-canvas" class="clip" data-start="0" data-duration="${duration}" data-track-index="0" width="1280" height="720" aria-label="绘制动画"></canvas></div>
<div id="controls"><button id="play">播放</button><button id="reset">重播</button><input id="time" type="range" min="0" max="${duration}" step="0.01" value="${duration}" aria-label="动画进度"><output id="clock"></output></div><div id="error" role="alert"></div>
<pre hidden id="asset-license">${license.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre>
<script id="scene-data" type="application/json">${json}</script>
<script>
(()=>{
${runtime}
const project=JSON.parse(document.getElementById('scene-data').textContent);
const canvas=document.getElementById('drawing-canvas'),slider=document.getElementById('time'),button=document.getElementById('play'),clock=document.getElementById('clock');
const duration=sceneDuration(project.items);
let assets=new Map(),loaded=false,time=duration,playing=false,previewTimer=0,previewClock=null;
function stop(){playing=false;clearInterval(previewTimer);previewClock?.pause();button.textContent='播放';}
function paint(value){time=clamp(value,0,duration);if(loaded)renderScene(canvas,project,time,assets);slider.value=time;clock.textContent=time.toFixed(1)+' / '+duration.toFixed(1)+' s';}
function renderAt(value){if(!Number.isFinite(value))throw new TypeError('时间必须是有限数字');stop();document.documentElement.setAttribute('data-capture','');paint(value);return time;}
const ready=(async()=>{await document.fonts.ready;assets=await loadAssets(project,${JSON.stringify(hand)});loaded=true;paint(time);})();
window.__hf=window.__hf||{};window.__hf.buildReady=window.__hf.buildReady||{};window.__hf.buildReady['drawing-board']=ready;
window.drawingBoard={ready,canvas,duration,renderAt,getProject:()=>structuredClone(project)};
window.addEventListener('hf-seek',event=>{renderAt(event.detail.time);if(!loaded)event.detail.waitUntil?.(ready);});
// The native clock is only created by a viewer's Play click. Capture exclusively uses hf-seek.
button.onclick=async()=>{await ready;if(playing){stop();return;}if(time>=duration)paint(0);previewClock??=new Animation(new KeyframeEffect(canvas,[],{duration:duration*1000,fill:'both'}));previewClock.currentTime=time*1000;previewClock.play();playing=true;button.textContent='暂停';previewTimer=setInterval(()=>{paint(Number(previewClock.currentTime)/1000);if(time>=duration)stop();},16);};
document.getElementById('reset').onclick=async()=>{await ready;stop();paint(0);button.click();};
slider.oninput=()=>{stop();paint(Number(slider.value));};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
ready.catch(error=>{document.getElementById('error').textContent='画面载入失败：'+error.message;button.disabled=true;});
})();
</script></body></html>`;
}
