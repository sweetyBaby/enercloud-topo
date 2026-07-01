let activeTab='device';
let customIcons=[]; // {type,zh,en,url}
const TAB_DEFS=[
  {id:'device',zh:'设备元素',en:'Devices'},
  {id:'annot',zh:'辅助元素',en:'Auxiliary'},
  {id:'custom',zh:'自定义',en:'Custom'},
];
function sidebarGroupsFor(tab){return DEVICE_GROUPS.filter(g=>(g.tab||'device')===tab);}
function sidebarKey(tab,g){return tab+'::'+g.title;}
function ensureSidebarDefault(tab,groups){
  if(sidebarAccInited.has(tab))return;
  groups.forEach((g,i)=>{const key=sidebarKey(tab,g);if(i>0)sidebarCollapsed.add(key);else sidebarCollapsed.delete(key);});
  sidebarAccInited.add(tab);
}
function setSidebarGroups(expand){
  const groups=sidebarGroupsFor(activeTab);
  groups.forEach(g=>{const key=sidebarKey(activeTab,g);if(expand)sidebarCollapsed.delete(key);else sidebarCollapsed.add(key);});
  sidebarAccInited.add(activeTab);
  buildSidebar();
}
function buildSidebar(){
  // 顶部 tab
  const tb=document.getElementById('side-tabs');tb.innerHTML='';
  TAB_DEFS.forEach(t=>{
    const b=document.createElement('button');b.className='stab'+(activeTab===t.id?' active':'');
    b.textContent=lang==='en'?t.en:t.zh;
    b.onclick=()=>{activeTab=t.id;buildSidebar();};
    tb.appendChild(b);
  });
  const sb=document.getElementById('sidebar');sb.innerHTML='';
  // 搜索框：仅「设备元素」tab 显示
  const ss=document.getElementById('side-search'); if(ss) ss.style.display=(activeTab==='device')?'block':'none';
  const dsi=document.getElementById('dev-search'); if(dsi) dsi.placeholder=(lang==='en'?'Search elements…':'搜索元素…');
  const tools=document.getElementById('side-acc-tools');
  if(activeTab==='custom'){
    if(tools)tools.style.display='none';
    // 自定义类：上传按钮 + 已上传图标
    const c=document.createElement('div');c.className='ni-custom';
    c.innerHTML='<span>📁</span> '+(lang==='en'?'Upload Icon':'上传自定义图标');
    c.onclick=()=>document.getElementById('uo').classList.add('show');sb.appendChild(c);
    if(customIcons.length===0){
      const tip=document.createElement('div');tip.style.cssText='padding:14px;font-size:12px;color:var(--ui-text2);line-height:1.6';
      tip.textContent=lang==='en'?'No custom icons yet. Click above to upload.':'还没有自定义图标，点击上方上传。';
      sb.appendChild(tip);
    }
    customIcons.forEach(ci=>sb.appendChild(makeNI(ci.type,ci.zh,ci.en,'custom',ci.url)));
    return;
  }
  // 其它 tab：按 tab 过滤分组
  const groups=sidebarGroupsFor(activeTab);
  ensureSidebarDefault(activeTab,groups);
  if(tools)tools.style.display=(groups.length>1)?'flex':'none';
  groups.forEach(g=>{
    const h=document.createElement('div');h.className='grptitle';h.style.setProperty('--gc',g.color);
    const key=sidebarKey(activeTab,g),collapsed=sidebarCollapsed.has(key);
    h.classList.toggle('is-collapsed',collapsed);
    h.setAttribute('aria-expanded',collapsed?'false':'true');
    const chev=document.createElement('span');chev.className='gchev';chev.textContent=collapsed?'▾':'▴';
    const title=document.createElement('span');title.className='gtitle';title.textContent=lang==='en'?(g.title_en||g.title):g.title;
    h.appendChild(title);h.appendChild(chev);sb.appendChild(h);
    const body=document.createElement('div');body.className='grpbody'+(collapsed?' collapsed':'');body.dataset.groupKey=key;
    h.onclick=()=>{ if(sidebarCollapsed.has(key))sidebarCollapsed.delete(key);else sidebarCollapsed.add(key);buildSidebar(); };
    g.devices.forEach(d=>body.appendChild(makeNI(d.type,d.label,d.label_en,d.badge)));
    sb.appendChild(body);
  });
  if(activeTab==='device') filterSidebar();
}
// 按名称搜索左侧元素：
//  · 无搜索词：恢复分组结构（显示全部分组标题与元素）
//  · 有搜索词：跨分组「拍平」成一个列表——隐藏所有分组标题，只显示匹配的元素
function filterSidebar(){
  const inp=document.getElementById('dev-search'); const ss=document.getElementById('side-search');
  const q=(inp?inp.value:'').trim().toLowerCase();
  if(ss) ss.classList.toggle('has-q', q.length>0);
  const sb=document.getElementById('sidebar'); if(!sb)return;
  const searching=q.length>0;
  let anyMatch=false;
  Array.from(sb.children).forEach(el=>{
    if(el.classList.contains('grptitle')){
      el.classList.toggle('search-hidden', searching);     // 搜索时隐藏所有分组标题
    } else if(el.classList.contains('grpbody')){
      const key=el.dataset.groupKey;
      el.classList.toggle('collapsed', !searching && sidebarCollapsed.has(key));
      let bodyHas=false;
      Array.from(el.children).forEach(item=>{
        if(item.classList.contains('ni')){
          const show = !searching || (item.dataset.search||'').includes(q);
          item.classList.toggle('search-hidden', !show);
          if(show){anyMatch=true;bodyHas=true;}
        }
      });
      el.style.display=(!searching||bodyHas)?'':'none';
    } else if(el.classList.contains('ni')){
      const show = !searching || (el.dataset.search||'').includes(q);
      el.classList.toggle('search-hidden', !show);
      if(show && searching) anyMatch=true;
    }
  });
  // 无匹配提示
  let empty=document.getElementById('side-noresult');
  if(searching && !anyMatch){
    if(!empty){empty=document.createElement('div');empty.id='side-noresult';empty.style.cssText='padding:14px;font-size:12px;color:var(--ui-text2);text-align:center;opacity:.8';sb.appendChild(empty);}
    empty.textContent=(lang==='en'?'No matching elements':'没有匹配的元素');empty.style.display='block';
  } else if(empty){ empty.style.display='none'; }
}
function clearDevSearch(){ const inp=document.getElementById('dev-search'); if(inp){inp.value='';inp.focus();} filterSidebar(); }
function makeNI(type,zh,en,badge,customUrl){
  const el=document.createElement('div');el.className='ni';el.draggable=true;el.dataset.type=type;
  el.dataset.search=((zh||'')+' '+(en||'')+' '+(type||'')).toLowerCase();
  el.ondragstart=e=>onDragStart(e,type);
  const dl=lang==='en'?(en||zh):zh;
  const img=document.createElement('img');img.alt=dl;img.className='ni-icon';
  if(customUrl)img.src=customUrl;
  else if(type==='text'){img.src='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><text x="24" y="34" font-size="34" text-anchor="middle" fill="#42a5f5" font-family="serif" font-weight="bold">T</text></svg>');}
  else if(type==='variable'){img.src='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><text x="24" y="20" font-size="17" text-anchor="middle" fill="#9fc0dd" font-family="sans-serif">label</text><text x="24" y="40" font-size="19" text-anchor="middle" fill="#4dd0ff" font-family="sans-serif" font-weight="bold">value</text></svg>');}
  else if(IMGS[type])img.src=IMGS[type].src;
  const txt=document.createElement('div');txt.className='ni-txt';
  txt.innerHTML='<span class="ni-lbl">'+dl+'</span><span class="ni-badge">'+badge+'</span>';
  el.appendChild(img);el.appendChild(txt);return el;
}
function addCustomToSidebar(tk,zh,en,url){
  customIcons.push({type:tk,zh,en,url});
  activeTab='custom';
  buildSidebar();
}
function buildEdgeBar(){
  const bar=document.getElementById('ebar');
  bar.querySelectorAll('.etb').forEach(b=>b.remove()); // 清除旧按钮，避免语言切换时重复
  Object.entries(ET).forEach(([k,v])=>{
    const btn=document.createElement('button');btn.className='etb'+(k===pendingET?' sel':'');btn.id='etb-'+k;
    btn.style.setProperty('--ec',v.color);
    const sw=linePreviewEl(k,30);
    btn.appendChild(sw);btn.appendChild(document.createTextNode(etLabel(k)));btn.onclick=()=>selectET(k);
    bar.insertBefore(btn, document.getElementById('routing-toggle'));
  });
}
function buildSelects(){
  const pt=document.getElementById('p-type'),ep=document.getElementById('ep-type');
  pt.innerHTML='';ep.innerHTML='';
  DEVICE_GROUPS.forEach(g=>g.devices.forEach(d=>{const o=document.createElement('option');o.value=d.type;o.textContent=(lang==='en'?(d.label_en||d.label):d.label);pt.appendChild(o);}));
  const edgeOrder=edgeTypeOrder();
  edgeOrder.forEach(k=>{const v=ET[k]||ET.ac_power;const o=document.createElement('option');o.value=k;o.textContent=etLabel(k);o.style.color=v.color;ep.appendChild(o);});
}
function edgeTypeOrder(){
  const first=['plain','plain_dash'];
  return first.filter(k=>ET[k]).concat(Object.keys(ET).filter(k=>!first.includes(k)));
}
// 生成一个「流动线型」预览元素（颜色/虚实/速度均按该类型）
// 统一的「线型预览」元素：圆角线条（实线/按真实虚线比例的虚线）+ 流动高光。
// 顶部线型按钮与属性面板下拉共用，保证两处线型完全一致。
function linePreviewEl(k, w){
  const v=ET[k]||ET.ac_power;
  const wrap=document.createElement('span');wrap.className='et-prev';
  if(w)wrap.style.width=w+'px';
  const base=document.createElement('span');base.className='et-base';
  if(v.dash&&v.dash.length){
    const d0=v.dash[0]||6, d1=(v.dash[1]!=null?v.dash[1]:d0);
    base.style.background='repeating-linear-gradient(90deg,'+v.color+' 0 '+d0+'px, transparent '+d0+'px '+(d0+d1)+'px)';
    base.style.top='50%'; base.style.bottom='auto'; base.style.height='3px'; base.style.transform='translateY(-50%)';
  } else { base.style.background=v.color; }
  const flow=document.createElement('span');flow.className='et-flow';
  flow.style.animationDuration=Math.max(0.6, 1.6/((v.spd||0.7))).toFixed(2)+'s';
  wrap.appendChild(base);wrap.appendChild(flow);
  return wrap;
}
function epTypePreviewEl(k){ return linePreviewEl(k, 56); }
// 构建下拉列表项（名称 + 右侧流动预览）
function buildEpTypeList(){
  const list=document.getElementById('ep-type-list'); if(!list)return; list.innerHTML='';
  const addSec=(txt)=>{const s=document.createElement('div');s.className='etdd-section';s.textContent=txt;list.appendChild(s);};
  edgeTypeOrder().forEach((k,i)=>{
    if(i===0)addSec(lang==='en'?'Basic line styles':'基础线型');
    if(i===2)addSec(lang==='en'?'Dynamic / semantic types':'动态/语义线型');
    const it=document.createElement('div');it.className='etdd-item';it.dataset.k=k;
    const name=document.createElement('span');name.className='etdd-name';name.textContent=etLabel(k);name.style.color=ET[k].color;
    it.appendChild(name);it.appendChild(epTypePreviewEl(k));
    it.onclick=()=>{ const sel=document.getElementById('ep-type'); sel.value=k; applyEP(); refreshEpTypeBtn(); closeEpTypeDD(); };
    list.appendChild(it);
  });
}
// 刷新已选类型在按钮上的显示（名称 + 流动预览），并高亮列表选中项
function refreshEpTypeBtn(){
  const k=(document.getElementById('ep-type')||{}).value||'ac_power';
  const lbl=document.getElementById('ep-type-btn-label'); if(lbl){lbl.textContent=etLabel(k);lbl.style.color=(ET[k]||ET.ac_power).color;}
  const old=document.getElementById('ep-type-btn-prev');
  if(old){ const nw=epTypePreviewEl(k); nw.id='ep-type-btn-prev'; old.replaceWith(nw); }
  document.querySelectorAll('#ep-type-list .etdd-item').forEach(it=>it.classList.toggle('sel',it.dataset.k===k));
}
function toggleEpTypeDD(ev){ if(ev)ev.stopPropagation(); const l=document.getElementById('ep-type-list'); if(!l)return;
  if(l.classList.contains('show')){ l.classList.remove('show'); }
  else { buildEpTypeList(); refreshEpTypeBtn(); l.classList.add('show');
    const sel=l.querySelector('.etdd-item.sel'); if(sel)sel.scrollIntoView({block:'nearest'}); } }
function closeEpTypeDD(){ const l=document.getElementById('ep-type-list'); if(l)l.classList.remove('show'); }
// 兼容旧调用名
function updateEpTypeSwatch(){ refreshEpTypeBtn(); }
function buildBg(){
  // theme buttons
  const tr=document.getElementById('theme-row');tr.innerHTML='';
  Object.entries(THEMES).forEach(([k,t])=>{
    const b=document.createElement('div');b.className='theme-btn'+(k===curTheme?' active':'');b.id='theme-'+k;
    b.onclick=()=>setTheme(k);
    b.innerHTML='<div class="theme-swatch" style="background:'+t.swatch+'"></div><div><div class="theme-name">'+t.name+'</div><div class="theme-desc">'+t.desc+'</div></div>';
    tr.appendChild(b);
  });
  // bg color presets
  const c=document.getElementById('cps');c.innerHTML='';
  PRESET_BG.forEach((col,i)=>{const el=document.createElement('div');el.className='cp'+(col===bgColor?' active':'');el.style.background=col;el.dataset.color=col;el.title=col;el.onclick=()=>setBg(col);c.appendChild(el);});
}
function setTheme(k){
  curTheme=k;const t=THEMES[k];if(!t)return;
  Object.entries(t.vars).forEach(([v,val])=>document.documentElement.style.setProperty(v,val));
  setBg(t.bg);
  document.querySelectorAll('.theme-btn').forEach(el=>el.classList.toggle('active',el.id==='theme-'+k));
}
function selectET(k){pendingET=k;document.querySelectorAll('.etb').forEach(b=>b.classList.remove('sel'));const b=document.getElementById('etb-'+k);if(b){b.classList.add('sel');b.style.setProperty('--ec',ET[k].color);}document.getElementById('ehint').textContent='连线['+ET[k].label+']：点击起始节点…';}
function setRouting(r){pendingRoute=r;['smart','arc'].forEach(x=>{const b=document.getElementById('rt-'+x);if(b)b.classList.toggle('sel',r===x);});}
let globalWidth=1;
function setGlobalWidth(v){globalWidth=parseFloat(v);document.getElementById('global-w-v').textContent=globalWidth.toFixed(1)+'×';}

