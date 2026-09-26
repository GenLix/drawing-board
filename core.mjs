export const WIDTH = 1280, HEIGHT = 720;
export const DIRECTIONS = { 'tl-br': '↘ 左上 → 右下', 'bl-tr': '↗ 左下 → 右上', down: '↓ 从上往下', up: '↑ 从下往上', right: '→ 从左往右', left: '← 从右往左' };
export const EFFECTS = { brush: '涂刷显现', sand: '沙粒显现', stroke: '逐笔描线' };
export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export function schedule(items) {
  let previous = { start: 0, end: 0, holdEnd: 0 };
  return items.map(item => {
    const start = (item.join === 'with' ? previous.start : previous.holdEnd) + item.delay;
    previous = { start, end: start + item.duration, holdEnd: start + item.duration + (item.hold ?? 0) };
    return previous;
  });
}
export const sceneDuration = items => Math.max(0,...schedule(items).map(slot=>slot.holdEnd));
export const progressAt = (time, slot) => clamp((time - slot.start) / (slot.end - slot.start));
const vectors = { 'tl-br': [Math.SQRT1_2, Math.SQRT1_2], 'bl-tr': [Math.SQRT1_2, -Math.SQRT1_2], down: [0,1], up: [0,-1], right: [1,0], left: [-1,0] };
export function brushPath(w, h, direction, size) {
  const [nx,ny] = vectors[direction];
  const pad = size * .3, corners = [[-pad,-pad],[w+pad,-pad],[w+pad,h+pad],[-pad,h+pad]];
  const projected = corners.map(([x,y]) => x*nx+y*ny);
  const min = Math.min(...projected), max = Math.max(...projected);
  const steps = Math.ceil((max-min)/(size*.7));
  const points = [];
  for (let i=0; i<=steps; i++) {
    const level = min+(max-min)*(i+.05)/(steps+.1), hits = [];
    for (let j=0;j<4;j++) {
      const a=corners[j], b=corners[(j+1)%4], da=a[0]*nx+a[1]*ny, db=b[0]*nx+b[1]*ny;
      if (Math.abs(db-da)<1e-9) continue;
      const f=(level-da)/(db-da);
      if(f>=0 && f<=1) hits.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);
    }
    hits.sort((a,b)=>(-ny*a[0]+nx*a[1])-(-ny*b[0]+nx*b[1]));
    // Start each direction at the appropriate edge; alternate to form real brush passes.
    if ((i%2===0) === (ny<0 || (ny===0 && nx>0))) hits.reverse();
    if(hits.length>=2) points.push(hits[0],hits.at(-1));
  }
  return points;
}
export function pathLength(points) {
  let n=0; for(let i=1;i<points.length;i++) n+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
  return n;
}
export function prefixPath(points, progress) {
  if(progress<=0 || !points.length) return [];
  if(progress>=1) return points;
  let remaining=pathLength(points)*progress;
  const result=[points[0]];
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(remaining>=len) { result.push(b); remaining-=len; }
    else { const f=len ? remaining/len : 0; result.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]); break; }
  }
  return result;
}
// Drawing and the visible pen share this state, including lifts between separate strokes.
export function strokeState(paths,progress) {
  if(!paths.length || progress<=0)return {paths:[],tip:null,drawing:false,lift:0};
  const lengths=paths.map(pathLength);
  const gaps=paths.map((path,i)=>i<paths.length-1?Math.min(30,Math.hypot(paths[i+1][0][0]-path.at(-1)[0],paths[i+1][0][1]-path.at(-1)[1])*.25):0);
  let remaining=clamp(progress)*(lengths.reduce((a,b)=>a+b,0)+gaps.reduce((a,b)=>a+b,0));
  const visible=[];
  for(let i=0;i<paths.length;i++) {
    if(remaining<lengths[i]) {const partial=prefixPath(paths[i],remaining/lengths[i]);visible.push(partial);return {paths:visible,tip:partial.at(-1),drawing:true,lift:0};}
    visible.push(paths[i]);remaining-=lengths[i];
    if(remaining<gaps[i]) {const f=remaining/gaps[i],a=paths[i].at(-1),b=paths[i+1][0];return {paths:visible,tip:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],drawing:false,lift:Math.sin(Math.PI*f)};}
    remaining-=gaps[i];
  }
  return {paths:visible,tip:paths.at(-1).at(-1),drawing:false,lift:0};
}
export function brushTip(path,progress) {
  const partial=prefixPath(path,progress),point=partial.at(-1);
  if(!point)return null;
  const before=partial.at(-2)??point;
  return {point,angle:Math.atan2(point[1]-before[1],point[0]-before[0]),lift:0};
}
export function sandThreshold(x,y,w,h,direction) {
  const [nx,ny]=vectors[direction];
  const min=Math.min(0,nx*w)+Math.min(0,ny*h), max=Math.max(0,nx*w)+Math.max(0,ny*h);
  let seed=Math.imul((x>>1)+1,374761393)^Math.imul((y>>1)+1,668265263);
  seed=Math.imul(seed^(seed>>>13),1274126177);
  const noise=((seed^(seed>>>16))>>>0)/4294967296;
  return clamp(.04+.78*((nx*x+ny*y-min)/(max-min))+.16*noise);
}
const titleStrokes = [
 [[93,18],[42,31]],[[26,56],[108,53]],[[16,86],[117,81]],[[70,27],[70,120],[65,136],[51,129]],
 [[157,24],[133,64],[157,60]],[[168,48],[137,95],[169,87]],[[133,121],[174,105]],
 [[213,23],[195,50],[177,65]],[[213,23],[234,47],[253,57]],[[192,69],[236,67]],
 [[181,89],[251,87]],[[211,89],[191,121],[237,116]],[[228,104],[245,126]]
];
const base = { x:0,y:0,width:300,height:100,duration:1,delay:.12,hold:0,pointer:'hand',join:'after',effect:'brush',direction:'right',brush:32,color:'#253e42' };
export function demoProject() {
 return { version:1,background:'#fffdf8',items:[
  {...base,id:'title',name:'手绘 · 笔画标题',type:'path',x:90,y:70,width:280,height:145,duration:1.4,delay:0,effect:'stroke',brush:5,paths:titleStrokes,viewWidth:270,viewHeight:150},
  {...base,id:'subtitle',pointer:'none',name:'让想法，一笔一笔成形。',type:'text',text:'让想法，\n一笔一笔成形。',x:420,y:91,width:650,height:125,fontSize:43,duration:1,join:'with',delay:.4},
  {...base,id:'landscape',hold:.8,name:'左侧 · 山间风景',type:'art',art:'landscape',x:90,y:282,width:455,height:300,duration:2,effect:'brush',direction:'tl-br',brush:42},
  {...base,id:'arrow',name:'连接 · 一条手绘箭头',type:'path',x:568,y:388,width:175,height:75,duration:.6,brush:3.5,effect:'stroke',paths:[[[4,55],[23,34],[48,22],[82,17],[116,21],[158,33]],[[142,14],[161,33],[139,44]]],viewWidth:170,viewHeight:70,color:'#b96443'},
  {...base,id:'plant',name:'右侧 · 生长的枝叶',type:'art',art:'plant',x:800,y:285,width:270,height:275,duration:1.6,effect:'sand',direction:'bl-tr',brush:28},
  {...base,id:'caption',hold:1,name:'把细节，留给每一次生长。',type:'text',text:'把细节，留给每一次生长。',x:750,y:594,width:430,height:55,fontSize:23,color:'#65736e',duration:.8,direction:'right'}
 ]};
}
export function validateProject(value) {
 const fail=message=>{throw new Error(message);};
 if(!value || value.version!==1 || !/^#[0-9a-f]{6}$/i.test(value.background)) fail('项目格式或背景色无效');
 if(new TextEncoder().encode(JSON.stringify(value)).length>32*1024*1024) fail('项目超过 32 MB，请减少图片或缩小素材');
 if(!Array.isArray(value.items) || value.items.length>40) fail('项目最多支持 40 个元素');
 const ids=new Set();
 for(const item of value.items) {
  if(!item || typeof item.id!=='string' || item.id.length>100 || ids.has(item.id)) fail('元素编号重复或无效'); ids.add(item.id);
  if(typeof item.name!=='string' || item.name.length>120) fail('元素名称过长或无效');
  for(const [key,min,max] of [['x',0,WIDTH],['y',0,HEIGHT],['width',8,WIDTH],['height',8,HEIGHT],['duration',.1,30],['delay',0,30],['brush',1,150]]) {
   if(!Number.isFinite(item[key]) || item[key]<min || item[key]>max) fail(`元素 ${item.name} 的 ${key} 超出范围`);
  }
  if(item.hold!==undefined && (!Number.isFinite(item.hold) || item.hold<0 || item.hold>600)) fail('画后停顿应在 0 到 600 秒之间');
  if(item.pointer!==undefined && !['none','hand'].includes(item.pointer)) fail('绘制工具无效');
  if(item.x+item.width>WIDTH+.01 || item.y+item.height>HEIGHT+.01) fail('元素超出画面边界');
  if(!Object.hasOwn(EFFECTS,item.effect) || !Object.hasOwn(DIRECTIONS,item.direction) || !['after','with'].includes(item.join)) fail('绘制效果、方向或时序无效');
  if(!/^#[0-9a-f]{6}$/i.test(item.color)) fail('颜色格式无效');
  if(item.type==='text') {
   if(typeof item.text!=='string' || item.text.length>1000 || !Number.isFinite(item.fontSize) || item.fontSize<10 || item.fontSize>200) fail('文字内容或字号无效');
  } else if(item.type==='image') {
   if(typeof item.src!=='string' || item.src.length>12*1024*1024 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(item.src)) fail('图片必须是嵌入的 PNG、JPEG 或 WebP');
  } else if(item.type==='art') {
   if(!['landscape','plant'].includes(item.art)) fail('未知示例素材');
  } else if(item.type==='path') {
   if(!Number.isFinite(item.viewWidth) || !Number.isFinite(item.viewHeight) || item.viewWidth<=0 || item.viewHeight<=0 || item.viewWidth>1280 || item.viewHeight>720) fail('笔画尺寸无效');
   if(!Array.isArray(item.paths) || item.paths.length>100 || !item.paths.length) fail('笔画数量无效');
   let count=0;
   for(const points of item.paths) {
    if(!Array.isArray(points) || points.length<2) fail('笔画至少需要两个点');
    count+=points.length;
    for(const p of points) if(!Array.isArray(p) || p.length!==2 || !p.every(Number.isFinite) || p[0]<0 || p[0]>item.viewWidth || p[1]<0 || p[1]>item.viewHeight) fail('笔画坐标无效');
   }
   if(count>20000) fail('笔画过于复杂');
  } else fail('未知元素类型');
  if(item.effect==='stroke' && item.type!=='path') fail('逐笔描线需要笔画路径');
 }
 return structuredClone(value);
}
export function newItem(type) {
 return {...base,id:crypto.randomUUID(),name:type==='text'?'新的文字':'新的图片',type,x:380,y:270,width:500,height:180,duration:1.5,...(type==='text'?{text:'写下你的想法',fontSize:48}:{})};
}
