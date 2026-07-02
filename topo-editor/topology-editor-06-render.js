function loop(ts){animT=ts*.001;drawAll();requestAnimationFrame(loop);}
function hexRgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function rgba(h,a){const[r,g,b]=hexRgb(h);return`rgba(${r},${g},${b},${a})`;}

// 汇合/分支「电气节点」：在多条连线交汇于同一点、或某连线端点接入另一条连线处，画一个实心点，
// 让"两线并为一处""线路在此分支/接入"一目了然（拖动对齐到同一通道、自动汇合后即出现该节点点）。
function drawJunctionDots(){
  const paths=[]; edges.forEach(e=>{ if(_dyn.hiddenEdges.has(e))return; const p=TR.cachedPath(e)||e._drawPts; if(p&&p.length>=2) paths.push({e,p,col:(ET[e.et]||ET.ac_power).color}); });
  if(paths.length<2)return;
  const EPS=4/zoom, dots=[];
  const add=(x,y,col)=>{ for(const d of dots){ if(Math.abs(d.x-x)<EPS&&Math.abs(d.y-y)<EPS)return; } dots.push({x,y,col}); };
  const onSeg=(p,a,b)=>{ const minx=Math.min(a[0],b[0])-EPS,maxx=Math.max(a[0],b[0])+EPS,miny=Math.min(a[1],b[1])-EPS,maxy=Math.max(a[1],b[1])+EPS;
    if(p[0]<minx||p[0]>maxx||p[1]<miny||p[1]>maxy)return false;
    const dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy||1; let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2; t=Math.max(0,Math.min(1,t));
    return Math.hypot(p[0]-(a[0]+t*dx), p[1]-(a[1]+t*dy))<EPS; };
  // 1) 不同连线共享的顶点 → 汇合/分支节点
  for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++){
    for(const a of paths[i].p)for(const b of paths[j].p){ if(Math.abs(a[0]-b[0])<EPS&&Math.abs(a[1]-b[1])<EPS) add(a[0],a[1],paths[i].col); }
  }
  // 2) T 形接入：一条线的端点落在另一条线的中间段上 → 接入节点
  paths.forEach(({e,p})=>{ [p[0],p[p.length-1]].forEach(ep=>{ for(const o of paths){ if(o.e===e)continue;
    let hit=false; for(let k=0;k<o.p.length-1;k++){ if(onSeg(ep,o.p[k],o.p[k+1])){hit=true;break;} }
    if(hit){ add(ep[0],ep[1],o.col); break; } } }); });
  if(!dots.length)return;
  ctx.save();ctx.shadowBlur=0;
  dots.forEach(d=>{ ctx.beginPath();ctx.arc(d.x,d.y,4.5/zoom,0,Math.PI*2);
    ctx.fillStyle=d.col;ctx.fill();ctx.lineWidth=1.6/zoom;ctx.strokeStyle=bgColor;ctx.stroke(); });
  ctx.restore();
}
function drawAll(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=bgColor;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();ctx.translate(panX,panY);ctx.scale(zoom,zoom);
  if(showGrid){
    // 网格线采用固定屏幕像素间距，不随缩放放大——放大画布只放大内容(节点/连线)，
    // 网格保持恒定密度，从而能看到更多细节。网格随平移滚动，但不随 zoom 缩放。
    const step=40; // 固定屏幕像素间距
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0); // 临时回到屏幕坐标系（canvas 与 CSS 像素 1:1）
    ctx.strokeStyle=gridColor();ctx.lineWidth=1;
    const ox=((panX%step)+step)%step, oy=((panY%step)+step)%step;
    ctx.beginPath();
    for(let x=ox;x<=canvas.width;x+=step){const px=Math.round(x)+0.5;ctx.moveTo(px,0);ctx.lineTo(px,canvas.height);}
    for(let y=oy;y<=canvas.height;y+=step){const py=Math.round(y)+0.5;ctx.moveTo(0,py);ctx.lineTo(canvas.width,py);}
    ctx.stroke();
    ctx.restore(); // 恢复 translate+scale，后续节点/连线仍按世界坐标绘制
  }
  document.getElementById('chint').style.opacity=nodes.length?'0':'1';
  // 汇流主干母线（多种样式可选，绘制在连线下方作为底板）；任何拖动交互时不绘制（避免游离母线/手柄）
  const _interacting=_dragging||dragBus||dragResize||dragGroupScale||dragRotate||dragChip||dragChipGroup||dragWaypoint||dragEndpoint||rubber;
  // 汇流主干：连线本身已共用同一段路径形成主干，无需再画额外母线条（避免残段/近距离平行线/断线）。
  // 仅在需要时绘制一个可拖动微调的中点手柄。
  if(busMerge&&TR.busTrunks().length&&!_interacting&&busShowHandles){
    ctx.save();
    TR.busTrunks().forEach(t=>{
      const midP=t.horiz?[(t.a+t.b)/2,t.y]:[t.x,(t.a+t.b)/2];
      t._handle=midP;
      ctx.globalAlpha=0.8;ctx.fillStyle='#fff';ctx.strokeStyle=t.color;ctx.lineWidth=2/zoom;
      ctx.beginPath();ctx.arc(midP[0],midP[1],4/zoom,0,Math.PI*2);ctx.fill();ctx.stroke();
    });
    ctx.restore();
  }
  computeCrossHops();
  // ★ 数据驱动：规则始终按当前信号实时求值并自动生效（无需进入预览）。
  //   编辑态：被规则隐藏的元素/连线「虚化」绘制，仍可点选编辑；运行视图(previewMode)：彻底隐藏。
  _dyn=computeDynamic(buildCtx(signalValues));
  edges.forEach(e=>{const ghost=_dyn.hiddenEdges.has(e);if(ghost&&previewMode)return;_drawAlpha=ghost?(selEdge===e?GHOST_SEL:GHOST_A):1;drawEdge(e);});
  _drawAlpha=1;ctx.globalAlpha=1;
  drawJunctionDots();
  nodes.forEach(n=>{const ghost=_dyn.hiddenNodes.has(n.id);if(ghost&&previewMode)return;_drawAlpha=ghost?(selNode===n.id?GHOST_SEL:GHOST_A):1;drawNode(n);});
  _drawAlpha=1;ctx.globalAlpha=1;   // 复位：drawNode 的虚化透明度设在 save 之前，循环后需手动还原
  // 多选高亮：给选中集合的节点画蓝色描边
  if(selSet.size>0){
    ctx.save();ctx.strokeStyle='#ffcc44';ctx.lineWidth=2/zoom;ctx.setLineDash([5/zoom,4/zoom]);
    let gx0=Infinity,gy0=Infinity,gx1=-Infinity,gy1=-Infinity;
    selSet.forEach(id=>{const n=nodes.find(z=>z.id===id);if(!n)return;
      let bx,by,bw,bh;
      if(usesTextBox(n.type)&&n._textBox){const b=n._textBox;bx=b.x-3/zoom;by=b.y-3/zoom;bw=b.w+6/zoom;bh=b.h+6/zoom;}
      else{const s=nsz(n);bx=n.x-s/2-4/zoom;by=n.y-s*.72-4/zoom;bw=s+8/zoom;bh=s+8/zoom;}
      ctx.strokeRect(bx,by,bw,bh);
      gx0=Math.min(gx0,bx);gy0=Math.min(gy0,by);gx1=Math.max(gx1,bx+bw);gy1=Math.max(gy1,by+bh);
    });
    // 多选整体包围框 + 右下角等比缩放手柄
    if(selSet.size>=2&&isFinite(gx0)){
      ctx.setLineDash([2/zoom,3/zoom]);ctx.strokeStyle='rgba(255,204,68,0.6)';ctx.lineWidth=1.5/zoom;
      ctx.strokeRect(gx0-6/zoom,gy0-6/zoom,(gx1-gx0)+12/zoom,(gy1-gy0)+12/zoom);ctx.setLineDash([]);
      const hx=gx1+6/zoom, hy=gy1+6/zoom, hs=6/zoom;
      _groupBox={x0:gx0-6/zoom,y0:gy0-6/zoom,x1:gx1+6/zoom,y1:gy1+6/zoom,handle:[hx,hy]};
      ctx.fillStyle='#fff';ctx.strokeStyle='#ffcc44';ctx.lineWidth=2/zoom;
      ctx.fillRect(hx-hs,hy-hs,hs*2,hs*2);ctx.strokeRect(hx-hs,hy-hs,hs*2,hs*2);
    } else _groupBox=null;
    ctx.setLineDash([]);ctx.restore();
  } else _groupBox=null;
  // 框选橡皮筋矩形
  if(rubber){
    const x0=Math.min(rubber.x0,rubber.x1),y0=Math.min(rubber.y0,rubber.y1),w=Math.abs(rubber.x1-rubber.x0),h=Math.abs(rubber.y1-rubber.y0);
    ctx.save();ctx.fillStyle='rgba(77,208,255,0.12)';ctx.strokeStyle='rgba(77,208,255,0.7)';ctx.lineWidth=1.2/zoom;ctx.setLineDash([5/zoom,4/zoom]);
    ctx.fillRect(x0,y0,w,h);ctx.strokeRect(x0,y0,w,h);ctx.setLineDash([]);ctx.restore();
  }
  // 对齐辅助线（拖动节点时与其他节点对齐显示）
  if(alignGuides.length>0){
    ctx.save();ctx.strokeStyle='#ff5fae';ctx.lineWidth=1/zoom;ctx.setLineDash([6/zoom,4/zoom]);
    const x0v=-panX/zoom,y0v=-panY/zoom,x1v=x0v+canvas.width/zoom,y1v=y0v+canvas.height/zoom;
    alignGuides.forEach(g=>{
      ctx.beginPath();
      if(g.type==='v'){ctx.moveTo(g.x,y0v);ctx.lineTo(g.x,y1v);}
      else{ctx.moveTo(x0v,g.y);ctx.lineTo(x1v,g.y);}
      ctx.stroke();
    });
    ctx.setLineDash([]);ctx.restore();
  }
  // 实时数值提示（旋转角度/缩放比例）
  if(_hud){
    ctx.save();
    const fs=13/zoom, pad=6/zoom;
    ctx.font='bold '+fs+"px -apple-system,'Microsoft YaHei',sans-serif";ctx.textAlign='center';ctx.textBaseline='middle';
    const tw=ctx.measureText(_hud.text).width;
    const bx=_hud.x, by=_hud.y-34/zoom;
    ctx.fillStyle='rgba(20,30,48,0.95)';ctx.strokeStyle='#4dd0ff';ctx.lineWidth=1.5/zoom;
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(bx-tw/2-pad,by-fs/2-pad/2,tw+pad*2,fs+pad,5/zoom);else ctx.rect(bx-tw/2-pad,by-fs/2-pad/2,tw+pad*2,fs+pad);
    ctx.fill();ctx.stroke();
    ctx.fillStyle='#9fe8ff';ctx.fillText(_hud.text,bx,by);
    ctx.restore();
  }
  // 连线进行中的预览（起点→已有拐点→鼠标当前位置）
  if(edgeMode&&edgeFrom){
    const f=nodes.find(z=>z.id===edgeFrom);
    if(f){
      const fb=nodeBox(f);
      const start=nodePortPoint(f,edgeFromPort)||[f.x,fb.cy];
      const pts=[start,...edgeWaypoints.map(p=>p.slice())];
      let snapPort=null;
      if(mouseWX!=null){
        const last=pts[pts.length-1];
        const hover=edgeSnapAt(mouseWX,mouseWY,edgeFrom);
        let px=mouseWX,py=mouseWY;
        if(hover){
          snapPort=hover.port;
          if(snapPort){px=snapPort.point[0];py=snapPort.point[1];}
        }else if(Math.abs(mouseWX-last[0])>Math.abs(mouseWY-last[1]))py=last[1];else px=last[0];
        pts.push([px,py]);
      }
      ctx.save();
      ctx.strokeStyle=(ET[pendingET]||ET.ac_power).color;ctx.lineWidth=2/zoom;ctx.globalAlpha=.7;ctx.setLineDash([6/zoom,5/zoom]);
      ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.stroke();
      ctx.setLineDash([]);
      if(snapPort){ctx.fillStyle='#fff';ctx.strokeStyle=(ET[pendingET]||ET.ac_power).color;ctx.lineWidth=2/zoom;ctx.beginPath();ctx.arc(snapPort.point[0],snapPort.point[1],5/zoom,0,Math.PI*2);ctx.fill();ctx.stroke();}
      // 拐点小圆
      edgeWaypoints.forEach(p=>{ctx.fillStyle=(ET[pendingET]||ET.ac_power).color;ctx.beginPath();ctx.arc(p[0],p[1],4/zoom,0,Math.PI*2);ctx.fill();});
      ctx.restore();
    }
  }
  ctx.restore();
}

// ───── 跨线弧（cross-over hop）─────
// 计算所有连线之间无法消除的交叉点，给「后绘制的那条线」在交点处画一个半圆跳过，区分上下层。
let _crossHops=new Map(); // edgeIndex -> [{x,y,segIndex}]
function segIntersectPt(a,b,c,d){
  const r=[b[0]-a[0],b[1]-a[1]], s=[d[0]-c[0],d[1]-c[1]];
  const den=r[0]*s[1]-r[1]*s[0];
  if(Math.abs(den)<1e-9)return null; // 平行/共线
  const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den;
  const u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;
  if(t<0.02||t>0.98||u<0.02||u>0.98)return null; // 端点附近不算（汇合点不画弧）
  return [a[0]+r[0]*t, a[1]+r[1]*t];
}
function computeCrossHops(){
  _crossHops=new Map();
  const paths=edges.map(e=>edgePath(e));
  for(let i=0;i<paths.length;i++){
    for(let j=i+1;j<paths.length;j++){
      const p1=paths[i],p2=paths[j];if(!p1||!p2)continue;
      // 不同线型/颜色的交叉才画弧；同色汇合重叠不画
      for(let a=0;a<p1.length-1;a++){
        for(let b=0;b<p2.length-1;b++){
          const ip=segIntersectPt(p1[a],p1[a+1],p2[b],p2[b+1]);
          if(ip){
            // 让后绘制的线（索引大的 j）跳过
            if(!_crossHops.has(j))_crossHops.set(j,[]);
            _crossHops.get(j).push({x:ip[0],y:ip[1],seg:b});
          }
        }
      }
    }
  }
}
function strokePolyline(pts,dashArr,offset){
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);
  if(dashArr)ctx.setLineDash(dashArr);ctx.lineDashOffset=offset||0;ctx.stroke();ctx.setLineDash([]);
}
// 带跨线弧的折线绘制：在 hops 指定的交点处画半圆跳过
function strokePolylineHop(pts,hops){
  if(!hops||!hops.length){ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.stroke();return;}
  const R=7/zoom; // 弧半径
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
  for(let i=0;i<pts.length-1;i++){
    const A=pts[i],B=pts[i+1];
    const segLen=Math.hypot(B[0]-A[0],B[1]-A[1]);if(segLen<1){ctx.lineTo(B[0],B[1]);continue;}
    const ux=(B[0]-A[0])/segLen, uy=(B[1]-A[1])/segLen;
    // 该段上的跨点，按到 A 的距离排序
    const segHops=hops.filter(h=>h.seg===i).map(h=>({h,d:(h.x-A[0])*ux+(h.y-A[1])*uy})).filter(o=>o.d>R&&o.d<segLen-R).sort((p,q)=>p.d-q.d);
    let cursor=A;
    for(const {h,d} of segHops){
      const cx=A[0]+ux*d, cy=A[1]+uy*d;
      const e1=[cx-ux*R, cy-uy*R], e2=[cx+ux*R, cy+uy*R];
      ctx.lineTo(e1[0],e1[1]);
      // 半圆（垂直于线方向凸起）
      const ang=Math.atan2(uy,ux);
      ctx.arc(cx,cy,R,ang-Math.PI,ang,false);
      cursor=e2;
      ctx.moveTo(e2[0],e2[1]);
    }
    ctx.lineTo(B[0],B[1]);
  }
  ctx.stroke();
}
function polyLen(pts){let l=0;for(let i=0;i<pts.length-1;i++)l+=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);return l;}
function pointAt(pts,dist){
  for(let i=0;i<pts.length-1;i++){const seg=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);
    if(dist<=seg){const t=dist/seg;return[pts[i][0]+(pts[i+1][0]-pts[i][0])*t,pts[i][1]+(pts[i+1][1]-pts[i][1])*t];}dist-=seg;}
  return pts[pts.length-1];
}
function normHex(v){
  v=String(v||'').trim();
  if(v&&v[0]!=='#')v='#'+v;
  return /^#[0-9a-fA-F]{6}$/.test(v)?v:null;
}
function edgeCfg(e){
  const base=ET[e.et]||ET.ac_power;
  const st=e.lineStyle||'inherit';
  let dash=base.dash||[];
  if(st==='solid')dash=[];
  else if(st==='dashed')dash=[7,6];
  const color=normHex(e.lineColor)||base.color;
  return Object.assign({},base,{color,dash});
}

function drawEdge(e){
  const pts=edgePath(e);if(!pts)return;
  const dir=effDir(e);   // ★ 流向由数据驱动规则实时确定（命中规则用规则结果，否则用固定 e.dir 兜底）
  const baseCfg=edgeCfg(e),isSel=selEdge===e;
  // 应用粗细倍率（每条边 e.w × 全局 globalWidth）
  const wmul=(e.w||1)*globalWidth;
  const cfg=Object.assign({},baseCfg,{w:baseCfg.w*wmul});
  if(dir==='none')cfg.anim='none';
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.globalAlpha=_drawAlpha;
  if(isSel){ctx.strokeStyle='rgba(255,255,255,0.18)';ctx.lineWidth=(cfg.w+8)/zoom;strokePolyline(pts);}

  // base glow
  if(cfg.anim!=='none'){
    ctx.strokeStyle=cfg.color;ctx.globalAlpha=.13*_drawAlpha;ctx.lineWidth=(cfg.w+5)/zoom;
    ctx.shadowColor=cfg.color;ctx.shadowBlur=10/zoom;strokePolyline(pts);ctx.globalAlpha=_drawAlpha;ctx.shadowBlur=0;
  }

  if(cfg.anim==='pipe'){
    // pipe base: dark track
    ctx.strokeStyle=rgba(cfg.color,.25);ctx.lineWidth=cfg.w/zoom;strokePolyline(pts);
    // flowing glow dots
    const total=polyLen(pts),gapW=22,off=(animT*cfg.spd*40)%gapW;
    for(let d=-off;d<total;d+=gapW){
      if(d<0)continue;const dd=(dir==='reverse')?(total-d):d;
      const[px,py]=pointAt(pts,dd);
      ctx.beginPath();ctx.fillStyle=cfg.color;ctx.shadowColor=cfg.color;ctx.shadowBlur=8/zoom;
      ctx.arc(px,py,(Math.max(2.2,cfg.w*0.72))/zoom,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    }
  } else if(cfg.anim==='busbar'){
    ctx.strokeStyle=cfg.color;ctx.lineWidth=cfg.w/zoom;ctx.shadowColor=cfg.color;ctx.shadowBlur=6/zoom;
    strokePolyline(pts);ctx.shadowBlur=0;
    ctx.strokeStyle=rgba('#ffffff',.4);ctx.lineWidth=(cfg.w*.3)/zoom;strokePolyline(pts);
  } else if(cfg.anim==='glow'){
    ctx.strokeStyle=cfg.color;ctx.lineWidth=cfg.w/zoom;ctx.shadowColor=cfg.color;ctx.shadowBlur=6/zoom;strokePolyline(pts);ctx.shadowBlur=0;
  } else {
    ctx.strokeStyle=cfg.color;ctx.lineWidth=cfg.w/zoom;
    ctx.shadowColor=cfg.color;ctx.shadowBlur=cfg.anim!=='none'?4/zoom:0;
    if(cfg.anim==='alarm')ctx.globalAlpha=_drawAlpha*(.5+.5*Math.sin(animT*cfg.spd*Math.PI*2));
    if(cfg.anim==='pulse')ctx.globalAlpha=_drawAlpha*(.35+.45*Math.sin(animT*cfg.spd*Math.PI*2));
    strokePolyline(pts,cfg.dash.map(d=>d/zoom));ctx.globalAlpha=_drawAlpha;ctx.shadowBlur=0;
    if(cfg.anim==='flow'||cfg.anim==='dash'){
      const pl=cfg.anim==='dash'?3:8,gap=cfg.anim==='dash'?8:16,off=(animT*cfg.spd*55)%(pl+gap);
      ctx.strokeStyle='rgba(255,255,255,0.94)';ctx.lineWidth=Math.max(2.4,Math.min(cfg.w*.78,8.5))/zoom;
      if(dir==='both'){strokePolyline(pts,[pl/zoom,gap/zoom],-off/zoom);strokePolyline(pts,[pl/zoom,gap/zoom],off/zoom);}
      else strokePolyline(pts,[pl/zoom,gap/zoom],(dir==='reverse'?off:-off)/zoom);
    }
  }
  ctx.shadowBlur=0;
  // 跨线弧（cross-over hop）：在无法消除的交叉点画半圆跳过，区分上下层
  const myIdx=edges.indexOf(e);
  const hops=_crossHops.get(myIdx);
  if(hops&&hops.length){
    hops.forEach(h=>{
      const R=7/zoom;
      // 先用背景色抹掉交点处一小段，制造"断开"
      ctx.strokeStyle=bgColor; ctx.lineWidth=(cfg.w+2.5)/zoom; ctx.lineCap='round';
      ctx.beginPath();ctx.arc(h.x,h.y,R,0,Math.PI*2);ctx.stroke();
      // 再画线色半圆拱桥
      ctx.strokeStyle=cfg.color; ctx.lineWidth=cfg.w/zoom;
      ctx.beginPath();ctx.arc(h.x,h.y,R,Math.PI,0,false);ctx.stroke();
    });
  }
  // arrow at end（dir 已在函数顶部按数据驱动求得）
  const p2=pts[pts.length-1],p1=pts[pts.length-2];
  const pa=pts[0],pb=pts[1];
  if((dir==='forward'||dir==='both')&&cfg.anim!=='busbar'&&cfg.anim!=='pipe')drawArrowSeg(p1,p2,cfg.color,cfg.w);
  if((dir==='reverse'||dir==='both')&&cfg.anim!=='busbar'&&cfg.anim!=='pipe')drawArrowSeg(pb,pa,cfg.color,cfg.w);
  // label
  if((e.lbl||isSel) && showEdgeLabels && !e.hideLabel){
    const lbl=e.lbl||(isSel?cfg.label:'');
    if(lbl){const mid=pointAt(pts,polyLen(pts)/2);const fs=13/zoom;ctx.font=fs+"px -apple-system,'Microsoft YaHei',sans-serif";ctx.textAlign='center';
      const tw=ctx.measureText(lbl).width;ctx.fillStyle=bgPlate();ctx.fillRect(mid[0]-tw/2-4/zoom,mid[1]-fs*0.8,tw+8/zoom,fs+5/zoom);
      ctx.fillStyle=cfg.color;ctx.fillText(lbl,mid[0],mid[1]+fs*.18);}
  }
  // 编辑态：带「显示/流向」条件的连线，在中点旁标琥珀色小点
  if(!previewMode){ const m=pointAt(pts,polyLen(pts)/2);
    if(_dyn.hiddenEdges.has(e)) drawHiddenBadge(m[0], m[1]);              // 被规则隐藏：醒目⊘标记，区别于其它虚化/普通线
    else if(showRuleBadges&&edgeHasRule(e)) drawCondBadge(m[0]+9/zoom, m[1]-9/zoom);   // 「带规则」标记：仅规则面板开启时显示
  }
  // 选中连线时，仅在「线上的真实节点」显示可拖动方块手柄：每个方向变更处(拐点) + 已存拐点 + 起止端。
  // 不显示"段中点新增拐点"标记，也不显示其他线的浮动手柄——避免越拖越乱、或线被拖走后留下孤立节点。
  if(isSel&&!_dragging&&!rubber){
    ctx.shadowBlur=0;
    const sqr=(x,y)=>{ const sz=5/zoom; ctx.fillStyle='#4dd0ff';ctx.strokeStyle='#fff';ctx.lineWidth=1.4/zoom;
      ctx.fillRect(x-sz,y-sz,sz*2,sz*2);ctx.strokeRect(x-sz,y-sz,sz*2,sz*2); };
    const handlePts=[];
    const addHP=(x,y)=>{ for(const h of handlePts){ if(Math.abs(h[0]-x)<0.5&&Math.abs(h[1]-y)<0.5)return; } handlePts.push([x,y]); };
    if(e.route!=='arc'){   // 弧线是连续曲线，无离散拐点，不画拐点手柄
      for(let i=1;i<pts.length-1;i++){ const a=pts[i-1],c=pts[i],d=pts[i+1];   // 仅取「实际渲染线」上的方向变更处
        if(Math.abs((c[0]-a[0])*(d[1]-a[1])-(c[1]-a[1])*(d[0]-a[0]))>1) addHP(c[0],c[1]); }
    }
    handlePts.forEach(p=>sqr(p[0],p[1]));   // 手柄只画在线上的真实拐点，绝不残留偏离线条的旧存储点
    // 起止端节点：放在端点稍内侧(避开设备图标)；与拐点同为方块，用于拖动这一端(重连/移动)，不新增线段
    const inset=(p0,p1)=>{ const dx=p1[0]-p0[0],dy=p1[1]-p0[1],len=Math.hypot(dx,dy)||1,t=Math.min(15/zoom,len*0.45); return [p0[0]+dx/len*t,p0[1]+dy/len*t]; };
    e._endHandles=[ inset(pts[0],pts[1]), inset(pts[pts.length-1],pts[pts.length-2]) ];
    e._endHandles.forEach(p=>sqr(p[0],p[1]));
    e._drawPts=pts;
  } else { e._endHandles=null; }
  ctx.restore();
}
function drawArrowSeg(p1,p2,color,w){
  const ang=Math.atan2(p2[1]-p1[1],p2[0]-p1[0]);
  const t=.6,ax=p1[0]+(p2[0]-p1[0])*t,ay=p1[1]+(p2[1]-p1[1])*t,as=Math.max(8,w*3.8)/zoom;
  ctx.save();ctx.translate(ax,ay);ctx.rotate(ang);ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=Math.max(1.1,w*.55)/zoom;
  ctx.setLineDash([]);ctx.shadowColor=color;ctx.shadowBlur=3/zoom;
  ctx.beginPath();ctx.moveTo(as*.18,0);ctx.lineTo(-as,-as*.58);ctx.lineTo(-as*.62,0);ctx.lineTo(-as,as*.58);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}

function rotatePt(px,py,cx,cy,rad){if(!rad)return [px,py];const c=Math.cos(rad),s=Math.sin(rad);const dx=px-cx,dy=py-cy;return [cx+dx*c-dy*s, cy+dx*s+dy*c];}
function drawNode(n){
  ctx.globalAlpha=_drawAlpha;   // 编辑态被规则隐藏的元素「虚化」绘制（仍可点选编辑）
  // 文本框元素：只渲染文字，无图标
  if(n.type==='text'){ drawTextNode(n); return; }
  if(n.type==='variable'){ drawVariableNode(n); return; }
  const _it=effIconType(n);   // 数据驱动：按 iconRules 生效的图标 type（不改节点自身 type，仅换绘制图像）
  const img=CUSTOM_ICONS[_it]||IMGS[_it];const s=nsz(n);
  const isSel=selNode===n.id,isESrc=edgeMode&&edgeFrom===n.id;
  ctx.save();
  if(isSel||isESrc){
    ctx.strokeStyle=isESrc?'#2ecc71':'#4dd0ff';ctx.lineWidth=2/zoom;ctx.setLineDash([4/zoom,4/zoom]);ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=12/zoom;
    const bx=n.x-s/2-6/zoom, by=n.y-s*.72-6/zoom, bw=s+12/zoom, bh=s+12/zoom;
    ctx.strokeRect(bx,by,bw,bh);ctx.setLineDash([]);ctx.shadowBlur=0;
    // 四角缩放手柄
    if(isSel&&selSet.size<=1){
      const hs=5/zoom;
      n._resizeHandles=[[bx,by],[bx+bw,by],[bx,by+bh],[bx+bw,by+bh]];
      n._resizeHandle=[bx+bw,by+bh]; // 兼容旧引用
      ctx.fillStyle='#fff';ctx.strokeStyle='#4dd0ff';ctx.lineWidth=2/zoom;
      n._resizeHandles.forEach(h=>{ctx.fillRect(h[0]-hs,h[1]-hs,hs*2,hs*2);ctx.strokeRect(h[0]-hs,h[1]-hs,hs*2,hs*2);});
      // 顶部旋转手柄（圆点 + 连杆）
      const rcx=n.x, rcy=by-16/zoom;
      n._rotHandle=[rcx,rcy];
      ctx.strokeStyle='#4dd0ff';ctx.lineWidth=1.5/zoom;
      ctx.beginPath();ctx.moveTo(n.x,by);ctx.lineTo(rcx,rcy);ctx.stroke();
      ctx.fillStyle='#4dd0ff';ctx.beginPath();ctx.arc(rcx,rcy,5/zoom,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(rcx,rcy,2/zoom,0,Math.PI*2);ctx.fill();
    }
  }
  // 图标（带旋转）：绕视觉中心旋转
  const rot=(n.rotation||0)*Math.PI/180;
  const vcx=n.x, vcy=n.y-s*0.22;
  ctx.save();
  if(rot){ctx.translate(vcx,vcy);ctx.rotate(rot);ctx.translate(-vcx,-vcy);}
  if(n.type==='anchor'){
    // 占位点：可配置填充色 + 不透明度。把填充设为画布同色或不透明度调 0 即可对用户「隐形」。
    const r=s*0.36, op=(n.opacity!=null?n.opacity:1);
    if(n.fill && n.fill!=='none' && op>0){
      ctx.globalAlpha=op*_drawAlpha;ctx.fillStyle=n.fill;
      ctx.beginPath();ctx.arc(vcx,vcy,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=_drawAlpha;
    }
    // 研发辅助标记：仅当「📍 占位点标记」开启或该点被选中时显示淡虚线环，方便研发定位/点选；
    // 关闭后即便填充透明也不会被用户看到。
    if(showAnchors || isSel){
      ctx.save();
      ctx.globalAlpha=0.7*_drawAlpha;ctx.strokeStyle='#4dd0ff';ctx.lineWidth=1.2/zoom;ctx.setLineDash([3/zoom,3/zoom]);
      ctx.beginPath();ctx.arc(vcx,vcy,r,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.lineWidth=1/zoom;ctx.beginPath();
      ctx.moveTo(vcx-3/zoom,vcy);ctx.lineTo(vcx+3/zoom,vcy);ctx.moveTo(vcx,vcy-3/zoom);ctx.lineTo(vcx,vcy+3/zoom);ctx.stroke();
      ctx.restore();
    }
  }
  else if(img)ctx.drawImage(img,n.x-s/2,n.y-s*.72,s,s);
  else{ctx.fillStyle='#1a3a5c';ctx.fillRect(n.x-s/2,n.y-s*.72,s,s);const fs=10/zoom;ctx.fillStyle='#4dd0ff';ctx.font=fs+'px Courier New';ctx.textAlign='center';ctx.fillText(n.type,n.x,n.y+fs*.5);}
  ctx.restore();
  // 编辑态：带「显示」条件的节点，在图标右上角标琥珀色小点
  if(!previewMode){
    if(_dyn.hiddenNodes.has(n.id)) drawHiddenBadge(n.x+s*0.34, n.y-s*0.6);    // 被规则隐藏：醒目⊘标记
    else if(showRuleBadges&&nodeHasRule(n)) drawCondBadge(n.x+s*0.34, n.y-s*0.66);   // 「带规则」标记：仅规则面板开启时显示
  }
  if(!n.hideLabel){
  const lfs=(n.fontSize||14)/zoom;
  ctx.font='bold '+lfs+"px -apple-system,'Microsoft YaHei',sans-serif";ctx.textAlign='center';
  const lblTxt=nodeLabel(n);
  // 标签放在图标实际绘制区域的底边之下，确保不遮挡图标任何部分（含台座光晕）
  // 图标绘制范围 y: [n.y - s*0.72, n.y + s*0.28]，底边 = n.y + s*0.28
  const imgBottom=n.y + s*0.28;
  const lblY=imgBottom + lfs*0.85;  // 图标底边下方留固定小间距
  const tw=ctx.measureText(lblTxt).width;
  // 标签背景板：用背景色近不透明 + 圆角，彻底遮住下方连线
  const padX=6/zoom, plateY=lblY-lfs*0.82, plateH=lfs*1.25, plateX=n.x-tw/2-padX, plateW=tw+padX*2, rr=4/zoom;
  ctx.fillStyle=bgPlate();
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(plateX,plateY,plateW,plateH,rr); else ctx.rect(plateX,plateY,plateW,plateH);
  ctx.fill();
  ctx.fillStyle=isSel?'#ffffff':(n.fontColor||'#e8f4ff');
  ctx.shadowColor=isSel?'#4dd0ff':'rgba(0,0,0,0.5)';ctx.shadowBlur=isSel?6/zoom:1/zoom;
  ctx.fillText(lblTxt,n.x,lblY);ctx.shadowBlur=0;
  }
  if(edgeMode&&!edgeFrom){ctx.fillStyle='rgba(46,204,113,.1)';ctx.beginPath();ctx.arc(n.x,n.y,s*.5,0,Math.PI*2);ctx.fill();}
  // 数据字段浮动标签（每个独立、可拖动），显示「字段名: 值/--」
  drawFieldChips(n,s);
  ctx.restore();
}
function textNodeDisplay(n){
  const label=nodeLabel(n);
  const f=(n.data||[]).find(x=>!x.hidden&&x.key);
  if(f){
    const ctxv=buildCtx(signalValues);
    const sig=fieldSig(n,f);
    if(Object.prototype.hasOwnProperty.call(ctxv,sig)){
      const v=ctxv[sig];
      if(v!==''&&v!=null)return label?(label+'：'+v):String(v);
    }
    if(f.dv!==''&&f.dv!=null)return label?(label+'：'+f.dv):String(f.dv);
  }
  return label;
}
// ── 文本框 / 变量节点 共用：在给定盒子上绘制背景、边框、选中虚线框 + 缩放/旋转手柄 ──
function drawBoxBg(n,b,rr){
  if(!(n.bg&&n.bg!=='none'))return;
  ctx.fillStyle=n.bg;ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(b.x,b.y,b.w,b.h,rr);else ctx.rect(b.x,b.y,b.w,b.h);
  ctx.fill();
}
function drawBoxBorder(n,b,rr){
  if(!(n.border&&n.border!=='none'))return;
  ctx.strokeStyle=n.borderColor||'#4dd0ff';ctx.lineWidth=(n.borderWidth||1.5)/zoom;
  if(n.border==='dashed')ctx.setLineDash([6/zoom,4/zoom]);
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(b.x,b.y,b.w,b.h,rr);else ctx.rect(b.x,b.y,b.w,b.h);
  ctx.stroke();ctx.setLineDash([]);
}
function drawBoxSelectionChrome(n,b,rot){
  ctx.strokeStyle='#4dd0ff';ctx.lineWidth=1.5/zoom;ctx.setLineDash([4/zoom,4/zoom]);
  ctx.strokeRect(b.x-3/zoom,b.y-3/zoom,b.w+6/zoom,b.h+6/zoom);ctx.setLineDash([]);
  if(selSet.size>1)return;
  const hs=5/zoom;
  const corners=[[b.x-3/zoom,b.y-3/zoom],[b.x+b.w+3/zoom,b.y-3/zoom],[b.x-3/zoom,b.y+b.h+3/zoom],[b.x+b.w+3/zoom,b.y+b.h+3/zoom]];
  n._resizeHandles=corners.map(c=>rotatePt(c[0],c[1],n.x,n.y,rot));
  n._resizeHandle=n._resizeHandles[3];
  ctx.fillStyle='#fff';ctx.strokeStyle='#4dd0ff';ctx.lineWidth=2/zoom;
  corners.forEach(c=>{ctx.fillRect(c[0]-hs,c[1]-hs,hs*2,hs*2);ctx.strokeRect(c[0]-hs,c[1]-hs,hs*2,hs*2);});
  const rcx=n.x, rcy=b.y-3/zoom-16/zoom;
  n._rotHandle=rotatePt(rcx,rcy,n.x,n.y,rot);
  ctx.strokeStyle='#4dd0ff';ctx.lineWidth=1.5/zoom;
  ctx.beginPath();ctx.moveTo(n.x,b.y-3/zoom);ctx.lineTo(rcx,rcy);ctx.stroke();
  ctx.fillStyle='#4dd0ff';ctx.beginPath();ctx.arc(rcx,rcy,5/zoom,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(rcx,rcy,2/zoom,0,Math.PI*2);ctx.fill();
}
// 文本框元素渲染
function drawTextNode(n){
  const isSel=selNode===n.id;
  // 字号随 1/zoom：屏幕字号恒定，与设备图标/节点标签的显示策略一致（拖入画布时所见即字号）
  const fs=(n.fontSize||18)*(n.scale||1)/zoom;
  const txt=textNodeDisplay(n);
  ctx.save();
  const rot=(n.rotation||0)*Math.PI/180;
  if(rot){ctx.translate(n.x,n.y);ctx.rotate(rot);ctx.translate(-n.x,-n.y);}
  ctx.font='bold '+fs+"px -apple-system,'Microsoft YaHei',sans-serif";ctx.textAlign='center';ctx.textBaseline='middle';
  const lines=txt.split('\n');
  let maxW=0;lines.forEach(l=>{maxW=Math.max(maxW,ctx.measureText(l).width);});
  const padX=(n.padX!=null?n.padX:10)/zoom, padY=(n.padY!=null?n.padY:6)/zoom;
  const lh=fs*1.3, totalH=lines.length*lh;
  n._textBox={x:n.x-maxW/2-padX,y:n.y-totalH/2-padY,w:maxW+padX*2,h:totalH+padY*2};
  const b=n._textBox, rr=(n.radius!=null?n.radius:6)/zoom;
  if(!n.hideLabel){ drawBoxBg(n,b,rr); drawBoxBorder(n,b,rr); }
  if(isSel) drawBoxSelectionChrome(n,b,rot);
  if(!n.hideLabel){
    ctx.fillStyle=n.fontColor||'#ffffff';
    if(!n.bg||n.bg==='none'){ctx.shadowColor='rgba(0,0,0,0.6)';ctx.shadowBlur=3/zoom;}
    lines.forEach((l,i)=>{ctx.fillText(l,n.x,n.y-totalH/2+lh*(i+0.5));});
  }
  ctx.shadowBlur=0;ctx.restore();
}
// 变量节点的「值」：优先取绑定字段的实时信号值，否则取该字段的静态默认值；无字段则空
function variableValue(n){
  const f=(n.data||[]).find(x=>!x.hidden&&x.key);
  if(f){
    const ctxv=buildCtx(signalValues);
    const sig=fieldSig(n,f);
    if(Object.prototype.hasOwnProperty.call(ctxv,sig)){
      const v=ctxv[sig];
      if(v!==''&&v!=null)return String(v);
    }
    if(f.dv!==''&&f.dv!=null)return String(f.dv);
  }
  return '';
}
// 变量节点渲染：label 段 + value 段，各自字体可独立设置；可横排 / 竖排
function drawVariableNode(n){
  const isSel=selNode===n.id;
  const sc=n.scale||1;
  // 字号随 1/zoom：屏幕字号恒定（与设备图标/节点标签一致）
  const lfs=(n.fontSize||16)*sc/zoom;                  // label 字号
  const vfs=(n.valFontSize||n.fontSize||16)*sc/zoom;   // value 字号
  const labelTxt=nodeLabel(n)||'';
  const valTxt=variableValue(n);
  const layout=(n.varLayout==='v')?'v':'h';
  const lFont=(n.labelBold!==false?'bold ':'')+lfs+"px -apple-system,'Microsoft YaHei',sans-serif";
  const vFont=(n.valBold?'bold ':'')+vfs+"px -apple-system,'Microsoft YaHei',sans-serif";
  ctx.save();
  const rot=(n.rotation||0)*Math.PI/180;
  if(rot){ctx.translate(n.x,n.y);ctx.rotate(rot);ctx.translate(-n.x,-n.y);}
  ctx.textBaseline='middle';
  ctx.font=lFont;const lw=labelTxt?ctx.measureText(labelTxt).width:0;
  ctx.font=vFont;const vw=valTxt?ctx.measureText(valTxt).width:0;
  const padX=(n.padX!=null?n.padX:10)/zoom, padY=(n.padY!=null?n.padY:6)/zoom;
  const both=!!(labelTxt&&valTxt);
  let contentW,contentH;
  if(layout==='h'){
    const gap=both?Math.max(lfs,vfs)*0.45:0;
    contentW=lw+gap+vw; contentH=Math.max(lfs,vfs)*1.2;
    n._varGap=gap;
  }else{
    const vgap=both?Math.max(lfs,vfs)*0.3:0;
    contentW=Math.max(lw,vw); contentH=(labelTxt?lfs*1.2:0)+(valTxt?vfs*1.2:0)+vgap;
    n._varGap=vgap;
  }
  n._textBox={x:n.x-contentW/2-padX,y:n.y-contentH/2-padY,w:contentW+padX*2,h:contentH+padY*2};
  const b=n._textBox, rr=(n.radius!=null?n.radius:6)/zoom;
  if(!n.hideLabel){ drawBoxBg(n,b,rr); drawBoxBorder(n,b,rr); }
  if(isSel) drawBoxSelectionChrome(n,b,rot);
  if(!n.hideLabel){
    if(!n.bg||n.bg==='none'){ctx.shadowColor='rgba(0,0,0,0.6)';ctx.shadowBlur=3/zoom;}
    if(layout==='h'){
      const gap=n._varGap;
      let x=n.x-contentW/2;
      ctx.textAlign='left';
      if(labelTxt){ctx.font=lFont;ctx.fillStyle=n.fontColor||'#e8f4ff';ctx.fillText(labelTxt,x,n.y);x+=lw+gap;}
      if(valTxt){ctx.font=vFont;ctx.fillStyle=n.valColor||'#4dd0ff';ctx.fillText(valTxt,x,n.y);}
    }else{
      const vgap=n._varGap;
      ctx.textAlign='center';
      let y=n.y-contentH/2;
      if(labelTxt){ctx.font=lFont;ctx.fillStyle=n.fontColor||'#e8f4ff';y+=lfs*0.6;ctx.fillText(labelTxt,n.x,y);y+=lfs*0.6+vgap;}
      if(valTxt){ctx.font=vFont;ctx.fillStyle=n.valColor||'#4dd0ff';y+=vfs*0.6;ctx.fillText(valTxt,n.x,y);}
    }
  }
  ctx.shadowBlur=0;ctx.restore();
}
// 计算某字段 chip 的默认位置（节点右侧堆叠）。全部用世界坐标常量，缩放稳定
function fieldChipPos(n,i){
  const s=nsz(n);
  const cfs=(n.fontSize||14)*0.92/zoom;       // 字号随 1/zoom，屏幕字号恒定（与图标一致）
  const baseX=n.x+s*0.5+14/zoom;              // 节点右侧（屏幕固定间距，不随缩放漂移）
  const step=((n.fontSize||14)+8+10)/zoom;    // 卡片高度(字号+上下padding) + 间距（屏幕固定）
  const baseY=n.y-s*0.40+i*step;              // 自上而下堆叠（含舒适间距）
  const f=n.data[i];
  const ox=(f.ox!=null?f.ox:0), oy=(f.oy!=null?f.oy:0);   // ox/oy 以屏幕像素存储
  return {x:baseX+ox/zoom, y:baseY+oy/zoom, h:cfs*1.5, cfs};
}
function fieldChipText(f){
  const k=dataKey(f);
  const v=(f.dv==null||f.dv==='')?'':f.dv;   // 有值就显示（含 0 显示为 0）；无值(null/空串)显示空
  return k+': '+v;
}
function drawFieldChips(n,s){
  if(n.hideFields||!showFieldChips||!n.data||n.data.length===0)return;
  ctx.shadowBlur=0;
  const isSel=selNode===n.id;
  const _iss=fieldNameIssues(n);   // 字段名校验：空名/同节点重名
  n.data.forEach((f,i)=>{
    if(f.hidden)return;
    const _s=_iss[i]||{}, _bad=!!(_s.emptyZh||_s.emptyEn||_s.dupZh||_s.dupEn);
    // 预览/运行态：不合法字段不展示给终端用户（半成品/信号键冲突字段不入图）
    if(previewMode&&_bad){ f._chipBox=null; return; }
    const pos=fieldChipPos(n,i);
    // 编辑态下不合法字段显示醒目告警文案（替代丑陋的空「: 」），提示运营端修正
    const txt=_bad ? ('⚠ '+(((_s.emptyZh||_s.emptyEn)?((dataKey(f)||'未命名')+'·缺名'):(dataKey(f)+'·重名')))) : fieldChipText(f);
    ctx.font=pos.cfs+"px -apple-system,'Microsoft YaHei',sans-serif";ctx.textAlign='left';
    const tw=ctx.measureText(txt).width;
    const padX=7/zoom, padY=4/zoom, rr=5/zoom;   // 屏幕固定（随 1/zoom）
    const bx=pos.x, by=pos.y-pos.cfs, bw=tw+padX*2, bh=pos.cfs+padY*2;
    // 引导线：当 chip 被拖离默认位置较远时，用细线连回节点视觉中心，避免不知归属
    const off=Math.hypot(f.ox||0,f.oy||0);
    if(off>40){
      const nb=nodeBox(n);
      // chip 中心
      const ccx=bx+bw/2, ccy=by+bh/2;
      ctx.save();
      ctx.strokeStyle=isSel?'rgba(77,208,255,0.5)':'rgba(120,150,180,0.32)';
      ctx.lineWidth=1/zoom;ctx.setLineDash([4/zoom,3/zoom]);
      ctx.beginPath();ctx.moveTo(nb.cx,nb.cy);ctx.lineTo(ccx,ccy);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    }
    // 背景板
    const chipSel=selChips.has(n.id+'#'+i);
    ctx.fillStyle=_bad?'rgba(60,20,24,0.85)':(chipSel?'rgba(40,70,110,0.92)':'rgba(10,22,40,0.82)');
    ctx.strokeStyle=_bad?'#ff6b6b':(chipSel?'#ffcc44':(isSel?'rgba(77,208,255,0.7)':'rgba(120,150,180,0.3)'));ctx.lineWidth=(_bad?1.6:(chipSel?1.8:1.2))/zoom;
    if(_bad)ctx.setLineDash([4/zoom,3/zoom]);
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(bx,by,bw,bh,rr);else ctx.rect(bx,by,bw,bh);
    ctx.fill();ctx.stroke();
    if(_bad)ctx.setLineDash([]);
    if(_bad){
      // 不合法字段：整条红色告警文案
      ctx.fillStyle='#ff9a9a';ctx.fillText(txt,bx+padX,pos.y);
    }else{
      // 文字：字段名浅色，值强调色
      const k=dataKey(f), kw=ctx.measureText(k+': ').width;
      ctx.fillStyle='#9fc0dd';ctx.fillText(k+': ',bx+padX,pos.y);
      const _hv=(f.dv!=null&&f.dv!=='');         // 有值(含 0)→强调色显示；无值→留空
      const v=_hv?f.dv:'';
      ctx.fillStyle=_hv?'#4dd0ff':'#6b8299';
      ctx.fillText(''+v,bx+padX+kw,pos.y);
    }
    f._chipBox={x:bx,y:by,w:bw,h:bh};
  });
}
