import { WIDTH, HEIGHT, DIRECTIONS, EFFECTS, clamp, schedule, sceneDuration, demoProject, validateProject, newItem } from './core.mjs';
import { renderScene, loadAssets, HAND_ASSET } from './renderer.mjs';
import { createHTML } from './export.mjs';
const $=id=>document.getElementById(id), canvas=$('scene');
let project=demoProject(), assets=new Map(), selectedId='title', time=0, playing=false, lastFrame=0, raf=0, dirty=false, busy=false, drawMode=false, gesture=null;
const slots=()=>schedule(project.items);
const total=()=>sceneDuration(project.items);
const selected=()=>project.items.find(i=>i.id===selectedId);
const numeric=['fontSize','brush','duration','delay','hold','x','y','width','height'];
const fields=['name','text','fontSize','effect','direction','pointer','brush','color','join','duration','delay','hold','x','y','width','height'];
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function setBusy(value){busy=value;document.querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=value);if(!value)syncUI();}
function stop(){playing=false;cancelAnimationFrame(raf);$('play').innerHTML='▶ <span>播放预览</span>';$('play').setAttribute('aria-label','播放预览');}
function render(){
 renderScene(canvas,project,time,assets);
 $('scrubber').max=String(total());$('scrubber').value=String(time);
 $('clock').textContent=`${time.toFixed(1)} / ${total().toFixed(1)} s`;
 const active=slots().some(slot=>time>=slot.start&&time<slot.end);
 $('play-state').textContent=playing?(active?'正在绘制':'停顿中 · 等待下一笔'):time===0?'准备落笔':time>=total()?'画面已完成':'已暂停 · 可继续绘制';
 const item=selected();$('selection').hidden=!item||playing||drawMode;
 if(item){Object.assign($('selection').style,{left:`${item.x/WIDTH*100}%`,top:`${item.y/HEIGHT*100}%`,width:`${item.width/WIDTH*100}%`,height:`${item.height/HEIGHT*100}%`});$('selection-name').textContent=item.name;}
}
function syncUI(){
 const timings=slots(),duration=total(),item=selected();
 $('layers').replaceChildren();$('timeline-blocks').replaceChildren();
 project.items.forEach((i,index)=>{
  const li=document.createElement('li');li.className='layer-item';
  const button=document.createElement('button');button.type='button';button.classList.toggle('selected',i.id===selectedId);button.setAttribute('aria-pressed',String(i.id===selectedId));button.setAttribute('aria-label',`选择 ${i.name}`);
  const number=document.createElement('span');number.className='layer-number';number.textContent=String(index+1).padStart(2,'0');
  const copy=document.createElement('span');copy.className='layer-copy';const name=document.createElement('span');name.className='layer-name';name.textContent=i.name;
  const meta=document.createElement('span');meta.className='layer-meta';meta.textContent=`${EFFECTS[i.effect]} · ${timings[index].start.toFixed(1)}–${timings[index].end.toFixed(1)} s${i.hold?' · 停 '+i.hold+'s':''}`;
  copy.append(name,meta);button.append(number,copy);li.append(button);$('layers').append(li);
  button.onclick=()=>{stop();selectedId=i.id;syncUI();render();};
  const block=document.createElement('span');block.className='time-block';block.classList.toggle('active',i.id===selectedId);block.style.left=`${timings[index].start/duration*100}%`;block.style.width=`${i.duration/duration*100}%`;$('timeline-blocks').append(block);
  if(i.hold){const hold=document.createElement('span');hold.className='hold-block';hold.style.left=`${timings[index].end/duration*100}%`;hold.style.width=`${i.hold/duration*100}%`;hold.title=`停顿 ${i.hold} 秒`;$('timeline-blocks').append(hold);}
 });
 $('item-count').textContent=project.items.length;
 $('end-time').textContent=`${duration.toFixed(1)} s`;
 $('properties').hidden=!item;$('empty-selection').hidden=!!item;
 $('move-up').disabled=!item||project.items.indexOf(item)===0;
 $('move-down').disabled=!item||project.items.indexOf(item)===project.items.length-1;
 $('delete-item').disabled=!item;
 $('play').disabled=!project.items.length;$('export-html').disabled=!project.items.length;
 if(!item)return;
 fields.forEach(key=>$(key).value=item[key]??(key==='hold'?0:key==='pointer'?'none':''));
 $('text-fields').hidden=item.type!=='text';
 $('effect').querySelector('[value="stroke"]').disabled=item.type!=='path';
 $('direction').disabled=item.effect==='stroke';
 $('brush').disabled=item.effect==='sand';$('pointer').disabled=item.effect==='sand';
 $('color').disabled=['image','art'].includes(item.type);
 $('effect-note').textContent=item.effect==='stroke'?'沿已有笔画绘制，抬笔时不连接。':item.effect==='sand'?'沙粒没有单一笔触轨迹，因此不显示笔尖。':item.type==='text'?'文字沿笔刷显现；不是汉字笔顺书写。':'笔刷来回涂抹，逐步露出完整内容。';
}
function commit(next,{keepTime=true}={}) {
 const wasEnd=time>=total();
 project=validateProject(next);dirty=true;
 time=(!keepTime||wasEnd)?total():Math.min(time,total());
 if(!project.items.some(i=>i.id===selectedId))selectedId=project.items[0]?.id??null;
 syncUI();render();
}
function tick(now){
 if(!playing)return;
 time=Math.min(total(),time+(now-lastFrame)/1000*Number($('speed').value));lastFrame=now;
 if(time>=total())stop();render();if(playing)raf=requestAnimationFrame(tick);
}
function play(){
 if(busy||!project.items.length)return;
 if(playing){stop();render();return;}
 setDrawMode(false);
 if(time>=total())time=0;
 playing=true;lastFrame=performance.now();$('play').innerHTML='Ⅱ <span>暂停绘制</span>';$('play').setAttribute('aria-label','暂停绘制');
 render();raf=requestAnimationFrame(tick);
}
function setDrawMode(value){drawMode=value;$('ink').hidden=!value;$('draw-ink').setAttribute('aria-pressed',String(value));render();}
for(const [value,label] of Object.entries(DIRECTIONS)){const option=document.createElement('option');option.value=value;option.textContent=label;$('direction').append(option);}
$('play').onclick=play;
$('restart').onclick=()=>{stop();time=0;render();};
$('fit-view').onclick=()=>{stop();time=total();render();};
$('scrubber').oninput=()=>{stop();time=Number($('scrubber').value);render();};
$('properties').onsubmit=e=>e.preventDefault();
for(const field of fields)$(field).addEventListener('change',()=>{
 if(busy||!selected())return;stop();
 const next=structuredClone(project),item=next.items.find(i=>i.id===selectedId);
 item[field]=numeric.includes(field)?Number($(field).value):$(field).value;
 if(field==='name'&&!item.name.trim())item.name='未命名元素';
 if(field==='width')item.width=clamp(item.width,8,WIDTH-item.x);
 if(field==='height')item.height=clamp(item.height,8,HEIGHT-item.y);
 if(field==='x')item.x=clamp(item.x,0,WIDTH-item.width);
 if(field==='y')item.y=clamp(item.y,0,HEIGHT-item.height);
 try{commit(next);status('绘制设置已更新。点击播放查看效果。');}catch(error){status(error.message,true);syncUI();}
});
function move(delta){
 stop();const next=structuredClone(project),index=next.items.findIndex(i=>i.id===selectedId),other=index+delta;
 if(index<0||other<0||other>=next.items.length)return;
 [next.items[index],next.items[other]]=[next.items[other],next.items[index]];commit(next);status('绘制顺序已更新。');
}
$('move-up').onclick=()=>move(-1);$('move-down').onclick=()=>move(1);
$('delete-item').onclick=()=>{stop();commit({...project,items:project.items.filter(i=>i.id!==selectedId)});status('元素已移除。');};
$('add-text').onclick=()=>{
 if(project.items.length>=40){status('最多支持 40 个元素。',true);return;}
 stop();const item=newItem('text');selectedId=item.id;commit({...project,items:[...project.items,item]},{keepTime:false});$('text').focus();$('text').select();status('输入文字，再设置它的绘制方式。');
};
$('draw-ink').onclick=()=>{stop();time=total();setDrawMode(!drawMode);status(drawMode?'直接在画面上画一笔，松开后会保存为可播放的笔画。':'已退出画笔。');};
$('add-image').onclick=()=>$('image-file').click();
const readData=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('无法读取文件'));r.readAsDataURL(file);});
$('image-file').onchange=async()=>{
 const files=[...$('image-file').files];$('image-file').value='';if(!files.length)return;
 stop();setBusy(true);status('正在读取图片…');
 try{
  if(project.items.length+files.length>40)throw new Error('最多支持 40 个元素');
  const additions=[],addedAssets=new Map(assets);
  for(const file of files){
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('请使用不超过 8 MB 的 PNG、JPG 或 WebP');
   const src=await readData(file),item={...newItem('image'),src,name:file.name.slice(0,120)};
   const decoded=await loadAssets({items:[item]}),image=decoded.get(item.id);
   const ratio=image.naturalWidth/image.naturalHeight;
   item.width=Math.round(Math.min(540,340*ratio));item.height=Math.round(item.width/ratio);
   if(item.width<8||item.height<8)throw new Error('图片长宽比例过于极端，请先裁切');
   item.x=Math.round((WIDTH-item.width)/2);item.y=Math.round((HEIGHT-item.height)/2);
   additions.push(item);addedAssets.set(item.id,image);
  }
  const next=validateProject({...project,items:[...project.items,...additions]});
  assets=addedAssets;selectedId=additions.at(-1).id;commit(next,{keepTime:false});setDrawMode(false);status(`已导入 ${additions.length} 张图片。可拖动位置，并修改顺序与方向。`);
 }catch(error){status(`导入失败：${error.message}`,true);}finally{setBusy(false);}
};
$('new-project').onclick=()=>{
 if(dirty&&!confirm('新建画面会替换当前编辑。尚未保存的修改将丢失，继续吗？'))return;
 stop();assets=new Map([[HAND_ASSET,assets.get(HAND_ASSET)]]);selectedId=null;commit({version:1,background:'#fffdf8',items:[]},{keepTime:false});dirty=false;setDrawMode(false);status('空白画面已就绪。导入图片、添加文字，或直接画一笔。');
};
function download(content,type,name){
 const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('save-project').onclick=()=>{
 download(JSON.stringify(project,null,2),'application/json','drawing-board.json');dirty=false;status('已保存 JSON 项目，可继续编辑。播放与渲染请使用“导出 HTML”。');
};
$('export-html').onclick=async()=>{
 stop();setBusy(true);status('正在打包 HTML，图片与绘制代码会一并嵌入…');
 try{const html=await createHTML(project);download(html,'text/html','drawing-board.html');status('已导出独立 HTML，可直接打开播放，也可作为 HyperFrames 的渲染入口。');}
 catch(error){status(`导出失败：${error.message}`,true);}finally{setBusy(false);}
};
$('open-project').onclick=()=>{if(!dirty||confirm('打开项目会替换当前画面。尚未保存的修改将丢失，继续吗？'))$('project-file').click();};
$('project-file').onchange=async()=>{
 const file=$('project-file').files[0];$('project-file').value='';if(!file)return;
 stop();setBusy(true);status('正在打开项目…');
 try{
  if(file.size>32*1024*1024)throw new Error('项目文件不能超过 32 MB');
  const next=validateProject(JSON.parse(await file.text())),nextAssets=await loadAssets(next);
  assets=nextAssets;selectedId=next.items[0]?.id??null;commit(next,{keepTime:false});dirty=false;setDrawMode(false);status('项目已打开。');
 }catch(error){status(`打开失败，原画面已保留：${error.message}`,true);}finally{setBusy(false);}
};
function point(event){const r=canvas.getBoundingClientRect();return [clamp((event.clientX-r.left)/r.width*WIDTH,0,WIDTH),clamp((event.clientY-r.top)/r.height*HEIGHT,0,HEIGHT)];}
canvas.onpointerdown=e=>{
 if(busy||e.button!==0)return;stop();time=total();
 const p=point(e),item=[...project.items].reverse().find(i=>p[0]>=i.x&&p[0]<=i.x+i.width&&p[1]>=i.y&&p[1]<=i.y+i.height);
 selectedId=item?.id??null;syncUI();render();
 if(item){gesture={id:item.id,start:p,x:item.x,y:item.y,original:project};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';}
};
canvas.onpointermove=e=>{
 if(!gesture||busy)return;
 const [x,y]=point(e),next=structuredClone(gesture.original),item=next.items.find(i=>i.id===gesture.id);
 item.x=Math.round(clamp(gesture.x+x-gesture.start[0],0,WIDTH-item.width));item.y=Math.round(clamp(gesture.y+y-gesture.start[1],0,HEIGHT-item.height));
 project=next;render();
};
canvas.onpointerup=()=>{if(!gesture)return;const changed=JSON.stringify(project)!==JSON.stringify(gesture.original);gesture=null;canvas.style.cursor='default';if(changed)commit(project);else syncUI();};
canvas.onpointercancel=()=>{if(gesture){project=gesture.original;gesture=null;canvas.style.cursor='default';syncUI();render();}};
let inkPoints=[];
function paintInk(){const c=$('ink').getContext('2d');c.clearRect(0,0,WIDTH,HEIGHT);if(!inkPoints.length)return;c.strokeStyle='#253e42';c.lineWidth=4;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(...inkPoints[0]);for(const p of inkPoints.slice(1))c.lineTo(...p);c.stroke();}
$('ink').onpointerdown=e=>{if(busy||e.button!==0)return;inkPoints=[point(e)];$('ink').setPointerCapture(e.pointerId);paintInk();};
$('ink').onpointermove=e=>{if(!inkPoints.length)return;const p=point(e),last=inkPoints.at(-1);if(Math.hypot(p[0]-last[0],p[1]-last[1])>2&&inkPoints.length<5000){inkPoints.push(p);paintInk();}};
$('ink').onpointerup=()=>{
 if(inkPoints.length>1&&project.items.length<40){
  const xs=inkPoints.map(p=>p[0]),ys=inkPoints.map(p=>p[1]),x=clamp(Math.min(...xs)-5,0,WIDTH-8),y=clamp(Math.min(...ys)-5,0,HEIGHT-8),width=Math.min(WIDTH-x,Math.max(8,Math.max(...xs)-x+5)),height=Math.min(HEIGHT-y,Math.max(8,Math.max(...ys)-y+5));
  const item={...newItem('path'),name:'自由笔画',x,y,width,height,effect:'stroke',brush:4,viewWidth:width,viewHeight:height,paths:[inkPoints.map(p=>[p[0]-x,p[1]-y])],duration:1};
  selectedId=item.id;commit({...project,items:[...project.items,item]},{keepTime:false});status('已记录一笔，可在列表中调整顺序和时长。');
 }else if(project.items.length>=40)status('最多支持 40 个元素。',true);
 inkPoints=[];paintInk();
};
$('ink').onpointercancel=()=>{inkPoints=[];paintInk();};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){stop();render();}});
const ready=(async()=>{
 await document.fonts.ready;assets=await loadAssets(project);time=total();syncUI();render();
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)status('已显示完整画面。点击播放后才开始绘制，也可拖动进度查看。');
})();
window.drawingBoard={ready,canvas,getProject:()=>structuredClone(project),get duration(){return total();},renderAt(seconds){if(!Number.isFinite(seconds))throw new TypeError('时间必须是有限数字');stop();time=clamp(seconds,0,total());render();return time;}};
ready.catch(error=>status(`初始化失败：${error.message}`,true));
