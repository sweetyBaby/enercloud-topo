// Topology editor runtime and UI logic.
const DEVICE_GROUPS=[{"title": "电源侧", "title_en": "Power Source", "color": "#4dd0ff", "tab": "device", "devices": [{"type": "grid", "label": "主电网", "label_en": "Grid", "badge": "grid"}, {"type": "solar", "label": "光伏板", "label_en": "PV Panel", "badge": "solar"}, {"type": "generator", "label": "发电机", "label_en": "Generator", "badge": "generator"}]}, {"title": "储能设备", "title_en": "Storage", "color": "#2ecc71", "tab": "device", "devices": [{"type": "pcs", "label": "变流器PCS", "label_en": "PCS", "badge": "pcs"}, {"type": "bms", "label": "电池BMS", "label_en": "Battery BMS", "badge": "bms"}, {"type": "cabinet", "label": "电池柜", "label_en": "Battery Rack", "badge": "cabinet"}, {"type": "h2_storage", "label": "氢储能", "label_en": "H2 Storage", "badge": "h2_storage"}]}, {"title": "电气设备", "title_en": "Electrical", "color": "#e67e22", "tab": "device", "devices": [{"type": "transformer", "label": "变压器", "label_en": "Transformer", "badge": "transformer"}, {"type": "switch", "label": "断路器", "label_en": "Breaker", "badge": "switch"}, {"type": "highvolt", "label": "高压箱", "label_en": "HV Box", "badge": "highvolt"}]}, {"title": "开关元件", "title_en": "Switching", "color": "#ff6b60", "tab": "device", "devices": [{"type": "cb_closed", "label": "断路器(闭合)", "label_en": "Breaker (closed)", "badge": "cb_closed"}, {"type": "switch_open", "label": "隔离开关(断开)", "label_en": "Switch (open)", "badge": "switch_open"}, {"type": "disconnector", "label": "刀闸(合闸)", "label_en": "Disconnector", "badge": "disconnector"}, {"type": "contactor", "label": "接触器", "label_en": "Contactor", "badge": "contactor"}, {"type": "fuse", "label": "熔断器", "label_en": "Fuse", "badge": "fuse"}, {"type": "iso_g", "label": "隔离开关", "label_en": "Isolator", "badge": "iso_g"}, {"type": "lbs_g", "label": "负荷开关", "label_en": "Load Switch", "badge": "lbs_g"}, {"type": "disc_v_g", "label": "竖向刀闸", "label_en": "Vert. Disconnector", "badge": "disc_v_g"}]}, {"title": "无源元件", "title_en": "Passive", "color": "#5dade2", "tab": "device", "devices": [{"type": "resistor", "label": "电阻", "label_en": "Resistor", "badge": "resistor"}, {"type": "inductor", "label": "电感", "label_en": "Inductor", "badge": "inductor"}, {"type": "capacitor", "label": "电容", "label_en": "Capacitor", "badge": "capacitor"}, {"type": "ct", "label": "电流互感器", "label_en": "CT", "badge": "ct"}, {"type": "pt", "label": "电压互感器", "label_en": "PT", "badge": "pt"}, {"type": "spd", "label": "避雷器", "label_en": "SPD", "badge": "spd"}, {"type": "ground", "label": "接地", "label_en": "Ground", "badge": "ground"}]}, {"title": "计量与负载", "title_en": "Meter & Load", "color": "#f1c40f", "tab": "device", "devices": [{"type": "meter", "label": "计量表", "label_en": "Meter", "badge": "meter"}, {"type": "meter2", "label": "关口表", "label_en": "Gateway Meter", "badge": "meter2"}, {"type": "load", "label": "用电负载", "label_en": "Load", "badge": "load"}, {"type": "charger", "label": "充电桩", "label_en": "EV Charger", "badge": "charger"}]}, {"title": "辅助系统", "title_en": "Auxiliary", "color": "#9b59b6", "tab": "device", "devices": [{"type": "ems", "label": "EMS系统", "label_en": "EMS", "badge": "ems"}, {"type": "aircon", "label": "空调", "label_en": "HVAC", "badge": "aircon"}, {"type": "fire", "label": "消防", "label_en": "Fire Sys", "badge": "fire"}, {"type": "sensor", "label": "传感器", "label_en": "Sensor", "badge": "sensor"}]}, {"title": "母线/主干线", "title_en": "Busbar & Trunk", "color": "#ff6b6b", "tab": "device", "devices": [{"type": "busbar", "label": "母线", "label_en": "Busbar", "badge": "busbar"}, {"type": "trunk_ac", "label": "交流主干线", "label_en": "AC Trunk", "badge": "busbar"}, {"type": "trunk_dc", "label": "直流主干线", "label_en": "DC Trunk", "badge": "busbar"}, {"type": "tie_line", "label": "联络线", "label_en": "Tie Line", "badge": "busbar"}]}, {"title": "辅助元素", "title_en": "Auxiliary", "color": "#42a5f5", "tab": "annot", "devices": [{"type": "text", "label": "文本框", "label_en": "Text", "badge": "text"}]}], NODE_DEFAULTS={"grid": {"data": ["P(kW)", "Q(kvar)"]}, "solar": {"data": ["P(kW)", "Vpv(V)"]}, "generator": {"data": ["P(kW)", "频率(Hz)"]}, "pcs": {"data": ["P(kW)", "Q(kvar)", "I(A)", "U(V)"]}, "bms": {"data": ["U(V)", "I(A)", "SOC(%)", "温度(℃)"]}, "cabinet": {"data": ["簇电压(V)", "簇电流(A)", "SOC(%)", "温度(℃)", "状态"]}, "transformer": {"data": ["输入电压(V)", "输出电压(V)"]}, "switch": {"data": ["状态"]}, "highvolt": {"data": ["直流电压(V)", "直流电流(A)"]}, "busbar": {"data": ["母线电压(V)"]}, "trunk_ac": {"data": ["电压(V)", "电流(A)"]}, "trunk_dc": {"data": ["电压(V)", "电流(A)"]}, "tie_line": {"data": ["P(kW)"]}, "meter": {"data": ["P(kW)", "Q(kvar)"]}, "meter2": {"data": ["P(kW)", "Q(kvar)", "今日用电(kWh)"]}, "load": {"data": ["负载功率(kW)", "今日用电(kWh)"]}, "charger": {"data": ["功率(kW)", "状态"]}, "ems": {"data": ["运行模式", "状态"]}, "aircon": {"data": ["温度(℃)", "状态"]}, "fire": {"data": ["状态", "告警"]}, "sensor": {"data": ["数值", "单位"]}, "cb_closed": {"data": ["状态", "电流(A)"]}, "switch_open": {"data": ["状态"]}, "disconnector": {"data": ["状态"]}, "contactor": {"data": ["状态"]}, "fuse": {"data": ["额定电流(A)"]}, "resistor": {"data": ["阻值(Ω)"]}, "inductor": {"data": ["电感(mH)"]}, "capacitor": {"data": ["容值(μF)"]}, "ct": {"data": ["变比", "二次电流(A)"]}, "pt": {"data": ["变比", "二次电压(V)"]}, "spd": {"data": ["状态"]}, "ground": {"data": []}, "h2_storage": {"data": ["压力(MPa)", "SOC(%)", "温度(℃)"]}, "iso_g": {"data": ["状态"]}, "lbs_g": {"data": ["状态"]}, "disc_v_g": {"data": ["状态"]}}, PRESET_BG=["#060e1a", "#0a2040", "#102a52", "#0d1b2a", "#1a1a2e", "#0a1a14", "#10240f", "#1a1000", "#2a0a0a", "#160020", "#2b2118", "#1a2630", "#23252b", "#2b1a2a", "#0f2a2a", "#3a2a1a", "#2a1a3a", "#1a3a2a", "#3a1a2a", "#1f1f0a", "#ffffff", "#f0f3f8", "#eaeef4", "#fdf6e3", "#f5eef5", "#e8f4f0", "#fff4e6", "#eef2ff", "#f0fff4", "#fff0f0", "#fef0f5", "#f0f9ff", "#fffbe8", "#f3f0ff", "#eafaf1"], DATA_LABEL_EN={"P(kW)": "P(kW)", "Q(kvar)": "Q(kvar)", "I(A)": "I(A)", "U(V)": "U(V)", "Vpv(V)": "Vpv(V)", "频率(Hz)": "Freq(Hz)", "SOC(%)": "SOC(%)", "温度(℃)": "Temp(℃)", "簇电压(V)": "Cluster V(V)", "簇电流(A)": "Cluster I(A)", "状态": "Status", "输入电压(V)": "Vin(V)", "输出电压(V)": "Vout(V)", "直流电压(V)": "DC V(V)", "直流电流(A)": "DC I(A)", "母线电压(V)": "Bus V(V)", "今日用电(kWh)": "Today(kWh)", "负载功率(kW)": "Load(kW)", "功率(kW)": "Power(kW)", "运行模式": "Mode", "告警": "Alarm", "数值": "Value", "单位": "Unit", "电流(A)": "I(A)", "额定电流(A)": "Rated I(A)", "阻值(Ω)": "R(Ω)", "电感(mH)": "L(mH)", "容值(μF)": "C(μF)", "变比": "Ratio", "二次电流(A)": "Sec I(A)", "二次电压(V)": "Sec V(V)", "电压(V)": "U(V)"}, STATUS_EN={"待机": "Standby", "充电": "Charging", "放电": "Discharging", "发电": "Generating", "在线": "Online", "离线": "Offline", "备用": "Standby", "运行": "Running", "停机": "Stopped", "并网运行": "Grid-tied", "离网运行": "Off-grid", "闭合": "Closed", "断开": "Open", "故障": "Fault", "告警": "Alarm", "正常": "Normal", "充电中": "Charging", "放电中": "Discharging"};
let lang='zh';
const THEMES={
  blue_screen:{name:'蓝色大屏风',desc:'默认 · 指挥中心亮蓝',swatch:'#102a52',vars:{'--ui-bg':'#102a52','--ui-bg2':'#0c2245','--ui-border':'#2a5a9a','--ui-text':'#e8f2ff','--ui-text2':'#a0c0e0','--ui-accent':'#42a5f5','--ui-btn-bg':'#143560','--ui-btn-border':'#2a5a9a','--ui-btn-text':'#bcdcff','--ui-input-bg':'#0a1f40','--ui-hover':'#1a3f70'},bg:'#0a1f40'},
  tech_dark:{name:'深色科技风',desc:'深蓝霓虹',swatch:'#0d1a2e',vars:{'--ui-bg':'#0d1a2e','--ui-bg2':'#0a1628','--ui-border':'#1a3a5c','--ui-text':'#d8e4f0','--ui-text2':'#8aa8c4','--ui-accent':'#4dd0ff','--ui-btn-bg':'#0a1a30','--ui-btn-border':'#1e4a70','--ui-btn-text':'#a8cce8','--ui-input-bg':'#060e1a','--ui-hover':'#142030'},bg:'#060e1a'},
  light:{name:'浅色商务风',desc:'白底 · 简洁专业',swatch:'#f0f3f8',vars:{'--ui-bg':'#ffffff','--ui-bg2':'#f4f7fb','--ui-border':'#d0d8e4','--ui-text':'#2a3548','--ui-text2':'#6a7689','--ui-accent':'#2274d4','--ui-btn-bg':'#eef2f8','--ui-btn-border':'#cdd6e4','--ui-btn-text':'#33425a','--ui-input-bg':'#ffffff','--ui-hover':'#e6edf6'},bg:'#eaeef4'},
  green_eye:{name:'豆沙绿护眼',desc:'浅绿 · 经典护眼底色',swatch:'#cce8cf',vars:{'--ui-bg':'#e8f3e9','--ui-bg2':'#dceadd','--ui-border':'#b0ccb2','--ui-text':'#2a3e2c','--ui-text2':'#5a7a5c','--ui-accent':'#2e8b57','--ui-btn-bg':'#d6e8d8','--ui-btn-border':'#aaccac','--ui-btn-text':'#345a38','--ui-input-bg':'#f0f8f1','--ui-hover':'#cfe4d0'},bg:'#cfe8d2'},
  dark_eye:{name:'暖色护眼',desc:'暗色 · 低蓝光暖调',swatch:'#2b2418',vars:{'--ui-bg':'#2b2418','--ui-bg2':'#241e14','--ui-border':'#4a4030','--ui-text':'#e8dcc0','--ui-text2':'#b0a484','--ui-accent':'#e0b060','--ui-btn-bg':'#332b1c','--ui-btn-border':'#4a4030','--ui-btn-text':'#d8c8a0','--ui-input-bg':'#1f1a10','--ui-hover':'#3a3022'},bg:'#1c1810'},
};
let curTheme='blue_screen';
const ET={
  plain:   {label:'普通直线',   labelEn:'Plain Line', color:'#d8e4f0',w:2,  dash:[],    anim:'none',     spd:0,  desc:'普通静态实线'},
  plain_dash:{label:'普通虚线', labelEn:'Plain Dashed', color:'#d8e4f0',w:2,  dash:[7,6], anim:'none',     spd:0,  desc:'普通静态虚线'},
  ac_power: {label:'交流电力', labelEn:'AC Power', color:'#e74c3c',w:2.5,dash:[],    anim:'flow',     spd:.5, desc:'电网交流传输，红色流动'},
  dc_power: {label:'直流电力', labelEn:'DC Power', color:'#e67e22',w:2.5,dash:[],    anim:'flow',     spd:.5, desc:'直流母线传输'},
  pipe_blue:{label:'蓝光管道', labelEn:'Blue Pipe', color:'#3aa0ff',w:2.5,dash:[],    anim:'pipe',     spd:.7, desc:'母线管道，蓝色光点流动'},
  pipe_gold:{label:'金光管道', labelEn:'Gold Pipe', color:'#f5c518',w:2.5,dash:[],    anim:'pipe',     spd:.7, desc:'高亮管道，金色光点流动'},
  charge:   {label:'充电中',   labelEn:'Charging', color:'#2ecc71',w:2.5,dash:[],    anim:'flow',     spd:.9, desc:'充电，绿色快流'},
  discharge:{label:'放电中',   labelEn:'Discharging', color:'#3498db',w:2.5,dash:[],    anim:'flow',     spd:.9, desc:'放电，蓝色快流'},
  busbar:   {label:'母线汇流', labelEn:'Busbar', color:'#4dd0ff',w:3.5,dash:[],    anim:'glow',     spd:.3, desc:'母线/汇流排，较粗实线'},
  standby:  {label:'待机',     labelEn:'Standby', color:'#f1c40f',w:2,  dash:[5,5], anim:'pulse',    spd:.2, desc:'待机，慢速脉冲'},
  comm:     {label:'通信线',   labelEn:'Comm Line', color:'#9b59b6',w:1.5,dash:[4,4], anim:'dash',     spd:1.2,desc:'通信/控制信号'},
  pv_power: {label:'光伏出力', labelEn:'PV Output', color:'#f9ca24',w:2.5,dash:[],    anim:'flow',     spd:.6, desc:'光伏直流出力'},
  fault:    {label:'故障告警', labelEn:'Fault Alarm', color:'#ff3333',w:2.5,dash:[4,4], anim:'alarm',    spd:2.0,desc:'故障/告警，急闪'},
  disabled: {label:'断路',     labelEn:'Open Circuit', color:'#445566',w:2,  dash:[8,8], anim:'none',     spd:0,  desc:'断路/停用'},
  neutral:  {label:'接地线',   labelEn:'Ground', color:'#888888',w:1.5,dash:[3,5], anim:'none',     spd:0,  desc:'中性/接地线'},
};
function etLabel(k){ const e=ET[k]; return lang==='en'?(e.labelEn||e.label):e.label; }

/* ───── 占位锚点(anchor)：最基础的占位元素。默认在画布上不显示名称与数据字段，
   但属性(标签/字段)依然保留，可在属性面板随时打开显示。归入「辅助元素」分类。 ───── */
IMG_DATA.anchor='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="12" fill="none" stroke="#4dd0ff" stroke-width="2" opacity="0.45"/><circle cx="24" cy="24" r="6" fill="#4dd0ff"/></svg>');
/* ───── 母线/主干线：原来交流主干线/直流主干线/联络线都复用母线图标，无法区分。
   这里给出语义化的独立图标：交流(~ 正弦)、直流(⎓ 实线+虚线)、联络线(两端环相连)。 ───── */
IMG_DATA.trunk_ac='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="6" y="29" width="36" height="5" rx="2.5" fill="#ff8a5b"/><path d="M9 18 q3.75 -9 7.5 0 t7.5 0 t7.5 0 t3.5 0" fill="none" stroke="#ff8a5b" stroke-width="3" stroke-linecap="round"/></svg>');
IMG_DATA.trunk_dc='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="6" y="29" width="36" height="5" rx="2.5" fill="#4dd0ff"/><line x1="12" y1="15" x2="36" y2="15" stroke="#4dd0ff" stroke-width="3" stroke-linecap="round"/><line x1="16" y1="22" x2="32" y2="22" stroke="#4dd0ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 4"/></svg>');
IMG_DATA.tie_line='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><line x1="13" y1="24" x2="35" y2="24" stroke="#c39bd3" stroke-width="3"/><circle cx="11" cy="24" r="5.5" fill="none" stroke="#c39bd3" stroke-width="3"/><circle cx="37" cy="24" r="5.5" fill="none" stroke="#c39bd3" stroke-width="3"/></svg>');
// 把占位点放进「辅助元素(annot)」分组
(function(){const g=DEVICE_GROUPS.find(x=>(x.tab||'')==='annot');
  if(g)g.devices.unshift({type:'anchor',label:'占位点',label_en:'Anchor Point',badge:'point'});})();
// 分类顺序：常用优先（电源/储能/母线/电气/计量负载 在前，其余其后）
(function(){const order=['电源侧','储能设备','母线/主干线','电气设备','计量与负载','开关元件','辅助系统','无源元件','辅助元素'];
  DEVICE_GROUPS.sort((a,b)=>{const ia=order.indexOf(a.title),ib=order.indexOf(b.title);return (ia<0?999:ia)-(ib<0?999:ib);});})();
let imgLoaded=0,imgTotal=Object.keys(IMG_DATA).length;
Object.entries(IMG_DATA).forEach(([k,src])=>{const i=new Image();i.src=src;i.onload=i.onerror=()=>{IMGS[k]=i;if(++imgLoaded>=imgTotal){['trunk_ac','trunk_dc','tie_line'].forEach(t=>{if(IMGS.busbar&&!IMGS[t])IMGS[t]=IMGS.busbar;});init();}};});
const CUSTOM_ICONS={},CUSTOM_LABELS={};let pendingDataURL=null;

let nodes=[],edges=[],selNode=null,selEdge=null;
let edgeMode=false,edgeFrom=null,edgeFromPort=null,edgeWaypoints=[],pendingET='ac_power',pendingRoute='smart',mouseWX=null,mouseWY=null,selectMode=false;
let dragNode=null,dox=0,doy=0,panX=0,panY=0,zoom=1,isPanning=false,panSX=0,panSY=0;
let dragChip=null,dchox=0,dchoy=0,dragWaypoint=null,dragBus=null,dragResize=null,dragGroupScale=null,_groupBox=null,dragRotate=null,_hud=null,dragChipGroup=null,dragEndpoint=null;
let selSet=new Set(),selChips=new Set(),rubber=null,_groupDrag=false,_groupStart={},alignGuides=[],_overlapHandles=[]; // 多选集合 + 选中字段 + 框选矩形 + 对齐辅助线 + 重叠线拐点浅色手柄
let ids={},animT=0,ctxTgt=null,ctxKind=null,bgColor='#0a1f40',showGrid=true,showEdgeLabels=true,showFieldChips=true,showAnchors=true,busMerge=true,busMergeGap=16,busTrunkBold=true,busStyle='busbar',busOffsets={},busShareTrunk=false,busShowHandles=false,routeStyle=3,busAggregation=false;
let history=[],histIdx=-1;
let suppressNodeActionClick=false;
// ★ 数据驱动（动态显隐/流向）：规则随信号实时求值并自动生效；面板开关与「运行视图」互相独立
// previewMode=运行视图（彻底隐藏被规则隐藏的元素）；panelOpen=「规则与信号」侧栏是否展开；
// _drawAlpha=当前绘制透明度（编辑态把被规则隐藏的元素「虚化」仍可点选编辑）
let previewMode=false,panelOpen=false,_drawAlpha=1,signalValues={},injRows=[],customSignals=[],_dyn={hiddenNodes:new Set(),hiddenEdges:new Set(),dirMap:new Map()};
let injCollapsed=new Set(),_injInited=false;   // 注入信号卡片手风琴：折叠的元素键集合 + 「默认首张展开」是否已初始化
let injDraft=null;   // 新增注入草稿（元素/字段/值）；点 ✓ 确认后才并入 injRows 卡片列表，避免选元素即跳转
const GHOST_A=0.16,GHOST_SEL=0.5; // 虚化透明度：普通/选中
let _ruleHovering=false,_ruleHoverPrev=null;   // 规则总览悬停高亮：是否正在悬停、进入列表前的选中态
let sidebarCollapsed=new Set();                // 左侧元素分类折叠状态（按 tab + 分类标题记忆）
let sidebarAccInited=new Set();                // 每个 tab 首次进入时：默认首组展开，其余折叠
const DRAFT_KEY='topology-editor-local-draft-v1';
let draftReady=false,draftTimer=null,loadingDraft=false;
function genId(t){ids[t]=(ids[t]||0)+1;return t+'_'+ids[t];}

function snapshot(){const s=JSON.stringify({nodes,edges,bgColor,routeStyle});history=history.slice(0,histIdx+1);history.push(s);if(history.length>21)history.shift();histIdx=history.length-1;updUR();if(draftReady&&!loadingDraft)scheduleDraftSave();}
function undo(){if(histIdx<=0)return;histIdx--;const s=JSON.parse(history[histIdx]);nodes=s.nodes;edges=s.edges;if(s.bgColor!==undefined)bgColor=s.bgColor;if(s.routeStyle!==undefined)routeStyle=s.routeStyle;selNode=selEdge=null;selSet.clear();selChips.clear();updateAlignBar();showPanel('none');_pathCacheSig='';updUR();}
function redo(){if(histIdx>=history.length-1)return;histIdx++;const s=JSON.parse(history[histIdx]);nodes=s.nodes;edges=s.edges;if(s.bgColor!==undefined)bgColor=s.bgColor;if(s.routeStyle!==undefined)routeStyle=s.routeStyle;selNode=selEdge=null;selSet.clear();selChips.clear();updateAlignBar();showPanel('none');_pathCacheSig='';updUR();}
function updUR(){document.getElementById('btn-undo').disabled=histIdx<=0;document.getElementById('btn-redo').disabled=histIdx>=history.length-1;}
function scheduleDraftSave(){
  if(loadingDraft)return;
  clearTimeout(draftTimer);
  draftTimer=setTimeout(saveDraftNow,260);
}
function saveDraftNow(){
  if(loadingDraft)return false;
  try{
    localStorage.setItem(DRAFT_KEY,buildJSON());
    localStorage.setItem(DRAFT_KEY+':time',new Date().toISOString());
    return true;
  }catch(err){console.warn('save draft failed',err);return false;}
}
function restoreDraft(opts){
  const silent=!!(opts&&opts.silent);
  let raw=null;
  try{raw=localStorage.getItem(DRAFT_KEY);}catch(err){return false;}
  if(!raw)return false;
  let obj;
  try{obj=JSON.parse(raw);}catch(err){if(!silent)flashHint('本地草稿已损坏');return false;}
  if(!obj||!Array.isArray(obj.nodes)){if(!silent)flashHint('本地草稿不是有效画布');return false;}
  loadingDraft=true;
  Promise.resolve(importCanvasJSON(obj)).then(()=>{
    if(!silent)flashHint('已恢复本地草稿');
  }).catch(err=>{
    console.warn('restore draft failed',err);
    if(!silent)flashHint('恢复草稿失败');
  }).finally(()=>{loadingDraft=false;});
  return true;
}
function restoreDraftManual(){ if(!restoreDraft({silent:false}))flashHint('暂无本地草稿'); }
function clearDraft(){
  try{localStorage.removeItem(DRAFT_KEY);localStorage.removeItem(DRAFT_KEY+':time');}catch(err){}
  flashHint('本地草稿已清除');
}

function init(){buildSidebar();buildEdgeBar();buildSelects();buildBg();resizeCanvas();snapshot();
  const _rt=topoRuntimeConfig();
  if(_rt){ enterRuntimeMode(_rt); }            // ★ 运营端配置好后，前端以「只读运行模式」用同一份渲染器+规则渲染（动态拉 JSON/实时数据）
  else { if(!restoreDraft({silent:true}))loadDefaultTemplate(); draftReady=true; scheduleDraftSave(); }
  document.addEventListener('input',()=>{if(draftReady&&!loadingDraft)scheduleDraftSave();});
  document.addEventListener('change',()=>{if(draftReady&&!loadingDraft)scheduleDraftSave();});
  requestAnimationFrame(loop);
  // 拖动提示 6 秒后淡出
  setTimeout(()=>{const ph=document.getElementById('pan-hint');if(ph)ph.style.opacity='0';},6000);
}

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

const canvas=document.getElementById('c'),ctx=canvas.getContext('2d'),cwrap=document.getElementById('cwrap');
function resizeCanvas(){canvas.width=cwrap.clientWidth;canvas.height=cwrap.clientHeight;}
// 折叠/展开左右侧面板，给画布更多空间；过渡期间持续重算画布尺寸
function togglePanel(side){
  const el=document.getElementById(side==='left'?'sidebar-wrap':'props');
  const btn=document.getElementById(side==='left'?'left-toggle':'right-toggle');
  const collapsed=el.classList.toggle('collapsed');
  if(side==='left') btn.textContent = collapsed?'▶':'◀';
  else              btn.textContent = collapsed?'◀':'▶';
  const t0=performance.now();
  (function tick(){ resizeCanvas(); if(performance.now()-t0<280) requestAnimationFrame(tick); })();
}
function ensurePropsOpen(){
  const el=document.getElementById('props'),btn=document.getElementById('right-toggle');
  if(!el||!el.classList.contains('collapsed'))return;
  el.classList.remove('collapsed');
  if(btn)btn.textContent='▶';
  const t0=performance.now();
  (function tick(){ resizeCanvas(); if(performance.now()-t0<280) requestAnimationFrame(tick); })();
}
window.addEventListener('resize',()=>resizeCanvas());
function toWorld(sx,sy){return [(sx-panX)/zoom,(sy-panY)/zoom];}

cwrap.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;const[wx,wy]=toWorld(mx,my);const f=e.deltaY<0?1.12:1/1.12;zoom=Math.max(.1,Math.min(5,zoom*f));panX=mx-wx*zoom;panY=my-wy*zoom;document.getElementById('zoom-info').textContent=Math.round(zoom*100)+'%';},{passive:false});
function resetZoom(){zoom=1;panX=0;panY=0;document.getElementById('zoom-info').textContent='100%';}
function zoomStep(factor){
  const mx=canvas.width/2,my=canvas.height/2;
  const wx=(mx-panX)/zoom,wy=(my-panY)/zoom;
  zoom=Math.max(.1,Math.min(5,zoom*factor));
  panX=mx-wx*zoom;panY=my-wy*zoom;
  document.getElementById('zoom-info').textContent=Math.round(zoom*100)+'%';
}
function toggleGrid(){showGrid=!showGrid;}
function toggleEdgeLabels(){showEdgeLabels=!showEdgeLabels;}
function toggleFieldChips(){showFieldChips=!showFieldChips;}
function toggleAnchors(){showAnchors=!showAnchors;}
function toggleBusMerge(){busMerge=!busMerge;_pathCacheSig='';}
// 完整中英文对照表（界面静态文案）
const I18N={
  '⚙ 规则与信号':'⚙ Rules & Signals',
  '▶ 预览效果':'▶ Preview','■ 退出预览':'■ Exit Preview',
  '运行视图（彻底隐藏被规则隐藏者）':'Run view (fully hide rule-hidden items)',
  '规则随信号实时生效：编辑态被隐藏的元素/连线会「虚化」显示，仍可点选并编辑；勾选「运行视图」可预览真实显隐效果。':'Rules apply live as signals change: in edit mode, hidden elements/edges are dimmed but still selectable & editable; tick "Run view" to preview the real show/hide result.',
  '全局信号':'Global Signals',
  '（添加后画布上所有元素/连线的规则均可引用，随图导出）':'(once added, any element/edge rule can reference it; exported with the diagram)',
  '数值':'Number','布尔':'Boolean','枚举':'Enum','文本':'Text',
  '（仅查看；新增/修改请选中元素或连线，在右侧属性面板里设置）':'(view only; to add/edit, select an element or edge and set it in the property panel)',
  '注入信号（测试）':'Inject Signals (test)',
  '（临时覆盖某信号的值，验证规则；不填用当前值）':'(temporarily override a signal value to verify rules; blank = current value)',
  '⚡ 储能拓扑编辑器':'⚡ Energy Storage Topology Editor','储能拓扑编辑器':'Energy Storage Topology Editor',
  '历史':'History','↩ 撤销':'↩ Undo','↪ 重做':'↪ Redo',
  '模式':'Mode','⬚ 选择模式':'⬚ Select','🔗 连线模式':'🔗 Connect',
  '布局与连线':'Layout & Wiring','✨ 自动布局':'✨ Auto Layout','🚌 母线汇流':'🚌 Bus Merge','连线风格':'Wire Style',
  '🤖 智能':'🤖 Smart','➖ 直连':'➖ Direct','⊞ 正交':'⊞ Ortho','⊘ 清空':'⊘ Clear',
  '视图与文件':'View & File','👁 视图 ▾':'👁 View ▾','⊙ 缩放复位 100%':'⊙ Reset Zoom 100%',
  '🎨 外观与主题':'🎨 Appearance & Theme','▦ 网格':'▦ Grid','🏷 全部线标签':'🏷 All Line Labels','📊 数据字段':'📊 Data Fields',
  '📍 占位点标记':'📍 Anchor Markers','占位点填充色':'Anchor Fill','透明':'Clear',
  '📁 文件 ▾':'📁 File ▾','📂 打开示例模板':'📂 Open Templates','📥 导入画布 JSON':'📥 Import Canvas JSON','⎙ 导出画布 JSON':'⎙ Export Canvas JSON',
  '💾 保存草稿':'💾 Save Draft','↺ 恢复草稿':'↺ Restore Draft','🧹 清除草稿':'🧹 Clear Draft',
  '▶ 数据预览':'▶ Data Preview','▶ 数据预览（注入信号）':'▶ Data Preview (inject signals)',
  '显示条件（数据驱动）':'Show condition (data-driven)','流向规则（数据驱动）':'Direction rules (data-driven)','编辑':'Edit',
  '流向（按规则确定）':'Flow (set by rules)','固定流向（兜底）':'Fixed direction (fallback)',
  '按信号实时匹配规则确定流向；规则都不命中时用下面的固定流向':'Direction is matched live from signal rules; falls back to the fixed direction below when no rule matches',
  '条件不满足→不画此连线（适合"动态建立的连线"）':'If condition fails → edge is not drawn (use for "dynamically created links")',
  '清空条件':'Clear','取消':'Cancel','保存':'Save','+ 信号':'+ Signal','应用JSON':'Apply JSON','清空注入':'Reset',
  '分组':'Groups','全部展开':'Expand all','全部折叠':'Collapse all','＋ 全部展开':'+ Expand all','－ 全部折叠':'- Collapse all','▼ 全部展开':'▼ Expand all','▶ 全部折叠':'▶ Collapse all','▾ 全部展开':'▾ Expand all','▸ 全部折叠':'▸ Collapse all',
  '注入信号':'Inject Signals','（覆盖预览数据；不填用静态值）':'(override preview values; blank = static)','自定义全局信号':'Custom Global Signals',
  '（规则可引用，随图导出）':'(usable in rules, exported with the diagram)','批量样例 JSON':'Bulk Sample JSON','+ 添加注入':'+ Add Injection',
  '规则总览':'Rules Overview','（元素/连线的显隐与流向规则，与属性面板同步）':'(show/direction rules for nodes & edges, synced with the property panel)',
  '+ 规则':'+ Rule','（一次性设置多个信号的值）':'(set many signal values at once)','填入当前':'Fill Current',
  '粘贴 {信号名:值} 批量覆盖注入；点「填入当前」生成模板再改。':'Paste {signal:value} to bulk-override injections; click "Fill Current" to generate a template, then edit.',
  '🗂 导出元素库包 (ZIP)':'🗂 Export Element Library Pack (ZIP)','🗂 元素库包(ZIP)':'🗂 Library Pack (ZIP)','⬇ 下载画布JSON':'⬇ Download Canvas JSON','📋 画布 JSON':'📋 Canvas JSON',
  '画布显示':'Canvas Display','显示名称':'Show Name','显示文本':'Show Text','显示数据字段':'Show Data Fields',
  '批量(所选元素)':'Batch (selected)','隐藏名称':'Hide Name','显示字段':'Show Fields','隐藏字段':'Hide Fields','⊘ 取消选择':'⊘ Deselect',
  '语言':'Language',
  '线型：':'Line:','走线：':'Route:','直线':'Straight','L型折线':'L-Bend','弧线':'Arc','粗细：':'Width:',
  '⫷ 左':'⫷ Left','⊟ 水平居中':'⊟ H-Center','右 ⫸':'Right ⫸','⊤ 顶':'⊤ Top','⊞ 垂直居中':'⊞ V-Center','底 ⊥':'Bottom ⊥',
  '↔ 水平分布':'↔ H-Distribute','↕ 垂直分布':'↕ V-Distribute','↔ 边缘分布':'↔ H-Edge Dist','↕ 边缘分布':'↕ V-Edge Dist',
  '间距':'Gap','↔ 水平间距':'↔ H-Spacing','↕ 垂直间距':'↕ V-Spacing','⚍ 排成一行':'⚍ Into Row','⚌ 排成一列':'⚌ Into Column',
  '⊞ 矩阵':'⊞ Matrix','⊡ 画布水平居中':'⊡ Canvas H-Center','⊡ 画布垂直居中':'⊡ Canvas V-Center','✕ 取消':'✕ Cancel',
  '属性面板':'Properties','未选中':'Nothing selected','点击节点或连线编辑':'Click a node or edge to edit',
  '💡 快捷键':'💡 Shortcuts','Del删除 · Ctrl+Z撤销':'Del · Ctrl+Z Undo','Ctrl+Y重做 · 滚轮缩放':'Ctrl+Y Redo · Scroll Zoom','中键/空格拖拽平移':'Middle/Space Drag Pan',
  '节点 ID':'Node ID','中文标签':'Chinese Label','English Label':'English Label','类型':'Type',
  '事件绑定':'Action Binding','不绑定':'None','左键点击':'Left Click','右键点击':'Right Click','双击':'Double Click','当前页':'Same Page','新窗口':'New Window',
  '预览/运行态触发；URL 可填写前端路由路径，如 /station/detail?id=1。':'Triggers in preview/runtime mode; URL can be a frontend route, e.g. /station/detail?id=1.',
  '图标大小':'Icon Size','旋转':'Rotation','归零':'Reset','标签字号':'Label Font Size','标签颜色':'Label Color',
  '背景填充':'Background','无':'None','边框样式':'Border Style','无边框':'No Border','实线':'Solid','虚线':'Dashed','边框颜色':'Border Color','圆角':'Radius',
  '数据字段':'Data Fields','中文字段名':'Chinese Name','英文字段名':'English Name','数值':'Value','+ 添加字段':'+ Add Field',
  '🔗 连线属性':'🔗 Edge Properties','连线类型':'Edge Type','走线方式':'Routing','智能（最短·自动避障）':'Smart (shortest, auto-avoid)','直线':'Straight','直线走线':'Straight Line','L型折线（推荐·自动避障）':'L-Bend (recommended)',
  '手动拐点':'Manual','拐点强制横平竖直（正交）':'Force orthogonal waypoints','流向':'Flow',
  '正向 →':'Forward →','反向 ←':'Reverse ←','双向 ↔':'Both ↔','无流向':'None',
  '标签（可选）':'Label (optional)','单独显示本条连线标签':'Show this edge label',
  '线条粗细':'Line Width','✕ 删除此连线':'✕ Delete Edge',
  '📋 拓扑 JSON':'📋 Topology JSON','📋 复制JSON':'📋 Copy JSON','⬇ 下载JSON':'⬇ Download JSON','🖼 下载图标包(ZIP)':'🖼 Download Icons (ZIP)','✕ 关闭':'✕ Close',
  '母线汇流排（带端帽）':'Busbar (with caps)',
  '加粗实线':'Bold Solid',
  '双线母线':'Double Line',
  '发光母线':'Glow Busbar',
  '无边框':'No Border',
  '实线':'Solid',
  '虚线':'Dashed',
  '弧线':'Arc',
  '手动拐点':'Manual',
  'L型折线（推荐·自动避障）':'L-Bend (auto-avoid)',
  '正向 →':'Forward →',
  '反向 ←':'Reverse ←',
  '双向 ↔':'Both ↔',
  '无流向':'No Flow',
  '普通模式':'Normal'
};
function tr(zh){ return lang==='en' ? (I18N[zh]||zh) : zh; }
function applyLang(){
  const en=lang==='en';
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const zh=el.getAttribute('data-i18n');
    el.textContent = en ? (I18N[zh]||zh) : zh;
  });
  // 分组标题、按钮等用 data-i18n 已覆盖；下面处理 select 选项与占位
  document.documentElement.lang = en?'en':'zh';
}
function toggleLang(){
  lang=lang==='zh'?'en':'zh';
  document.getElementById('btn-lang').textContent=lang==='zh'?'🌐 中/EN':'🌐 EN/中';
  document.getElementById('btn-lang').classList.toggle('act',lang==='en');
  applyLang();
  buildSidebar();
  buildEdgeBar();
  buildSelects();
  applyUploadLang();
  updateAlignBar();
  toggleRunView(previewMode);   // 重设「预览效果」按钮文案（applyLang 会按 data-i18n 复位，需按当前状态再同步）
  if(selNode)selectNode(selNode); else if(selEdge)selectEdge(selEdge); else showPanel('none');
}
// 上传弹框文案随语言切换
function applyUploadLang(){
  const en=lang==='en';
  const set=(id,t)=>{const el=document.getElementById(id);if(el)el.textContent=t;};
  set('ub-title', en?'📁 Upload Custom Icon':'📁 上传自定义图标');
  set('dz-p1', en?'Click to select PNG / SVG file':'点击选择 PNG / SVG 文件');
  set('dz-p2', en?'Recommended 100×100, transparent bg':'建议 100×100 透明背景');
  set('uf-zh-label', en?'Chinese Name':'中文名称'); set('uf-en-label', en?'English Name':'英文名称');
  set('uf-zh-req', en?'*Required':'*必填');
  set('uf-en-req', en?'*Required':'*必填');
  set('ub-ok', en?'✓ Add':'✓ 添加');
  set('ub-cancel', en?'✕ Cancel':'✕ 取消');
  const un=document.getElementById('un'),une=document.getElementById('un-en');
  if(un)un.placeholder=en?'e.g. Custom Device':'如：自定义设备';
  if(une)une.placeholder=en?'e.g. Custom Device':'如：Custom Device';
}
function gridColor(){
  const c=bgColor.replace('#','');const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);
  const lum=(r*0.299+g*0.587+b*0.114);
  return lum>128?'rgba(0,40,90,0.13)':'rgba(120,170,220,0.28)';
}

let spaceDown=false;
canvas.addEventListener('mousedown',e=>{
  if(e.button===1||(e.button===0&&spaceDown)){e.preventDefault();isPanning=true;panSX=e.clientX-panX;panSY=e.clientY-panY;canvas.style.cursor='grabbing';return;}
  if(e.button===2)return;
  const r=canvas.getBoundingClientRect();const[wx,wy]=toWorld(e.clientX-r.left,e.clientY-r.top);
  // 多选整体缩放手柄
  if(_groupBox&&_groupBox.handle&&Math.hypot(wx-_groupBox.handle[0],wy-_groupBox.handle[1])<9/zoom){
    const cx=(_groupBox.x0+_groupBox.x1)/2, cy=(_groupBox.y0+_groupBox.y1)/2;
    const d0=Math.hypot(_groupBox.handle[0]-cx,_groupBox.handle[1]-cy);
    const snap={};selSet.forEach(id=>{const nn=nodes.find(z=>z.id===id);if(nn)snap[id]={x:nn.x,y:nn.y,scale:nn.scale||1,fontSize:nn.fontSize};});
    dragGroupScale={cx,cy,d0,snap};canvas.style.cursor='nwse-resize';return;
  }
  // 单节点缩放手柄
  if(selNode&&selSet.size<=1){
    const sn=nodes.find(z=>z.id===selNode);
    if(sn&&sn._rotHandle&&Math.hypot(wx-sn._rotHandle[0],wy-sn._rotHandle[1])<9/zoom){
      const cx=sn.x, cy=(sn.type==='text')?sn.y:(sn.y-nsz(sn)*0.22);
      dragRotate={n:sn,cx,cy,start:sn.rotation||0,startAng:Math.atan2(wy-cy,wx-cx)};canvas.style.cursor='grabbing';return;
    }
    if(sn&&sn._resizeHandles){
      for(const h of sn._resizeHandles){
        if(Math.hypot(wx-h[0],wy-h[1])<9/zoom){
          const isText=sn.type==='text';
          const cx=sn.type==='text'?sn.y:(sn.y-nsz(sn)*0.22);
          const baseDist=Math.hypot(h[0]-sn.x, h[1]-sn.y)||1;
          dragResize={n:sn,baseDist,startScale:sn.scale||1,startFont:sn.fontSize,isText};canvas.style.cursor='nwse-resize';return;
        }
      }
    }
  }
  // 汇流主干拖动手柄优先检测
  if(busMerge&&busShowHandles&&_busTrunks.length){
    for(const t of _busTrunks){
      if(t._handle&&Math.hypot(wx-t._handle[0],wy-t._handle[1])<8/zoom){
        dragBus={t, startOff:busOffsets[t.bkey]||0, sx:wx, sy:wy};
        canvas.style.cursor='grabbing';return;
      }
    }
  }
  const n=nodeAt(wx,wy);
  if(edgeMode){
    const snapHit=edgeSnapAt(wx,wy,edgeFrom);
    if(snapHit){
      const n=snapHit.node, hitPort=snapHit.port;
      const lockedPort=(hitPort&&hitPort.dist<=Math.max(18/zoom,nsz(n)*0.22))?hitPort.name:null;
      if(!edgeFrom){edgeFrom=n.id;edgeFromPort=lockedPort;edgeWaypoints=[];document.getElementById('ehint').textContent='连线['+ET[pendingET].label+']：点空白处加拐点，点目标节点完成';}
      else if(edgeFrom!==n.id){
        if(!edges.find(e=>e.from===edgeFrom&&e.to===n.id||e.from===n.id&&e.to===edgeFrom)){
          snapshot();
          const newEdge={from:edgeFrom,to:n.id,fromPort:edgeFromPort,toPort:lockedPort,et:pendingET,dir:'forward',route:pendingRoute,lbl:''};
          const cleanedWaypoints=trimWaypointsNearPort(edgeWaypoints,hitPort&&hitPort.point);
          if(cleanedWaypoints.length>0){
            newEdge.waypoints=cleanedWaypoints;
            newEdge.route='manual';
            simplifyWaypoints(newEdge);
            dropOverroutedManualWaypoints(newEdge);
          }
          edges.push(newEdge);snapshot();
        }
        edgeFrom=null;edgeFromPort=null;edgeWaypoints=[];document.getElementById('ehint').textContent='连线['+ET[pendingET].label+']：点击起始节点…';
        // 连完一条线后自动回到普通模式（除非勾选了「连续连线」）
        const cont=document.getElementById('edge-continuous');
        if(!cont||!cont.checked){ toggleEdgeMode(); }
      }
    } else if(edgeFrom){
      // 点击空白处：添加一个拐点（自动对齐为水平/垂直 + 吸附网格/节点）
      let px=wx,py=wy;
      const snap=10/zoom;
      nodes.forEach(o=>{if(Math.abs(o.x-px)<snap)px=o.x;const oy=o.type==='text'?o.y:(o.y-nsz(o)*0.22);if(Math.abs(oy-py)<snap)py=oy;});
      const GS=25;{const gx=Math.round(px/GS)*GS;if(Math.abs(gx-px)<snap)px=gx;const gy=Math.round(py/GS)*GS;if(Math.abs(gy-py)<snap)py=gy;}
      const last=edgeWaypoints.length>0?edgeWaypoints[edgeWaypoints.length-1]:(()=>{const f=nodes.find(z=>z.id===edgeFrom);return f?(nodePortPoint(f,edgeFromPort)||[f.x,f.y-nsz(f)*0.22]):[wx,wy];})();
      // L型：与上一点对齐，取偏移大的方向
      if(Math.abs(px-last[0])>Math.abs(py-last[1])) py=last[1]; else px=last[0];
      edgeWaypoints.push([px,py]);
      document.getElementById('ehint').textContent='已加 '+edgeWaypoints.length+' 个拐点，继续点空白加拐点或点目标完成';
    }
    return;
  }
  // 数据字段 chip 优先于节点检测（即使 chip 落在节点图标上也能拖动）
  const chipHit=fieldChipAt(wx,wy);
  if(chipHit && !edgeMode){
    if(selChips.has(chipHit.node.id+'#'+chipHit.fi)&&selChips.size>1){
      dragChipGroup={sx:wx,sy:wy,snap:{}};
      selChips.forEach(k=>{const a=k.split('#');const nn=nodes.find(z=>z.id===a[0]);if(nn&&nn.data[a[1]])dragChipGroup.snap[k]={ox:nn.data[a[1]].ox||0,oy:nn.data[a[1]].oy||0};});
      canvas.style.cursor='grabbing';return;
    }
    dragChip=chipHit;selectNode(chipHit.node.id);const f=chipHit.node.data[chipHit.fi];const pos=fieldChipPos(chipHit.node,chipHit.fi);dchox=wx-pos.x;dchoy=wy-pos.y;canvas.style.cursor='grabbing';return;
  }
  // 选中连线的手柄优先于节点检测（手柄即使落在节点附近也能抓取）：拐点(方块) + 起止端(方块)
  if(selEdge && !edgeMode){
    const wi=waypointAt(selEdge,wx,wy);
    if(wi>=0){dragWaypoint={e:selEdge,i:wi};canvas.style.cursor='grabbing';return;}
    const cn=cornerAt(selEdge,wx,wy);
    if(cn){
      const _savedRoute=selEdge.route, _savedWP=selEdge.waypoints?selEdge.waypoints.map(p=>p.slice()):undefined;
      ensureManual(selEdge);
      let idx=-1,bd=Infinity;
      selEdge.waypoints.forEach((p,k)=>{const d=Math.hypot(p[0]-cn.x,p[1]-cn.y);if(d<bd){bd=d;idx=k;}});
      if(idx<0||bd>7/zoom){const ins=waypointInsertIndex(selEdge,cn.x,cn.y);selEdge.waypoints.splice(ins,0,[cn.x,cn.y]);idx=ins;}
      dragWaypoint={e:selEdge,i:idx,fromCorner:true,sx:wx,sy:wy,savedRoute:_savedRoute,savedWP:_savedWP};canvas.style.cursor='grabbing';return;
    }
    // 起止端节点：拖动以「重连/移动这一端」，不插入拐点、不新增线段
    if(selEdge._endHandles){ for(let hi=0;hi<selEdge._endHandles.length;hi++){ const h=selEdge._endHandles[hi];
      if(h&&Math.abs(wx-h[0])<8/zoom&&Math.abs(wy-h[1])<8/zoom){
        const which=hi===0?'from':'to';
        dragEndpoint={e:selEdge,which,orig:selEdge[which],origPort:selEdge[which+'Port']};canvas.style.cursor='grabbing';return;
      } } }
  }
  if(n){
    // 若节点已在多选集合中，拖动整组；否则单选
    if(selSet.has(n.id)&&selSet.size>1){dragNode=n;dox=wx-n.x;doy=wy-n.y;_groupDrag=true;_groupStart={};selSet.forEach(id=>{const nn=nodes.find(z=>z.id===id);if(nn)_groupStart[id]=[nn.x,nn.y];});canvas.style.cursor='grabbing';return;}
    selSet.clear();selChips.clear();updateAlignBar();selectNode(n.id);dragNode=n;dox=wx-n.x;doy=wy-n.y;canvas.style.cursor='grabbing';}
  else{
    const hit=fieldChipAt(wx,wy);
    if(hit){
      // 若点中的 chip 在多选集合中，整组拖动所有选中 chip
      if(selChips.has(hit.node.id+'#'+hit.fi)&&selChips.size>1){
        dragChipGroup={sx:wx,sy:wy,snap:{}};
        selChips.forEach(k=>{const [id,j]=k.split('#');const nn=nodes.find(z=>z.id===id);if(nn&&nn.data[j])dragChipGroup.snap[k]={ox:nn.data[j].ox||0,oy:nn.data[j].oy||0};});
        canvas.style.cursor='grabbing';return;
      }
      dragChip=hit;selectNode(hit.node.id);const f=hit.node.data[hit.fi];const pos=fieldChipPos(hit.node,hit.fi);dchox=wx-pos.x;dchoy=wy-pos.y;canvas.style.cursor='grabbing';return;
    }
    const ed=edgeAt(wx,wy);if(ed){selSet.clear();selChips.clear();updateAlignBar();selectEdge(ed);}
    else if(e.shiftKey||selectMode){
      // 选择模式或 Shift+拖动空白 → 框选
      rubber={x0:wx,y0:wy,x1:wx,y1:wy};selSet.clear();selChips.clear();updateAlignBar();selNode=selEdge=null;showPanel('none');
    }else{
      selSet.clear();selChips.clear();updateAlignBar();selNode=selEdge=null;showPanel('none');
      isPanning=true;panSX=e.clientX-panX;panSY=e.clientY-panY;canvas.style.cursor='grabbing';
    }
  }
});
canvas.addEventListener('mousemove',e=>{
  const r=canvas.getBoundingClientRect();
  const wpt=toWorld(e.clientX-r.left,e.clientY-r.top);mouseWX=wpt[0];mouseWY=wpt[1];
  if(isPanning){panX=e.clientX-panSX;panY=e.clientY-panSY;return;}
  if(dragRotate){
    const ang=Math.atan2(mouseWY-dragRotate.cy, mouseWX-dragRotate.cx);
    let deg=dragRotate.start + (ang-dragRotate.startAng)*180/Math.PI;
    if(e.shiftKey) deg=Math.round(deg/15)*15; // Shift 吸附 15°
    deg=((deg%360)+360)%360;
    dragRotate.n.rotation=Math.round(deg);
    _pathCacheSig='';
    const el=document.getElementById('p-rot');if(el){el.value=dragRotate.n.rotation;const v=document.getElementById('p-rot-v');if(v)v.textContent=dragRotate.n.rotation;}
    _hud={x:dragRotate.cx,y:dragRotate.cy,text:'∠ '+dragRotate.n.rotation+'°'};
    return;
  }
  if(dragResize){
    const d=Math.hypot(mouseWX-dragResize.n.x, mouseWY-dragResize.n.y);
    const ratio=Math.max(0.05,Math.min(4, d/dragResize.baseDist));
    if(dragResize.isText){dragResize.n.fontSize=Math.max(8,Math.round(dragResize.startFont*ratio));}
    else{dragResize.n.scale=Math.max(0.05,Math.min(8, dragResize.startScale*ratio));}
    _pathCacheSig='';
    if(selNode===dragResize.n.id){
      if(dragResize.isText){const el=document.getElementById('p-fs');if(el){el.value=dragResize.n.fontSize;const v=document.getElementById('p-fs-v');if(v)v.textContent=dragResize.n.fontSize;}}
      else{const el=document.getElementById('p-scale');if(el){el.value=Math.round(dragResize.n.scale*100);const v=document.getElementById('p-scale-v');if(v)v.textContent=Math.round(dragResize.n.scale*100);}}
    }
    _hud={x:dragResize.n.x,y:dragResize.n.y,text:dragResize.isText?(dragResize.n.fontSize+'px'):(Math.round(dragResize.n.scale*100)+'%')};
    return;
  }
  if(dragGroupScale){
    const d=Math.hypot(mouseWX-dragGroupScale.cx, mouseWY-dragGroupScale.cy);
    const ratio=Math.max(0.15,Math.min(8, d/dragGroupScale.d0));
    const {cx,cy,snap}=dragGroupScale;
    selSet.forEach(id=>{const n=nodes.find(z=>z.id===id);if(!n||!snap[id])return;
      n.x=cx+(snap[id].x-cx)*ratio; n.y=cy+(snap[id].y-cy)*ratio;
      if(n.type==='text')n.fontSize=Math.max(8,Math.round(snap[id].fontSize*ratio));
      else n.scale=Math.max(0.05,Math.min(8, snap[id].scale*ratio));
    });
    _pathCacheSig='';
    _hud={x:cx,y:cy,text:Math.round(ratio*100)+'%'};
    return;
  }
  if(dragBus){
    const t=dragBus.t;
    // 主干垂直方向的位移转为偏移量；远离节点为正
    let delta;
    if(t.horiz){delta=(t.side==='T')?(dragBus.sy-mouseWY):(mouseWY-dragBus.sy);}
    else{delta=(t.side==='L')?(dragBus.sx-mouseWX):(mouseWX-dragBus.sx);}
    let off=dragBus.startOff+delta;
    if(off<-(Math.max(0,busMergeGap-8)))off=-(Math.max(0,busMergeGap-8)); // 不要穿进节点
    busOffsets[t.bkey]=off;
    _pathCacheSig='';
    return;
  }
  if(rubber){rubber.x1=mouseWX;rubber.y1=mouseWY;return;}
  if(dragEndpoint){
    // 重连/移动连线这一端：实时吸附到光标下的设备(非另一端)，移开则回到原设备
    const otherId=dragEndpoint.e[dragEndpoint.which==='from'?'to':'from'];
    const hit=edgeSnapAt(mouseWX,mouseWY,otherId);
    const hv=hit&&hit.node;
    const portKey=dragEndpoint.which+'Port';
    const tgt=(hv&&hv.id!==otherId)?hv.id:dragEndpoint.orig;
    const hp=(hv&&hv.id!==otherId)?hit.port:null;
    const nextPort=(hp&&hp.dist<=Math.max(18/zoom,nsz(hv)*0.22))?hp.name:dragEndpoint.origPort;
    if(dragEndpoint.e[dragEndpoint.which]!==tgt || dragEndpoint.e[portKey]!==nextPort){
      dragEndpoint.e[dragEndpoint.which]=tgt;
      if(nextPort)dragEndpoint.e[portKey]=nextPort;else delete dragEndpoint.e[portKey];
      _pathCacheSig='';
    }
    canvas.style.cursor=(hv&&hv.id!==otherId)?'grabbing':'no-drop';
    return;
  }
  if(dragWaypoint){
    alignGuides=[];
    const snap=9/zoom;
    // 始终以「原始鼠标位置」为基准挑最近的吸附目标，避免逐个比较时被前一次吸附带偏
    let px=mouseWX, py=mouseWY, bestXd=snap, bestYd=snap, gx=null, gy=null;
    const tryX=v=>{const d=Math.abs(v-mouseWX);if(d<bestXd){bestXd=d;px=v;gx=v;}};
    const tryY=v=>{const d=Math.abs(v-mouseWY);if(d<bestYd){bestYd=d;py=v;gy=v;}};
    // 1) 对齐其他节点中心线（横/竖）
    nodes.forEach(o=>{ tryX(o.x); tryY(o.type==='text'?o.y:(o.y-nsz(o)*0.22)); });
    // 2) 对齐/汇合其他连线：其拐点(同时命中X与Y即汇合为同一点) + 横平竖直段(对齐到同一通道)
    edges.forEach(oe=>{ if(oe===dragWaypoint.e)return; const pp=_pathCache[oe._cacheKey]||oe._drawPts; if(!pp||pp.length<2)return;
      pp.forEach(pt=>{ tryX(pt[0]); tryY(pt[1]); });
      for(let i=0;i<pp.length-1;i++){ const a=pp[i],b=pp[i+1];
        if(Math.abs(a[0]-b[0])<1) tryX(a[0]);   // 竖直段 → 对齐 X
        if(Math.abs(a[1]-b[1])<1) tryY(a[1]);   // 水平段 → 对齐 Y
      }
    });
    // 3) 仍未吸附到任何参考 → 吸附网格(25px)
    const GS=25;
    if(gx==null){const g=Math.round(mouseWX/GS)*GS;if(Math.abs(g-mouseWX)<snap){px=g;gx=g;}}
    if(gy==null){const g=Math.round(mouseWY/GS)*GS;if(Math.abs(g-mouseWY)<snap){py=g;gy=g;}}
    if(gx!=null)alignGuides.push({type:'v',x:gx});
    if(gy!=null)alignGuides.push({type:'h',y:gy});
    dragWaypoint.e.waypoints[dragWaypoint.i]=[px,py];
    _pathCacheSig='';
    return;
  }
  if(dragChipGroup){
    const ddx=mouseWX-dragChipGroup.sx, ddy=mouseWY-dragChipGroup.sy;
    Object.entries(dragChipGroup.snap).forEach(([k,s])=>{const a=k.split('#');const nn=nodes.find(z=>z.id===a[0]);if(nn&&nn.data[a[1]]){nn.data[a[1]].ox=s.ox+ddx*zoom;nn.data[a[1]].oy=s.oy+ddy*zoom;}});
    return;
  }
  if(dragChip){
    const f=dragChip.node.data[dragChip.fi];
    const s=nsz(dragChip.node);
    const step=((dragChip.node.fontSize||14)+18)/zoom;
    const baseX=dragChip.node.x+s*0.5+14/zoom, baseY=dragChip.node.y-s*0.40+dragChip.fi*step;
    f.ox=((mouseWX-dchox)-baseX)*zoom; f.oy=((mouseWY-dchoy)-baseY)*zoom;   // 存屏幕像素
    return;
  }
  if(dragNode&&_groupDrag){
    const ddx=(mouseWX-dox)-_groupStart[dragNode.id][0], ddy=(mouseWY-doy)-_groupStart[dragNode.id][1];
    selSet.forEach(id=>{const nn=nodes.find(z=>z.id===id);if(nn&&_groupStart[id]){nn.x=_groupStart[id][0]+ddx;nn.y=_groupStart[id][1]+ddy;}});
    _dragging=true;_dragIds=new Set(selSet);return;
  }
  if(!dragNode)return;const[wx,wy]=[wpt[0],wpt[1]];
  let nx=wx-dox, ny=wy-doy;
  alignGuides=[];
  const snap=8/zoom;
  // 取一个节点的对齐参考线：x方向[左,中,右]，y方向[上,中,下]
  function xRefs(o,cx){const s=nsz(o);const hw=(o.type==='text'&&o._textBox)?o._textBox.w/2:s*0.40;return [cx-hw,cx,cx+hw];}
  function yRefs(o,cy){const s=nsz(o);if(o.type==='text'&&o._textBox){const hh=o._textBox.h/2;return [cy-hh,cy,cy+hh];}const vc=cy-s*0.22,hh=s*0.40;return [vc-hh,vc,vc+hh];}
  const dxr=xRefs(dragNode,nx), dyr=yRefs(dragNode,ny);
  let bestX=null,bestY=null,bestXd=snap,bestYd=snap,guideX=null,guideY=null;
  nodes.forEach(o=>{if(o.id===dragNode.id)return;
    const oxr=xRefs(o,o.x), oyr=yRefs(o,o.y);
    // x 方向：拖动节点的 3 条参考线 vs 目标 3 条参考线
    dxr.forEach((dv,di)=>oxr.forEach(ov=>{const d=Math.abs(dv-ov);if(d<bestXd){bestXd=d;bestX=nx+(ov-dv);guideX=ov;}}));
    dyr.forEach((dv,di)=>oyr.forEach(ov=>{const d=Math.abs(dv-ov);if(d<bestYd){bestYd=d;bestY=ny+(ov-dv);guideY=ov;}}));
  });
  if(bestX!=null){nx=bestX;alignGuides.push({type:'v',x:guideX});}
  if(bestY!=null){ny=bestY;alignGuides.push({type:'h',y:guideY});}
  dragNode.x=nx;dragNode.y=ny;_dragging=true;_dragIds=new Set([dragNode.id]);
  if(selNode===dragNode.id){document.getElementById('p-x').textContent=dragNode.x.toFixed(0);document.getElementById('p-y').textContent=dragNode.y.toFixed(0);}
});
canvas.addEventListener('mouseup',()=>{
  if(rubber){
    const x0=Math.min(rubber.x0,rubber.x1),x1=Math.max(rubber.x0,rubber.x1),y0=Math.min(rubber.y0,rubber.y1),y1=Math.max(rubber.y0,rubber.y1);
    selSet.clear();selChips.clear();
    nodes.forEach(n=>{if(n.x>=x0&&n.x<=x1&&n.y>=y0&&n.y<=y1)selSet.add(n.id);});
    // 框选数据字段 chip（chip 盒与框相交即选中）
    if(showFieldChips){
      nodes.forEach(n=>{if(!n.data)return;n.data.forEach((f,j)=>{const b=f._chipBox;if(!b||f.hidden)return;
        if(b.x<x1&&b.x+b.w>x0&&b.y<y1&&b.y+b.h>y0)selChips.add(n.id+'#'+j);
      });});
    }
    rubber=null;
    updateAlignBar();
    // 框选结束后自动回到普通模式，无需手动取消选择模式
    if(selectMode){ selectMode=false; document.getElementById('btn-select').classList.remove('active'); }
    canvas.style.cursor='default';return;
  }
  if(isPanning){isPanning=false;canvas.style.cursor=edgeMode?'crosshair':'default';return;}
  if(dragRotate){dragRotate=null;_hud=null;_pathCacheSig='';snapshot();canvas.style.cursor='default';return;}
  if(dragResize){dragResize=null;_hud=null;_pathCacheSig='';snapshot();canvas.style.cursor='default';return;}
  if(dragGroupScale){dragGroupScale=null;_hud=null;_pathCacheSig='';snapshot();canvas.style.cursor='default';return;}
  if(dragBus){dragBus=null;_pathCacheSig='';canvas.style.cursor='default';return;}
  if(dragEndpoint){
    const _e=dragEndpoint.e, portKey=dragEndpoint.which+'Port';
    const changed=_e[dragEndpoint.which]!==dragEndpoint.orig || _e[portKey]!==dragEndpoint.origPort;
    if(changed){ delete _e.waypoints; if(_e.route==='manual')_e.route='smart'; }   // 端点变了→旧拐点作废，重新走线
    dragEndpoint=null;_pathCacheSig='';canvas.style.cursor='default';
    if(changed){snapshot();flashHint('已重连该端');}
    return;
  }
  if(dragWaypoint){const _dw=dragWaypoint,_e=_dw.e;dragWaypoint=null;alignGuides=[];
    // 若是通过点击自动路由拐角触发的（fromCorner），且几乎没有移动，则视为点击而非拖动——
    // 恢复原始路由，不把直线变成折线
    if(_dw.fromCorner && Math.hypot(mouseWX-_dw.sx, mouseWY-_dw.sy)<8/zoom){
      _e.route=_dw.savedRoute; if(_dw.savedWP){_e.waypoints=_dw.savedWP;}else{delete _e.waypoints;}
      _pathCacheSig='';canvas.style.cursor='default';return;
    }
    simplifyWaypoints(_e);
    // 把存储拐点同步为「实际渲染后的正交拐点」：强制正交会让线在直角处转弯而非原始点，
    // 不同步就会残留偏离线条的孤立手柄、并越拖越多。同步后手柄恒在线上、抓取即命中。
    _pathCacheSig=''; const rp=edgePath(_e); if(rp&&rp.length>2){ _e.waypoints=rp.slice(1,-1).map(p=>p.slice()); simplifyWaypoints(_e); autoAttachLooseEdgeEnds(_e); dropOverroutedManualWaypoints(_e); }
    _pathCacheSig='';snapshot();canvas.style.cursor='default';return;}
  if(dragChipGroup){dragChipGroup=null;snapshot();canvas.style.cursor='default';return;}
  if(dragChip){dragChip=null;snapshot();canvas.style.cursor='default';return;}
  if(dragNode){suppressNodeActionClick=true;setTimeout(()=>{suppressNodeActionClick=false;},0);_dragging=false;_groupDrag=false;_dragIds=new Set();_pathCacheSig='';alignGuides=[];snapshot();}
  dragNode=null;canvas.style.cursor=edgeMode?'crosshair':'default';
});
canvas.addEventListener('mouseleave',()=>{dragNode=null;isPanning=false;});
function isNodeActionRuntime(){return previewMode||document.body.classList.contains('rt');}
function openNodeAction(action){
  if(!action||!action.url)return false;
  const url=String(action.url).trim();
  if(!url)return false;
  if(action.target==='blank')window.open(url,'_blank','noopener');
  else window.location.href=url;
  return true;
}
function triggerNodeAction(n,trigger){
  if(!isNodeActionRuntime()||!n||!n.action)return false;
  const a=n.action;
  if((a.trigger||'click')!==trigger)return false;
  return openNodeAction(a);
}
canvas.addEventListener('click',e=>{
  if(suppressNodeActionClick||edgeMode)return;
  const r=canvas.getBoundingClientRect();const[wx,wy]=toWorld(e.clientX-r.left,e.clientY-r.top);
  const n=nodeAt(wx,wy);
  if(n)triggerNodeAction(n,'click');
});
canvas.addEventListener('dblclick',e=>{
  const r=canvas.getBoundingClientRect();const[wx,wy]=toWorld(e.clientX-r.left,e.clientY-r.top);
  // 双击选中连线的拐点 → 删除该拐点
  if(selEdge){
    const wi=waypointAt(selEdge,wx,wy);
    if(wi>=0){
      snapshot();
      selEdge.waypoints.splice(wi,1);
      if(selEdge.waypoints.length===0){selEdge.route='straight';delete selEdge.waypoints;}
      _pathCacheSig='';snapshot();
      return;
    }
  }
  // 双击数据字段 chip → 内联编辑数值（自定义弹层，替代原生 prompt）
  const hit=fieldChipAt(wx,wy);
  if(hit){
    openChipValueEditor(hit.node, hit.fi, e.clientX, e.clientY);
    return;
  }
  // 双击节点 → 编辑标签（当前语言）
  const n=nodeAt(wx,wy);
  if(n){
    if(triggerNodeAction(n,'dblclick'))return;
    if(n.type==='text'){ openTextEditor(n, e.clientX, e.clientY); return; }
    const isEn=lang==='en';
    const cur=isEn?(n.labelEn||''):(n.labelZh||n.label||'');
    openInlineInput(e.clientX,e.clientY,(isEn?'编辑英文标签':'编辑中文标签'),cur,(v)=>{
      snapshot();if(isEn)n.labelEn=v;else{n.labelZh=v;n.label=v;}snapshot();selectNode(n.id);
    });
  }
});
// 通用内联输入弹层（替代原生 prompt）
function openInlineInput(clientX,clientY,title,value,onOk){
  const old=document.getElementById('inline-input');if(old)old.remove();
  const box=document.createElement('div');box.id='inline-input';
  box.style.cssText='position:fixed;z-index:200;background:var(--ui-bg);border:1px solid var(--ui-accent);border-radius:8px;padding:10px;box-shadow:0 8px 28px rgba(0,0,0,.5);min-width:200px';
  const lbl=document.createElement('div');lbl.textContent=title;lbl.style.cssText='font-size:12px;color:var(--ui-text2);margin-bottom:6px';
  const inp=document.createElement('input');inp.type='text';inp.value=value;
  inp.style.cssText='width:100%;background:var(--ui-input-bg,#060e1a);border:1.5px solid var(--ui-border);color:var(--ui-text);font-family:inherit;font-size:14px;padding:7px 9px;border-radius:5px;outline:none;box-sizing:border-box';
  const row=document.createElement('div');row.style.cssText='display:flex;gap:6px;justify-content:flex-end;margin-top:8px';
  const ok=document.createElement('button');ok.className='tb grn';ok.textContent='✓ 确定';ok.style.fontSize='12px';
  const cancel=document.createElement('button');cancel.className='tb';cancel.textContent='取消';cancel.style.fontSize='12px';
  row.appendChild(cancel);row.appendChild(ok);
  box.appendChild(lbl);box.appendChild(inp);box.appendChild(row);
  document.body.appendChild(box);
  // 定位（避免超出视口）
  const bw=box.offsetWidth,bh=box.offsetHeight;
  let x=Math.min(clientX,window.innerWidth-bw-12), y=Math.min(clientY,window.innerHeight-bh-12);
  box.style.left=Math.max(8,x)+'px';box.style.top=Math.max(8,y)+'px';
  inp.focus();inp.select();
  const close=()=>{box.remove();document.removeEventListener('mousedown',outside,true);};
  const submit=()=>{const v=inp.value.trim();close();onOk(v);};
  ok.onclick=submit;cancel.onclick=close;
  inp.addEventListener('keydown',ev=>{if(ev.key==='Enter')submit();else if(ev.key==='Escape')close();});
  const outside=(ev)=>{if(!box.contains(ev.target))close();};
  setTimeout(()=>document.addEventListener('mousedown',outside,true),0);
}
// 编辑某字段数值
function openChipValueEditor(node,fi,clientX,clientY){
  const f=node.data[fi];
  const cur=(f.dv!=null&&f.dv!==''&&f.dv!==0)?f.dv:'';
  openInlineInput(clientX,clientY,'设置数值 · '+dataKey(f),cur,(v)=>{
    snapshot();f.dv=v;snapshot();selectNode(node.id);
  });
}
// 文本框多行内联编辑器
function openTextEditor(n, clientX, clientY){
  const old=document.getElementById('text-editor');if(old)old.remove();
  const isEn=lang==='en';
  const ta=document.createElement('textarea');
  ta.id='text-editor';
  ta.value=isEn?(n.labelEn||''):(n.labelZh||n.label||'');
  ta.placeholder=isEn?'Enter text (Enter for newline, Esc to cancel)':'输入文字（回车换行，Esc 取消，点外部保存）';
  const r=canvas.getBoundingClientRect();
  ta.style.cssText='position:fixed;left:'+Math.min(clientX,window.innerWidth-280)+'px;top:'+Math.min(clientY,window.innerHeight-140)+'px;'+
    'width:260px;height:90px;z-index:200;background:var(--ui-bg);color:var(--ui-text);'+
    'border:2px solid var(--ui-accent);border-radius:8px;padding:9px;font-size:14px;'+
    'font-family:inherit;resize:both;outline:none;box-shadow:0 8px 30px rgba(0,0,0,.5)';
  document.body.appendChild(ta);ta.focus();ta.select();
  const save=()=>{
    if(!document.body.contains(ta))return;
    snapshot();
    if(isEn)n.labelEn=ta.value; else {n.labelZh=ta.value;n.label=ta.value;}
    snapshot();selectNode(n.id);
    ta.remove();
  };
  ta.addEventListener('blur',save);
  ta.addEventListener('keydown',ev=>{
    ev.stopPropagation();
    if(ev.key==='Escape'){ta.remove();}
    // Ctrl+Enter 也保存
    if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)){save();}
  });
}
window.addEventListener('keydown',e=>{
  if(e.code==='Space'&&!e.target.matches('input,select,textarea')){e.preventDefault();spaceDown=true;canvas.style.cursor='grab';}
  if(e.key==='Escape'){if(edgeFrom){edgeFrom=null;edgeFromPort=null;edgeWaypoints=[];document.getElementById('ehint').textContent='连线['+ET[pendingET].label+']：点击起始节点…';}}
  if((e.key==='Delete'||e.key==='Backspace')&&!e.target.matches('input,select,textarea')){e.preventDefault();deleteSelected();}
  if(e.ctrlKey&&e.key==='z'){e.preventDefault();undo();}
  if(e.ctrlKey&&(e.key==='y'||e.key==='Y')){e.preventDefault();redo();}
  if((e.ctrlKey||e.metaKey)&&(e.key==='c'||e.key==='C')&&!e.target.matches('input,select,textarea')){e.preventDefault();copySelection();}
  if((e.ctrlKey||e.metaKey)&&(e.key==='v'||e.key==='V')&&!e.target.matches('input,select,textarea')){e.preventDefault();pasteClipboard();}
  if((e.ctrlKey||e.metaKey)&&(e.key==='d'||e.key==='D')&&!e.target.matches('input,select,textarea')){e.preventDefault();copySelection();pasteClipboard();}
});
window.addEventListener('keyup',e=>{if(e.code==='Space'){spaceDown=false;canvas.style.cursor=edgeMode?'crosshair':'default';}});
canvas.addEventListener('contextmenu',e=>{
  e.preventDefault();const r=canvas.getBoundingClientRect();const[wx,wy]=toWorld(e.clientX-r.left,e.clientY-r.top);
  const n=nodeAt(wx,wy),ed=edgeAt(wx,wy),m=document.getElementById('ctxmenu');
  if(n&&triggerNodeAction(n,'contextmenu'))return;
  if(n||ed){ctxTgt=n||ed;ctxKind=n?'node':'edge';
    document.getElementById('ctx-conn').style.display=n?'flex':'none';
    document.getElementById('ctx-copy').style.display=n?'flex':'none';
    document.getElementById('ctx-straight').style.display=ed?'flex':'none';
    document.getElementById('ctx-line').style.display=ed?'flex':'none';
    document.getElementById('ctx-del-edge').style.display=ed?'flex':'none';
    document.getElementById('ctx-del').style.display=n?'flex':'none';
    m.style.display='block';m.style.left=e.clientX+'px';m.style.top=e.clientY+'px';}
});
document.addEventListener('click',e=>{
  if(!e.target.closest('#ctxmenu'))document.getElementById('ctxmenu').style.display='none';
  if(!e.target.closest('#ep-type-dd'))closeEpTypeDD();
  if(!e.target.closest('#bgpanel')&&!e.target.closest('#topbar'))closeBgPanel();
  if(e.target.id==='tpl-overlay')closeTemplates();
});
function onDragStart(e,t){window._dt=t;e.dataTransfer.setData('text/plain',t);}
cwrap.addEventListener('dragover',e=>e.preventDefault());
cwrap.addEventListener('drop',e=>{e.preventDefault();const t=window._dt;if(!t)return;const r=canvas.getBoundingClientRect();const[wx,wy]=toWorld(e.clientX-r.left,e.clientY-r.top);addNode(t,wx,wy);window._dt=null;});
function addNode(type,x,y){
  const def=NODE_DEFAULTS[type]||{data:[]};const id=genId(type);
  const isC=type.startsWith('custom_');
  const dev=DEVICE_GROUPS.flatMap(g=>g.devices).find(d=>d.type===type);
  let labelZh,labelEn;
  if(isC&&CUSTOM_LABELS[type]){ labelZh=CUSTOM_LABELS[type].zh; labelEn=CUSTOM_LABELS[type].en; }
  else { labelZh=dev?.label||type; labelEn=dev?.label_en||type; }
  snapshot();
  if(type==='text'){
    nodes.push({id,type,labelZh:'文本内容',labelEn:'Text',x,y,fontSize:18,fontColor:'#ffffff',scale:1,
      data:[{key:'数值',keyEn:'Value',dv:''}]});
    snapshot();selectNode(id);return;
  }
  nodes.push({id,type,labelZh,labelEn,x,y,status:'待机',fontSize:14,fontColor:'#e8f4ff',scale:(type==='anchor'?0.1:1),
    hideLabel:(type==='anchor'),hideFields:(type==='anchor'),
    ...(type==='anchor'?{fill:'#4dd0ff',opacity:1}:{}),
    data:(def.data||[]).map(k=>({key:k,keyEn:(DATA_LABEL_EN[k]||k),dv:''}))});
  snapshot();selectNode(id);
}
// 获取节点当前语言标签
function nodeLabel(n){ return lang==='en' ? (n.labelEn||n.labelZh||n.id) : (n.labelZh||n.label||n.id); }
function dataKey(f){ return lang==='en' ? (f.keyEn||f.key) : f.key; }
function nodeSupportsStateSignals(n){ return !!(n&&n.type!=='text'); }

function nsz(typeOrNode){
  const type=typeof typeOrNode==='string'?typeOrNode:typeOrNode.type;
  const scale=typeof typeOrNode==='string'?1:(typeOrNode.scale||1);
  const base=Math.min(canvas.width,canvas.height)/zoom;
  const s={grid:80,pcs:66,bms:66,meter:56,meter2:60,load:66,solar:74,transformer:64,switch:60,generator:68,cabinet:64,highvolt:60,ems:64,aircon:60,fire:58,sensor:58,busbar:70,charger:60,h2_storage:64,
    // 开关元件：默认偏大，统一缩小为更紧凑的尺寸
    cb_closed:44,switch_open:44,disconnector:44,contactor:44,fuse:44,iso_g:44,lbs_g:44,disc_v_g:44,
    trunk_ac:70,trunk_dc:70,tie_line:66,
    anchor:26}[type]||62;
  return s*(base/600)*scale;
}
function nodeAt(wx,wy){for(let i=nodes.length-1;i>=0;i--){const n=nodes[i];if(n.type==='text'){const b=n._textBox;if(b&&wx>=b.x&&wx<=b.x+b.w&&wy>=b.y&&wy<=b.y+b.h)return n;continue;}const s=nsz(n);if(n.type==='anchor'){const vcy=n.y-s*0.22, hit=Math.max(s*0.5, 11/zoom);if(Math.abs(wx-n.x)<hit&&Math.abs(wy-vcy)<hit)return n;continue;}if(Math.abs(wx-n.x)<s*.55&&Math.abs(wy-n.y)<s*.5)return n;}return null;}
// 返回节点边界上的锚点（从中心朝目标方向，落在图标外缘）
// 节点的视觉包围盒（图标实际绘制区域，中心略偏上）
function nodeBox(n){
  const s=nsz(n);
  // 图标绘制 y 从 n.y - s*0.72 到 n.y + s*0.28，视觉中心在 n.y - s*0.22
  const cx=n.x, cy=n.y - s*0.22;
  const hw=s*0.50, hh=s*0.50;
  return {cx,cy,hw,hh,left:cx-hw,right:cx+hw,top:cy-hh,bottom:cy+hh};
}
function isLinearBusNode(n){
  return !!(n&&['busbar','trunk_ac','trunk_dc','tie_line'].includes(n.type));
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function linearBusSpan(n){
  const b=nodeBox(n), s=nsz(n);
  // 母线/主干线图标主体是横向线段，不是完整方盒；连接点应落在线段上。
  const half=s*0.42;
  return {y:b.cy,left:b.cx-half,right:b.cx+half,cx:b.cx};
}
function linearBusPort(n, wx){
  const sp=linearBusSpan(n);
  const x=clamp(wx,sp.left,sp.right);
  const ratio=(sp.right===sp.left)?0.5:(x-sp.left)/(sp.right-sp.left);
  return {name:'line:'+ratio.toFixed(3),point:[x,sp.y],dist:0};
}
function nodeSnapBox(n){
  if(n.type==='text'&&n._textBox)return n._textBox;
  const b=nodeBox(n), s=nsz(n), lfs=(n.fontSize||14);
  const labelBottom=(n.y+s*0.28)+lfs*1.45;
  const out={x:b.left,y:b.top,w:b.hw*2,h:Math.max(b.hh*2,labelBottom-b.top)};
  if(!n.hideFields&&showFieldChips&&n.data&&n.data.length){
    n.data.forEach((f,i)=>{
      if(f.hidden)return;
      const pos=fieldChipPos(n,i);
      const txt=fieldChipText(f);
      let tw=Math.max(74/zoom,120/zoom);
      try{ctx.save();ctx.font=pos.cfs+"px -apple-system,'Microsoft YaHei',sans-serif";tw=Math.max(tw,ctx.measureText(txt).width+14/zoom);ctx.restore();}catch(_){}
      const bx=pos.x,by=pos.y-pos.cfs,bw=tw,bh=pos.cfs+8/zoom;
      const minX=Math.min(out.x,bx),minY=Math.min(out.y,by),maxX=Math.max(out.x+out.w,bx+bw),maxY=Math.max(out.y+out.h,by+bh);
      out.x=minX;out.y=minY;out.w=maxX-minX;out.h=maxY-minY;
    });
  }
  return out;
}
function nodePortPoint(n, port){
  const b=nodeBox(n);
  if(isLinearBusNode(n)){
    if(typeof port==='string'&&port.startsWith('line:')){
      const sp=linearBusSpan(n), r=clamp(parseFloat(port.slice(5)),0,1);
      return [sp.left+(sp.right-sp.left)*(isFinite(r)?r:0.5),sp.y];
    }
    if(port==='left'||port==='right'||port==='top'||port==='bottom'||port==='center'){
      const sp=linearBusSpan(n);
      if(port==='left')return [sp.left,sp.y];
      if(port==='right')return [sp.right,sp.y];
      return [sp.cx,sp.y];
    }
  }
  switch(port){
    case 'top': return [b.cx,b.top];
    case 'right': return [b.right,b.cy];
    case 'bottom': return [b.cx,b.bottom];
    case 'left': return [b.left,b.cy];
    case 'center': return [b.cx,b.cy];
    default: return null;
  }
}
function nearestNodePort(n, wx, wy){
  if(isLinearBusNode(n)){
    const p=linearBusPort(n,wx);
    p.dist=Math.hypot(wx-p.point[0],wy-p.point[1]);
    return p;
  }
  const ports=['top','right','bottom','left'];
  let best=null,bd=Infinity;
  ports.forEach(name=>{
    const p=nodePortPoint(n,name);
    const d=Math.hypot(wx-p[0],wy-p[1]);
    if(d<bd){bd=d;best={name,point:p,dist:d};}
  });
  return best;
}
function directionalNodePort(n, wx, wy){
  if(isLinearBusNode(n))return linearBusPort(n,wx);
  const b=nodeBox(n);
  const dx=wx-b.cx,dy=wy-b.cy,adx=Math.abs(dx),ady=Math.abs(dy);
  if(ady>adx*0.8)return {name:dy<0?'top':'bottom',point:nodePortPoint(n,dy<0?'top':'bottom'),dist:0};
  if(adx>ady*0.8)return {name:dx<0?'left':'right',point:nodePortPoint(n,dx<0?'left':'right'),dist:0};
  return nearestNodePort(n,wx,wy);
}
function edgeSnapAt(wx,wy,excludeId){
  const direct=nodeAt(wx,wy);
  let best=null,bd=Infinity;
  nodes.forEach(n=>{
    if(n.id===excludeId)return;
    const port=nearestNodePort(n,wx,wy);
    if(!port)return;
    const sb=nodeSnapBox(n);
    const pad=Math.max(44/zoom, nsz(n)*0.55);
    const nearBox=wx>=sb.x-pad&&wx<=sb.x+sb.w+pad&&wy>=sb.y-pad&&wy<=sb.y+sb.h+pad;
    if(!nearBox&&n!==direct)return;
    const d=Math.hypot(wx-port.point[0],wy-port.point[1]);
    port.dist=d;
    const score=(n===direct?d*0.25:d);
    if(score<bd){bd=score;best={node:n,port};}
  });
  return best;
}
function trimWaypointsNearPort(wps, portPoint){
  const out=(wps||[]).map(p=>p.slice());
  if(!portPoint)return out;
  const tol=Math.max(64/zoom,28);
  while(out.length){
    const p=out[out.length-1];
    if(Math.hypot(p[0]-portPoint[0],p[1]-portPoint[1])>tol)break;
    out.pop();
  }
  return out;
}
function trimWaypointsNearStartPort(wps, portPoint){
  const out=(wps||[]).map(p=>p.slice());
  if(!portPoint)return out;
  const tol=Math.max(64/zoom,28);
  while(out.length){
    const p=out[0];
    if(Math.hypot(p[0]-portPoint[0],p[1]-portPoint[1])>tol)break;
    out.shift();
  }
  return out;
}
function looseSnapNodeAt(wx,wy,excludeIds){
  const exclude=new Set((excludeIds||[]).filter(Boolean));
  let best=null,bd=Infinity;
  nodes.forEach(n=>{
    if(exclude.has(n.id))return;
    const sb=nodeSnapBox(n), b=nodeBox(n);
    const pad=Math.max(56/zoom,nsz(n)*0.75);
    const nearBox=wx>=sb.x-pad&&wx<=sb.x+sb.w+pad&&wy>=sb.y-pad&&wy<=sb.y+sb.h+pad;
    const d=Math.hypot(wx-b.cx,wy-b.cy);
    if(nearBox&&d<bd){bd=d;best=n;}
  });
  return best;
}
function autoAttachLooseEdgeEnds(e){
  if(!e||!e.waypoints||!e.waypoints.length)return false;
  let changed=false;
  const first=e.waypoints[0],last=e.waypoints[e.waypoints.length-1];
  const fromHit=looseSnapNodeAt(first[0],first[1],[e.to,e.from]);
  if(fromHit){
    e.from=fromHit.id;
    e.fromPort=(directionalNodePort(fromHit,first[0],first[1])||{}).name;
    e.waypoints=trimWaypointsNearStartPort(e.waypoints,nodePortPoint(fromHit,e.fromPort));
    changed=true;
  }
  const tail=e.waypoints.length?e.waypoints[e.waypoints.length-1]:null;
  const toHit=tail&&looseSnapNodeAt(tail[0],tail[1],[e.from,e.to]);
  if(toHit){
    e.to=toHit.id;
    e.toPort=(directionalNodePort(toHit,tail[0],tail[1])||{}).name;
    e.waypoints=trimWaypointsNearPort(e.waypoints,nodePortPoint(toHit,e.toPort));
    changed=true;
  }
  if(changed){
    if(e.waypoints.length===0){delete e.waypoints;if(e.route==='manual')e.route='smart';}
    else simplifyWaypoints(e);
  }
  return changed;
}
// 从节点视觉中心朝目标方向，求与包围盒边界的交点（连线起止贴边，不进图标内部）
function anchorPoint(n, tx, ty){
  const bx=nodeBox(n);
  const dx=tx-bx.cx, dy=ty-bx.cy;
  if(dx===0&&dy===0) return [bx.cx,bx.cy];
  const sx=dx===0?Infinity:bx.hw/Math.abs(dx);
  const sy=dy===0?Infinity:bx.hh/Math.abs(dy);
  const t=Math.min(sx,sy);
  return [bx.cx+dx*t, bx.cy+dy*t];
}
function edgeAnchorPoint(n, tx, ty, port){
  const explicit=nodePortPoint(n,port);
  if(explicit)return explicit;
  const inferred=directionalNodePort(n,tx,ty);
  return inferred?inferred.point:anchorPoint(n,tx,ty);
}
// 矩形与线段是否相交（用于碰撞检测，基于视觉盒）
function segRectHit(x1,y1,x2,y2,n,pad){
  const bx=nodeBox(n);
  const minX=bx.left-pad, maxX=bx.right+pad, minY=bx.top-pad, maxY=bx.bottom+pad;
  function inside(x,y){return x>=minX&&x<=maxX&&y>=minY&&y<=maxY;}
  if(inside(x1,y1)||inside(x2,y2)) return true;
  function segSeg(ax,ay,bx2,by,cx,cy,dx,dy){
    const d=(bx2-ax)*(dy-cy)-(by-ay)*(dx-cx);if(Math.abs(d)<1e-9)return false;
    const t=((cx-ax)*(dy-cy)-(cy-ay)*(dx-cx))/d;
    const u=((cx-ax)*(by-ay)-(cy-ay)*(bx2-ax))/d;
    return t>=0&&t<=1&&u>=0&&u<=1;
  }
  return segSeg(x1,y1,x2,y2,minX,minY,maxX,minY)||segSeg(x1,y1,x2,y2,maxX,minY,maxX,maxY)||
         segSeg(x1,y1,x2,y2,maxX,maxY,minX,maxY)||segSeg(x1,y1,x2,y2,minX,maxY,minX,minY);
}
// 路径是否穿过其他节点
function pathHitsNodes(pts, fromId, toId){
  for(const n of nodes){
    if(n.id===fromId||n.id===toId) continue;
    for(let i=0;i<pts.length-1;i++)
      if(segRectHit(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],n,6)) return true;
  }
  return false;
}
// 线段与轴对齐矩形求交（返回离 p1 最近的交点参数 t，无交返回 null）
function segBoxClip(p1,p2,box){
  const x1=p1[0],y1=p1[1],x2=p2[0],y2=p2[1];
  const dx=x2-x1,dy=y2-y1;
  let tmin=0,tmax=1;
  const edges=[[-dx,x1-box.left],[dx,box.right-x1],[-dy,y1-box.top],[dy,box.bottom-y1]];
  for(const[p,q]of edges){
    if(Math.abs(p)<1e-9){ if(q<0)return null; }
    else{ const t=q/p; if(p<0){ if(t>tmax)return null; if(t>tmin)tmin=t; } else { if(t<tmin)return null; if(t<tmax)tmax=t; } }
  }
  return {tmin,tmax};
}
function ptInBox(p,box){ return p[0]>=box.left&&p[0]<=box.right&&p[1]>=box.top&&p[1]<=box.bottom; }
// 把折线两端裁剪到节点视觉盒边界（彻底移除盒内点，连线只到设备边缘）
function clipEnds(pts,a,b,e){
  const ba=nodeBox(a), bb=nodeBox(b);
  pts=pts.map(p=>p.slice());
  // ── 头部：找路径离开 a 盒的那一段，在盒边界处截断（沿该段方向，保持轴对齐）──
  let hi=0;
  while(hi<pts.length-1 && ptInBox(pts[hi+1],ba)) hi++;
  // pts[hi] 在盒内或盒上, pts[hi+1] 在盒外
  if(hi<pts.length-1){
    const p=pts[hi],q=pts[hi+1];
    const r=segBoxClip(p,q,ba);
    let cp=p;
    if(r){ const t=r.tmax; cp=[p[0]+(q[0]-p[0])*t, p[1]+(q[1]-p[1])*t]; }
    pts=pts.slice(hi); pts[0]=cp;
  }
  // ── 尾部：同理 ──
  let ti=pts.length-1;
  while(ti>0 && ptInBox(pts[ti-1],bb)) ti--;
  if(ti>0){
    const p=pts[ti],q=pts[ti-1];
    const r=segBoxClip(p,q,bb);
    let cp=p;
    if(r){ const t=r.tmax; cp=[p[0]+(q[0]-p[0])*t, p[1]+(q[1]-p[1])*t]; }
    pts=pts.slice(0,ti+1); pts[pts.length-1]=cp;
  }
  if(pts.length>=2){
    pts[0]=edgeAnchorPoint(a,pts[1][0],pts[1][1],e&&e.fromPort);
    pts[pts.length-1]=edgeAnchorPoint(b,pts[pts.length-2][0],pts[pts.length-2][1],e&&e.toPort);
  }
  // ── 兜底：若首/尾段仍是斜的，插入拐点矫正为 L ──
  if(pts.length>=2){
    const p0=pts[0],p1=pts[1];
    if(Math.abs(p0[0]-p1[0])>0.5&&Math.abs(p0[1]-p1[1])>0.5)
      pts.splice(1,0,[p1[0],p0[1]]);
  }
  if(pts.length>=2){
    const i=pts.length-1,q0=pts[i],q1=pts[i-1];
    if(Math.abs(q0[0]-q1[0])>0.5&&Math.abs(q0[1]-q1[1])>0.5)
      pts.splice(i,0,[q1[0],q0[1]]);
  }
  return pts;
}
// ───── 正交网格 A* 路由：绕开节点障碍 + 惩罚与已有连线交叉 ─────
let _pathCache={}, _pathCacheSig='', _dragging=false, _dragIds=new Set(), _busTrunks=[];
function topoSig(){
  // 拓扑签名：节点位置 + 边连接，变化时缓存失效
  return nodes.map(n=>n.id+':'+Math.round(n.x)+','+Math.round(n.y)+':'+n.type).join('|')+'##'+
         edges.map(e=>e.from+'>'+e.to+':'+(e.route||'')+':'+(e.fromPort||'')+'>'+(e.toPort||'')).join('|');
}
function invalidatePathCache(){ _pathCache={}; }
let _routeCache=null, _routeCacheKey='';
function buildObstacleGrid(){
  // 收集所有节点视觉盒作为障碍；底部延伸覆盖图标底边下方的标签区域
  return nodes.map(n=>{
    const b=nodeBox(n);
    const s=nsz(n);
    const lfs=(n.fontSize||14);
    // 标签位于图标底边(n.y+0.28s)之下，覆盖到标签底部
    const labelBottom=(n.y + s*0.28) + lfs*1.4;
    return {id:n.id,l:b.left-14,r:b.right+14,t:b.top-14,b:Math.max(b.bottom+14,labelBottom)};
  });
}
function ptInObstacle(x,y,obs,exFrom,exTo){
  for(const o of obs){ if(o.id===exFrom||o.id===exTo)continue; if(x>=o.l&&x<=o.r&&y>=o.t&&y<=o.b)return true; }
  return false;
}
function segInObstacle(x1,y1,x2,y2,obs,exFrom,exTo){
  const steps=Math.max(2,Math.ceil(Math.hypot(x2-x1,y2-y1)/10));
  for(let i=0;i<=steps;i++){const x=x1+(x2-x1)*i/steps,y=y1+(y2-y1)*i/steps;if(ptInObstacle(x,y,obs,exFrom,exTo))return true;}
  return false;
}
// 已占用线段集合（用于让后续连线避开已有连线，减少重叠/交叉）
let _occupied=new Set();
function occKey(x1,y1,x2,y2){
  const ax=Math.round(x1/4),ay=Math.round(y1/4),bx=Math.round(x2/4),by=Math.round(y2/4);
  return ax<bx||(ax===bx&&ay<=by)?`${ax},${ay},${bx},${by}`:`${bx},${by},${ax},${ay}`;
}
let _occPts=new Set();
function ptKey(x,y){return Math.round(x/6)+','+Math.round(y/6);}
function markOccupied(pts){
  for(let i=0;i<pts.length-1;i++){
    const[x1,y1]=pts[i],[x2,y2]=pts[i+1];
    const steps=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/6));
    for(let s=0;s<=steps;s++){const x=x1+(x2-x1)*s/steps,y=y1+(y2-y1)*s/steps;_occPts.add(ptKey(x,y));}
  }
}
function segOverlapPenalty(x1,y1,x2,y2){
  const steps=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/6));
  let hits=0;
  for(let s=0;s<=steps;s++){const x=x1+(x2-x1)*s/steps,y=y1+(y2-y1)*s/steps;if(_occPts.has(ptKey(x,y)))hits++;}
  return hits*400; // 与已有连线交叉/重叠的强惩罚
}
// 正交路由：加密网格（节点边界 + 多条中间车道）+ A*，强避让
function routeOrtho(a,b,e){
  const ba=nodeBox(a), bb=nodeBox(b);
  const sp=edgeAnchorPoint(a,bb.cx,bb.cy,e.fromPort), tp=edgeAnchorPoint(b,ba.cx,ba.cy,e.toPort);
  const obs=buildObstacleGrid();
  const GAP=20;
  const xsSet=new Set(),ysSet=new Set();
  xsSet.add(sp[0]);xsSet.add(tp[0]);ysSet.add(sp[1]);ysSet.add(tp[1]);
  obs.forEach(o=>{xsSet.add(o.l-GAP);xsSet.add(o.r+GAP);ysSet.add(o.t-GAP);ysSet.add(o.b+GAP);});
  // 在起止之间加入多条中间车道，给并行连线更多分流空间
  const lo_x=Math.min(sp[0],tp[0]),hi_x=Math.max(sp[0],tp[0]);
  const lo_y=Math.min(sp[1],tp[1]),hi_y=Math.max(sp[1],tp[1]);
  for(let k=1;k<=3;k++){
    xsSet.add(lo_x+(hi_x-lo_x)*k/4);
    ysSet.add(lo_y+(hi_y-lo_y)*k/4);
  }
  // 额外的全局车道线（基于所有节点的间隙中点）
  const allX=nodes.map(n=>nodeBox(n).cx).sort((p,q)=>p-q);
  const allY=nodes.map(n=>nodeBox(n).cy).sort((p,q)=>p-q);
  for(let i=0;i<allX.length-1;i++)xsSet.add((allX[i]+allX[i+1])/2);
  for(let i=0;i<allY.length-1;i++)ysSet.add((allY[i]+allY[i+1])/2);
  const xs=[...xsSet].sort((p,q)=>p-q), ys=[...ysSet].sort((p,q)=>p-q);
  const xi=new Map(xs.map((v,i)=>[v,i])), yi=new Map(ys.map((v,i)=>[v,i]));
  const W=xs.length,H=ys.length;
  const sx=xi.get(sp[0]),sy=yi.get(sp[1]),tx=xi.get(tp[0]),ty=yi.get(tp[1]);
  function key(ix,iy){return ix*2000+iy;}
  const open=[{ix:sx,iy:sy,g:0,f:0,dir:-1,prev:null}];
  const seen=new Map();
  let goal=null,iter=0;
  while(open.length&&iter++<12000){
    open.sort((p,q)=>p.f-q.f);
    const cur=open.shift();
    if(cur.ix===tx&&cur.iy===ty){goal=cur;break;}
    const k=key(cur.ix,cur.iy);
    if(seen.has(k)&&seen.get(k)<=cur.g)continue;
    seen.set(k,cur.g);
    const moves=[[1,0,0],[-1,0,0],[0,1,1],[0,-1,1]];
    for(const[dx,dy,axis]of moves){
      const nx=cur.ix+dx,ny=cur.iy+dy;
      if(nx<0||nx>=W||ny<0||ny>=H)continue;
      const x1=xs[cur.ix],y1=ys[cur.iy],x2=xs[nx],y2=ys[ny];
      if(segInObstacle(x1,y1,x2,y2,obs,e.from,e.to))continue;
      const segLen=Math.abs(x2-x1)+Math.abs(y2-y1);
      const turn=(cur.dir!==-1&&cur.dir!==axis)?30:0;
      const overlap=segOverlapPenalty(x1,y1,x2,y2);
      const ng=cur.g+segLen+turn+overlap;
      const h=Math.abs(xs[tx]-x2)+Math.abs(ys[ty]-y2);
      open.push({ix:nx,iy:ny,g:ng,f:ng+h,dir:axis,prev:cur});
    }
  }
  if(!goal){
    const mx=(sp[0]+tp[0])/2;
    return [sp,[mx,sp[1]],[mx,tp[1]],tp];
  }
  const path=[];let c=goal;while(c){path.unshift([xs[c.ix],ys[c.iy]]);c=c.prev;}
  const merged=[path[0]];
  for(let i=1;i<path.length-1;i++){
    const[px,py]=merged[merged.length-1],[cx,cy]=path[i],[nx,ny]=path[i+1];
    const col=(px===cx&&cx===nx)||(py===cy&&cy===ny);
    if(!col)merged.push(path[i]);
  }
  merged.push(path[path.length-1]);
  return merged;
}
// 把折线强制为正交（横平竖直）：相邻两点若是斜线，插入一个直角拐点
function orthogonalize(pts){
  if(pts.length<2)return pts;
  const out=[pts[0].slice()];
  for(let i=1;i<pts.length;i++){
    const prev=out[out.length-1], cur=pts[i].slice();
    const dx=Math.abs(cur[0]-prev[0]), dy=Math.abs(cur[1]-prev[1]);
    if(dx>0.5&&dy>0.5){
      // 斜线 → 插入直角拐点。最后一段优先竖直进入（更自然），其余水平优先
      const last=(i===pts.length-1);
      if(last) out.push([cur[0],prev[1]]);   // 先水平再竖直到终点
      else     out.push([cur[0],prev[1]]);   // 先水平再竖直
    }
    out.push(cur);
  }
  // 合并共线冗余点
  const merged=[out[0]];
  for(let i=1;i<out.length-1;i++){
    const p=merged[merged.length-1],c=out[i],n=out[i+1];
    const col=(p[0]===c[0]&&c[0]===n[0])||(p[1]===c[1]&&c[1]===n[1]);
    if(!col)merged.push(c);
  }
  merged.push(out[out.length-1]);
  return merged;
}
function edgePathRaw(e){
  const a=nodes.find(n=>n.id===e.from),b=nodes.find(n=>n.id===e.to);if(!a||!b)return null;
  const ba=nodeBox(a), bb=nodeBox(b);
  const route=e.route||'straight';
  if(route==='manual' && e.waypoints && e.waypoints.length>0){
    // 手动拐点：起点→各拐点→终点，端点裁剪到设备边缘
    let pts=[[a.x,ba.cy], ...e.waypoints.map(p=>p.slice()), [b.x,bb.cy]];
    pts[0]=edgeAnchorPoint(a, pts[1][0], pts[1][1], e.fromPort);
    pts[pts.length-1]=edgeAnchorPoint(b, pts[pts.length-2][0], pts[pts.length-2][1], e.toPort);
    // 强制正交：在非横平竖直的段之间插入直角拐点
    if(e.orthoSnap!==false){ pts=orthogonalize(pts); }
    return pts;
  }
  if(route==='arc'){
    const p0=edgeAnchorPoint(a, bb.cx, bb.cy, e.fromPort);
    const p1=edgeAnchorPoint(b, ba.cx, ba.cy, e.toPort);
    const mx=(p0[0]+p1[0])/2, my=(p0[1]+p1[1])/2;
    const dx=p1[0]-p0[0], dy=p1[1]-p0[1], len=Math.hypot(dx,dy)||1;
    const sib=edges.filter(x=>x.from===e.from); const idx=sib.indexOf(e);
    const bow=(40+idx*18)*((idx%2)?-1:1);
    const cx=mx-dy/len*bow, cy=my+dx/len*bow;
    const pts=[];
    for(let t=0;t<=1.001;t+=0.1){
      const x=(1-t)*(1-t)*p0[0]+2*(1-t)*t*cx+t*t*p1[0];
      const y=(1-t)*(1-t)*p0[1]+2*(1-t)*t*cy+t*t*p1[1];
      pts.push([x,y]);
    }
    return pts;
  }
  if(route==='ortho'){
    let pts;
    try{ pts=routeOrtho(a,b,e); }catch(err){ pts=null; }
    let cl = pts?clipEnds(pts,a,b,e):null;
    if(!cl || pathHitsNodes(cl,e.from,e.to)) cl=detourRoute(a,b,e);
    return cl;
  }
  if(route==='lshape'){
    // 简单 L 型：按 orthoDir 选择先横后竖或先竖后横（用于消除交叉，方向可切换）
    const p0=edgeAnchorPoint(a, bb.cx, bb.cy, e.fromPort);
    const p1=edgeAnchorPoint(b, ba.cx, ba.cy, e.toPort);
    let pts;
    if(e.orthoDir==='vh') pts=[p0,[p0[0],p1[1]],p1];
    else pts=[p0,[p1[0],p0[1]],p1];
    // 若该 L 穿设备，退回保底避障路由
    if(pathHitsNodes(pts,e.from,e.to)){
      pts=detourRoute(a,b,e);
      return pts;
    }
    return clipEnds(pts,a,b,e);
  }
  if(route==='line'){
    // 纯直线：起止锚点直连，始终保持为一条直线（不横平竖直、不自动避障、不汇流）
    return [edgeAnchorPoint(a, bb.cx, bb.cy, e.fromPort), edgeAnchorPoint(b, ba.cx, ba.cy, e.toPort)];
  }
  // 直线：动态锚点（随节点位置自适应）
  const p0=edgeAnchorPoint(a, bb.cx, bb.cy, e.fromPort);
  const p1=edgeAnchorPoint(b, ba.cx, ba.cy, e.toPort);
  // 若直线穿过其他设备，自动改用避障路由（默认直线·遇障碍转L）
  if(pathHitsNodes([p0,p1], e.from, e.to)){
    let pts;
    try{ pts=routeOrtho(a,b,e); }catch(err){ pts=null; }
    let cl = pts?clipEnds(pts,a,b,e):null;
    if(!cl || pathHitsNodes(cl,e.from,e.to)) cl=detourRoute(a,b,e);
    return cl;
  }
  return [p0,p1];
}
// ═══════════════════════════════════════════════════════════════
// 确定性通道布线引擎（v67）
// 一次性计算所有连线路径：同侧必汇合、横平竖直、不穿设备、不交叉、无断线、最少拐点
// ═══════════════════════════════════════════════════════════════
function sideOf(node, other){
  // 对端相对本节点的主方位
  const dx=other.x-node.x, dy=other.y-node.y;
  return (Math.abs(dx)>=Math.abs(dy)) ? (dx<0?'L':'R') : (dy<0?'T':'B');
}
function portSide(port){return {left:'L',right:'R',top:'T',bottom:'B'}[port]||null;}
function channelRoute(){
  _pathCache={};
  // 1) 每个节点：按侧分组其所有连线
  const sideMap={}; // nodeId -> {L:[edge..],R:[],T:[],B:[]}
  nodes.forEach(n=>sideMap[n.id]={L:[],R:[],T:[],B:[]});
  edges.forEach(e=>{
    const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
    if(!a||!b)return;
    e._sideFrom=portSide(e.fromPort)||sideOf(a,b);
    e._sideTo=portSide(e.toPort)||sideOf(b,a);
    sideMap[a.id][e._sideFrom].push(e);
    sideMap[b.id][e._sideTo].push(e);
  });
  // 2) 每个节点每侧分配一条主干通道（trunk）+ 统一汇流接入点（join）
  //    join 固定在该侧边缘中点；trunk 在该侧外延 gap 处
  const trunkInfo={}; // key node|side -> {trunkC, horiz, join}
  nodes.forEach(n=>{
    const box=nodeBox(n);
    ['L','R','T','B'].forEach(side=>{
      const arr=sideMap[n.id][side];
      if(arr.length===0)return;
      const gap=busMergeGap+Math.max(box.hw,box.hh);
      let trunkC, horiz, join;
      if(side==='L'){trunkC=box.left-gap;horiz=false;join=[box.left,box.cy];}
      else if(side==='R'){trunkC=box.right+gap;horiz=false;join=[box.right,box.cy];}
      else if(side==='T'){trunkC=box.top-gap;horiz=true;join=[box.cx,box.top];}
      else {trunkC=box.bottom+gap;horiz=true;join=[box.cx,box.bottom];}
      trunkInfo[n.id+'|'+side]={trunkC,horiz,join,box};
    });
  });
  // 3) 逐条连线生成路径（默认用「合并版」：强制经过共享主干点，使同侧完全合并成一条主干）
  const edgeCands={}; // cacheKey -> {merged, natural, variants:[...]}
  edges.forEach((e,i)=>{
    const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
    e._cacheKey=e.from+'>'+e.to+':'+i;
    if(!a||!b){_pathCache[e._cacheKey]=null;return;}
    const ba=nodeBox(a), bb=nodeBox(b);
    // 手动/弧线：按各自规则直接出图，不进入布线优化。
    if(e.route==='manual' || e.route==='arc' || e.route==='line'){ _pathCache[e._cacheKey]=edgePathRaw(e); return; }
    // 默认「智能最短」：能直连就直连，否则最短 L/Z（避开设备），再做交叉消除。
    if(!busAggregation){
      const vs=straightVariants(a,b,e);
      _pathCache[e._cacheKey]=vs[0]||edgePathRaw(e);
      edgeCands[e._cacheKey]={straight:true, variants:vs};
      return;
    }
    // 「母线汇流」模式：同侧多条连线合并到共享主干（竖直/水平母干）再接入对端。

    const tf=trunkInfo[a.id+'|'+e._sideFrom];
    const tt=trunkInfo[b.id+'|'+e._sideTo];
    const fJoin=isLinearBusNode(a)?edgeAnchorPoint(a,bb.cx,bb.cy,e.fromPort):tf.join.slice();
    const tJoin=isLinearBusNode(b)?edgeAnchorPoint(b,ba.cx,ba.cy,e.toPort):tt.join.slice();
    // 直连快速通道
    const aligned = Math.abs(ba.cx-bb.cx)<14 || Math.abs(ba.cy-bb.cy)<14;
    if(routeStyle!==1 && aligned){
      const p0=edgeAnchorPoint(a,bb.cx,bb.cy,e.fromPort), p1=edgeAnchorPoint(b,ba.cx,ba.cy,e.toPort);
      if(!pathHitsNodes([p0,p1],e.from,e.to)){ _pathCache[e._cacheKey]=[p0,p1]; edgeCands[e._cacheKey]=null; return; }
    }
    const fTrunkPt = tf.horiz ? [fJoin[0], tf.trunkC] : [tf.trunkC, fJoin[1]];
    const tTrunkPt = tt.horiz ? [tJoin[0], tt.trunkC] : [tt.trunkC, tJoin[1]];
    const safe=(p)=>{ if(!pathHitsNodes(p,e.from,e.to))return simplifyPath(p,e.from,e.to);
      let pts; try{ pts=routeOrtho(a,b,e); }catch(err){ pts=null; }
      let cl=pts?clipEnds(pts,a,b,e):null; if(!cl||pathHitsNodes(cl,e.from,e.to)) cl=detourRoute(a,b,e); return cl; };
    // 合并版：fJoin → fTrunkPt →(沿 to 主干法线收拢)→ tTrunkPt(共享) → tJoin
    let mPath=[fJoin, fTrunkPt];
    if(Math.abs(fTrunkPt[0]-tTrunkPt[0])>1 && Math.abs(fTrunkPt[1]-tTrunkPt[1])>1){
      const midX = tt.horiz ? fTrunkPt[0] : tTrunkPt[0];
      const midY = tt.horiz ? tTrunkPt[1] : fTrunkPt[1];
      mPath.push([midX,midY]);
    }
    mPath.push(tTrunkPt, tJoin);
    const merged=safe(dedupe(mPath));
    // 自然版：v67 走廊（交叉更少，但末段不一定重叠）
    let nPath=[fJoin, fTrunkPt];
    if(Math.abs(fTrunkPt[0]-tTrunkPt[0])>1 && Math.abs(fTrunkPt[1]-tTrunkPt[1])>1){
      const midX = tf.horiz ? tTrunkPt[0] : fTrunkPt[0];
      const midY = tf.horiz ? fTrunkPt[1] : tTrunkPt[1];
      nPath.push([midX,midY]);
    }
    nPath.push(tTrunkPt, tJoin);
    const natural=safe(dedupe(nPath));
    edgeCands[e._cacheKey]={merged, natural, fJoin, tJoin, tTrunkPt};
    _pathCache[e._cacheKey]=merged; // 默认优先合并
  });
  // 4) 合并优先 + 交叉消除：对造成交叉的边，依次尝试 自然版/走廊变体，取交叉最少
  optimizeChannel(edgeCands);
  // 5) 拐点汇合对齐：把相近的拐点(竖直/水平方向)对齐到同一通道并合并为共享节点，减少多余拐点、更整齐
  alignJunctions();
}
// 拐点汇合：把所有正交连线的拐点按"竖直段同列、水平段同行"约束聚类，
// 相近的通道(阈值内)对齐到同一坐标 → 平行段并入同一条线、相近拐点合并为一个汇合点；
// 端点(贴节点的锚点)与斜线不动，保证不破坏正交与连接。
function alignJunctions(){
  const T=40; // 汇合/对齐阈值（世界坐标）——足够大以便"对齐后微小偏差也自动汇合为同一通道/拐点，两条近平行线并为一条"；
              // 不同设备的主干间距(≈节点间距 sRef*2.5 ≈ 280)远大于此值，故不会误并相邻独立主干
  const verts=[]; const paths=[];
  edges.forEach(e=>{ const p=_pathCache[e._cacheKey];
    if(!p||p.length<3||e.route==='arc'||e.route==='manual'||e.route==='line') return; // 仅自动正交路径
    const base=verts.length;
    p.forEach((pt,i)=>verts.push({x:pt[0],y:pt[1],anchored:(i===0||i===p.length-1)}));
    paths.push({key:e._cacheKey,base,len:p.length});
  });
  if(verts.length<2)return;
  const px=verts.map((_,i)=>i), py=verts.map((_,i)=>i);
  const fx=a=>{while(px[a]!==a)a=px[a]=px[px[a]];return a;};
  const fy=a=>{while(py[a]!==a)a=py[a]=py[py[a]];return a;};
  // 段方向约束：竖直段两端必须同 X；水平段两端必须同 Y；斜线段两端锚定不动
  paths.forEach(pa=>{ for(let i=0;i<pa.len-1;i++){ const a=pa.base+i,b=pa.base+i+1;
    const dx=Math.abs(verts[a].x-verts[b].x), dy=Math.abs(verts[a].y-verts[b].y);
    if(dx<1 && dy>=1){ px[fx(a)]=fx(b); }
    else if(dy<1 && dx>=1){ py[fy(a)]=fy(b); }
    else { verts[a].anchored=true; verts[b].anchored=true; } // 斜线：固定
  }});
  function snapAxis(find,getC,setC){
    const groups={}; verts.forEach((v,i)=>{const r=find(i);(groups[r]=groups[r]||[]).push(i);});
    let cl=Object.values(groups).map(mem=>{ let anc=null,sum=0; mem.forEach(i=>{ if(verts[i].anchored&&anc==null)anc=getC(verts[i]); sum+=getC(verts[i]); }); return {mem,n:mem.length,anchored:anc!=null,val:anc!=null?anc:sum/mem.length}; });
    cl.sort((a,b)=>a.val-b.val);
    const out=[];
    for(const c of cl){ const last=out[out.length-1];
      if(last && Math.abs(c.val-last.val)<=T && !(last.anchored&&c.anchored)){
        if(last.anchored){ last.mem=last.mem.concat(c.mem); last.n+=c.n; }
        else if(c.anchored){ last.val=c.val; last.anchored=true; last.mem=last.mem.concat(c.mem); last.n+=c.n; }
        else { last.val=(last.val*last.n+c.val*c.n)/(last.n+c.n); last.mem=last.mem.concat(c.mem); last.n+=c.n; }
      } else out.push(c);
    }
    out.forEach(c=>c.mem.forEach(i=>setC(verts[i],c.val)));
  }
  snapAxis(fx, v=>v.x, (v,x)=>v.x=x);
  snapAxis(fy, v=>v.y, (v,y)=>v.y=y);
  // 写回并清理重复/共线点（去掉冗余拐点）
  paths.forEach(pa=>{
    let pts=[]; for(let i=0;i<pa.len;i++){const v=verts[pa.base+i]; pts.push([v.x,v.y]);}
    _pathCache[pa.key]=_dedupCollinear(pts);
  });
}
function _dedupCollinear(pts){
  if(pts.length<2)return pts;
  const out=[];
  for(const p of pts){ const l=out[out.length-1]; if(l && Math.abs(l[0]-p[0])<0.5 && Math.abs(l[1]-p[1])<0.5) continue; out.push(p.slice()); }
  if(out.length<3)return out;
  const res=[out[0]];
  for(let i=1;i<out.length-1;i++){ const a=res[res.length-1],b=out[i],c=out[i+1];
    const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
    const dot=(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]);
    if(Math.abs(cross)<0.5 && dot>=0) continue; // 共线同向 → 去掉中间点
    res.push(b);
  }
  res.push(out[out.length-1]);
  return res;
}
function _allPaths(){ return edges.map(e=>_pathCache[e._cacheKey]).filter(Boolean); }
function _countCross(){ const ps=_allPaths(); let n=0; for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++)if(pathsCross(ps[i],ps[j]))n++; return n; }
function _pathLen(p){ if(!p||p.length<2)return 0; let d=0; for(let i=0;i<p.length-1;i++)d+=Math.abs(p[i+1][0]-p[i][0])+Math.abs(p[i+1][1]-p[i][1]); return d; }
function _pathBends(p){
  if(!p||p.length<3)return 0;
  let n=0;
  for(let i=1;i<p.length-1;i++){
    const a=p[i-1],b=p[i],c=p[i+1];
    const dx1=Math.sign(b[0]-a[0]),dy1=Math.sign(b[1]-a[1]);
    const dx2=Math.sign(c[0]-b[0]),dy2=Math.sign(c[1]-b[1]);
    if(dx1!==dx2||dy1!==dy2)n++;
  }
  return n;
}
function _pathDetourPenalty(p,a,b){
  if(!p||p.length<2||!a||!b)return 0;
  const ba=nodeBox(a),bb=nodeBox(b);
  const direct=Math.hypot(bb.cx-ba.cx,bb.cy-ba.cy);
  const margin=Math.max(80,Math.min(180,direct*0.35));
  const minX=Math.min(ba.left,bb.left)-margin,maxX=Math.max(ba.right,bb.right)+margin;
  const minY=Math.min(ba.top,bb.top)-margin,maxY=Math.max(ba.bottom,bb.bottom)+margin;
  let pen=0;
  p.forEach(pt=>{
    if(pt[0]<minX)pen+=minX-pt[0]; else if(pt[0]>maxX)pen+=pt[0]-maxX;
    if(pt[1]<minY)pen+=minY-pt[1]; else if(pt[1]>maxY)pen+=pt[1]-maxY;
  });
  return pen;
}
function _pathScore(p,a,b){
  return _pathLen(p)+_pathBends(p)*18+_pathDetourPenalty(p,a,b)*4;
}
function dropOverroutedManualWaypoints(e){
  if(!e||e.route!=='manual'||!e.waypoints||!e.waypoints.length)return;
  const a=nodes.find(n=>n.id===e.from),b=nodes.find(n=>n.id===e.to);
  if(!a||!b)return;
  const manual=edgePathRaw(e);
  const autoEdge=Object.assign({},e,{route:'smart'});
  delete autoEdge.waypoints;
  const auto=(straightVariants(a,b,autoEdge)[0]||edgePathRaw(autoEdge));
  if(!manual||!auto)return;
  const manualScore=_pathScore(manual,a,b);
  const autoScore=_pathScore(auto,a,b);
  if(manualScore>autoScore*1.35+60){
    delete e.waypoints;
    e.route='smart';
  }
}
// 直线模式候选：直连优先，其次最短 L，再 Z 中线，最后 A* 兜底；全部已避开设备。
// 顺序即「偏好度」，优化器在交叉数相同的情况下取更靠前/更短者。
function straightVariants(a,b,e){
  const ba=nodeBox(a), bb=nodeBox(b);
  const p0=edgeAnchorPoint(a,bb.cx,bb.cy,e.fromPort), p1=edgeAnchorPoint(b,ba.cx,ba.cy,e.toPort);
  const out=[];
  const seen=new Set();
  const push=(pts)=>{ if(!pts||pts.length<2)return; const k=pts.map(p=>Math.round(p[0])+','+Math.round(p[1])).join(';'); if(seen.has(k))return; seen.add(k); out.push(pts); };
  const add=(raw)=>{ const cl=clipEnds(raw.map(p=>p.slice()),a,b,e); if(cl&&!pathHitsNodes(cl,e.from,e.to)) push(simplifyPath(cl,e.from,e.to)); };
  // 0) 直线（端点直连）
  if(!pathHitsNodes([p0,p1],e.from,e.to)) push([p0.slice(),p1.slice()]);
  // 1) 两种 L 型
  add([p0,[p1[0],p0[1]],p1]);  // 先横后竖
  add([p0,[p0[0],p1[1]],p1]);  // 先竖后横
  // 2) Z 型中线（横/竖各取若干分割比例）
  for(const f of [0.5,0.35,0.65,0.25,0.75]){
    const mx=p0[0]+(p1[0]-p0[0])*f, my=p0[1]+(p1[1]-p0[1])*f;
    add([p0,[mx,p0[1]],[mx,p1[1]],p1]);
    add([p0,[p0[0],my],[p1[0],my],p1]);
  }
  // 3) A* 正交避障兜底
  try{ const o=routeOrtho(a,b,e); add(o); }catch(_){}
  if(out.length===0) out.push(detourRoute(a,b,e)||[p0.slice(),p1.slice()]);
  // 按长度排序，但直连（含 2 点的真直线）永远排第一
  const straightFirst = out[0] && out[0].length===2 ? out.shift() : null;
  out.sort((u,v)=>_pathScore(u,a,b)-_pathScore(v,a,b));
  if(straightFirst) out.unshift(straightFirst);
  return out;
}
function optimizeChannel(edgeCands){
  let best=_countCross();
  if(best===0)return;
  for(let iter=0; iter<20 && best>0; iter++){
    let improved=false;
    const ranked=edges.map(e=>{const p=_pathCache[e._cacheKey];let c=0;if(p)edges.forEach(o=>{if(o!==e){const op=_pathCache[o._cacheKey];if(op&&pathsCross(p,op))c++;}});return{e,c};}).filter(x=>x.c>0).sort((p,q)=>q.c-p.c);
    for(const {e} of ranked){
      const ck=e._cacheKey; const cand=edgeCands[ck]; if(!cand)continue;
      const orig=_pathCache[ck];
      // 候选列表：直线模式用其 L/Z 候选；通道模式用 合并/自然/走廊变体。
      const tries = cand.straight ? cand.variants.slice() : (()=>{const t=[];if(cand.merged)t.push(cand.merged);if(cand.natural)t.push(cand.natural);t.push(...buildCorridorVariants(e));return t;})();
      // 选交叉最少；并列时取更短；再并列时取更靠前（偏好度更高）的候选。
      const a=nodes.find(n=>n.id===e.from),b=nodes.find(n=>n.id===e.to);
      let bc=best, bestV=null, bestScore=Infinity, bestTi=Infinity;
      for(let ti=0;ti<tries.length;ti++){ const v=tries[ti]; if(!v)continue; _pathCache[ck]=v; const now=_countCross(); const score=_pathScore(v,a,b);
        if(now<bc || (now===bc && (score<bestScore-0.5 || (Math.abs(score-bestScore)<=0.5 && ti<bestTi)))){bc=now;bestV=v;bestScore=score;bestTi=ti;} }
      if(bestV && bc<=best){_pathCache[ck]=bestV; if(bc<best)improved=true; best=bc;}
      else _pathCache[ck]=orig;
      if(best===0)break;
    }
    if(!improved)break;
  }
}
function buildCorridorVariants(e){
  // 为一条边生成走廊变体，但保留最后两点（共享主干接入段）不变，避免破坏同侧合并
  const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
  if(!a||!b)return [];
  const cur=_pathCache[e._cacheKey];
  if(!cur||cur.length<3)return [];
  // 锁定尾段：共享主干点 + join（最后两点）
  const tail=cur.slice(-2);          // [sharedTrunkPt, tJoin]
  const head=cur[0];                  // fJoin
  const entry=tail[0];                // 共享主干点（必须到达此点）
  const variants=[];
  // 在 head→entry 之间尝试不同的 L / Z 走法
  const Hx=head[0],Hy=head[1],Ex=entry[0],Ey=entry[1];
  const mids=[
    [[Ex,Hy]],                        // 先横后竖
    [[Hx,Ey]],                        // 先竖后横
  ];
  for(const f of [0.35,0.5,0.65]){
    const mx=Hx+(Ex-Hx)*f, my=Hy+(Ey-Hy)*f;
    mids.push([[mx,Hy],[mx,Ey]]);     // 竖直中线
    mids.push([[Hx,my],[Ex,my]]);     // 水平中线
  }
  for(const mid of mids){
    const cand=dedupe([head, ...mid, entry, tail[1]]);
    variants.push(cand);
  }
  return variants.map(v=>simplifyPath(v,e.from,e.to)).filter(v=>!pathHitsNodes(v,e.from,e.to));
}
function recomputeAllPaths(){
  // 清除悬空连线
  const nodeIds=new Set(nodes.map(n=>n.id));
  edges=edges.filter(e=>nodeIds.has(e.from)&&nodeIds.has(e.to));
  _occPts=new Set();
  channelRoute();
}
// 汇流合并：把共享同一端点、且从同方向接入的多条连线，在临近节点处合并到一条主干通道
function approachSide(pt, box){
  // 判断 pt 相对节点盒在哪一侧
  const dx=pt[0]-box.cx, dy=pt[1]-box.cy;
  if(Math.abs(dx)>Math.abs(dy)) return dx<0?'L':'R';
  return dy<0?'T':'B';
}
// 保底避障路由：尝试多条正交折线，返回第一条不穿任何设备的；都不行则返回穿越最少的
function detourRoute(a,b,e){
  const ba=nodeBox(a), bb=nodeBox(b);
  const p0=edgeAnchorPoint(a,bb.cx,bb.cy,e.fromPort), p1=edgeAnchorPoint(b,ba.cx,ba.cy,e.toPort);
  // 收集所有障碍（排除 a、b）的边界，作为候选绕行通道
  const obs=nodes.filter(n=>n.id!==a.id&&n.id!==b.id).map(n=>nodeBox(n));
  const cands=[];
  // 基本 L 型两种
  cands.push([p0,[p1[0],p0[1]],p1]);
  cands.push([p0,[p0[0],p1[1]],p1]);
  // Z 型：在中间某 x 或 y 处转折（尝试障碍上下/左右边缘外侧）
  const xsMid=[(p0[0]+p1[0])/2];
  const ysMid=[(p0[1]+p1[1])/2];
  obs.forEach(o=>{ xsMid.push(o.left-22,o.right+22); ysMid.push(o.top-22,o.bottom+22); });
  xsMid.forEach(mx=>cands.push([p0,[mx,p0[1]],[mx,p1[1]],p1]));
  ysMid.forEach(my=>cands.push([p0,[p0[0],my],[p1[0],my],p1]));
  // 选第一条完全不穿设备的；否则穿越最少的
  let best=null, bestHits=Infinity;
  for(const c of cands){
    const cl=clipEnds(c,a,b,e);
    let hits=0;
    for(const n of nodes){ if(n.id===a.id||n.id===b.id)continue;
      for(let i=0;i<cl.length-1;i++) if(segRectHit(cl[i][0],cl[i][1],cl[i+1][0],cl[i+1][1],n,6)){hits++;break;}
    }
    if(hits===0) return cl;
    if(hits<bestHits){bestHits=hits;best=cl;}
  }
  return best||clipEnds([p0,p1],a,b,e);
}
function applyBusMerge(){
  _busTrunks=[];
  nodes.forEach(node=>{
    ['to','from'].forEach(role=>{
      // 仅合并已是正交折线（≥3 点）的连线
      const grp=edges.filter(e=>e[role]===node.id && _pathCache[e._cacheKey] && _pathCache[e._cacheKey].length>=3);
      if(grp.length<2)return;
      const box=nodeBox(node);
      const bySide={};
      grp.forEach(e=>{
        const otherId=(role==='to')?e.from:e.to;
        const other=nodes.find(n=>n.id===otherId);
        let side;
        if(other){
          const dx=other.x-node.x, dy=other.y-node.y;
          side=(Math.abs(dx)>=Math.abs(dy))?(dx<0?'L':'R'):(dy<0?'T':'B');
        }else{
          const pts=_pathCache[e._cacheKey];const endPt=(role==='to')?pts[pts.length-1]:pts[0];
          side=approachSide(endPt, box);
        }
        (bySide[side]=bySide[side]||[]).push(e);
      });
      Object.entries(bySide).forEach(([side,es])=>{
        if(es.length<2)return;
        const bkey=node.id+'|'+role+'|'+side;
        const userOff=busOffsets[bkey]||0;
        const TRUNK=Math.max(box.hw,box.hh)+busMergeGap+userOff;
        let horiz, trunkC, joinPt;
        if(side==='L'){trunkC=box.left-TRUNK;horiz=false;joinPt=[box.left,box.cy];}
        else if(side==='R'){trunkC=box.right+TRUNK;horiz=false;joinPt=[box.right,box.cy];}
        else if(side==='T'){trunkC=box.top-TRUNK;horiz=true;joinPt=[box.cx,box.top];}
        else {trunkC=box.bottom+TRUNK;horiz=true;joinPt=[box.cx,box.bottom];}
        // 重建每条线的完整路径（从对端到本节点），保证几何干净、无残段：
        //   对端锚点 →(L型)→ 主干车道点 → 主干交点 → 沿主干到汇流点 → 节点汇流点
        //   若重建路径穿过其它设备，则该线退出合并、改用 A* 正交避障路由
        es.forEach(e=>{
          const otherId=(role==='to')?e.from:e.to;
          const other=nodes.find(n=>n.id===otherId);
          if(!other)return;
          const ob=nodeBox(other);
          const laneC = horiz ? ob.cx : ob.cy;
          const trunkPtLane = horiz?[laneC,trunkC]:[trunkC,laneC];
          const trunkPtJoin = horiz?[joinPt[0],trunkC]:[trunkC,joinPt[1]];
          const oAnchor = anchorPoint(other, trunkPtLane[0], trunkPtLane[1]);
          let pre;
          if(horiz){ pre=[oAnchor,[oAnchor[0],trunkC],trunkPtLane]; }
          else{ pre=[oAnchor,[trunkC,oAnchor[1]],trunkPtLane]; }
          const full=[...pre, trunkPtJoin, joinPt.slice()];
          const merged = role==='to' ? dedupe(full) : dedupe(full.slice().reverse());
          // 障碍物避让检测：合并后的路径不得穿过任何其它设备
          if(pathHitsNodes(merged, e.from, e.to)){
            // 退出合并：用避障正交路由重算这条线
            const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
            let pts; try{ pts=routeOrtho(a,b,e); }catch(err){ pts=null; }
            let clipped = pts? clipEnds(pts,a,b,e) : null;
            // 若 A* 仍穿设备（或失败），用「绕到障碍上/下方」的保底正交折线
            if(!clipped || pathHitsNodes(clipped, e.from, e.to)){
              clipped = detourRoute(a,b,e);
            }
            _pathCache[e._cacheKey]=clipped;
            e._mergeSkipped=true;
          }else{
            _pathCache[e._cacheKey]=merged;
            e._mergeSkipped=false;
          }
        });
        // 记录主干用于（可选）加粗母线绘制：跨度取所有车道交点 + 汇流点
        const laneVals=es.map(e=>{const pts=_pathCache[e._cacheKey];
          // 找主干线上的点（坐标≈trunkC 的那些点的另一轴值）
          const onTrunk=pts.filter(p=>Math.abs((horiz?p[1]:p[0])-trunkC)<0.5);
          return onTrunk.map(p=>horiz?p[0]:p[1]);
        }).flat();
        const allVals=[...laneVals, horiz?joinPt[0]:joinPt[1]];
        const etColor=(ET[es[0].et]||ET.ac_power).color;
        if(horiz) _busTrunks.push({horiz:true, y:trunkC, a:Math.min(...allVals), b:Math.max(...allVals), color:etColor, joinPt, bkey, side});
        else _busTrunks.push({horiz:false, x:trunkC, a:Math.min(...allVals), b:Math.max(...allVals), color:etColor, joinPt, bkey, side});
      });
    });
  });
  if(busShareTrunk) shareNearbyTrunks();
}
// 跨设备共享主干：把坐标接近、同朝向的主干通道对齐到同一条线，并把相关连线改走该共享线
function shareNearbyTrunks(){
  const THRESH=42; // 主干间距小于此值视为可共享
  // 分别处理竖直主干（按 x 聚类）和水平主干（按 y 聚类）
  ['v','h'].forEach(orient=>{
    const group=_busTrunks.filter(t=>orient==='v'?!t.horiz:t.horiz);
    if(group.length<2)return;
    // 按坐标排序聚类
    const coordOf=t=>orient==='v'?t.x:t.y;
    const sorted=[...group].sort((p,q)=>coordOf(p)-coordOf(q));
    let cluster=[sorted[0]];
    const flush=cl=>{
      if(cl.length<2)return;
      // 仅当这些主干属于不同设备且同侧朝向时才共享
      const shared=cl.reduce((s,t)=>s+coordOf(t),0)/cl.length;
      // 收集所有相关连线在该共享线上的实际坐标点，用于确定母线真实跨度
      const along=[]; // 沿主干方向的坐标值
      cl.forEach(t=>{
        const old=coordOf(t);
        if(orient==='v')t.x=shared; else t.y=shared;
        t._shared=true;
        edges.forEach(e=>{
          const pts=_pathCache[e._cacheKey];if(!pts)return;
          let touched=false;
          pts.forEach(p=>{
            if(orient==='v'&&Math.abs(p[0]-old)<0.5){p[0]=shared;touched=true;}
            if(orient==='h'&&Math.abs(p[1]-old)<0.5){p[1]=shared;touched=true;}
          });
          if(touched){
            _pathCache[e._cacheKey]=dedupe(pts);
            // 记录这条线落在共享主干上的点（沿主干方向坐标）
            pts.forEach(p=>{
              if(orient==='v'&&Math.abs(p[0]-shared)<0.5)along.push(p[1]);
              if(orient==='h'&&Math.abs(p[1]-shared)<0.5)along.push(p[0]);
            });
          }
        });
      });
      // 母线跨度按实际连线落点确定，避免画出没有连线的游离段
      if(along.length){
        const lo=Math.min(...along), hi=Math.max(...along);
        cl.forEach(t=>{t.a=lo;t.b=hi;});
      }
    };
    for(let i=1;i<sorted.length;i++){
      if(Math.abs(coordOf(sorted[i])-coordOf(cluster[cluster.length-1]))<THRESH)cluster.push(sorted[i]);
      else{flush(cluster);cluster=[sorted[i]];}
    }
    flush(cluster);
  });
}
function dedupe(pts){
  const out=[pts[0]];
  for(let i=1;i<pts.length;i++){const p=out[out.length-1],c=pts[i];if(Math.abs(p[0]-c[0])>0.5||Math.abs(p[1]-c[1])>0.5)out.push(c);}
  return out;
}
// 路径简化：去掉共线的中间点（把能拉直的拐点拉直），减少多余台阶
function simplifyPath(pts, fromId, toId){
  if(!pts||pts.length<3)return pts;
  let p=dedupe(pts);
  // 1) 移除共线点：若 a-b-c 三点共线，去掉 b
  let changed=true;
  while(changed){
    changed=false;
    const out=[p[0]];
    for(let i=1;i<p.length-1;i++){
      const a=out[out.length-1], b=p[i], c=p[i+1];
      const cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      if(Math.abs(cross)<1){ changed=true; continue; } // 共线，跳过 b
      out.push(b);
    }
    out.push(p[p.length-1]);
    p=out;
  }
  // 2) 捷径化：去掉单个拐点（直连不穿设备且保持正交）
  changed=true;
  while(changed && p.length>2){
    changed=false;
    for(let i=1;i<p.length-1;i++){
      const a=p[i-1], c=p[i+1];
      if(!pathHitsNodes([a,c], fromId, toId)){
        const isOrtho=Math.abs(a[0]-c[0])<1||Math.abs(a[1]-c[1])<1;
        if(isOrtho){ p=p.slice(0,i).concat(p.slice(i+1)); changed=true; break; }
      }
    }
  }
  return dedupe(p);
}
// 单条连线的智能路径（最短·避障；手动/弧线按各自规则），并写入缓存
function computeSmartEdge(e){
  const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
  if(!a||!b) return null;
  if(!e._cacheKey) e._cacheKey=e.from+'>'+e.to+':'+edges.indexOf(e);
  let p;
  if(e.route==='manual' || e.route==='arc' || e.route==='line') p=edgePathRaw(e);
  else { const vs=straightVariants(a,b,e); p=vs[0]||edgePathRaw(e); }
  _pathCache[e._cacheKey]=p;
  return p;
}
function edgePath(e){
  // 拖动中：只对「与被拖动节点相连」的连线做实时重算，其余连线复用缓存（其几何未变），大幅提速
  if(_dragging && _dragIds.size){
    if(_dragIds.has(e.from) || _dragIds.has(e.to)) return computeSmartEdge(e);
    if(e._cacheKey && _pathCache[e._cacheKey]) return _pathCache[e._cacheKey];
    return computeSmartEdge(e);
  }
  // 非拖动：拓扑变化时整体重算（含交叉消除优化）
  const sig=topoSig();
  if(sig!==_pathCacheSig){ _pathCacheSig=sig; recomputeAllPaths(); }
  if(e._cacheKey && _pathCache[e._cacheKey]) return _pathCache[e._cacheKey];
  // 回退
  const ek=e.from+'>'+e.to+':'+edges.indexOf(e);
  if(_pathCache[ek]) return _pathCache[ek];
  const p=edgePathRaw(e); return p;
}
function edgeAt(wx,wy){
  for(const e of edges){const pts=edgePath(e);if(!pts)continue;
    for(let i=0;i<pts.length-1;i++){
      const[x1,y1]=pts[i],[x2,y2]=pts[i+1];const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy);if(len<1)continue;
      const t=((wx-x1)*dx+(wy-y1)*dy)/(len*len);if(t<0||t>1)continue;
      if(Math.sqrt((wx-x1-t*dx)**2+(wy-y1-t*dy)**2)<9/zoom)return e;
    }}return null;
}

function loop(ts){animT=ts*.001;drawAll();requestAnimationFrame(loop);}
function hexRgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function rgba(h,a){const[r,g,b]=hexRgb(h);return`rgba(${r},${g},${b},${a})`;}

// 汇合/分支「电气节点」：在多条连线交汇于同一点、或某连线端点接入另一条连线处，画一个实心点，
// 让"两线并为一处""线路在此分支/接入"一目了然（拖动对齐到同一通道、自动汇合后即出现该节点点）。
function drawJunctionDots(){
  const paths=[]; edges.forEach(e=>{ if(_dyn.hiddenEdges.has(e))return; const p=_pathCache[e._cacheKey]||e._drawPts; if(p&&p.length>=2) paths.push({e,p,col:(ET[e.et]||ET.ac_power).color}); });
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
  if(busMerge&&_busTrunks.length&&!_interacting&&busShowHandles){
    ctx.save();
    _busTrunks.forEach(t=>{
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
      if(n.type==='text'&&n._textBox){const b=n._textBox;bx=b.x-3/zoom;by=b.y-3/zoom;bw=b.w+6/zoom;bh=b.h+6/zoom;}
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
    else if(edgeHasRule(e)) drawCondBadge(m[0]+9/zoom, m[1]-9/zoom);      // 有规则但当前显示：琥珀点
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
  const img=CUSTOM_ICONS[n.type]||IMGS[n.type];const s=nsz(n);
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
    else if(nodeHasRule(n)) drawCondBadge(n.x+s*0.34, n.y-s*0.66);
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
    const sig=n.id+'.'+f.key;
    if(Object.prototype.hasOwnProperty.call(ctxv,sig)){
      const v=ctxv[sig];
      if(v!==''&&v!=null)return label?(label+'：'+v):String(v);
    }
    if(f.dv!==''&&f.dv!=null)return label?(label+'：'+f.dv):String(f.dv);
  }
  return label;
}
// 文本框元素渲染
function drawTextNode(n){
  const isSel=selNode===n.id;
  const fs=(n.fontSize||18)*(n.scale||1);
  const txt=textNodeDisplay(n);
  ctx.save();
  const rot=(n.rotation||0)*Math.PI/180;
  if(rot){ctx.translate(n.x,n.y);ctx.rotate(rot);ctx.translate(-n.x,-n.y);}
  ctx.font='bold '+fs+"px -apple-system,'Microsoft YaHei',sans-serif";ctx.textAlign='center';ctx.textBaseline='middle';
  const lines=txt.split('\n');
  let maxW=0;lines.forEach(l=>{maxW=Math.max(maxW,ctx.measureText(l).width);});
  const padX=(n.padX!=null?n.padX:10), padY=(n.padY!=null?n.padY:6);
  const lh=fs*1.3, totalH=lines.length*lh;
  n._textBox={x:n.x-maxW/2-padX,y:n.y-totalH/2-padY,w:maxW+padX*2,h:totalH+padY*2};
  const b=n._textBox, rr=(n.radius!=null?n.radius:6);
  // 背景填充
  if(!n.hideLabel && n.bg && n.bg!=='none'){
    ctx.fillStyle=n.bg;ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(b.x,b.y,b.w,b.h,rr);else ctx.rect(b.x,b.y,b.w,b.h);
    ctx.fill();
  }
  // 边框
  if(!n.hideLabel && n.border && n.border!=='none'){
    ctx.strokeStyle=n.borderColor||'#4dd0ff';ctx.lineWidth=(n.borderWidth||1.5)/zoom;
    if(n.border==='dashed')ctx.setLineDash([6/zoom,4/zoom]);
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(b.x,b.y,b.w,b.h,rr);else ctx.rect(b.x,b.y,b.w,b.h);
    ctx.stroke();ctx.setLineDash([]);
  }
  // 选中虚线框
  if(isSel){
    ctx.strokeStyle='#4dd0ff';ctx.lineWidth=1.5/zoom;ctx.setLineDash([4/zoom,4/zoom]);
    ctx.strokeRect(b.x-3/zoom,b.y-3/zoom,b.w+6/zoom,b.h+6/zoom);ctx.setLineDash([]);
    if(selSet.size<=1){
      const hs=5/zoom;
      const corners=[[b.x-3/zoom,b.y-3/zoom],[b.x+b.w+3/zoom,b.y-3/zoom],[b.x-3/zoom,b.y+b.h+3/zoom],[b.x+b.w+3/zoom,b.y+b.h+3/zoom]];
      n._resizeHandles=corners.map(c=>rotatePt(c[0],c[1],n.x,n.y,rot));
      n._resizeHandle=n._resizeHandles[3];
      ctx.fillStyle='#fff';ctx.strokeStyle='#4dd0ff';ctx.lineWidth=2/zoom;
      corners.forEach(c=>{ctx.fillRect(c[0]-hs,c[1]-hs,hs*2,hs*2);ctx.strokeRect(c[0]-hs,c[1]-hs,hs*2,hs*2);});
      // 旋转手柄
      const rcx=n.x, rcy=b.y-3/zoom-16/zoom;
      n._rotHandle=rotatePt(rcx,rcy,n.x,n.y,rot);
      ctx.strokeStyle='#4dd0ff';ctx.lineWidth=1.5/zoom;
      ctx.beginPath();ctx.moveTo(n.x,b.y-3/zoom);ctx.lineTo(rcx,rcy);ctx.stroke();
      ctx.fillStyle='#4dd0ff';ctx.beginPath();ctx.arc(rcx,rcy,5/zoom,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(rcx,rcy,2/zoom,0,Math.PI*2);ctx.fill();
    }
  }
  if(!n.hideLabel){
    ctx.fillStyle=n.fontColor||'#ffffff';
    if(!n.bg||n.bg==='none'){ctx.shadowColor='rgba(0,0,0,0.6)';ctx.shadowBlur=3/zoom;}
    lines.forEach((l,i)=>{ctx.fillText(l,n.x,n.y-totalH/2+lh*(i+0.5));});
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
  n.data.forEach((f,i)=>{
    if(f.hidden)return;
    const pos=fieldChipPos(n,i);
    const txt=fieldChipText(f);
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
    ctx.fillStyle=chipSel?'rgba(40,70,110,0.92)':'rgba(10,22,40,0.82)';
    ctx.strokeStyle=chipSel?'#ffcc44':(isSel?'rgba(77,208,255,0.7)':'rgba(120,150,180,0.3)');ctx.lineWidth=(chipSel?1.8:1.2)/zoom;
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(bx,by,bw,bh,rr);else ctx.rect(bx,by,bw,bh);
    ctx.fill();ctx.stroke();
    // 文字：字段名浅色，值强调色
    const k=dataKey(f), kw=ctx.measureText(k+': ').width;
    ctx.fillStyle='#9fc0dd';ctx.fillText(k+': ',bx+padX,pos.y);
    const _hv=(f.dv!=null&&f.dv!=='');         // 有值(含 0)→强调色显示；无值→留空
    const v=_hv?f.dv:'';
    ctx.fillStyle=_hv?'#4dd0ff':'#6b8299';
    ctx.fillText(''+v,bx+padX+kw,pos.y);
    f._chipBox={x:bx,y:by,w:bw,h:bh};
  });
}
// 命中测试：返回 {node, fieldIndex} 若点中某 chip
function fieldChipAt(wx,wy){
  if(!showFieldChips)return null;
  for(let i=nodes.length-1;i>=0;i--){
    const n=nodes[i];if(!n.data)continue;
    for(let j=0;j<n.data.length;j++){
      const b=n.data[j]._chipBox;if(!b)continue;
      if(wx>=b.x&&wx<=b.x+b.w&&wy>=b.y&&wy<=b.y+b.h)return {node:n,fi:j};
    }
  }
  return null;
}
// 命中选中连线的拐点手柄
function waypointAt(e,wx,wy){
  if(!e||!e.waypoints)return -1;
  const tol=8/zoom;
  for(let i=0;i<e.waypoints.length;i++){
    const p=e.waypoints[i];
    if(Math.abs(wx-p[0])<tol&&Math.abs(wy-p[1])<tol)return i;
  }
  return -1;
}
// 命中选中连线某段的中点「+」（返回应插入的 waypoint 索引）
function segMidAt(e,wx,wy){
  if(!e||!e._drawPts)return -1;
  const pts=e._drawPts, tol=9/zoom;
  for(let i=0;i<pts.length-1;i++){
    const mx=(pts[i][0]+pts[i+1][0])/2, my=(pts[i][1]+pts[i+1][1])/2;
    if(Math.hypot(wx-mx,wy-my)<tol){
      // 段 i 对应在 waypoints 中插入的位置：起点段=0，之后每段+1
      return {insertAt:i, x:mx, y:my};
    }
  }
  return -1;
}
// 命中非手动连线的拐点(方向变化处)，返回拐点坐标 {x,y}；用于"抓住拐点直接拖动对齐/汇合"
// 点是否落在折线（任一段）上（容差 tol）——用于判断"某拐点是否与另一条线重叠"
function ptOnPolyline(p,pts,tol){
  for(let i=0;i<pts.length-1;i++){ const a=pts[i],b=pts[i+1];
    const dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy||1; let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2; t=Math.max(0,Math.min(1,t));
    if(Math.hypot(p[0]-(a[0]+t*dx),p[1]-(a[1]+t*dy))<tol)return true;
  }
  return false;
}
function cornerAt(e,wx,wy){
  if(!e||!e._drawPts)return null;
  const pts=e._drawPts, tol=8/zoom;
  for(let i=1;i<pts.length-1;i++){
    const a=pts[i-1],c=pts[i],d=pts[i+1];
    if(Math.abs((c[0]-a[0])*(d[1]-a[1])-(c[1]-a[1])*(d[0]-a[0]))<=1)continue; // 共线
    if(Math.abs(wx-c[0])<tol&&Math.abs(wy-c[1])<tol)return {x:c[0],y:c[1]};
  }
  return null;
}
function ensureManual(e){
  // 将连线转为可编辑的手动折线：用当前绘制点作为初始 waypoints（去掉首尾锚点）
  if(e.route==='manual' && e.waypoints) return;
  const pts=edgePath(e)||[];
  const inner=pts.slice(1,-1).map(p=>p.slice());
  e.route='manual';
  e.waypoints=inner;
  simplifyWaypoints(e);  // 自动布线常带很多台阶拐点，转手动后先精简，避免“越点越多”
}
// 精简手动连线的拐点：删除共线/重复的冗余拐点，只保留真正改变走向的点。
// 目的：加拐点是为了快速汇合/对齐，而不是堆出越来越多的台阶。
function simplifyWaypoints(e){
  if(!e||e.route!=='manual'||!e.waypoints||e.waypoints.length<1)return;
  const a=nodes.find(n=>n.id===e.from),b=nodes.find(n=>n.id===e.to);
  if(!a||!b)return;
  let wps=e.waypoints.map(p=>p.slice());
  const start=edgeAnchorPoint(a, wps[0][0], wps[0][1], e.fromPort);
  const end=edgeAnchorPoint(b, wps[wps.length-1][0], wps[wps.length-1][1], e.toPort);
  let pts=dedupe([start,...wps,end]);
  // 去掉共线中间点（端点也参与判断，能把整段拉直）
  let changed=true;
  while(changed && pts.length>2){
    changed=false;
    for(let i=1;i<pts.length-1;i++){
      const p=pts[i-1],c=pts[i],n=pts[i+1];
      const cross=(c[0]-p[0])*(n[1]-p[1])-(c[1]-p[1])*(n[0]-p[0]);
      if(Math.abs(cross)<1.5){ pts.splice(i,1); changed=true; break; }
    }
  }
  e.waypoints=pts.slice(1,-1).map(p=>p.slice());
}
// 在当前（已精简）路径上，按坐标求新拐点应插入的 waypoint 索引
function waypointInsertIndex(e,x,y){
  const pts=edgePath(e)||[];
  let best=0,bestD=Infinity;
  for(let i=0;i<pts.length-1;i++){
    const [x1,y1]=pts[i],[x2,y2]=pts[i+1];
    const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy||1;
    let t=((x-x1)*dx+(y-y1)*dy)/len2; t=Math.max(0,Math.min(1,t));
    const px=x1+t*dx,py=y1+t*dy,d=Math.hypot(x-px,y-py);
    if(d<bestD){bestD=d;best=i;}
  }
  return best; // 段 i（pts[i]→pts[i+1]）对应在 inner waypoints 中的插入位置
}
// 标签背景板颜色（用纯背景色不透明，彻底遮住下方连线，避免文字与线叠加）
function bgPlate(){
  return bgColor;
}

function selectNode(id){
  ensurePropsOpen();
  selNode=id;selEdge=null;const n=nodes.find(x=>x.id===id);if(!n){showPanel('none');return;}
  showPanel('node');
  document.getElementById('p-id').value=n.id;
  document.getElementById('p-label-zh').value=n.labelZh||n.label||'';
  document.getElementById('p-label-en').value=n.labelEn||'';
  document.getElementById('p-type').value=n.type;document.getElementById('p-status').value=n.status||'';
  const seEl=document.getElementById('p-status-en');
  seEl.value=n.statusEn||'';
  seEl.placeholder=(STATUS_EN[n.status]||'')||'自动映射，可手动覆盖';
  document.getElementById('p-fs').value=n.fontSize||14;document.getElementById('p-fs-v').textContent=n.fontSize||14;
  const sc=Math.round((n.scale||1)*100);document.getElementById('p-scale').value=sc;document.getElementById('p-scale-v').textContent=sc;
  document.getElementById('p-rot').value=n.rotation||0;document.getElementById('p-rot-v').textContent=n.rotation||0;
  document.getElementById('p-fc').value=n.fontColor||'#e8f4ff';document.getElementById('p-fc-hex').value=n.fontColor||'#e8f4ff';
  document.getElementById('p-x').textContent=n.x.toFixed(0);document.getElementById('p-y').textContent=n.y.toFixed(0);
  // 文本框元素：隐藏类型/状态/图标大小，数据字段走与其它元素一致的标准配置
  const isText=n.type==='text';
  ['prow-type','prow-status','prow-status-en','prow-scale'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=isText?'none':'';});
  ['prow-data','prow-datasep'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='';});
  // 画布显示开关：反映当前节点的 hideLabel / hideFields
  const slEl=document.getElementById('p-show-label'),sfEl=document.getElementById('p-show-fields');
  if(slEl)slEl.checked=!n.hideLabel; if(sfEl)sfEl.checked=!n.hideFields;
  const slTxt=document.getElementById('p-show-label-text'),sfWrap=document.getElementById('p-show-fields-wrap');
  if(slTxt){slTxt.textContent=isText?(lang==='en'?'Show Text':'显示文本'):(lang==='en'?'Show Name':'显示名称');slTxt.setAttribute('data-i18n',isText?'显示文本':'显示名称');}
  if(sfWrap)sfWrap.style.display=isText?'none':'flex';
  // 占位点外观：仅 anchor 类型显示填充/不透明度
  const isAnchor=n.type==='anchor';
  document.getElementById('anchor-style').style.display=isAnchor?'block':'none';
  if(isAnchor){
    const hasFill=(n.fill&&n.fill!=='none');
    document.getElementById('p-anchor-fill').value=hasFill?n.fill:'#4dd0ff';
    document.getElementById('p-anchor-fill-hex').value=hasFill?n.fill:'';
    const op=Math.round((n.opacity!=null?n.opacity:1)*100);
    document.getElementById('p-anchor-op').value=op;document.getElementById('p-anchor-op-v').textContent=op;
  }
  document.getElementById('p-fs-label').innerHTML=isText?('文字字号 <span id="p-fs-v">'+(n.fontSize||18)+'</span>px'):('标签字号 <span id="p-fs-v">'+(n.fontSize||14)+'</span>px');
  document.getElementById('p-fc-label').textContent=isText?'文字颜色':'标签颜色';
  document.querySelector('#pnode .pr label').textContent=isText?'文本框 ID':'节点 ID';
  // 文本框样式控件
  document.getElementById('text-style').style.display=isText?'block':'none';
  if(isText){
    document.getElementById('p-bg').value=(n.bg&&n.bg!=='none')?n.bg:'#102a52';
    document.getElementById('p-bg-hex').value=(n.bg&&n.bg!=='none')?n.bg:'';
    document.getElementById('p-border').value=n.border||'none';
    document.getElementById('p-border-color').value=n.borderColor||'#4dd0ff';
    document.getElementById('p-border-color-hex').value=n.borderColor||'#4dd0ff';
    document.getElementById('p-radius').value=n.radius!=null?n.radius:6;
    document.getElementById('p-radius-v').textContent=n.radius!=null?n.radius:6;
  }
  renderNodeActionControls(n);
  renderDFs(n);
  refreshNodeRuleSummary(n);
}
function applyTextStyle(){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;
  const bgHex=document.getElementById('p-bg-hex').value.trim();
  const pick=document.getElementById('p-bg').value;
  if(bgHex){ n.bg=(/^#?[0-9a-fA-F]{6}$/.test(bgHex))?(bgHex[0]==='#'?bgHex:'#'+bgHex):pick; }
  else if(document.activeElement&&document.activeElement.id==='p-bg'){ n.bg=pick; document.getElementById('p-bg-hex').value=pick; }
  n.border=document.getElementById('p-border').value;
  n.borderColor=document.getElementById('p-border-color').value;
  const bch=document.getElementById('p-border-color-hex').value.trim();
  if(/^#?[0-9a-fA-F]{6}$/.test(bch)){n.borderColor=(bch[0]==='#'?bch:'#'+bch);document.getElementById('p-border-color').value=n.borderColor;}
  n.radius=parseInt(document.getElementById('p-radius').value);
  document.getElementById('p-radius-v').textContent=n.radius;
}
function clearTextBg(){const n=nodes.find(x=>x.id===selNode);if(!n)return;n.bg='none';document.getElementById('p-bg-hex').value='';}
function renderNodeActionControls(n){
  const trigger=document.getElementById('p-action-trigger'),url=document.getElementById('p-action-url'),target=document.getElementById('p-action-target');
  if(!trigger||!url||!target)return;
  const a=n.action||{};
  trigger.value=a.url?(a.trigger||'click'):'none';
  url.value=a.url||'';
  target.value=a.target||'same';
}
function applyNodeAction(){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;
  const trigger=document.getElementById('p-action-trigger').value;
  const url=document.getElementById('p-action-url').value.trim();
  const target=document.getElementById('p-action-target').value;
  if(trigger==='none'||!url){delete n.action;return;}
  n.action={trigger,url,target:(target==='blank'?'blank':'same')};
}
// 占位点(anchor)外观：填充色 + 不透明度
function applyAnchorStyle(){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;
  const hex=document.getElementById('p-anchor-fill-hex').value.trim();
  const pick=document.getElementById('p-anchor-fill').value;
  if(/^#?[0-9a-fA-F]{6}$/.test(hex)){ n.fill=(hex[0]==='#'?hex:'#'+hex); document.getElementById('p-anchor-fill').value=n.fill; }
  else if(document.activeElement&&document.activeElement.id==='p-anchor-fill'){ n.fill=pick; document.getElementById('p-anchor-fill-hex').value=pick; }
  n.opacity=parseInt(document.getElementById('p-anchor-op').value)/100;
  document.getElementById('p-anchor-op-v').textContent=Math.round(n.opacity*100);
}
function clearAnchorFill(){const n=nodes.find(x=>x.id===selNode);if(!n)return;n.fill='none';document.getElementById('p-anchor-fill-hex').value='';}
// 内部走线值 → 属性面板可显示的选项；非弧线/手动的一律视为「智能（最短·避障·少交叉）」
function routeToOption(r){ return (r==='arc'||r==='manual'||r==='line') ? r : 'smart'; }
// 属性面板选项 → 内部走线值；「智能」用统一的内部值 'smart'
function optionToRoute(o){ return (o==='arc'||o==='manual'||o==='line') ? o : 'smart'; }
function selectEdge(e){
  ensurePropsOpen();
  selEdge=e;selNode=null;showPanel('edge');
  document.getElementById('ep-type').value=e.et||'ac_power';document.getElementById('ep-route').value=routeToOption(e.route);
  document.getElementById('ep-dir').value=e.dir||'forward';document.getElementById('ep-lbl').value=e.lbl||'';
  document.getElementById('ep-w').value=e.w||1;document.getElementById('ep-w-v').textContent=(e.w||1).toFixed(1);
  const cfg=edgeCfg(e);
  document.getElementById('ep-color').value=cfg.color;
  document.getElementById('ep-color-hex').value=e.lineColor||'';
  document.getElementById('ep-style').value=e.lineStyle||'inherit';
  document.getElementById('ep-showlbl').checked=!e.hideLabel;
  // 仅手动拐点连线显示正交开关
  const orow=document.getElementById('ep-ortho-row');
  orow.style.display=(e.route==='manual')?'block':'none';
  document.getElementById('ep-ortho').checked=(e.orthoSnap!==false);
  const base=ET[e.et]||ET.ac_power;document.getElementById('ep-desc').textContent=base.desc;document.getElementById('ep-desc').style.color=cfg.color;
  refreshEdgeRuleSummary(e);
  updateEpTypeSwatch();
}
function showPanel(m){document.getElementById('pnone').style.display=m==='none'?'block':'none';document.getElementById('pnode').style.display=m==='node'?'block':'none';document.getElementById('pedge').style.display=m==='edge'?'block':'none';}
function applyNP(){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;
  const nid=document.getElementById('p-id').value.trim();
  if(nid&&nid!==n.id){edges.forEach(e=>{if(e.from===n.id)e.from=nid;if(e.to===n.id)e.to=nid;});n.id=nid;selNode=nid;}
  n.labelZh=document.getElementById('p-label-zh').value;
  n.labelEn=document.getElementById('p-label-en').value;
  n.label=n.labelZh; // 兼容旧字段
  n.type=document.getElementById('p-type').value;n.status=document.getElementById('p-status').value;
  n.statusEn=document.getElementById('p-status-en').value.trim();
  // 必填校验：中英文初始状态都需填写，英文缺失时高亮提示
  const seEl=document.getElementById('p-status-en'), sEl=document.getElementById('p-status');
  if(!n.statusEn){ seEl.style.borderColor='#ff6b6b'; seEl.title='请填写英文初始状态（必填）'; }
  else { seEl.style.borderColor=''; seEl.title=''; }
  if(!n.status){ sEl.style.borderColor='#ff6b6b'; sEl.title='请填写中文初始状态（必填）'; }
  else { sEl.style.borderColor=''; sEl.title=''; }
  document.getElementById('p-status-en').placeholder=(STATUS_EN[n.status]||'')||'如 Standby / Charging';
  n.fontSize=parseInt(document.getElementById('p-fs').value);document.getElementById('p-fs-v').textContent=n.fontSize;
  n.scale=parseInt(document.getElementById('p-scale').value)/100;document.getElementById('p-scale-v').textContent=Math.round(n.scale*100);
  n.rotation=parseInt(document.getElementById('p-rot').value);document.getElementById('p-rot-v').textContent=n.rotation;
  _pathCacheSig='';
  n.fontColor=document.getElementById('p-fc').value;document.getElementById('p-fc-hex').value=n.fontColor;
}
function syncColor(id,v){if(/^#[0-9a-fA-F]{6}$/.test(v)){document.getElementById(id).value=v;applyNP();}}
// 单个节点：控制画布上是否显示名称 / 数据字段（属性仍保留，仅控制显示）
function applyVis(){
  const n=nodes.find(x=>x.id===selNode);if(!n)return;snapshot();
  n.hideLabel=!document.getElementById('p-show-label').checked;
  if(n.type!=='text')n.hideFields=!document.getElementById('p-show-fields').checked;
  snapshot();
}
// 批量：对所有选中节点统一显示/隐藏 名称(label) 或 数据字段(fields)
function batchVis(which,show){
  const ns=selectedNodes();if(ns.length<1)return;snapshot();
  ns.forEach(n=>{ if(which==='label')n.hideLabel=!show; else if(n.type!=='text')n.hideFields=!show; });
  const cur=nodes.find(x=>x.id===selNode);
  if(cur){const a=document.getElementById('p-show-label'),b=document.getElementById('p-show-fields');if(a)a.checked=!cur.hideLabel;if(b)b.checked=!cur.hideFields;}
  snapshot();
}
function applyEP(){
  if(!selEdge)return;selEdge.et=document.getElementById('ep-type').value;selEdge.route=optionToRoute(document.getElementById('ep-route').value);
  selEdge.dir=document.getElementById('ep-dir').value;selEdge.lbl=document.getElementById('ep-lbl').value;
  selEdge.w=parseFloat(document.getElementById('ep-w').value);document.getElementById('ep-w-v').textContent=selEdge.w.toFixed(1);
  const pick=document.getElementById('ep-color').value;
  const hex=normHex(document.getElementById('ep-color-hex').value);
  if(hex){selEdge.lineColor=hex;document.getElementById('ep-color').value=hex;}
  else if(document.activeElement&&document.activeElement.id==='ep-color'){selEdge.lineColor=pick;document.getElementById('ep-color-hex').value=pick;}
  else if(!document.getElementById('ep-color-hex').value.trim())delete selEdge.lineColor;
  selEdge.lineStyle=document.getElementById('ep-style').value;
  if(selEdge.lineStyle==='inherit')delete selEdge.lineStyle;
  selEdge.hideLabel=!document.getElementById('ep-showlbl').checked;
  selEdge.orthoSnap=document.getElementById('ep-ortho').checked;
  document.getElementById('ep-ortho-row').style.display=(selEdge.route==='manual')?'block':'none';
  _pathCacheSig='';
  const base=ET[selEdge.et]||ET.ac_power,cfg=edgeCfg(selEdge);
  if(!selEdge.lineColor)document.getElementById('ep-color').value=base.color;
  document.getElementById('ep-desc').textContent=base.desc;document.getElementById('ep-desc').style.color=cfg.color;updateEpTypeSwatch();snapshot();
}
function clearEdgeColor(){if(!selEdge)return;delete selEdge.lineColor;document.getElementById('ep-color-hex').value='';document.getElementById('ep-color').value=(ET[selEdge.et]||ET.ac_power).color;applyEP();}
function renderDFs(n){const c=document.getElementById('dfields');c.innerHTML='';(n.data||[]).forEach((f,i)=>{const r=document.createElement('div');r.className='dfrow';const dvVal=(f.dv==null||f.dv==='')?'':String(f.dv).replace(/"/g,'&quot;');r.innerHTML='<input class="df-zh-in" value="'+(f.key||'')+'" placeholder="中文" oninput="updDF('+i+',\'key\',this.value)"><input class="df-en-in" value="'+(f.keyEn||'')+'" placeholder="English" oninput="updDF('+i+',\'keyEn\',this.value)"><input class="df-val-in" value="'+dvVal+'" placeholder="--" oninput="updDFVal('+i+',this.value)"><button onclick="rmDF('+i+')">✕</button>';c.appendChild(r);});}
function addDF(){const n=nodes.find(x=>x.id===selNode);if(!n)return;n.data=n.data||[];const def=NODE_DEFAULTS[n.type]||{data:[]};const used=n.data.map(f=>f.key);const next=def.data.find(k=>!used.includes(k))||'字段'+(n.data.length+1);n.data.push({key:next,keyEn:(DATA_LABEL_EN[next]||next),dv:''});renderDFs(n);}
function resetRotation(){const n=nodes.find(x=>x.id===selNode);if(!n)return;snapshot();n.rotation=0;document.getElementById('p-rot').value=0;document.getElementById('p-rot-v').textContent=0;snapshot();}
function resetFieldPos(){const n=nodes.find(x=>x.id===selNode);if(!n||!n.data)return;snapshot();n.data.forEach(f=>{f.ox=0;f.oy=0;});snapshot();}
// 智能环绕布局：把字段卡片分配到设备四周空闲方向，避开连线占用的边
function connDirsOf(n){
  // 返回该节点各连线离开的方向角度集合
  const dirs=[];
  edges.forEach(e=>{
    let other=null;
    if(e.from===n.id)other=nodes.find(x=>x.id===e.to);
    else if(e.to===n.id)other=nodes.find(x=>x.id===e.from);
    if(other){const a=Math.atan2(other.y-n.y,other.x-n.x);dirs.push(a);}
  });
  return dirs;
}
function smartLayoutFields(n){
  if(!n.data||n.data.length===0)return;
  const s=nsz(n);
  const cfs=(n.fontSize||14)*0.92/zoom;
  const connDirs=connDirsOf(n);
  const step=((n.fontSize||14)+18)/zoom; const chipW=130/zoom, chipH=step; // 估算卡片尺寸（屏幕固定）
  // 8 个候选方向（右、右下、下、左下、左、左上、上、右上）
  const slots=[0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, -3*Math.PI/4, -Math.PI/2, -Math.PI/4];
  const radius=s*0.55+cfs*1.6;
  // 收集障碍：其它节点盒 + 其它节点已放置的字段卡片
  const obstacles=[];
  nodes.forEach(o=>{ if(o.id===n.id)return; const b=nodeBox(o); obstacles.push({l:b.left-10,r:b.right+10,t:b.top-10,b:b.bottom+10});
    if(o.data) o.data.forEach((f,i)=>{ const os=nsz(o); const bx=o.x+os*0.5+12/zoom+(f.ox||0)/zoom, by=o.y-os*0.40+i*(((o.fontSize||14)+18)/zoom)+(f.oy||0)/zoom; obstacles.push({l:bx-6,r:bx+chipW+6,t:by-6,b:by+chipH+6}); });
  });
  // 画布中心，用于"朝向开阔区"的偏好
  const cw=canvas.width/zoom, ch=canvas.height/zoom;
  const rectHit=(x,y,w,h)=>{ for(const o of obstacles){ if(x< o.r&&x+w>o.l&&y<o.b&&y+h>o.t)return true; } return false; };
  // 给每个方向打分
  const scored=slots.map(ang=>{
    // 该方向放第一张卡片的左上角
    const cx=n.x+Math.cos(ang)*radius, cy=(n.y-s*0.22)+Math.sin(ang)*radius;
    const leftSide=Math.cos(ang)<-0.3;
    const x=cx-(leftSide?chipW:0), y=cy-chipH/2;
    // 1) 离连线越远越好
    let minDiff=Math.PI; connDirs.forEach(cd=>{let d=Math.abs(ang-cd);if(d>Math.PI)d=2*Math.PI-d;minDiff=Math.min(minDiff,d);});
    // 2) 不与障碍碰撞
    const collide=rectHit(x,y,chipW,chipH)?-3:0;
    // 3) 偏好水平方向（卡片横向）
    const horizBonus=(Math.abs(Math.cos(ang))>0.7)?0.3:0;
    // 4) 偏好画布内、远离边缘
    let edgePenalty=0;
    if(x<10||x+chipW>cw-10) edgePenalty-=0.6;
    if(y<10||y+chipH>ch-10) edgePenalty-=0.6;
    // 5) 偏好朝向画布开阔的一侧（远离最近的节点群——用朝画布中心反方向的弱偏好）
    return {ang, leftSide, score:minDiff+horizBonus+collide+edgePenalty};
  }).sort((a,b)=>b.score-a.score);
  // 依次摆放：同一方向多条字段沿垂直堆叠，超过容量换下一个方向
  const perSlot=Math.ceil(n.data.length/Math.min(2,n.data.length));
  let slotIdx=0,inSlot=0;
  n.data.forEach((f,i)=>{
    if(inSlot>=perSlot && slotIdx<scored.length-1){slotIdx++;inSlot=0;}
    const sl=scored[Math.min(slotIdx,scored.length-1)];
    const ang=sl.ang;
    const cx=n.x+Math.cos(ang)*radius;
    const cy=(n.y-s*0.22)+Math.sin(ang)*radius + inSlot*step;
    const baseX=n.x+s*0.5+14/zoom, baseY=n.y-s*0.40+i*step;
    f.ox=((cx - (sl.leftSide?chipW:0)) - baseX)*zoom;   // 存屏幕像素
    f.oy=(cy - baseY)*zoom;
    inSlot++;
  });
}
function smartLayoutSelected(){const n=nodes.find(x=>x.id===selNode);if(!n)return;snapshot();smartLayoutFields(n);snapshot();}
function smartLayoutAll(){snapshot();nodes.forEach(smartLayoutFields);snapshot();}
// ───── 多选对齐 ─────
function updateAlignBar(){
  const bar=document.getElementById('alignbar');
  const nc=selSet.size, cc=selChips.size;
  if(nc>=2){bar.classList.add('show');document.getElementById('align-count').textContent=lang==='en'?('Align '+nc+' nodes'+(cc>0?' (+'+cc+' fields, nodes first)':'')):('对齐 '+nc+' 个元素'+(cc>0?'（含'+cc+'字段，以元素为准）':''));}
  else if(cc>=2){bar.classList.add('show');document.getElementById('align-count').textContent=lang==='en'?('Align '+cc+' fields'):('对齐 '+cc+' 个字段');}
  else bar.classList.remove('show');
}
function clearMultiSel(){selSet.clear();selChips.clear();updateAlignBar();}
function selectedNodes(){return [...selSet].map(id=>nodes.find(n=>n.id===id)).filter(Boolean);}
// 取选中 chip 的绝对位置列表（含其所属字段引用）
function selectedChipRefs(){
  return [...selChips].map(k=>{const a=k.split('#');const n=nodes.find(z=>z.id===a[0]);if(!n||!n.data[a[1]])return null;
    const pos=fieldChipPos(n,parseInt(a[1]));const b=n.data[a[1]]._chipBox;
    return {n,f:n.data[a[1]],fi:parseInt(a[1]),x:pos.x,y:pos.y,w:b?b.w:60,h:b?b.h:16};
  }).filter(Boolean);
}
function alignChips(mode){
  const cs=selectedChipRefs();if(cs.length<2)return;
  snapshot();
  // 用 chip 左上角坐标对齐
  const xs=cs.map(c=>c.x), ys=cs.map(c=>c.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const cX=(minX+maxX)/2,cY=(minY+maxY)/2;
  const setX=(c,nx)=>{c.f.ox=(c.f.ox||0)+(nx-c.x);};
  const setY=(c,ny)=>{c.f.oy=(c.f.oy||0)+(ny-c.y);};
  if(mode==='left')cs.forEach(c=>setX(c,minX));
  else if(mode==='right')cs.forEach(c=>setX(c,maxX));
  else if(mode==='hcenter')cs.forEach(c=>setX(c,cX));
  else if(mode==='top')cs.forEach(c=>setY(c,minY));
  else if(mode==='bottom')cs.forEach(c=>setY(c,maxY));
  else if(mode==='vcenter')cs.forEach(c=>setY(c,cY));
  else if(mode==='hdist'){const s=[...cs].sort((a,b)=>a.x-b.x);const span=maxX-minX>1?(maxX-minX):(s.length-1)*(parseInt(document.getElementById('align-gap').value)||80);const step=span/(s.length-1);s.forEach((c,i)=>setX(c,minX+step*i));}
  else if(mode==='vdist'){const s=[...cs].sort((a,b)=>a.y-b.y);const span=maxY-minY>1?(maxY-minY):(s.length-1)*(parseInt(document.getElementById('align-gap').value)||30);const step=span/(s.length-1);s.forEach((c,i)=>setY(c,minY+step*i));}
  else if(mode==='hgap'){const gap=parseInt(document.getElementById('align-gap').value)||80;const s=[...cs].sort((a,b)=>a.x-b.x);s.forEach((c,i)=>setX(c,minX+gap*i));}
  else if(mode==='vgap'){const gap=parseInt(document.getElementById('align-gap').value)||30;const s=[...cs].sort((a,b)=>a.y-b.y);s.forEach((c,i)=>setY(c,minY+gap*i));}
  snapshot();
}
function alignSel(mode){
  // 谁多对齐谁：默认优先对齐设备（框选设备是常见意图）。
  // 仅当几乎没框到设备（设备<2）而字段≥2 时，才对齐数据字段。
  const nodeCount=selSet.size, chipCount=selChips.size;
  if(nodeCount<2 && chipCount>=2){ alignChips(mode); return; }
  const ns=selectedNodes();if(ns.length<2)return;
  snapshot();
  // 元素半宽/半高（考虑实际尺寸），对齐按边缘计算
  const hw=n=>(n.type==='text'&&n._textBox)?n._textBox.w/2:nsz(n)*0.40;
  const hh=n=>(n.type==='text'&&n._textBox)?n._textBox.h/2:nsz(n)*0.40;
  const left=n=>n.x-hw(n), right=n=>n.x+hw(n), top=n=>n.y-hh(n), bot=n=>n.y+hh(n);
  const xs=ns.map(n=>n.x), ys=ns.map(n=>n.y);
  const minL=Math.min(...ns.map(left)), maxR=Math.max(...ns.map(right));
  const minT=Math.min(...ns.map(top)), maxB=Math.max(...ns.map(bot));
  const cX=(Math.min(...xs)+Math.max(...xs))/2, cY=(Math.min(...ys)+Math.max(...ys))/2;
  if(mode==='left')ns.forEach(n=>n.x=minL+hw(n));        // 左边缘对齐
  else if(mode==='right')ns.forEach(n=>n.x=maxR-hw(n));   // 右边缘对齐
  else if(mode==='hcenter')ns.forEach(n=>n.x=cX);
  else if(mode==='top')ns.forEach(n=>n.y=minT+hh(n));     // 顶边缘对齐
  else if(mode==='bottom')ns.forEach(n=>n.y=maxB-hh(n));  // 底边缘对齐
  else if(mode==='vcenter')ns.forEach(n=>n.y=cY);
  else if(mode==='hdist'){
    const minX=Math.min(...xs),maxX=Math.max(...xs);
    const sorted=[...ns].sort((a,b)=>a.x-b.x);
    const span=maxX-minX>1?(maxX-minX):(sorted.length-1)*(parseInt(document.getElementById('align-gap').value)||120);
    const step=span/(sorted.length-1);sorted.forEach((n,i)=>n.x=minX+step*i);
  }
  else if(mode==='vdist'){
    const minY=Math.min(...ys),maxY=Math.max(...ys);
    const sorted=[...ns].sort((a,b)=>a.y-b.y);
    const span=maxY-minY>1?(maxY-minY):(sorted.length-1)*(parseInt(document.getElementById('align-gap').value)||120);
    const step=span/(sorted.length-1);sorted.forEach((n,i)=>n.y=minY+step*i);
  }
  else if(mode==='hgap'){
    // 边到边间距：gap 为相邻元素之间的空白
    const gap=parseInt(document.getElementById('align-gap').value)||120;
    const sorted=[...ns].sort((a,b)=>a.x-b.x);
    const halfW=n=>(n.type==='text'&&n._textBox)?n._textBox.w/2:nsz(n)*0.40;
    let cursor=sorted[0].x;
    sorted.forEach((n,i)=>{if(i===0){cursor=n.x;return;}cursor=cursor+halfW(sorted[i-1])+gap+halfW(n);n.x=cursor;});
  }
  else if(mode==='vgap'){
    const gap=parseInt(document.getElementById('align-gap').value)||120;
    const sorted=[...ns].sort((a,b)=>a.y-b.y);
    const halfH=n=>(n.type==='text'&&n._textBox)?n._textBox.h/2:nsz(n)*0.40;
    let cursor=sorted[0].y;
    sorted.forEach((n,i)=>{if(i===0){cursor=n.y;return;}cursor=cursor+halfH(sorted[i-1])+gap+halfH(n);n.y=cursor;});
  }
  else if(mode==='hdistedge'){
    // 水平均匀分布：保持首尾不动，中间元素按边缘间距相等排列
    const sorted=[...ns].sort((a,b)=>a.x-b.x);
    if(sorted.length>=2){
      const totalW=sorted.reduce((s,n)=>s+hw(n)*2,0);
      const span=(sorted[sorted.length-1].x+hw(sorted[sorted.length-1])) - (sorted[0].x-hw(sorted[0]));
      const gap=(span-totalW)/(sorted.length-1);
      let cursor=sorted[0].x-hw(sorted[0]);
      sorted.forEach(n=>{n.x=cursor+hw(n);cursor=cursor+hw(n)*2+gap;});
    }
  }
  else if(mode==='vdistedge'){
    const sorted=[...ns].sort((a,b)=>a.y-b.y);
    if(sorted.length>=2){
      const totalH=sorted.reduce((s,n)=>s+hh(n)*2,0);
      const span=(sorted[sorted.length-1].y+hh(sorted[sorted.length-1])) - (sorted[0].y-hh(sorted[0]));
      const gap=(span-totalH)/(sorted.length-1);
      let cursor=sorted[0].y-hh(sorted[0]);
      sorted.forEach(n=>{n.y=cursor+hh(n);cursor=cursor+hh(n)*2+gap;});
    }
  }
  else if(mode==='row'){
    // 排成一行：垂直居中对齐 + 按边缘间距水平排列
    const gap=parseInt(document.getElementById('align-gap').value)||80;
    const sorted=[...ns].sort((a,b)=>a.x-b.x);
    let cursor=Math.min(...sorted.map(left));
    sorted.forEach(n=>{n.x=cursor+hw(n);n.y=cY;cursor=cursor+hw(n)*2+gap;});
  }
  else if(mode==='col'){
    // 排成一列：水平居中对齐 + 按边缘间距垂直排列
    const gap=parseInt(document.getElementById('align-gap').value)||60;
    const sorted=[...ns].sort((a,b)=>a.y-b.y);
    let cursor=Math.min(...sorted.map(top));
    sorted.forEach(n=>{n.y=cursor+hh(n);n.x=cX;cursor=cursor+hh(n)*2+gap;});
  }
  else if(mode==='matrix'){
    // 矩阵排列：按数量自动定列数，网格状排布
    const gap=parseInt(document.getElementById('align-gap').value)||120;
    const cols=Math.ceil(Math.sqrt(ns.length));
    const startX=Math.min(...ns.map(n=>n.x)), startY=Math.min(...ns.map(n=>n.y));
    const sorted=[...ns];
    sorted.forEach((n,i)=>{
      const r=Math.floor(i/cols), c=i%cols;
      n.x=startX+c*gap; n.y=startY+r*gap;
    });
  }
  else if(mode==='canvasH'){
    // 水平居中于画布：整组中心移到画布水平中心
    const wcx=(-panX+canvas.width/2)/zoom;
    const gcx=(Math.min(...ns.map(left))+Math.max(...ns.map(right)))/2;
    const d=wcx-gcx; ns.forEach(n=>n.x+=d);
  }
  else if(mode==='canvasV'){
    const wcy=(-panY+canvas.height/2)/zoom;
    const gcy=(Math.min(...ns.map(top))+Math.max(...ns.map(bot)))/2;
    const d=wcy-gcy; ns.forEach(n=>n.y+=d);
  }
  _pathCacheSig='';snapshot();
}
function rmDF(i){const n=nodes.find(x=>x.id===selNode);if(!n)return;n.data.splice(i,1);renderDFs(n);}
function updDF(i,prop,v){const n=nodes.find(x=>x.id===selNode);if(!n)return;n.data[i][prop]=v;}
function updDFVal(i,v){const n=nodes.find(x=>x.id===selNode);if(!n||!n.data[i])return;n.data[i].dv=v.trim();_pathCacheSig='';}

function toggleEdgeMode(){
  edgeMode=!edgeMode;edgeFrom=null;edgeFromPort=null;
  // 与框选模式互斥
  if(edgeMode&&selectMode){selectMode=false;document.getElementById('btn-select').classList.remove('active');}
  document.getElementById('btn-edge').classList.toggle('active',edgeMode);
  document.getElementById('ehint').style.display=edgeMode?'block':'none';document.getElementById('ebar').classList.toggle('show',edgeMode);canvas.style.cursor=edgeMode?'crosshair':'default';if(edgeMode)document.getElementById('ehint').textContent='连线['+ET[pendingET].label+']：点击起始节点…';
}
function toggleMenu(id){const m=document.getElementById(id);const wasOpen=m.classList.contains('open');closeMenus();if(!wasOpen)m.classList.add('open');}
function closeMenus(){document.querySelectorAll('.menu.open').forEach(m=>m.classList.remove('open'));}
document.addEventListener('click',e=>{if(!e.target.closest('.menu'))closeMenus();});
function toggleSelectMode(){
  selectMode=!selectMode;
  // 与连线模式互斥
  if(selectMode&&edgeMode){edgeMode=false;edgeFrom=null;edgeFromPort=null;document.getElementById('btn-edge').classList.remove('active');document.getElementById('ehint').style.display='none';document.getElementById('ebar').classList.remove('show');}
  document.getElementById('btn-select').classList.toggle('active',selectMode);canvas.style.cursor=selectMode?'crosshair':'default';
}
function deleteSelected(){if(selNode){snapshot();nodes=nodes.filter(n=>n.id!==selNode);edges=edges.filter(e=>e.from!==selNode&&e.to!==selNode);selNode=null;snapshot();}else if(selEdge){snapshot();edges=edges.filter(e=>e!==selEdge);selEdge=null;snapshot();}showPanel('none');}
// ───── 复制 / 粘贴（含数据字段整体复制）─────
let clipboard=null;
function cleanNodeForCopy(n){
  // 深拷贝节点，剔除运行时缓存字段（_textBox/_chipBox/_resizeHandle 等）
  const c=JSON.parse(JSON.stringify(n));
  delete c._textBox;delete c._chipBox;delete c._resizeHandle;delete c._rotHandle;
  if(c.data)c.data.forEach(f=>{delete f._chipBox;});
  return c;
}
function copySelection(){
  let ids2=[];
  if(selSet.size>0) ids2=[...selSet];
  else if(selNode) ids2=[selNode];
  if(ids2.length===0)return;
  const ns=ids2.map(id=>nodes.find(n=>n.id===id)).filter(Boolean).map(cleanNodeForCopy);
  // 同时复制两端都在选中集合内的连线
  const idset=new Set(ids2);
  const es=edges.filter(e=>idset.has(e.from)&&idset.has(e.to)).map(e=>JSON.parse(JSON.stringify(e)));
  clipboard={nodes:ns,edges:es};
  // 轻提示
  flashHint('已复制 '+ns.length+' 个元素'+(es.length?('（含 '+es.length+' 条连线）'):''));
}
function pasteClipboard(){
  if(!clipboard||!clipboard.nodes.length)return;
  snapshot();
  const OFF=40; // 粘贴偏移
  const idMap={};
  const newIds=[];
  clipboard.nodes.forEach(orig=>{
    const c=JSON.parse(JSON.stringify(orig));
    const nid=genId(c.type);
    idMap[c.id]=nid;c.id=nid;
    c.x+=OFF;c.y+=OFF;
    // data 字段（含 ox/oy 偏移）已随深拷贝带上
    nodes.push(c);newIds.push(nid);
  });
  // 复制选中范围内的连线，重新指向新节点
  clipboard.edges.forEach(oe=>{
    const f=idMap[oe.from],t=idMap[oe.to];if(!f||!t)return;
    const ne=JSON.parse(JSON.stringify(oe));ne.from=f;ne.to=t;
    if(ne.waypoints)ne.waypoints=ne.waypoints.map(p=>[p[0]+OFF,p[1]+OFF]);
    edges.push(ne);
  });
  // 选中新粘贴的元素
  selSet=new Set(newIds);selChips.clear();
  if(newIds.length===1){selectNode(newIds[0]);}else{selNode=selEdge=null;showPanel('none');}
  updateAlignBar();_pathCacheSig='';snapshot();
  flashHint('已粘贴 '+newIds.length+' 个元素');
}
let _hintTimer=null;
function flashHint(msg){
  let el=document.getElementById('flash-hint');
  if(!el){el=document.createElement('div');el.id='flash-hint';el.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(20,30,48,0.95);color:#9fe8ff;border:1px solid var(--ui-accent);padding:8px 16px;border-radius:20px;font-size:13px;z-index:300;pointer-events:none;transition:opacity .3s';document.body.appendChild(el);}
  el.textContent=msg;el.style.opacity='1';
  clearTimeout(_hintTimer);_hintTimer=setTimeout(()=>{el.style.opacity='0';},1500);
}
function delEdge(){if(selEdge){snapshot();edges=edges.filter(e=>e!==selEdge);selEdge=null;snapshot();showPanel('none');}}
// 自定义美化确认弹框（替代原生 confirm）
function uiConfirm(msg, danger){
  return new Promise(resolve=>{
    const ov=document.getElementById('confirm-overlay');
    document.getElementById('confirm-msg').textContent=msg;
    document.getElementById('confirm-icon').textContent=danger?'🗑️':'❓';
    const okBtn=document.getElementById('confirm-ok'), caBtn=document.getElementById('confirm-cancel');
    okBtn.textContent=lang==='en'?'Confirm':'确定';
    caBtn.textContent=lang==='en'?'Cancel':'取消';
    okBtn.className='tb '+(danger?'red':'grn');
    ov.classList.add('show');
    const done=(v)=>{ov.classList.remove('show');okBtn.onclick=null;caBtn.onclick=null;resolve(v);};
    okBtn.onclick=()=>done(true);
    caBtn.onclick=()=>done(false);
  });
}
async function clearAll(){
  const ok=await uiConfirm(lang==='en'?'Clear the entire canvas?':'确定清空整个画布？',true);
  if(!ok)return;
  snapshot();nodes=[];edges=[];selNode=selEdge=null;ids={};snapshot();showPanel('none');
}

// ══════════════════════════════════════════════
// 一键自动布局（分层 + 同层均布 + 重心排序，减少交叉）
// ══════════════════════════════════════════════
// 一键整理连线：智能选择走线（无障碍走直线，否则正交），并触发汇流合并，减少画面线条
// 线段相交判定（用于统计连线交叉）
function segsCross(a,b,c,d){
  function ccw(p,q,r){return (r[1]-p[1])*(q[0]-p[0]) - (q[1]-p[1])*(r[0]-p[0]);}
  const d1=ccw(c,d,a),d2=ccw(c,d,b),d3=ccw(a,b,c),d4=ccw(a,b,d);
  if(((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0)))return true;
  return false;
}
function pathsCross(p1,p2){
  for(let i=0;i<p1.length-1;i++)for(let j=0;j<p2.length-1;j++){
    if(segsCross(p1[i],p1[i+1],p2[j],p2[j+1]))return true;
  }
  return false;
}
function countCrossings(){
  let n=0;
  const paths=edges.map(e=>edgePath(e)).filter(Boolean);
  for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++){
    if(pathsCross(paths[i],paths[j]))n++;
  }
  return n;
}
function tidyEdges(){
  if(!edges.length)return;
  snapshot();
  busMerge=true;
  busAggregation=false;
  applyTidyRouting();
  _pathCacheSig='';snapshot();
  flashHint('已整理连线：自动吸附端口 · 最短避障路径（剩余交叉 '+_countCrossRaw()+'）');
}
// 一键直线走线：直线优先，遇障碍/交叉自动转最优 L 型正交路线（不改线型/颜色）
function straightenAllEdges(){
  if(!edges.length)return;
  snapshot();
  busAggregation=false;
  applyTidyRouting();
  _pathCacheSig='';snapshot();
  flashHint('已直线走线 · 遇障/交叉转最优L型 · 剩余交叉 '+_countCrossRaw());
}
// 在给定节点子集内做分层布局（列=层级、重心排序、中位对齐、叶子对齐），就地设置 x,y（局部坐标）
function _layoutComponent(cNodes, cEdges, minGap, colGap){
  const SEMANTIC_TIER={grid:0,solar:0,generator:0,meter2:1,meter:1,busbar:2,transformer:2,switch:2,highvolt:2,pcs:3,ems:3,bms:4,cabinet:4,load:2,charger:2,aircon:3,fire:3,sensor:3};
  const find=id=>cNodes.find(n=>n.id===id);
  const tier={};
  cNodes.forEach(n=>{ tier[n.id]= SEMANTIC_TIER[n.type]!==undefined?SEMANTIC_TIER[n.type]:2; });
  for(let it=0;it<3;it++) cEdges.forEach(e=>{ if(tier[e.to]<=tier[e.from] && SEMANTIC_TIER[find(e.to)?.type]===undefined) tier[e.to]=tier[e.from]+1; });
  const layers={}; cNodes.forEach(n=>{ const t=tier[n.id]; (layers[t]=layers[t]||[]).push(n); });
  const tierKeys=Object.keys(layers).map(Number).sort((a,b)=>a-b);
  const order={}; tierKeys.forEach(t=>layers[t].forEach((n,i)=>order[n.id]=i));
  for(let pass=0;pass<4;pass++) tierKeys.forEach(t=>{
    layers[t].forEach(n=>{ const nb=[]; cEdges.forEach(e=>{ if(e.from===n.id&&order[e.to]!=null)nb.push(order[e.to]); if(e.to===n.id&&order[e.from]!=null)nb.push(order[e.from]); }); n._bary=nb.length?nb.reduce((a,b)=>a+b,0)/nb.length:order[n.id]; });
    layers[t].sort((a,b)=>a._bary-b._bary); layers[t].forEach((n,i)=>order[n.id]=i);
  });
  tierKeys.forEach((t,ti)=>layers[t].forEach((n,i)=>{ n.x=colGap*(ti+1); n.y=(i+1)*minGap; delete n._bary; }));
  const med=a=>{ if(!a.length)return null; const s=[...a].sort((x,y)=>x-y); const m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
  for(let pass=0;pass<10;pass++){ const seq=pass%2?[...tierKeys].reverse():tierKeys;
    seq.forEach(t=>{ const arr=layers[t]; if(!arr.length)return;
      arr.forEach(n=>{ const ys=[]; cEdges.forEach(e=>{ if(e.from===n.id){const m=find(e.to);if(m)ys.push(m.y);} if(e.to===n.id){const m=find(e.from);if(m)ys.push(m.y);} }); n._dy=ys.length?med(ys):n.y; });
      arr.forEach((n,i)=>{ n.y=(i===0)?n._dy:Math.max(n._dy,arr[i-1].y+minGap); });
      for(let i=arr.length-2;i>=0;i--) if(arr[i].y>arr[i+1].y-minGap) arr[i].y=arr[i+1].y-minGap;
      const mD=arr.reduce((s,n)=>s+n._dy,0)/arr.length, mY=arr.reduce((s,n)=>s+n.y,0)/arr.length, off=mD-mY; arr.forEach(n=>n.y+=off);
    });
  }
  cNodes.forEach(n=>delete n._dy);
  const deg={}; cNodes.forEach(n=>deg[n.id]=0); cEdges.forEach(e=>{ if(deg[e.from]!=null)deg[e.from]++; if(deg[e.to]!=null)deg[e.to]++; });
  for(let rep=0;rep<3;rep++) tierKeys.forEach(t=>{ const arr=layers[t];
    arr.forEach((n,i)=>{ if(deg[n.id]!==1)return; let nb=null; for(const e of cEdges){ if(e.from===n.id){nb=e.to;break;} if(e.to===n.id){nb=e.from;break;} } const m=find(nb); if(!m)return;
      const target=m.y, up=i>0?arr[i-1].y:-Infinity, dn=i<arr.length-1?arr[i+1].y:Infinity; if(target>up+minGap-1&&target<dn-minGap+1) n.y=target; });
  });
}
// 收紧空白：沿某一轴向，把「整条投影都没有任何节点」的空白带压缩到 targetGap，
// 保持节点先后次序与连接关系不变（只挪动落在空带之后的节点）。
// 用于消除语义分层导致的大片无效留白（如子树被推到很远、中间整段空白）。
function _compactAxis(cNodes, axis, targetGap){
  if(cNodes.length<2)return;
  const lohi=n=>{ const s=nsz(n);
    const f=(!n.hideFields&&n.data)?n.data.filter(x=>!x.hidden).length:0;
    const step=((n.fontSize||14)+18);
    if(axis==='x'){ const rc=f?185:0; return [n.x-s*0.7, n.x+s*0.7+rc]; }   // 右侧含字段延展
    return [n.y-s*0.9, n.y+Math.max(s*1.2, s*0.4+f*step)];                  // 下方含标签与下垂字段
  };
  const arr=cNodes.map(n=>{const[lo,hi]=lohi(n);return{n,lo,hi};}).sort((a,b)=>a.lo-b.lo);
  let shift=0, cover=-Infinity;
  for(const it of arr){
    let lo=it.lo-shift; const len=it.hi-it.lo;
    if(cover!==-Infinity && lo-cover>targetGap){ const e=(lo-cover)-targetGap; shift+=e; lo-=e; }
    it.n[axis]-=shift; cover=Math.max(cover, lo+len);
  }
}
function autoLayout(silent){
  if(nodes.length===0)return;
  if(!silent)snapshot();
  // 自适应间距：纵向随字段数增减（避免太空或字段重叠）；横向容纳右侧字段
  // 间距与「节点实际视觉尺寸」成比例：nsz 随 zoom 反比变化，若用固定像素间距，
  // 低缩放布局时节点很大→间距相对过小→元素重叠折叠；高缩放时又留白过多。比例化后任何缩放都一致。
  let maxF=0, sRef=0;
  nodes.forEach(n=>{ if(!n.hideFields&&n.data) maxF=Math.max(maxF, n.data.filter(f=>!f.hidden).length); sRef=Math.max(sRef, nsz(n)); });
  if(sRef<=0) sRef=nsz('pcs');
  // 紧凑但不重叠：节点视觉高约 1.3×尺寸(图标+标签)，纵向取略大于此值；横向留出右侧字段+一条走线通道即可。
  const minGap=Math.round(sRef*(1.4+0.06*Math.min(maxF,6)));   // 纵向：刚好不折叠重叠，随字段条数轻微增高
  const colGap=Math.round(maxF>0 ? sRef*2.5 : sRef*1.35);      // 横向：图标 + 右侧字段预留 + 走线通道（连线不穿字段，又不浪费空间）
  // 拆分连通分量，分别布局后紧凑打包 —— 互不相连的系统不再被拉远、不留大片空白
  const idIndex={}; nodes.forEach((n,i)=>idIndex[n.id]=i);
  const parent=nodes.map((_,i)=>i);
  const findp=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
  edges.forEach(e=>{ const a=idIndex[e.from],b=idIndex[e.to]; if(a!=null&&b!=null) parent[findp(a)]=findp(b); });
  const comps={}; nodes.forEach((n,i)=>{ const r=findp(i); (comps[r]=comps[r]||[]).push(n); });
  const compList=Object.values(comps);
  compList.forEach(cNodes=>{
    const cset=new Set(cNodes.map(n=>n.id));
    _layoutComponent(cNodes, edges.filter(e=>cset.has(e.from)&&cset.has(e.to)), minGap, colGap);
    // 压缩纵向/横向空白带，去掉分层产生的大片无效留白（填充列不受影响；阈值随节点尺寸成比例）
    _compactAxis(cNodes,'y',minGap*0.5);
    _compactAxis(cNodes,'x',colGap*0.45);
  });
  // 打包：各分量按行排布，超出目标宽度换行，避免空白
  const gapX=200, gapY=150, maxRowW=2400;
  let curX=0, curY=0, rowH=0;
  compList.forEach(cNodes=>{
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    cNodes.forEach(n=>{ const s=nsz(n); const f=(!n.hideFields&&n.data)?n.data.filter(x=>!x.hidden).length:0; const rc=f?185:0;
      minX=Math.min(minX,n.x-s*0.6); minY=Math.min(minY,n.y-s*0.85); maxX=Math.max(maxX,n.x+s*0.6+rc); maxY=Math.max(maxY,n.y+s*0.95); });
    const w=maxX-minX, h=maxY-minY;
    if(curX>0 && curX+w>maxRowW){ curX=0; curY+=rowH+gapY; rowH=0; }
    const dx=curX-minX, dy=curY-minY; cNodes.forEach(n=>{ n.x+=dx; n.y+=dy; });
    curX += w+gapX; rowH=Math.max(rowH,h);
  });
  // 走线：自动布局优先连接最近语义端口，再由智能路由选择最短避障路径
  busAggregation=false;
  applyTidyRouting();
  nodes.forEach(n=>{ if(n.data) n.data.forEach(f=>{ f.ox=0; f.oy=0; }); });
  if(!silent)snapshot();
  fitView(1);   // 居中展示全部，最多 100%（内容多则自动缩小以全展示）
}

function fitView(capZoom){
  if(nodes.length===0)return;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  nodes.forEach(n=>{const s=nsz(n);
    const f=(!n.hideFields&&n.data)?n.data.filter(x=>!x.hidden).length:0;
    const rc=f?185:0;                       // 右侧字段延展
    minX=Math.min(minX,n.x-s);minY=Math.min(minY,n.y-s);
    maxX=Math.max(maxX,n.x+s+rc);maxY=Math.max(maxY,n.y+s*1.5);});
  const w=maxX-minX, h=maxY-minY, pad=60;
  const zx=(canvas.width-pad*2)/w, zy=(canvas.height-pad*2)/h;
  zoom=Math.max(0.2,Math.min(capZoom||2,Math.min(zx,zy)));
  panX=pad-minX*zoom+(canvas.width-pad*2-w*zoom)/2;
  panY=pad-minY*zoom+(canvas.height-pad*2-h*zoom)/2;
  document.getElementById('zoom-info').textContent=Math.round(zoom*100)+'%';
}

function ctxEdit(){document.getElementById('ctxmenu').style.display='none';if(ctxKind==='node')selectNode(ctxTgt.id);else selectEdge(ctxTgt);}
function ctxConn(){if(!edgeMode){toggleEdgeMode();}edgeFrom=ctxTgt.id;edgeFromPort=null;document.getElementById('ehint').textContent='连线['+ET[pendingET].label+']：已选"'+ctxTgt.label+'"，点目标';document.getElementById('ctxmenu').style.display='none';}
function ctxDelEdge(){snapshot();edges=edges.filter(e=>e!==ctxTgt);selEdge=null;snapshot();showPanel('none');document.getElementById('ctxmenu').style.display='none';}
function ctxDel(){if(ctxKind==='node'){selNode=ctxTgt.id;deleteSelected();}else{selEdge=ctxTgt;delEdge();}document.getElementById('ctxmenu').style.display='none';}
function ctxCopy(){document.getElementById('ctxmenu').style.display='none';if(ctxKind==='node'){selSet.clear();selChips.clear();selectNode(ctxTgt.id);copySelection();pasteClipboard();}}
function ctxStraight(){document.getElementById('ctxmenu').style.display='none';if(ctxKind==='edge'){snapshot();ctxTgt.route='smart';delete ctxTgt.waypoints;_pathCacheSig='';snapshot();selectEdge(ctxTgt);flashHint('该连线已重置为智能走线（最短·自动避障）');}}
function ctxLine(){document.getElementById('ctxmenu').style.display='none';if(ctxKind==='edge'){snapshot();ctxTgt.route='line';delete ctxTgt.waypoints;delete ctxTgt.orthoDir;_pathCacheSig='';snapshot();selectEdge(ctxTgt);flashHint('该连线已设为直线（起止直连）');}}

function closeBgPanel(){const p=document.getElementById('bgpanel'),ov=document.getElementById('bgpanel-overlay');if(p)p.classList.remove('show');if(ov)ov.classList.remove('show');}
function toggleBgPanel(){
  const p=document.getElementById('bgpanel');const ov=document.getElementById('bgpanel-overlay');const show=!p.classList.contains('show');
  if(show)setSigPanel(false);
  p.classList.toggle('show',show);ov.classList.toggle('show',show);
}
function setBg(c){bgColor=c;document.documentElement.style.setProperty('--bg',c);const h=document.getElementById('bg-hex');if(h)h.value=c;const p=document.getElementById('bg-pick');if(p&&/^#[0-9a-fA-F]{6}$/.test(c))p.value=c;document.querySelectorAll('.cp').forEach(el=>el.classList.toggle('active',el.dataset.color===c));}
function applyBgHex(){let v=document.getElementById('bg-hex').value.trim();if(v&&v[0]!=='#')v='#'+v;if(/^#[0-9a-fA-F]{3,6}$/.test(v))setBg(v);else alert('请输入有效色值，如 #0a1f40');}
// 全局字体：一键应用到所有节点
document.getElementById('gf-color').addEventListener('input',e=>{document.getElementById('gf-color-hex').value=e.target.value;});
function applyGlobalFont(){
  if(nodes.length===0){alert('画布暂无节点');return;}
  const fs=parseInt(document.getElementById('gf-size').value);
  const fc=document.getElementById('gf-color').value;
  snapshot();
  nodes.forEach(n=>{n.fontSize=fs;n.fontColor=fc;});
  snapshot();
  // 若当前选中节点，刷新属性面板
  if(selNode)selectNode(selNode);
}
document.getElementById('bg-hex').addEventListener('keydown',e=>{if(e.key==='Enter')applyBgHex();});

const dz=document.getElementById('dz');
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over');});
dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');if(e.dataTransfer.files[0])readFile(e.dataTransfer.files[0]);});
function onFile(e){if(e.target.files[0])readFile(e.target.files[0]);}
function readFile(file){const r=new FileReader();r.onload=ev=>{pendingDataURL=ev.target.result;const p=document.getElementById('upv');p.src=pendingDataURL;p.style.display='block';if(!document.getElementById('un').value)document.getElementById('un').value=file.name.replace(/\.[^.]+$/,'');};r.readAsDataURL(file);}
function confirmUp(){
  if(!pendingDataURL){alert(lang==='en'?'Please select a file':'请先选择文件');return;}
  const zhEl=document.getElementById('un'),enEl=document.getElementById('un-en');
  const zh=zhEl.value.trim(), en=enEl.value.trim();
  zhEl.classList.toggle('invalid',!zh); enEl.classList.toggle('invalid',!en);
  if(!zh||!en){alert(lang==='en'?'Please fill both Chinese and English names':'请同时填写中文和英文名称');return;}
  const safe=en.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
  const tk='custom_'+(safe||('icon'+Date.now()));
  const img=new Image();img.src=pendingDataURL;
  img.onload=()=>{
    CUSTOM_ICONS[tk]=img;IMGS[tk]=img;NODE_DEFAULTS[tk]={data:[]};
    CUSTOM_LABELS[tk]={zh,en};
    addCustomToSidebar(tk,zh,en,pendingDataURL);
    const sel=document.getElementById('p-type');const o=document.createElement('option');o.value=tk;o.textContent=zh+' / '+en;sel.appendChild(o);
    closeUp();
  };
}
function closeUp(){document.getElementById('uo').classList.remove('show');document.getElementById('upv').style.display='none';document.getElementById('upv').src='';document.getElementById('un').value='';document.getElementById('un-en').value='';document.getElementById('un').classList.remove('invalid');document.getElementById('un-en').classList.remove('invalid');document.getElementById('fi').value='';pendingDataURL=null;}

function statusBilingual(n){
  const zh=n.status||'待机';
  const en=(n.statusEn&&n.statusEn.trim())||STATUS_EN[zh]||zh;
  return {zh,en};
}
// 取某类型的图标 dataURL
function iconSrcOf(t){
  if(CUSTOM_ICONS[t]&&CUSTOM_ICONS[t].src) return CUSTOM_ICONS[t].src;
  if(IMG_DATA[t]) return IMG_DATA[t];
  if(IMGS[t]&&IMGS[t].src) return IMGS[t].src;
  return null;
}
// 根据 dataURL 判断扩展名
function iconExt(src){
  if(!src) return 'png';
  if(src.indexOf('image/svg')>=0) return 'svg';
  if(src.indexOf('image/jpeg')>=0||src.indexOf('image/jpg')>=0) return 'jpg';
  return 'png';
}
function iconFileName(t){const src=iconSrcOf(t);return src?(t+'.'+iconExt(src)):null;}
function usedTypeList(){return [...new Set(nodes.map(n=>n.type))];}

// 元素库版本号（后台维护，前后端共享同一套库时用它对齐）
const LIBRARY_VERSION='2.0.0';
const LIBRARY_NAME='energy-topology';

// ───── 元素库 + 字典：后台维护、提供给前端的「单一事实来源」 ─────
// 前端加载一次即可知道每种 type 的图标 / 默认字段 / 默认尺寸 / 分组 / 连线类型 / 中英字典。
function buildLibraryObj(){
  const iconManifest={};
  DEVICE_GROUPS.forEach(g=>g.devices.forEach(d=>{const fn=iconFileName(d.type);if(fn)iconManifest[d.type]=fn;}));
  (customIcons||[]).forEach(ci=>{const fn=iconFileName(ci.type);if(fn)iconManifest[ci.type]=fn;});
  return {
    schemaVersion:'2.0',
    library:{
      name:LIBRARY_NAME, version:LIBRARY_VERSION, generatedAt:new Date().toISOString(),
      iconRender:{
        note:'节点以 position(x,y) 为中心：图标绘制区为 [x - sizeWorld/2, y - sizeWorld*0.72]，宽高均为 sizeWorld；图标视觉中心在 (x, y - sizeWorld*0.22)；名称在图标下方；数据字段在节点右侧按 offset 偏移。',
        iconTopOffsetRatio:-0.72, iconCenterOffsetRatio:-0.22, labelBelow:true
      },
      tabs: TAB_DEFS.map(t=>({id:t.id,labelZh:t.zh,labelEn:t.en})),
      groups: DEVICE_GROUPS.map(g=>({
        title:g.title, titleEn:g.title_en||g.title, color:g.color, tab:g.tab||'device',
        devices: g.devices.map(d=>({
          type:d.type, labelZh:d.label||d.type, labelEn:d.label_en||d.type,
          icon: iconFileName(d.type),
          defaultData: (NODE_DEFAULTS[d.type]&&NODE_DEFAULTS[d.type].data)||[],
          defaultSizeWorld: Math.round(nsz(d.type))
        }))
      })),
      edgeTypes: Object.fromEntries(Object.entries(ET).map(([k,v])=>[k,
        {labelZh:v.label, labelEn:v.labelEn||v.label, color:v.color, width:v.w, dash:v.dash, anim:v.anim, speed:v.spd, desc:v.desc}])),
      statusDict: STATUS_EN,        // 中文状态 → 英文
      dataLabelDict: DATA_LABEL_EN  // 中文字段名 → 英文
    },
    iconManifest                    // 全量 type → 图标文件名
  };
}

// ───── 画布 JSON（每张图各一份）：轻量，只引用元素库版本，不内嵌整套库 ─────
function buildJSON(){
  // 完整序列化每个节点（实例信息；图标/默认值由元素库按 type 解析）
  const serNode=n=>{
    const o={
      id:n.id, type:n.type,
      label:{zh:n.labelZh||n.label||'', en:n.labelEn||''},
      position:{x:parseFloat(n.x.toFixed(1)), y:parseFloat(n.y.toFixed(1))},
      sizeWorld:Math.round(nsz(n)),          // 实际绘制尺寸(已含 scale)，前端可直接用
      scale:n.scale||1, rotation:n.rotation||0,
      fontSize:n.fontSize||14, fontColor:n.fontColor||'#e8f4ff',
      display:{ showLabel:!n.hideLabel, showFields:!n.hideFields },
      data:(n.data||[]).map(f=>({
        key:{zh:f.key, en:f.keyEn||f.key},
        value:(f.dv==null||f.dv==='')?'':f.dv,
        hidden:!!f.hidden,
        offset:{x:parseFloat((f.ox||0).toFixed(1)), y:parseFloat((f.oy||0).toFixed(1))}
      }))
    };
    if(nodeSupportsStateSignals(n)) o.status=statusBilingual(n);
    // 自定义图标的 type 不在后台库中，附带文件名以便前端解析
    if(String(n.type).startsWith('custom_')) o.icon=iconFileName(n.type);
    if(n.type==='text'){
      o.textStyle={bg:n.bg||'none',border:n.border||'none',borderColor:n.borderColor||'#4dd0ff',
        borderWidth:(n.borderWidth!=null?n.borderWidth:1.5), radius:(n.radius!=null?n.radius:6),
        padX:(n.padX!=null?n.padX:10), padY:(n.padY!=null?n.padY:6)};
    }
    if(n.type==='anchor') o.anchorStyle={fill:n.fill||'none', opacity:(n.opacity!=null?n.opacity:1)};
    if(n.action&&n.action.url)o.action={trigger:n.action.trigger||'click',url:n.action.url,target:n.action.target||'same'};
    if(n.visibleWhen!=null) o.visibleWhen=n.visibleWhen;   // ★ 数据驱动：显示条件（条件不满足→运行端隐藏该元素）
    return o;
  };
  // 本图用到的连线类型样式（自带，前端无需依赖元素库即可还原线型）；完整表见 element-library.json
  const usedET=[...new Set(edges.map(e=>e.et||'ac_power'))];
  const edgeStyles={};
  usedET.forEach(k=>{const c=ET[k]||ET.ac_power;edgeStyles[k]={labelZh:c.label,labelEn:c.labelEn,color:c.color,width:c.w,dash:c.dash,anim:c.anim,speed:c.spd};});
  const obj={
    schemaVersion:'2.0',
    meta:{
      app:'储能拓扑编辑器', generatedAt:new Date().toISOString(), lang,
      // ★ 引用元素库版本（按 name+version 加载完整库）；本文件已自带 edgeStyles，可独立还原线型
      libraryRef:{ name:LIBRARY_NAME, version:LIBRARY_VERSION },
      canvas:{ bgColor, zoom:parseFloat(zoom.toFixed(3)), panX:parseFloat(panX.toFixed(1)), panY:parseFloat(panY.toFixed(1)),
               grid:{show:showGrid, stepPx:40}, showAnchors },
      // ★ 全局视图/显示设置：随图导出，导入时一并还原，便于复原整张拓扑图的外观
      view:{ showEdgeLabels, showFieldChips, globalWidth, routeStyle,
             busMerge, busMergeGap, busTrunkBold, busStyle, busShareTrunk, busAggregation }
    },
    edgeStyles,   // ★ type → 线型样式（颜色/粗细/虚线/动画）
    nodes:nodes.map(serNode),
    edges:edges.map(e=>{const c=ET[e.et]||ET.ac_power,ec=edgeCfg(e);const eo={
      from:e.from, to:e.to,
      edgeType:e.et||'ac_power',                 // 连线类型 key
      edgeTypeLabel:{zh:c.label,en:c.labelEn},   // 类型中英文名
      color:ec.color, dash:ec.dash,              // 实际线型（已叠加单线颜色/虚实覆盖）
      route:routeToOption(e.route),              // smart / arc / manual
      dir:e.dir||'forward', width:e.w||1,
      label:e.lbl||'', showLabel:!e.hideLabel,
      orthoSnap:(e.orthoSnap!==false),
      waypoints:(e.waypoints||[]).map(p=>Array.isArray(p)?{x:parseFloat((+p[0]).toFixed(1)),y:parseFloat((+p[1]).toFixed(1))}:{x:parseFloat((+p.x).toFixed(1)),y:parseFloat((+p.y).toFixed(1))}),
      active:true
    };
    if(e.lineColor||e.lineStyle)eo.style={color:e.lineColor||'',lineStyle:e.lineStyle||'inherit'};
    if(e.fromPort)eo.fromPort=e.fromPort;
    if(e.toPort)eo.toPort=e.toPort;
    if(e.showWhen!=null) eo.showWhen=e.showWhen;                              // ★ 数据驱动：显示/存在条件
    if(Array.isArray(e.dirRules)&&e.dirRules.length) eo.dirRules=e.dirRules;  // ★ 数据驱动：流向规则（顺序匹配，e.dir 兜底）
    return eo;})
  };
  // ★ 数据驱动：自定义全局信号目录（节点字段信号 id.字段 由运行端按 nodes 自动派生，无需导出）
  if(customSignals&&customSignals.length) obj.signals=customSignals.map(s=>{const o={name:s.name,label:s.label||s.name,sample:s.sample};if(s.type)o.type=s.type;if(Array.isArray(s.options)&&s.options.length)o.options=s.options.slice();return o;});
  // ★ 数据驱动：当前注入的样例信号值（预览数据，随图导出，便于运行端/再次编辑时作默认值）
  if(signalValues&&Object.keys(signalValues).length){
    const valid=new Set(collectSignals().map(s=>s.name)),samples={};
    Object.keys(signalValues).forEach(k=>{if(valid.has(k))samples[k]=signalValues[k];});
    if(Object.keys(samples).length)obj.sampleSignals=samples;
  }
  return JSON.stringify(obj,null,2);
}
function refreshJSON(){document.getElementById('jout').textContent=buildJSON();}
function showJSON(){document.getElementById('jout').textContent=buildJSON();document.getElementById('jpanel').classList.add('show');}
function hideJSON(){document.getElementById('jpanel').classList.remove('show');}
function copyJSON(){navigator.clipboard.writeText(buildJSON()).then(()=>{const b=document.querySelector('#jpa .tb');const o=b.textContent;b.textContent='✓ 已复制';setTimeout(()=>b.textContent=o,1500);});}
function dlJSON(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buildJSON()],{type:'application/json'}));a.download='topology.json';a.click();}

// ───── 导入画布 JSON：按导出的配置还原节点/连线/画布设置，便于快速修改 ─────
function onImportJSON(ev){
  const file=ev.target.files&&ev.target.files[0];
  if(!file)return;
  const r=new FileReader();
  r.onload=async e=>{
    let obj;
    try{ obj=JSON.parse(e.target.result); }
    catch(err){ alert(lang==='en'?('Invalid JSON file: '+err.message):('JSON 解析失败：'+err.message)); ev.target.value=''; return; }
    await importCanvasJSON(obj);
    ev.target.value='';   // 清空，允许再次选择同一文件
  };
  r.onerror=()=>{ alert(lang==='en'?'Failed to read file':'读取文件失败'); ev.target.value=''; };
  r.readAsText(file);
}
// 同步 View 菜单里的复选框开关到当前布尔状态
function syncToggle(onchangeAttr,checked){
  const el=document.querySelector('input[onchange="'+onchangeAttr+'"]');
  if(el)el.checked=!!checked;
}
// 把导出节点(serNode 的产物 / 内部节点)还原为内部节点对象
function parseImportedNode(o){
  if(!o||!o.type)return null;
  const pos=o.position||{};
  const n={
    id:o.id||genId(o.type),
    type:o.type,
    labelZh:(o.label&&typeof o.label==='object'?o.label.zh:o.label)||o.labelZh||'',
    labelEn:(o.label&&typeof o.label==='object'?o.label.en:'')||o.labelEn||'',
    x:(+pos.x||+o.x||0), y:(+pos.y||+o.y||0),
    scale:(o.scale!=null?o.scale:1),
    rotation:o.rotation||0,
    fontSize:o.fontSize||14,
    fontColor:o.fontColor||'#e8f4ff'
  };
  // 状态（中/英）
  if(o.status&&typeof o.status==='object'){ n.status=o.status.zh||'待机'; if(o.status.en)n.statusEn=o.status.en; }
  else n.status=o.status||'待机';
  if(o.statusEn)n.statusEn=o.statusEn;
  // 显示开关（导出用 display.showLabel/showFields；内部用 hideLabel/hideFields）
  const disp=o.display||{};
  n.hideLabel=(disp.showLabel===false)||(o.hideLabel===true);
  n.hideFields=(disp.showFields===false)||(o.hideFields===true);
  // 数据字段
  n.data=(Array.isArray(o.data)?o.data:[]).map(f=>{
    const key=(f.key&&typeof f.key==='object')?f.key:{zh:f.key,en:f.keyEn};
    const off=f.offset||{};
    let dv=(f.value!==undefined?f.value:f.dv);
    if(dv==='--'||dv==null)dv='';   // 兼容旧导出的占位符 '--'：视为无值（空）
    return {key:(key.zh||''), keyEn:(key.en||key.zh||''), dv:dv, hidden:!!f.hidden,
            ox:(+off.x||+f.ox||0), oy:(+off.y||+f.oy||0)};
  });
  // 文本框样式
  if(o.type==='text'){const t=o.textStyle||{};n.bg=t.bg||o.bg||'none';n.border=t.border||o.border||'none';
    n.borderColor=t.borderColor||o.borderColor||'#4dd0ff';n.borderWidth=(t.borderWidth!=null?t.borderWidth:(o.borderWidth!=null?o.borderWidth:1.5));
    n.radius=(t.radius!=null?t.radius:(o.radius!=null?o.radius:6));n.padX=(t.padX!=null?t.padX:(o.padX!=null?o.padX:10));n.padY=(t.padY!=null?t.padY:(o.padY!=null?o.padY:6));
    const oldBind=t.bind||o.textBind;
    if(oldBind&&!n.data.length)n.data=[{key:String(oldBind).split('.').pop()||'数值',keyEn:'Value',dv:''}];
    if(!n.data.length)n.data=[{key:'数值',keyEn:'Value',dv:''}];}
  // 占位点样式
  if(o.type==='anchor'){const a=o.anchorStyle||{};n.fill=a.fill||o.fill||'none';n.opacity=(a.opacity!=null?a.opacity:(o.opacity!=null?o.opacity:1));}
  if(o.action&&o.action.url)n.action={trigger:o.action.trigger||'click',url:String(o.action.url),target:(o.action.target==='blank'?'blank':'same')};
  if(o.visibleWhen!=null)n.visibleWhen=o.visibleWhen;   // ★ 数据驱动：显示条件
  return n;
}
// 把导出连线还原为内部连线对象（waypoints 内部用 [x,y] 数组）
function parseImportedEdge(o){
  if(!o||!o.from||!o.to)return null;
  const wp=(Array.isArray(o.waypoints)?o.waypoints:[]).map(p=>Array.isArray(p)?[+p[0],+p[1]]:[+p.x,+p.y]).filter(p=>isFinite(p[0])&&isFinite(p[1]));
  const e={
    from:o.from, to:o.to,
    et:o.edgeType||o.et||'ac_power',
    route:routeToOption(o.route),
    dir:o.dir||'forward',
    w:(o.width!=null?o.width:(o.w!=null?o.w:1)),
    lbl:o.label||o.lbl||'',
    hideLabel:(o.showLabel===false)||(o.hideLabel===true),
    orthoSnap:(o.orthoSnap!==false)
  };
  if(o.fromPort)e.fromPort=o.fromPort;
  if(o.toPort)e.toPort=o.toPort;
  const st=o.style||{};
  if(normHex(st.color))e.lineColor=normHex(st.color);
  if(st.lineStyle==='solid'||st.lineStyle==='dashed')e.lineStyle=st.lineStyle;
  if(wp.length)e.waypoints=wp;
  if(o.showWhen!=null)e.showWhen=o.showWhen;                              // ★ 数据驱动：显示/存在条件
  if(Array.isArray(o.dirRules)&&o.dirRules.length)e.dirRules=o.dirRules;  // ★ 数据驱动：流向规则
  return e;
}
function inferEdgePortName(e,which){
  const node=nodes.find(n=>n.id===e[which]);
  if(!node)return null;
  let hint=null;
  if(which==='from'){
    hint=e.waypoints&&e.waypoints.length?e.waypoints[0]:null;
    if(!hint){const other=nodes.find(n=>n.id===e.to);if(other){const b=nodeBox(other);hint=[b.cx,b.cy];}}
  }else{
    hint=e.waypoints&&e.waypoints.length?e.waypoints[e.waypoints.length-1]:null;
    if(!hint){const other=nodes.find(n=>n.id===e.from);if(other){const b=nodeBox(other);hint=[b.cx,b.cy];}}
  }
  const port=hint&&directionalNodePort(node,hint[0],hint[1]);
  return port&&port.name;
}
function normalizeEdgePorts(list){
  (list||edges).forEach(e=>{
    autoAttachLooseEdgeEnds(e);
    if(!e.fromPort)e.fromPort=inferEdgePortName(e,'from');
    if(!e.toPort)e.toPort=inferEdgePortName(e,'to');
    dropOverroutedManualWaypoints(e);
  });
}
function resetEdgeRoutingForAutoLayout(list){
  (list||edges).forEach(e=>{
    delete e.waypoints;
    delete e.orthoDir;
    delete e.fromPort;
    delete e.toPort;
    if(e.route!=='arc'&&e.route!=='line')e.route='smart';
  });
  normalizeEdgePorts(list||edges);
}
async function importCanvasJSON(obj){
  if(!obj||typeof obj!=='object'||!Array.isArray(obj.nodes)){
    alert(lang==='en'?'Not a valid canvas JSON (missing "nodes" array).':'不是有效的画布 JSON（缺少 nodes 数组）。');
    return;
  }
  if(nodes.length>0){
    const ok=await uiConfirm(lang==='en'?'Import will replace current canvas content. Continue?':'导入将替换当前画布内容，确定？',false);
    if(!ok)return;
  }
  // 1) 合并连线类型样式：导出文件自带 edgeStyles，库里没有的类型也能还原线型
  const es=obj.edgeStyles||{};
  Object.keys(es).forEach(k=>{
    if(ET[k])return;                       // 已有类型保持库定义，不覆盖
    const s=es[k]||{};
    ET[k]={label:s.labelZh||k, labelEn:s.labelEn||k, color:s.color||'#4dd0ff',
           w:(s.width!=null?s.width:2.5), dash:s.dash||[], anim:s.anim||'flow',
           spd:(s.speed!=null?s.speed:0.5), desc:''};
  });
  // 1.5) 还原自定义全局信号 + 清空上次注入
  customSignals=(Array.isArray(obj.signals)?obj.signals:[]).filter(s=>s&&s.name).map(s=>{const o={name:s.name,label:s.label||s.name,sample:s.sample};if(s.type)o.type=s.type;if(Array.isArray(s.options))o.options=s.options.slice();return o;});
  signalValues={};injRows=[];injDraft=null;_injInited=false;
  // 2) 还原节点 / 连线（仅保留两端节点都存在的连线）
  const newNodes=obj.nodes.map(parseImportedNode).filter(Boolean);
  const idSet=new Set(newNodes.map(n=>n.id));
  const newEdges=(Array.isArray(obj.edges)?obj.edges:[]).map(parseImportedEdge)
    .filter(e=>e&&idSet.has(e.from)&&idSet.has(e.to));
  // 3) 应用状态
  snapshot();
  nodes=newNodes; edges=newEdges;
  normalizeEdgePorts(edges);
  selNode=selEdge=null; selSet.clear(); selChips.clear();
  // 还原注入的样例信号值（sampleSignals）→ 重建注入行
  if(obj.sampleSignals&&typeof obj.sampleSignals==='object'){
    Object.keys(obj.sampleSignals).forEach(k=>{const ps=parseSignal(k);injRows.push({node:ps.node,field:ps.field,val:obj.sampleSignals[k]});});
    pruneInvalidInjections();
    syncInjections();
  }
  // 4) 重建 id 计数器，保证后续新增节点 id 不冲突
  ids={};
  nodes.forEach(n=>{const m=String(n.id).match(/^(.+?)_?(\d+)$/);if(m){ids[m[1]]=Math.max(ids[m[1]]||0,parseInt(m[2]));}});
  // 5) 还原画布设置
  const canv=(obj.meta&&obj.meta.canvas)||{};
  if(canv.bgColor) setBg(canv.bgColor);
  if(canv.grid&&typeof canv.grid.show==='boolean'){ showGrid=canv.grid.show; syncToggle('toggleGrid()',showGrid); }
  if(typeof canv.showAnchors==='boolean'){ showAnchors=canv.showAnchors; syncToggle('toggleAnchors()',showAnchors); }
  // 5.5) 还原全局视图/显示设置（线标签、数据字段、线宽、走线风格、汇流合并），并同步对应 UI 控件
  const view=(obj.meta&&obj.meta.view)||{};
  if(typeof view.showEdgeLabels==='boolean'){ showEdgeLabels=view.showEdgeLabels; syncToggle('toggleEdgeLabels()',showEdgeLabels); }
  if(typeof view.showFieldChips==='boolean'){ showFieldChips=view.showFieldChips; syncToggle('toggleFieldChips()',showFieldChips); }
  if(typeof view.globalWidth==='number'){ globalWidth=view.globalWidth;
    const gw=document.getElementById('global-w'),gwv=document.getElementById('global-w-v');
    if(gw)gw.value=globalWidth; if(gwv)gwv.textContent=globalWidth.toFixed(1)+'×'; }
  if(typeof view.routeStyle==='number'){ routeStyle=view.routeStyle;
    document.querySelectorAll('#seg-route .seg-btn').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.rs)===routeStyle)); }
  if(typeof view.busMerge==='boolean') busMerge=view.busMerge;
  if(typeof view.busAggregation==='boolean') busAggregation=view.busAggregation;
  if(typeof view.busMergeGap==='number'){ busMergeGap=view.busMergeGap;
    const bg=document.getElementById('bm-gap'),bgv=document.getElementById('bm-gap-v');
    if(bg)bg.value=busMergeGap; if(bgv)bgv.textContent=busMergeGap; }
  if(typeof view.busTrunkBold==='boolean'){ busTrunkBold=view.busTrunkBold; const b=document.getElementById('bm-bold'); if(b)b.checked=busTrunkBold; }
  if(typeof view.busShareTrunk==='boolean'){ busShareTrunk=view.busShareTrunk; const b=document.getElementById('bm-share'); if(b)b.checked=busShareTrunk; }
  if(typeof view.busStyle==='string'){ busStyle=view.busStyle; const b=document.getElementById('bm-style'); if(b)b.value=busStyle; }
  // 6) 还原视图：有保存的缩放/平移就沿用，否则自动适配
  if(typeof canv.zoom==='number'&&typeof canv.panX==='number'&&typeof canv.panY==='number'){
    zoom=canv.zoom; panX=canv.panX; panY=canv.panY;
    document.getElementById('zoom-info').textContent=Math.round(zoom*100)+'%';
  }else{
    fitView();
  }
  // 7) 收尾：清路由缓存，重置历史，提示结果
  showPanel('none');
  _pathCacheSig='';
  updateAlignBar();
  history=[];histIdx=-1;snapshot();
  if(panelOpen)renderSimPanel();
  const missing=[...new Set(nodes.filter(n=>String(n.type).startsWith('custom_')&&!iconSrcOf(n.type)).map(n=>n.type))];
  let msg=(lang==='en'?'Imported ':'已导入 ')+nodes.length+(lang==='en'?' nodes, ':' 个节点、')+edges.length+(lang==='en'?' edges':' 条连线');
  if(missing.length)msg+=(lang==='en'?(' · '+missing.length+' custom icon(s) missing, re-upload in library'):('（'+missing.length+' 个自定义图标缺失，请在元素库重新上传）'));
  flashHint(msg);
}

// ══════════════════════════════════════════════════════════════
// ★ 数据驱动引擎（动态显隐 / 流向 / 条件连线）——编辑器预览与运行端共用同一套逻辑
// ══════════════════════════════════════════════════════════════
const RULE_OPS=[{v:'>=',t:'≥'},{v:'<=',t:'≤'},{v:'>',t:'>'},{v:'<',t:'<'},{v:'==',t:'='},{v:'!=',t:'≠'},
  {v:'in',t:'属于'},{v:'between',t:'区间'},{v:'truthy',t:'为真'},{v:'falsy',t:'为假'},{v:'exists',t:'存在'}];
const RULE_DIRS=[{v:'forward',t:'正向 →'},{v:'reverse',t:'反向 ←'},{v:'both',t:'双向 ↔'},{v:'none',t:'无流向'}];
const _OPT={'>=':'≥','<=':'≤','>':'>','<':'<','==':'=','!=':'≠','in':'∈','between':'∈区间','truthy':'为真','falsy':'为假','exists':'存在'};
function _num(x){if(typeof x==='number')return x;if(typeof x==='boolean')return x?1:0;const f=parseFloat(x);return isNaN(f)?NaN:f;}
function _looseEq(a,b){if(a===b)return true;const na=_num(a),nb=_num(b);if(!isNaN(na)&&!isNaN(nb))return na===nb;return String(a)===String(b);}
function _toList(rv){if(Array.isArray(rv))return rv;return String(rv==null?'':rv).split(',').map(s=>s.trim()).filter(s=>s!=='');}
function autoNum(v){if(typeof v!=='string')return v;const t=v.trim();if(t==='')return '';if(t==='true')return true;if(t==='false')return false;if(/^-?\d+(\.\d+)?$/.test(t))return parseFloat(t);return v;}
// 单条件求值
function cmpOp(lv,op,rv){
  switch(op){
    case '==': return _looseEq(lv,rv);
    case '!=': return !_looseEq(lv,rv);
    case '>':  return _num(lv)>_num(rv);
    case '>=': return _num(lv)>=_num(rv);
    case '<':  return _num(lv)<_num(rv);
    case '<=': return _num(lv)<=_num(rv);
    case 'truthy': return !!lv && lv!=='false' && lv!=='0';
    case 'falsy':  return !lv || lv==='false' || lv==='0';
    case 'exists': return lv!==undefined && lv!==null && lv!=='';
    case 'in':     return _toList(rv).some(x=>_looseEq(lv,x));
    case 'between':{const a=_toList(rv).map(_num);if(a.length<2)return false;return _num(lv)>=Math.min(a[0],a[1])&&_num(lv)<=Math.max(a[0],a[1]);}
    default: return true;
  }
}
// 条件树求值：null/无条件 → true；支持 all/any/not + 叶子{var,op,val|ref}
function evalCond(cond, ctx){
  if(cond==null)return true;
  if(typeof cond!=='object')return !!cond;
  if(Array.isArray(cond.all))return cond.all.every(c=>evalCond(c,ctx));
  if(Array.isArray(cond.any))return cond.any.some(c=>evalCond(c,ctx));
  if(cond.not!=null)return !evalCond(cond.not,ctx);
  if(cond.var==null)return true;
  const lv=ctx[cond.var];
  const rv=(cond.ref!=null)?ctx[cond.ref]:cond.val;
  return cmpOp(lv,cond.op||'truthy',rv);
}
// 汇总当前画布全部可用信号：节点字段(id.字段) + 有状态节点的 id.status/id.online + 自定义全局信号
function collectSignals(){
  const out=[],seen=new Set();
  const add=(name,label)=>{if(name&&!seen.has(name)){seen.add(name);out.push({name,label:label||name});}};
  nodes.forEach(n=>{
    (n.data||[]).forEach(f=>{if(f.key)add(n.id+'.'+f.key,nodeLabel(n)+' · '+f.key);});
    if(nodeSupportsStateSignals(n)){
      add(n.id+'.status',nodeLabel(n)+' · 状态');
      add(n.id+'.online',nodeLabel(n)+' · 在线');
    }
  });
  (customSignals||[]).forEach(s=>add(s.name,s.label||s.name));
  return out;
}
// 构造求值上下文：静态默认值(节点字段dv/有状态节点状态/在线=true/自定义样例) 叠加注入的样例值
function buildCtx(values){
  const ctx={};
  nodes.forEach(n=>{
    (n.data||[]).forEach(f=>{if(f.key)ctx[n.id+'.'+f.key]=f.dv;});
    if(nodeSupportsStateSignals(n)){
      ctx[n.id+'.status']=n.status||'';
      ctx[n.id+'.online']=true;
    }
  });
  (customSignals||[]).forEach(s=>{if(s.name!=null&&s.sample!==undefined)ctx[s.name]=s.sample;});
  if(values)Object.keys(values).forEach(k=>{ctx[k]=values[k];});
  return ctx;
}
// 连线有效流向：按 dirRules 顺序匹配，首个命中生效，否则用 e.dir
function edgeDirFor(e,ctx){
  if(Array.isArray(e.dirRules))for(const r of e.dirRules){if(evalCond(r.when,ctx))return r.dir;}
  return e.dir||'forward';
}
// 计算一帧的动态结果：隐藏节点集、隐藏连线集、流向覆盖表
function computeDynamic(ctx){
  const hiddenNodes=new Set(),hiddenEdges=new Set(),dirMap=new Map();
  nodes.forEach(n=>{if(n.visibleWhen!=null&&!evalCond(n.visibleWhen,ctx))hiddenNodes.add(n.id);});
  edges.forEach(e=>{
    let hidden=hiddenNodes.has(e.from)||hiddenNodes.has(e.to);
    if(!hidden&&e.showWhen!=null&&!evalCond(e.showWhen,ctx))hidden=true;
    if(hidden)hiddenEdges.add(e);
    else if(Array.isArray(e.dirRules)&&e.dirRules.length)dirMap.set(e,edgeDirFor(e,ctx));
  });
  return {hiddenNodes,hiddenEdges,dirMap};
}
// 渲染期取连线有效流向：流向规则随信号实时求值并自动生效（编辑态与预览态一致）；
// 有命中规则时用规则结果（dirMap），否则用连线自身的「固定流向」e.dir 兜底。仅改流向，不改连线类型/走线。
function effDir(e){ return _dyn.dirMap.has(e)?_dyn.dirMap.get(e):(e.dir||'forward'); }
function nodeHasRule(n){ return n&&n.visibleWhen!=null; }
function edgeHasRule(e){ return e&&(e.showWhen!=null||(Array.isArray(e.dirRules)&&e.dirRules.length>0)); }
// 编辑态下「带条件」的元素角标（琥珀色小点）
function drawCondBadge(x,y){
  ctx.save();ctx.shadowBlur=0;
  ctx.beginPath();ctx.arc(x,y,4.5/zoom,0,Math.PI*2);
  ctx.fillStyle='#ffcc44';ctx.fill();
  ctx.lineWidth=1.4/zoom;ctx.strokeStyle='#3a2a00';ctx.stroke();
  ctx.restore();
}
// 「被规则隐藏」标记：在虚化的元素/连线上画一个醒目的斜杠圆（⊘），与普通线区分，避免混淆。强制满透明绘制。
function drawHiddenBadge(x,y){
  ctx.save();ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.setLineDash([]);
  const r=6.5/zoom;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fillStyle='rgba(16,24,40,0.95)';ctx.fill();
  ctx.lineWidth=1.7/zoom;ctx.strokeStyle='#8aa0bf';ctx.stroke();
  const d=r*0.6;ctx.beginPath();ctx.moveTo(x-d,y+d);ctx.lineTo(x+d,y-d);ctx.lineWidth=1.8/zoom;ctx.strokeStyle='#cdd8ea';ctx.stroke();
  ctx.restore();
}

// ───── 条件 ↔ 编辑态(扁平组) 互转 ─────
function _leafToRow(c){const row={var:c.var||'',op:c.op||'>=',isRef:(c.ref!=null)};if(c.ref!=null)row.ref=c.ref;else row.val=(c.val!=null?c.val:'');return row;}
function condToEdit(cond){
  if(cond==null)return {mode:'all',rows:[]};
  if(Array.isArray(cond.all))return {mode:'all',rows:cond.all.filter(c=>c&&c.var!=null).map(_leafToRow)};
  if(Array.isArray(cond.any))return {mode:'any',rows:cond.any.filter(c=>c&&c.var!=null).map(_leafToRow)};
  if(cond.var!=null)return {mode:'all',rows:[_leafToRow(cond)]};
  return {mode:'all',rows:[]};
}
function _rowToLeaf(r){
  if(!r.var)return null;
  const leaf={var:r.var,op:r.op};
  if(['truthy','falsy','exists'].includes(r.op))return leaf;
  if(r.isRef){if(!r.ref)return null;leaf.ref=r.ref;}
  else leaf.val=autoNum(r.val);
  return leaf;
}
function editToCond(st){
  const leaves=st.rows.map(_rowToLeaf).filter(Boolean);
  if(!leaves.length)return null;
  if(leaves.length===1)return leaves[0];
  return {[st.mode]:leaves};
}
// 条件 → 可读摘要
function condSummary(cond){
  function leaf(c){const v=c.var||'?';if(['truthy','falsy','exists'].includes(c.op))return v+_OPT[c.op];const r=(c.ref!=null)?c.ref:c.val;return v+(_OPT[c.op]||c.op)+r;}
  function walk(c){if(c==null)return '';if(Array.isArray(c.all))return c.all.map(walk).filter(Boolean).join(' 且 ');if(Array.isArray(c.any))return '('+c.any.map(walk).filter(Boolean).join(' 或 ')+')';if(c.not!=null)return '非('+walk(c.not)+')';if(c.var!=null)return leaf(c);return '';}
  return walk(cond)||null;
}

// ───── 信号选择器：先选分类（元素 / 全局信号），再选具体信号 ─────
// value 为完整信号名（如 bms_1.SOC(%) 或自定义全局信号名）；变更时回调 onChange(完整信号名)
function makeSignalPicker(value, onChange){
  const wrap=document.createElement('span');wrap.className='rm-sigwrap';
  const nsel=document.createElement('select');nsel.className='rm-sig-node';
  const fsel=document.createElement('select');fsel.className='rm-sig-field';
  const state={node:'',field:''};
  if(value){const p=parseSignal(value);state.node=p.node;state.field=p.field;}
  const opt=(v,t)=>{const o=document.createElement('option');o.value=v;o.textContent=t;return o;};
  function fillNodes(){
    nsel.innerHTML='';
    nsel.appendChild(opt('',lang==='en'?'Category…':'选择分类…'));
    nodes.forEach(n=>nsel.appendChild(opt(n.id,nodeLabel(n))));
    if((customSignals&&customSignals.length)||state.node==='@global')nsel.appendChild(opt('@global',lang==='en'?'＊Global signals':'＊全局信号'));
    nsel.value=state.node;
  }
  function fillFields(){
    fsel.innerHTML='';
    fsel.appendChild(opt('',lang==='en'?'Signal…':'选择信号…'));
    const opts=state.node?fieldOptionsFor(state.node):[];
    opts.forEach(o=>fsel.appendChild(opt(o.v,o.t)));
    // 兜底：当前值在选项中已不存在（节点/字段被删或导入残留），仍展示并保留
    if(state.field&&!opts.some(o=>o.v===state.field))fsel.appendChild(opt(state.field,state.field+(lang==='en'?' (missing)':'（已失效）')));
    fsel.value=state.field;fsel.disabled=!state.node;
  }
  const emit=()=>onChange(injSignalName({node:state.node,field:state.field})||'');
  nsel.onchange=e=>{state.node=e.target.value;state.field='';fillFields();emit();};
  fsel.onchange=e=>{state.field=e.target.value;emit();};
  fillNodes();fillFields();
  wrap.appendChild(nsel);wrap.appendChild(fsel);
  return wrap;
}
// ───── 信号值语义：决定规则里「值」用「布尔/枚举下拉」还是「数值/文本输入」，避免全部混为一谈 ─────
function signalValueMeta(name){
  if(!name)return {kind:'text'};
  const p=parseSignal(name);
  const n=p.node==='@global'?null:nodes.find(x=>x.id===p.node);
  if(p.field==='online'&&nodeSupportsStateSignals(n))return {kind:'bool'};
  if(p.field==='status'&&nodeSupportsStateSignals(n)){
    const base=['在线','离线','待机','运行','充电','放电','故障','告警','备用','发电'];
    if(n&&n.status&&!base.includes(n.status))base.unshift(n.status);
    return {kind:'enum',options:base};
  }
  if(p.node==='@global'){
    const s=(customSignals||[]).find(c=>c.name===p.field);
    if(!s)return {kind:'text'};
    const t=sigTypeOf(s);
    if(t==='bool')return {kind:'bool'};
    if(t==='enum')return {kind:'enum',options:(s.options||[]).map(String)};
    if(t==='number')return {kind:'num'};
    return {kind:'text'};
  }
  const f=n&&(n.data||[]).find(d=>d.key===p.field);
  if(f){
    if(typeof f.dv==='boolean')return {kind:'bool'};
    if(typeof f.dv==='number')return {kind:'num'};
    if(f.dv!==''&&f.dv!=null&&!isNaN(Number(f.dv)))return {kind:'num'};
    return {kind:'text'};
  }
  return {kind:'num'};   // 节点数据字段默认按数值
}
// 按信号语义与运算符，生成规则里「常量值」的输入控件
function makeRuleValueInput(row){
  const meta=signalValueMeta(row.var);
  const multi=(row.op==='between'||row.op==='in');
  if(!multi&&meta.kind==='bool'){
    const sel=document.createElement('select');sel.className='rm-val';
    [['',(lang==='en'?'value…':'值…')],['true','true'],['false','false']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;sel.appendChild(o);});
    sel.value=(row.val!=null?String(row.val):'');sel.onchange=e=>row.val=e.target.value;return sel;
  }
  if(!multi&&meta.kind==='enum'){
    const sel=document.createElement('select');sel.className='rm-val';
    sel.appendChild((()=>{const o=document.createElement('option');o.value='';o.textContent=(lang==='en'?'value…':'值…');return o;})());
    const opts=(meta.options||[]).map(String);
    if(row.val!=null&&row.val!==''&&!opts.includes(String(row.val)))opts.push(String(row.val));
    opts.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o);});
    sel.value=(row.val!=null?String(row.val):'');sel.onchange=e=>row.val=e.target.value;return sel;
  }
  if(!multi&&meta.kind==='num'){
    const inp=document.createElement('input');inp.className='rm-val';inp.type='number';inp.placeholder=(lang==='en'?'number':'数值');inp.value=(row.val!=null?row.val:'');inp.oninput=e=>row.val=e.target.value;return inp;
  }
  const inp=document.createElement('input');inp.className='rm-val';
  inp.placeholder=(row.op==='between'?'a,b':(row.op==='in'?(lang==='en'?'v1,v2':'值1,值2'):(lang==='en'?'value':'值')));
  inp.value=(row.val!=null?row.val:'');inp.oninput=e=>row.val=e.target.value;return inp;
}
// 渲染一个「条件组」编辑器到容器；直接就地修改传入的 st 对象（{mode,rows}）
function renderCond(box, st){
  box.innerHTML='';box.className='rm-cond';
  const head=document.createElement('div');head.className='rm-row rm-head';
  const ms=document.createElement('select');ms.className='rm-mode';
  [['all','全部满足(且)'],['any','任一满足(或)']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;ms.appendChild(o);});
  ms.value=st.mode;ms.onchange=e=>{st.mode=e.target.value;};
  head.appendChild(document.createTextNode('匹配 '));head.appendChild(ms);box.appendChild(head);
  const list=document.createElement('div');box.appendChild(list);
  function drawRows(){
    list.innerHTML='';
    st.rows.forEach((row,idx)=>{
      const r=document.createElement('div');r.className='rm-row';
      const vIn=makeSignalPicker(row.var,v=>{row.var=v;rebuildVal();});  // 换信号→按新信号语义重建值输入（保留已填的值，含 0，不清空）
      const op=document.createElement('select');op.className='rm-op';
      RULE_OPS.forEach(o=>{const opt=document.createElement('option');opt.value=o.v;opt.textContent=o.t;op.appendChild(opt);});
      op.value=row.op||'>=';
      const valWrap=document.createElement('span');valWrap.className='rm-valwrap';
      function rebuildVal(){
        valWrap.innerHTML='';
        if(['truthy','falsy','exists'].includes(row.op))return;
        if(row.isRef){
          valWrap.appendChild(makeSignalPicker(row.ref,v=>{row.ref=v;}));
        }else{
          valWrap.appendChild(makeRuleValueInput(row));
        }
        const tg=document.createElement('button');tg.type='button';tg.className='rm-reftg'+(row.isRef?' on':'');tg.textContent=row.isRef?'信号':'常量';tg.title='切换：与常量比较 / 与另一个信号比较';
        tg.onclick=()=>{row.isRef=!row.isRef;rebuildVal();};
        valWrap.appendChild(tg);
      }
      op.onchange=e=>{row.op=e.target.value;rebuildVal();};
      const del=document.createElement('button');del.type='button';del.className='rm-del';del.textContent='×';del.title='删除此条件';
      del.onclick=()=>{st.rows.splice(idx,1);drawRows();};
      r.appendChild(vIn);r.appendChild(op);r.appendChild(valWrap);r.appendChild(del);
      list.appendChild(r);rebuildVal();
    });
    if(!st.rows.length){const em=document.createElement('div');em.className='rm-empty';em.textContent='无条件（始终满足）';list.appendChild(em);}
  }
  drawRows();
  const add=document.createElement('button');add.type='button';add.className='rm-add';add.textContent='+ 添加条件';
  add.onclick=()=>{st.rows.push({var:'',op:'>=',val:''});drawRows();};
  box.appendChild(add);
}
function _mkBtn(t,fn,title){const b=document.createElement('button');b.type='button';b.className='rm-mini';b.textContent=t;if(title)b.title=title;b.onclick=fn;return b;}
// 渲染「流向规则表」编辑器（ds={def,rules:[{when:editState,dir}]}）
function renderDirRules(box, ds){
  box.innerHTML='';box.className='rm-cond';
  const hint=document.createElement('div');hint.className='rm-hint';hint.textContent='按顺序匹配，第一个命中的规则决定流向；都不命中时用连线自身的「流向」设置。仅修改流向，不改变连线类型与走线方式。';box.appendChild(hint);
  const list=document.createElement('div');box.appendChild(list);
  function draw(){
    list.innerHTML='';
    ds.rules.forEach((r,idx)=>{
      const card=document.createElement('div');card.className='rm-dircard';
      const top=document.createElement('div');top.className='rm-dirtop';
      top.appendChild(document.createTextNode('规则'+(idx+1)+' 命中 ⇒ 流向 '));
      const dsel=document.createElement('select');RULE_DIRS.forEach(d=>{const o=document.createElement('option');o.value=d.v;o.textContent=d.t;dsel.appendChild(o);});dsel.value=r.dir;dsel.onchange=e=>r.dir=e.target.value;
      top.appendChild(dsel);
      const sp=document.createElement('span');sp.className='rm-dirbtns';
      sp.appendChild(_mkBtn('↑',()=>{if(idx>0){const t=ds.rules[idx-1];ds.rules[idx-1]=ds.rules[idx];ds.rules[idx]=t;draw();}},'上移'));
      sp.appendChild(_mkBtn('↓',()=>{if(idx<ds.rules.length-1){const t=ds.rules[idx+1];ds.rules[idx+1]=ds.rules[idx];ds.rules[idx]=t;draw();}},'下移'));
      sp.appendChild(_mkBtn('×',()=>{ds.rules.splice(idx,1);draw();},'删除规则'));
      top.appendChild(sp);card.appendChild(top);
      const condBox=document.createElement('div');card.appendChild(condBox);renderCond(condBox,r.when);
      list.appendChild(card);
    });
    // 兜底流向只读展示——它就是连线自身的「流向」，请在属性面板里改；此处不改连线本身，避免编辑流向规则时动到走线
    const defRow=document.createElement('div');defRow.className='rm-dirdefault';
    const defLbl=(RULE_DIRS.find(d=>d.v===ds.def)||{t:ds.def}).t;
    defRow.appendChild(document.createTextNode('都不命中 ⇒ 用连线流向：'+defLbl+'（在属性面板修改）'));
    list.appendChild(defRow);
  }
  draw();
  const add=document.createElement('button');add.type='button';add.className='rm-add';add.textContent='+ 添加流向规则';
  add.onclick=()=>{ds.rules.push({when:{mode:'all',rows:[{var:'',op:'>',val:'0'}]},dir:'forward'});draw();};
  box.appendChild(add);
}

// ───── 规则编辑模态 ─────
let _ruleSaver=null,_ruleClearer=null;
// 在模态顶部显示「当前绑定的元素/连线」，避免不知道规则属于谁
function setRuleTarget(target){
  const el=document.getElementById('rm-target');if(!el)return;
  if(!target){el.style.display='none';return;}
  el.style.display='';
  el.style.borderLeftColor=target.color||'var(--ui-accent)';
  el.innerHTML='';
  const top=document.createElement('div');top.className='rm-tg-top';
  const chip=document.createElement('span');chip.className='rm-tg-chip';chip.textContent=target.kind;
  const main=document.createElement('span');main.className='rm-tg-main';main.textContent=target.main;
  top.appendChild(chip);top.appendChild(main);el.appendChild(top);
  if(target.sub){const sub=document.createElement('div');sub.className='rm-tg-sub';sub.textContent=target.sub;el.appendChild(sub);}
}
// 连线的目标描述：起点 → 终点（类型 / 标签）
function edgeTargetDesc(e){
  const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
  const al=a?(nodeLabel(a)||a.id):e.from, bl=b?(nodeLabel(b)||b.id):e.to;
  const cfg=ET[e.et]||ET.ac_power;
  const tl=(lang==='en'?(cfg.labelEn||cfg.label):cfg.label)||e.et;
  const sub=(lang==='en'?'Type: ':'类型：')+tl+(e.lbl?((lang==='en'?'  ·  Label: ':'  ·  标签：')+e.lbl):'');
  return {kind:(lang==='en'?'EDGE':'连线'), main:al+'  →  '+bl, sub:sub, color:cfg.color};
}
function nodeTargetDesc(n){
  return {kind:(lang==='en'?'NODE':'元素'), main:(nodeLabel(n)||n.id), sub:n.id+'  ·  '+n.type, color:n.fontColor||'var(--ui-accent)'};
}
function openRuleModal(title, target, bodyRenderer, saver, clearer){
  setSigPanel(false);
  closeBgPanel();
  document.getElementById('rm-title').textContent=title;
  setRuleTarget(target);
  const body=document.getElementById('rm-body');body.innerHTML='';
  bodyRenderer(body);
  _ruleSaver=saver;_ruleClearer=clearer||null;
  document.getElementById('rulemodal-ov').classList.add('show');
}
function closeRuleModal(){document.getElementById('rulemodal-ov').classList.remove('show');_ruleSaver=_ruleClearer=null;}
function saveRuleModal(){if(_ruleSaver)_ruleSaver();closeRuleModal();}
function clearRuleModalState(){if(_ruleClearer)_ruleClearer();}
// 节点显示条件（可传入指定节点；不传则用当前选中——属性面板与规则总览共用）
function editNodeRule(n){
  n=n||nodes.find(x=>x.id===selNode);if(!n)return;
  const st=condToEdit(n.visibleWhen);
  openRuleModal((lang==='en'?'Show condition':'显示条件'), nodeTargetDesc(n),
    box=>renderCond(box,st),
    ()=>{snapshot();n.visibleWhen=editToCond(st);snapshot();afterRuleChange(n);},
    ()=>{st.rows=[];renderCond(document.getElementById('rm-body'),st);});
}
// 连线显示条件
function editEdgeShowRule(e){
  e=e||selEdge;if(!e)return;
  const st=condToEdit(e.showWhen);
  openRuleModal((lang==='en'?'Edge show condition':'连线显示条件'), edgeTargetDesc(e),
    box=>renderCond(box,st),
    ()=>{snapshot();e.showWhen=editToCond(st);snapshot();afterRuleChange(e);},
    ()=>{st.rows=[];renderCond(document.getElementById('rm-body'),st);});
}
// 连线流向规则
function editEdgeDirRules(e){
  e=e||selEdge;if(!e)return;
  const ds={def:e.dir||'forward',rules:(Array.isArray(e.dirRules)?e.dirRules:[]).map(r=>({when:condToEdit(r.when),dir:r.dir||'forward'}))};
  openRuleModal((lang==='en'?'Edge direction rules':'连线流向规则'), edgeTargetDesc(e),
    box=>renderDirRules(box,ds),
    ()=>{snapshot();
      // 只写入流向规则，绝不改动连线的固定流向(e.dir)、类型(e.et)、走线方式(e.route)与拐点(e.waypoints)
      const rules=ds.rules.map(r=>({when:editToCond(r.when),dir:r.dir})).filter(r=>r.when!=null);
      if(rules.length)e.dirRules=rules;else delete e.dirRules;
      snapshot();afterRuleChange(e);},
    ()=>{ds.rules=[];renderDirRules(document.getElementById('rm-body'),ds);});
}
// 规则改动后：同步刷新属性面板摘要(若该元素正被选中) + 抽屉「规则总览」，两边一致
function afterRuleChange(ref){
  if(ref&&typeof ref==='object'){
    if(ref.id!==undefined&&ref.id===selNode)refreshNodeRuleSummary(ref);
    if(ref===selEdge)refreshEdgeRuleSummary(ref);
  }
  renderRulesList();
  _pathCacheSig='';
}
// 规则总览：增/删/改入口（与属性面板共用同一套编辑器与数据）
function openRuleEditor(kind, ref){
  if(kind==='nodeShow')editNodeRule(ref);
  else if(kind==='edgeShow')editEdgeShowRule(ref);
  else if(kind==='edgeDir')editEdgeDirRules(ref);
}
function clearRuleOf(kind, ref){
  snapshot();
  if(kind==='nodeShow')delete ref.visibleWhen;
  else if(kind==='edgeShow')delete ref.showWhen;
  else if(kind==='edgeDir')delete ref.dirRules;
  snapshot();afterRuleChange(ref);
}
function ruleItemInfo(kind, ref){
  const dt={forward:'正向→',reverse:'反向←',both:'双向↔',none:'无'};
  if(kind==='nodeShow')return {chip:(lang==='en'?'NODE':'元素'), tag:(lang==='en'?'Show':'显示'), name:(nodeLabel(ref)||ref.id), sum:(condSummary(ref.visibleWhen)||'—'), color:ref.fontColor||'var(--ui-accent)'};
  const a=nodes.find(n=>n.id===ref.from),b=nodes.find(n=>n.id===ref.to);
  const nm=(a?(nodeLabel(a)||a.id):ref.from)+' → '+(b?(nodeLabel(b)||b.id):ref.to);
  const cfg=ET[ref.et]||ET.ac_power;
  if(kind==='edgeShow')return {chip:(lang==='en'?'EDGE':'连线'), tag:(lang==='en'?'Show':'显示'), name:nm, sum:(condSummary(ref.showWhen)||'—'), color:cfg.color};
  const sum=(Array.isArray(ref.dirRules)?ref.dirRules.map(r=>(condSummary(r.when)||'?')+'⇒'+(dt[r.dir]||r.dir)).join('；'):'')+'；否则'+(dt[ref.dir||'forward']||'正向→');
  return {chip:(lang==='en'?'EDGE':'连线'), tag:(lang==='en'?'Dir':'流向'), name:nm, sum:sum, color:cfg.color};
}
function renderRulesList(){
  const wrap=document.getElementById('sim-rules');if(!wrap)return;
  wrap.innerHTML='';
  const rows=[];
  nodes.forEach(n=>{if(n.visibleWhen!=null)rows.push({kind:'nodeShow',ref:n});});
  edges.forEach(e=>{if(e.showWhen!=null)rows.push({kind:'edgeShow',ref:e});if(Array.isArray(e.dirRules)&&e.dirRules.length)rows.push({kind:'edgeDir',ref:e});});
  // 鼠标移出整张规则列表时，恢复进入列表前的选中；移入某条规则时临时选中其元素/连线
  wrap.onmouseleave=()=>{ if(!_ruleHovering)return; _ruleHovering=false; const p=_ruleHoverPrev;_ruleHoverPrev=null; restoreSelection(p); };
  if(!rows.length){const d=document.createElement('div');d.className='sim-empty';d.textContent=(lang==='en'?'No rules yet. Select an element/edge on the canvas, then set its show/direction condition in the property panel — it takes effect immediately.':'暂无规则。在画布上选中元素或连线，于右侧属性面板设置「显示条件 / 流向规则」，保存后立即生效。');wrap.appendChild(d);}
  else rows.forEach(r=>{
    const info=ruleItemInfo(r.kind,r.ref);
    const it=document.createElement('div');it.className='rule-item';it.style.borderLeftColor=info.color;it.style.cursor='pointer';
    const head=document.createElement('div');head.className='rule-item-head';
    const chip=document.createElement('span');chip.className='rule-item-chip';chip.textContent=info.chip+' · '+info.tag;
    const nm=document.createElement('span');nm.className='rule-item-name';nm.textContent=info.name;nm.title=info.name;
    head.appendChild(chip);head.appendChild(nm);
    const sum=document.createElement('div');sum.className='rule-item-sum';sum.textContent=info.sum;sum.title=info.sum;
    const btns=document.createElement('div');btns.className='rule-item-btns';
    const ed=document.createElement('button');ed.type='button';ed.className='rm-mini rm-wide';ed.textContent=(lang==='en'?'Edit':'编辑');ed.onclick=()=>{_ruleHovering=false;_ruleHoverPrev=null;selectRuleTarget(r.kind,r.ref);openRuleEditor(r.kind,r.ref);};
    const cl=document.createElement('button');cl.type='button';cl.className='rm-mini rm-wide';cl.textContent=(lang==='en'?'Clear':'清除');cl.onclick=()=>clearRuleOf(r.kind,r.ref);
    btns.appendChild(ed);btns.appendChild(cl);
    // 悬停高亮：临时选中对应元素/连线，便于辨认是哪个；记住进入列表前的选中以便复原
    it.onmouseenter=()=>{ if(!_ruleHovering){_ruleHovering=true;_ruleHoverPrev={node:selNode,edge:selEdge};} selectRuleTarget(r.kind,r.ref); };
    it.appendChild(head);it.appendChild(sum);it.appendChild(btns);
    wrap.appendChild(it);
  });
}
// 悬停规则总览的恢复：还原进入列表前的选中态
function restoreSelection(p){
  try{
    if(p&&p.node&&nodes.some(n=>n.id===p.node)){ selectNode(p.node); }
    else if(p&&p.edge&&edges.indexOf(p.edge)>=0){ selectEdge(p.edge); }
    else { selNode=selEdge=null; showPanel('none'); }
  }catch(e){}
}
// 从规则总览定位并选中对应元素/连线（便于在画布上看到它，并与属性面板联动）
function selectRuleTarget(kind, ref){
  try{ if(kind==='nodeShow'){ if(typeof selectNode==='function')selectNode(ref.id); } else { if(typeof selectEdge==='function')selectEdge(ref); } }catch(e){}
}
// 批量样例文本框：按内容自适应高度（无内部滚动条）
function autoGrowSimJSON(){ const ta=document.getElementById('sim-json'); if(!ta)return; ta.style.height='auto'; ta.style.height=(ta.scrollHeight+4)+'px'; }
// 用当前信号值生成一份完整 JSON 模板，便于看清「批量样例 JSON」的格式；填入后自适应高度并滚动到底部定位到批量样例处
function fillSimTemplate(){
  const ctxv=buildCtx(signalValues);const obj={};
  collectSignals().forEach(s=>{obj[s.name]=ctxv[s.name];});
  const ta=document.getElementById('sim-json');if(ta)ta.value=JSON.stringify(obj,null,2);
  autoGrowSimJSON();   // 同步改高度（内部读取 scrollHeight 触发回流）→ 此后 body 高度已是最新，可直接滚到底
  const body=document.getElementById('sim-body');
  if(body){ body.scrollTop=body.scrollHeight; setTimeout(()=>{ if(body)body.scrollTop=body.scrollHeight; },60); }   // 定位到底部「批量样例」处
}
// 面板规则摘要
function refreshNodeRuleSummary(n){
  const el=document.getElementById('np-rule-sum');if(!el)return;
  const s=n&&condSummary(n.visibleWhen);
  el.textContent=s||(lang==='en'?'None (always show)':'无（始终显示）');
  el.classList.toggle('has',!!s);
}
function refreshEdgeRuleSummary(e){
  const se=document.getElementById('ep-show-sum');
  if(se){const s=e&&condSummary(e.showWhen);se.textContent=s||(lang==='en'?'None (always show)':'无（始终显示）');se.classList.toggle('has',!!s);}
  const de=document.getElementById('ep-dir-sum');
  if(de){
    const dt={forward:'正向→',reverse:'反向←',both:'双向↔',none:'无'};
    let txt,has=false;
    if(e&&Array.isArray(e.dirRules)&&e.dirRules.length){has=true;txt=e.dirRules.map(r=>(condSummary(r.when)||'?')+'⇒'+(dt[r.dir]||r.dir)).join('；')+'；否则'+(dt[e.dir||'forward']||'正向→');}
    else txt=(lang==='en'?'No rules (uses fixed direction below)':'无规则（用下面的固定流向）');
    de.textContent=txt;de.classList.toggle('has',has);
  }
}

// ───── 「规则与信号」侧栏 + 运行视图 ─────
// 规则始终实时生效（编辑态虚化、运行视图彻底隐藏）；侧栏仅用于「总览规则 / 管理全局信号 / 注入测试」。
// 注意：togglePanel(side) 已被左右属性面板折叠占用，这里用独立名 toggleSigPanel。
function setSigPanel(on){
  panelOpen=!!on;
  const b=document.getElementById('btn-preview');
  if(b)b.classList.toggle('act',panelOpen);
  document.getElementById('simpanel').classList.toggle('show',panelOpen);
  if(panelOpen)renderSimPanel();
}
function toggleSigPanel(){ setSigPanel(!panelOpen); }
// 运行视图/预览开关：开=彻底隐藏被规则隐藏的元素并应用数据驱动流向（看整图运行效果）；关=回到编辑态（被隐藏者虚化+⊘标记，仍可编辑）
function toggleRunView(on){
  previewMode=(on!=null)?!!on:!previewMode;
  const cb=document.getElementById('sim-runview');if(cb)cb.checked=previewMode;
  const b=document.getElementById('btn-runview');
  if(b){b.classList.toggle('act',previewMode);b.textContent=previewMode?(lang==='en'?'■ Exit Preview':'■ 退出预览'):(lang==='en'?'▶ Preview':'▶ 预览效果');}
  _pathCacheSig='';
}
// 兼容旧入口名
function togglePreview(){ toggleSigPanel(); }
// 注入行 → 信号名（@global 用字段名本身，否则 节点id.字段）
function injSignalName(r){ if(!r)return null; if(r.node==='@global')return r.field||null; if(r.node&&r.field)return r.node+'.'+r.field; return null; }
// 信号名 → 注入行结构（导入/粘贴时反解）
function parseSignal(name){ const i=String(name).lastIndexOf('.'); if(i>0){const nd=name.slice(0,i),fd=name.slice(i+1);if(nodes.some(n=>n.id===nd))return {node:nd,field:fd};} return {node:'@global',field:name}; }
// 注入行 → signalValues（供求值用）
function syncInjections(){ signalValues={}; injRows.forEach(r=>{const nm=injSignalName(r);if(nm&&r.val!=='')signalValues[nm]=autoNum(r.val);}); }
function signalExistsForRow(r){
  if(!r||!r.node||!r.field)return false;
  return fieldOptionsFor(r.node).some(o=>o.v===r.field);
}
function pruneInvalidInjections(){
  const before=injRows.length;
  injRows=injRows.filter(signalExistsForRow);
  if(injDraft&&injDraft.node&&injDraft.field&&!signalExistsForRow(injDraft))injDraft=null;
  if(injRows.length!==before)syncInjections();
}
// 某元素的「字段」可选项
function fieldOptionsFor(node){
  if(node==='@global')return (customSignals||[]).map(s=>({v:s.name,t:s.label||s.name}));
  const n=nodes.find(x=>x.id===node);if(!n)return [];
  const opts=(n.data||[]).filter(f=>f.key).map(f=>({v:f.key,t:f.key}));
  if(nodeSupportsStateSignals(n)){ opts.push({v:'status',t:'状态'});opts.push({v:'online',t:'在线'}); }
  return opts;
}
// 某行「值」的下拉建议（在线→true/false；状态→常见状态；数值→当前静态值）
function valSuggestFor(r){
  const n=(r&&r.node&&r.node!=='@global')?nodes.find(x=>x.id===r.node):null;
  if(r.field==='online'&&nodeSupportsStateSignals(n))return ['true','false'];
  if(r.field==='status'&&nodeSupportsStateSignals(n)){const base=['在线','离线','待机','运行','充电','放电','故障','告警','备用','发电'];if(n&&n.status&&base.indexOf(n.status)<0)base.unshift(n.status);return base;}
  if(r.node==='@global'){const s=(customSignals||[]).find(c=>c.name===r.field);if(!s)return [];const t=sigTypeOf(s);if(t==='bool')return ['true','false'];if(t==='enum')return (s.options||[]).map(String);return (s.sample!==''&&s.sample!=null)?[String(s.sample)]:[];}
  const f=n&&(n.data||[]).find(d=>d.key===r.field);return (f&&f.dv!=='')?[String(f.dv)]:[];
}
function renderSimPanel(){ renderRulesList(); renderInjRows(); renderCustomSignals(); autoGrowSimJSON(); }
// 某元素「尚未被其它注入行占用」的字段（去重用；exceptIdx 为当前行自身，排除在外）
function remainingFieldsFor(node, exceptIdx){
  const used=new Set();
  injRows.forEach((r,i)=>{ if(i===exceptIdx)return; if(r.node===node && r.field) used.add(r.field); });
  return fieldOptionsFor(node).filter(o=>!used.has(o.v));
}
// 是否所有可用信号都已注入（节点字段/状态/在线 + 全局信号）
function allSignalsInjected(){
  const avail=collectSignals(); if(!avail.length)return false;
  const inj=new Set(injRows.map(injSignalName).filter(Boolean));
  return avail.every(s=>inj.has(s.name));
}
// 是否正在新增（存在待确认草稿）→ 用于禁用「+ 添加注入」，一次只编辑一条草稿
function hasPendingInjRow(){ return !!injDraft; }
// 注入「值」控件：按信号语义决定控件类型——布尔/枚举(在线、状态、枚举型全局信号)用下拉；数值/文本用输入框（不再用 datalist 让数值也带下拉）
function makeInjValueInput(r){
  const name=injSignalName(r);
  const meta=name?signalValueMeta(name):{kind:'text'};
  if(meta.kind==='bool'){
    const sel=document.createElement('select');sel.className='sim-val';
    [['',(lang==='en'?'value…':'值…')],['true','true'],['false','false']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;sel.appendChild(o);});
    sel.value=(r.val!=null?String(r.val):'');sel.onchange=e=>{r.val=e.target.value;syncInjections();};return sel;
  }
  if(meta.kind==='enum'){
    const sel=document.createElement('select');sel.className='sim-val';
    const ph=document.createElement('option');ph.value='';ph.textContent=(lang==='en'?'value…':'值…');sel.appendChild(ph);
    const opts=(meta.options||[]).map(String);
    if(r.val!=null&&r.val!==''&&!opts.includes(String(r.val)))opts.push(String(r.val));
    opts.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o);});
    sel.value=(r.val!=null?String(r.val):'');sel.onchange=e=>{r.val=e.target.value;syncInjections();};return sel;
  }
  const inp=document.createElement('input');inp.className='sim-val';
  if(meta.kind==='num'){inp.type='number';inp.placeholder=(lang==='en'?'number':'数值');}else{inp.placeholder=(lang==='en'?'value':'值');}
  inp.value=(r.val!=null?r.val:'');inp.oninput=e=>{r.val=e.target.value;syncInjections();};return inp;
}
// 已确认注入行（分组内紧凑行）：字段 + 值 + 删除（元素由分组头表示）
function buildInjCompactRow(idx){
  const r=injRows[idx];
  const row=document.createElement('div');row.className='sim-irow';
  const fsel=document.createElement('select');fsel.className='sim-sel';
  const optList=remainingFieldsFor(r.node, idx);                                   // 排除同元素其它行已占字段 → 防重复
  if(r.field && !optList.some(o=>o.v===r.field)){ const own=fieldOptionsFor(r.node).find(o=>o.v===r.field); optList.push(own||{v:r.field,t:r.field}); }
  if(!r.field && optList.length)r.field=optList[0].v;
  optList.forEach(o=>{const op=document.createElement('option');op.value=o.v;op.textContent=o.t;fsel.appendChild(op);});
  fsel.value=r.field||'';
  fsel.onchange=e=>{r.field=e.target.value;r.val='';syncInjections();renderInjRows();};
  const vctrl=makeInjValueInput(r);
  const del=document.createElement('button');del.type='button';del.className='rm-del';del.textContent='×';del.title=(lang==='en'?'Remove':'删除');del.onclick=()=>{injRows.splice(idx,1);syncInjections();renderInjRows();};
  row.appendChild(fsel);row.appendChild(vctrl);row.appendChild(del);
  return row;
}
// 新增注入草稿卡：选元素 → 选字段 → 填值 → 点 ✓ 确认后才并入分组列表（× 取消）；选完元素不再立即跳转
function buildInjDraftCard(){
  const d=injDraft;
  const box=document.createElement('div');box.className='sim-igroup draft';
  const head=document.createElement('div');head.className='sim-ghead';
  const name=document.createElement('span');name.className='sim-gname';name.style.color='var(--ui-text2)';name.textContent=(lang==='en'?'New injection…':'新增注入…');
  head.appendChild(name);box.appendChild(head);
  const fullTag=(lang==='en'?' (all injected)':'（已全部注入）');
  // 第一行：元素下拉（已全部注入的元素置灰）
  const r1=document.createElement('div');r1.className='sim-irow';
  const nsel=document.createElement('select');nsel.className='sim-sel';
  const ph=document.createElement('option');ph.value='';ph.textContent=(lang==='en'?'Element':'选择元素');nsel.appendChild(ph);
  nodes.forEach(n=>{const o=document.createElement('option');o.value=n.id;o.textContent=nodeLabel(n);if(remainingFieldsFor(n.id,-1).length===0){o.disabled=true;o.textContent+=fullTag;}nsel.appendChild(o);});
  const og=document.createElement('option');og.value='@global';og.textContent=(lang==='en'?'＊Global signals':'＊全局信号');if(remainingFieldsFor('@global',-1).length===0){og.disabled=true;og.textContent+=((customSignals&&customSignals.length)?fullTag:(lang==='en'?' (none)':'（无全局信号）'));}nsel.appendChild(og);
  nsel.value=d.node||'';
  nsel.onchange=e=>{d.node=e.target.value;const rem=remainingFieldsFor(d.node,-1);d.field=(rem[0]?rem[0].v:'');d.val='';renderInjRows();};
  r1.appendChild(nsel);box.appendChild(r1);
  // 第二行：字段 + 值 + ✓ 确认 + × 取消
  const r2=document.createElement('div');r2.className='sim-irow';
  const fsel=document.createElement('select');fsel.className='sim-sel';
  if(!d.node){const fph=document.createElement('option');fph.value='';fph.textContent=(lang==='en'?'Field':'选择字段');fsel.appendChild(fph);fsel.disabled=true;}
  else{const optList=remainingFieldsFor(d.node,-1);if(!d.field&&optList.length)d.field=optList[0].v;optList.forEach(o=>{const op=document.createElement('option');op.value=o.v;op.textContent=o.t;fsel.appendChild(op);});fsel.value=d.field||'';}
  fsel.onchange=e=>{d.field=e.target.value;d.val='';renderInjRows();};
  const vctrl=d.field?makeInjValueInput(d):(function(){const i=document.createElement('input');i.className='sim-val';i.placeholder=(lang==='en'?'value':'值');i.disabled=true;return i;})();
  const ok=document.createElement('button');ok.type='button';ok.className='sim-ok';ok.textContent='✓';ok.title=(lang==='en'?'Confirm & add':'确认添加到列表');
  ok.disabled=!(d.node&&d.field);
  ok.onclick=()=>{ if(!(d.node&&d.field))return; injRows.push({node:d.node,field:d.field,val:(d.val!=null?d.val:'')}); injCollapsed.delete(d.node); injDraft=null; syncInjections(); renderInjRows(); };
  const cancel=document.createElement('button');cancel.type='button';cancel.className='rm-del';cancel.textContent='×';cancel.title=(lang==='en'?'Cancel':'取消');cancel.onclick=()=>{injDraft=null;renderInjRows();};
  r2.appendChild(fsel);r2.appendChild(vctrl);r2.appendChild(ok);r2.appendChild(cancel);box.appendChild(r2);
  return box;
}
function renderInjRows(){
  const wrap=document.getElementById('sim-inj');if(!wrap)return;
  wrap.innerHTML='';
  const addBtn=document.getElementById('sim-add-inj');
  const tools=document.getElementById('sim-inj-tools');
  pruneInvalidInjections();
  if(!nodes.length&&!customSignals.length){
    wrap.innerHTML='<div class="sim-empty">'+(lang==='en'?'No elements/signals yet: add nodes & data fields, or add a global signal below.':'画布暂无元素/信号：先添加节点与数据字段，或在下方添加全局信号。')+'</div>';
    if(addBtn)addBtn.disabled=true; if(tools)tools.style.display='none'; _injInited=false; return;
  }
  // 鼠标移出注入列表 → 恢复进入前的选中（与「规则总览」共用悬停高亮机制）
  wrap.onmouseleave=()=>{ if(!_ruleHovering)return; _ruleHovering=false; const p=_ruleHoverPrev;_ruleHoverPrev=null; restoreSelection(p); };
  const committed=injRows.filter(r=>r.node);   // 已确认（完整）注入；草稿单独存在 injDraft
  if(!committed.length)_injInited=false;
  if(!committed.length && !injDraft){
    wrap.innerHTML='<div class="sim-empty">'+(lang==='en'?'Click "+ Add injection" to pick an element & field and inject preview data.':'点「+ 添加注入」选择元素与字段，注入预览数据。')+'</div>';
    if(tools)tools.style.display='none';
  } else {
    // 按元素分组（首次出现顺序）——仅已确认行参与分组
    const order=[],map={};
    injRows.forEach((r,idx)=>{ if(!r.node)return; const key=r.node; if(!(key in map)){map[key]={node:r.node,items:[]};order.push(key);} map[key].items.push(idx); });
    const realKeys=order;
    if(!_injInited){ _injInited=true; injCollapsed=new Set(realKeys.slice(1)); }   // 手风琴：默认仅首张展开
    if(tools)tools.style.display=(realKeys.length>=2)?'flex':'none';               // ≥2 个分组才显示「全部展开/折叠」
    order.forEach(key=>{
      const g=map[key];
      const box=document.createElement('div');box.className='sim-igroup';
      // 悬停卡片 → 高亮画布上对应元素（及其数据字段）；全局信号无对应元素则临时清空高亮
      box.onmouseenter=()=>{ if(!_ruleHovering){_ruleHovering=true;_ruleHoverPrev={node:selNode,edge:selEdge};}
        if(g.node&&g.node!=='@global'&&nodes.some(n=>n.id===g.node)){ try{ selectNode(g.node); }catch(e){} }
        else { selNode=null;selEdge=null; } };
      const head=document.createElement('div');head.className='sim-ghead';
      const name=document.createElement('span');name.className='sim-gname';
      const collapsed=injCollapsed.has(key);
      if(collapsed)box.classList.add('collapsed');
      head.classList.add('clk');
      const chev=document.createElement('span');chev.className='sim-gchev';chev.textContent=collapsed?'▶':'▼';
      const chip=document.createElement('span');chip.className='sim-gchip';chip.textContent=(g.node==='@global'?(lang==='en'?'GLOBAL':'全局'):(lang==='en'?'NODE':'元素'));
      const nd=nodes.find(x=>x.id===g.node);
      const lab=document.createElement('span');lab.style.cssText='overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      lab.textContent=(g.node==='@global'?(lang==='en'?'Global signals':'全局信号'):(nd?nodeLabel(nd):g.node));
      name.appendChild(chip);name.appendChild(lab);
      const cnt=document.createElement('span');cnt.className='sim-gcount';cnt.textContent='('+g.items.length+')';
      const gadd=document.createElement('button');gadd.type='button';gadd.className='sim-gadd';gadd.textContent=(lang==='en'?'+ field':'+ 字段');
      const rem=remainingFieldsFor(g.node,-1);
      gadd.disabled=!rem.length;gadd.title=rem.length?(lang==='en'?'Inject another field of this element':'为该元素再注入一个字段'):(lang==='en'?'All fields of this element are injected':'该元素的字段已全部注入');
      gadd.onclick=ev=>{ev.stopPropagation();const r2=remainingFieldsFor(g.node,-1);if(!r2.length)return;injCollapsed.delete(g.node);injRows.push({node:g.node,field:r2[0].v,val:''});syncInjections();renderInjRows();};
      head.appendChild(chev);head.appendChild(name);head.appendChild(cnt);head.appendChild(gadd);box.appendChild(head);
      head.onclick=ev=>{ if(ev.target.closest('.sim-gadd'))return; if(injCollapsed.has(key))injCollapsed.delete(key);else injCollapsed.add(key); renderInjRows(); };
      if(!collapsed){const body=document.createElement('div');body.className='sim-gbody';g.items.forEach(idx=>body.appendChild(buildInjCompactRow(idx)));box.appendChild(body);}
      wrap.appendChild(box);
    });
    // 草稿卡（待确认）放最后
    if(injDraft)wrap.appendChild(buildInjDraftCard());
  }
  // 「+ 添加注入」：所有可用信号都已注入 或 正在编辑草稿 时禁用
  if(addBtn){
    const noneLeft=allSignalsInjected(),drafting=!!injDraft;
    addBtn.disabled=noneLeft||drafting;
    addBtn.title=noneLeft?(lang==='en'?'All available signals are injected':'所有可用信号都已注入，无需再添加')
              :drafting?(lang==='en'?'Finish the new injection below first':'请先完成下方「新增注入」并点 ✓ 确认')
              :'';
  }
}
function addInjRow(){
  if(allSignalsInjected()){ flashHint(lang==='en'?'All available signals are already injected':'所有可用信号都已注入，无需再添加'); renderInjRows(); return; }
  if(injDraft){ flashHint(lang==='en'?'Finish the new injection below first':'请先完成下方「新增注入」并点 ✓ 确认'); renderInjRows(); return; }
  injDraft={node:'',field:'',val:''};renderInjRows();
}
// 全局信号类型：number(数值) / bool(布尔) / enum(枚举) / text(文本)。老数据无 type 时按样例值推断。
function sigTypeOf(s){ if(s&&s.type)return s.type; if(typeof (s&&s.sample)==='boolean')return 'bool'; if(typeof (s&&s.sample)==='number')return 'number'; return 'text'; }
function sigTypeLabel(t){ return ({number:(lang==='en'?'NUM':'数值'),bool:(lang==='en'?'BOOL':'布尔'),enum:(lang==='en'?'ENUM':'枚举'),text:(lang==='en'?'TEXT':'文本')})[t]||t; }
function renderCustomSignals(){
  const wrap=document.getElementById('sim-custom');if(!wrap)return;
  wrap.innerHTML='';
  if(!customSignals.length){const e=document.createElement('div');e.className='sim-empty';e.textContent=(lang==='en'?'No global signals yet (e.g. mode, islanding). Add one below — any rule can then reference it.':'暂无全局信号（如 mode、islanding）。在下方添加后，任意元素/连线的规则均可引用。');wrap.appendChild(e);return;}
  customSignals.forEach((s,idx)=>{
    const row=document.createElement('div');row.className='sim-crow';
    const nm=document.createElement('span');nm.className='sim-cname';
    const tb=document.createElement('span');tb.className='sim-ctype';tb.textContent=sigTypeLabel(sigTypeOf(s));
    const nt=document.createElement('span');nt.textContent=s.name;nt.title=s.name+' · '+sigTypeLabel(sigTypeOf(s));nt.style.cssText='overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    nm.appendChild(tb);nm.appendChild(nt);
    const vctrl=makeGlobalValueInput(s);
    const del=document.createElement('button');del.type='button';del.className='rm-del';del.textContent='×';del.title='删除信号';del.onclick=()=>{customSignals.splice(idx,1);renderSimPanel();_pathCacheSig='';};
    row.appendChild(nm);row.appendChild(vctrl);row.appendChild(del);wrap.appendChild(row);
  });
}
// 全局信号「当前值」控件：按类型给布尔/枚举下拉或数值/文本输入；该值即参与规则实时求值
function makeGlobalValueInput(s){
  const t=sigTypeOf(s);
  if(t==='bool'){
    const sel=document.createElement('select');sel.className='sim-val';sel.style.width='78px';
    [['','—'],['true','true'],['false','false']].forEach(([v,tx])=>{const o=document.createElement('option');o.value=v;o.textContent=tx;sel.appendChild(o);});
    sel.value=(s.sample===true?'true':(s.sample===false?'false':''));
    sel.onchange=e=>{s.sample=(e.target.value===''?'':(e.target.value==='true'));};
    return sel;
  }
  if(t==='enum'){
    const sel=document.createElement('select');sel.className='sim-val';sel.style.width='96px';
    const ph=document.createElement('option');ph.value='';ph.textContent='—';sel.appendChild(ph);
    (s.options||[]).forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o);});
    if(s.sample!=null&&s.sample!==''&&!(s.options||[]).map(String).includes(String(s.sample))){const o=document.createElement('option');o.value=String(s.sample);o.textContent=String(s.sample);sel.appendChild(o);}
    sel.value=(s.sample!=null?String(s.sample):'');
    sel.onchange=e=>{s.sample=e.target.value;};
    return sel;
  }
  const inp=document.createElement('input');inp.className='sim-val';inp.value=(s.sample!=null?s.sample:'');inp.placeholder=(t==='number'?(lang==='en'?'number':'数值'):(lang==='en'?'value':'值'));
  if(t==='number')inp.type='number';
  inp.oninput=e=>{const v=e.target.value;s.sample=(v===''?'':(t==='number'?autoNum(v):v));};
  return inp;
}
// 新建全局信号：切换类型时，枚举显示「可选值」输入，并调整当前值占位
function onNewSigType(){
  const t=(document.getElementById('sim-newtype')||{}).value;
  const opts=document.getElementById('sim-newopts');if(opts)opts.style.display=(t==='enum')?'block':'none';
  const val=document.getElementById('sim-newval');if(val)val.placeholder=(t==='bool'?'true/false':(t==='number'?(lang==='en'?'current value (number)':'当前值(数值)'):(lang==='en'?'current value':'当前值')));
}
function addCustomSignal(){
  const nmEl=document.getElementById('sim-newname');const nm=(nmEl.value||'').trim();if(!nm)return;
  if(customSignals.some(s=>s.name===nm)){alert(lang==='en'?'A global signal with this name already exists.':'已存在同名全局信号。');return;}
  const type=(document.getElementById('sim-newtype')||{}).value||'number';
  const rawVal=((document.getElementById('sim-newval')||{}).value||'').trim();
  const sig={name:nm,label:nm,type:type};
  if(type==='enum'){
    const opts=((document.getElementById('sim-newopts')||{}).value||'').split(/[,，]/).map(x=>x.trim()).filter(Boolean);
    sig.options=opts;
    sig.sample=(rawVal!==''&&(!opts.length||opts.includes(rawVal)))?rawVal:(opts.length?opts[0]:'');
  } else if(type==='bool'){
    sig.sample=(rawVal==='')?true:(rawVal==='true'||rawVal==='1'||rawVal==='是');
  } else if(type==='number'){
    sig.sample=(rawVal==='')?0:autoNum(rawVal);
  } else {
    sig.sample=rawVal;
  }
  customSignals.push(sig);
  nmEl.value='';const v=document.getElementById('sim-newval');if(v)v.value='';const o=document.getElementById('sim-newopts');if(o)o.value='';
  renderSimPanel();_pathCacheSig='';
}
function pasteSimJSON(){
  const ta=document.getElementById('sim-json');const txt=ta.value.trim();if(!txt)return;
  let obj;try{obj=JSON.parse(txt);}catch(err){alert(lang==='en'?('Invalid JSON: '+err.message):('JSON 解析失败：'+err.message));return;}
  if(obj&&typeof obj==='object')Object.keys(obj).forEach(k=>{
    const existing=injRows.find(r=>injSignalName(r)===k);
    if(existing)existing.val=obj[k];
    else{const ps=parseSignal(k);injRows.push({node:ps.node,field:ps.field,val:obj[k]});}
  });
  syncInjections();renderSimPanel();autoGrowSimJSON();flashHint(lang==='en'?'Sample data applied':'已应用样例数据');
}
function clearSim(){injRows=[];signalValues={};_injInited=false;injDraft=null;const ta=document.getElementById('sim-json');if(ta)ta.value='';autoGrowSimJSON();renderSimPanel();}
// 注入信号手风琴：全部展开 / 全部折叠（仅作用于已选元素的分组，待指定行不折叠）
function injExpandAll(){ injCollapsed.clear(); renderInjRows(); }
function injCollapseAll(){ const ks=new Set(); injRows.forEach(r=>{ if(r.node)ks.add(r.node); }); injCollapsed=ks; renderInjRows(); }

// ───── 极简 ZIP 打包器（store 模式，无需外部库）─────
function crc32(buf){
  let c, crc=0xFFFFFFFF;
  if(!crc32.table){crc32.table=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crc32.table[n]=c;}}
  for(let i=0;i<buf.length;i++)crc=crc32.table[(crc^buf[i])&0xFF]^(crc>>>8);
  return (crc^0xFFFFFFFF)>>>0;
}
function strToBytes(s){return new TextEncoder().encode(s);}
function makeZip(files){
  // files: [{name, data(Uint8Array)}]
  const enc=[];const central=[];let offset=0;
  const u16=v=>[v&0xFF,(v>>8)&0xFF];
  const u32=v=>[v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>24)&0xFF];
  files.forEach(f=>{
    const nameB=strToBytes(f.name), data=f.data, crc=crc32(data);
    const local=[].concat(u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nameB.length),u16(0));
    enc.push(new Uint8Array(local), nameB, data);
    const cen=[].concat(u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nameB.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset));
    central.push(new Uint8Array(cen), nameB);
    offset+=local.length+nameB.length+data.length;
  });
  let cenSize=0;central.forEach(c=>cenSize+=c.length);
  const end=new Uint8Array([].concat(u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cenSize),u32(offset),u16(0)));
  const parts=[...enc,...central,end];
  let total=0;parts.forEach(p=>total+=p.length);
  const out=new Uint8Array(total);let pos=0;parts.forEach(p=>{out.set(p,pos);pos+=p.length;});
  return out;
}
function dataURLtoBytes(dataURL){
  const b64=dataURL.split(',')[1];
  const bin=atob(b64);const arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  return arr;
}
// 导出图标 ZIP 包：所有用到的图标文件 + iconMap.json + README
function dlIconsZip(){
  const usedTypes=usedTypeList();
  const files=[];const iconMap={};
  usedTypes.forEach(t=>{
    const src=iconSrcOf(t);if(!src)return;
    const fn=iconFileName(t);
    iconMap[t]=fn;
    files.push({name:'icons/'+fn, data:dataURLtoBytes(src)});
  });
  if(files.length===0){alert('当前画布无可导出的图标');return;}
  // 映射表
  iconMap_meta={ note:'type → 图标文件名。前端：iconUrl = baseDir + iconMap[node.type]', generatedAt:new Date().toISOString() };
  const mapObj={meta:iconMap_meta, iconMap};
  files.push({name:'iconMap.json', data:strToBytes(JSON.stringify(mapObj,null,2))});
  // README
  const readme=
'储能拓扑图标包\n================\n\n'+
'目录结构：\n'+
'  icons/         各设备图标文件（.png 实拍图 / .svg 线框图标）\n'+
'  iconMap.json   type → 文件名 的映射表\n\n'+
'前端用法：\n'+
'  1) 将 icons/ 目录部署到你的静态资源目录，例如 /assets/topo-icons/\n'+
'  2) 读取拓扑 topology.json，遍历 nodes：\n'+
'       const fname = node.icon;            // 如 "pcs.png"\n'+
'       const url   = "/assets/topo-icons/" + fname;\n'+
'       // 在 (node.x, node.y) 处按 meta.iconSizeByType[node.type] 绘制\n'+
'  3) 文字：中文 node.label.zh / 英文 node.label.en；状态 node.status.zh / .en\n'+
'  4) 连线样式见 topology.json 的 edgeStyles\n';
  files.push({name:'README.txt', data:strToBytes(readme)});
  const zip=makeZip(files);
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([zip],{type:'application/zip'}));
  a.download='topo-icons.zip';a.click();
}
let iconMap_meta=null;

// ───── 收集左侧元素库的全部元素（所有分组 + 自定义图标）─────
function allLibraryEntries(){
  const out=[];
  DEVICE_GROUPS.forEach(g=>g.devices.forEach(d=>{
    out.push({type:d.type, labelZh:d.label||d.type, labelEn:d.label_en||d.type,
              group:g.title||'', groupEn:g.title_en||g.title||'', tab:g.tab||'device'});
  }));
  (customIcons||[]).forEach(ci=>out.push({type:ci.type, labelZh:ci.zh||ci.type, labelEn:ci.en||ci.type,
              group:'自定义', groupEn:'Custom', tab:'custom'}));
  return out;
}
// 导出「全部」左侧元素图标（不限于当前画布）——产出前端可直接使用的图标包：
// 真实图标文件 + 路径映射(JSON) + 开箱即用 ES 模块(icons.js) + 可视化预览(preview.html)
// ★ 运行端数据驱动库（随元素库包导出）：与编辑器预览同一套求值逻辑，保证线上=预览
const RUNTIME_JS=`// 储能拓扑 · 数据驱动运行端（与编辑器「数据预览」同一套逻辑）
// 用法：
//   import { resolveDynamic } from './runtime.js';
//   const state = resolveDynamic(topology, signals);
//   state.nodes: [{...node, visible}]        // visible=false → 不渲染该元素
//   state.edges: [{...edge, visible, dir}]    // visible=false → 不渲染（含"条件不满足时无连线"）；dir=动态流向
// signals：扁平对象，如 { "bms_1.SOC(%)": 20, "grid_1.online": true, "mode": "island" }
//   未提供的信号回退到画布静态值（节点字段 value / 支持状态节点的状态与在线=true / topology.signals 样例）。
function _num(x){if(typeof x==='number')return x;if(typeof x==='boolean')return x?1:0;var f=parseFloat(x);return isNaN(f)?NaN:f;}
function _looseEq(a,b){if(a===b)return true;var na=_num(a),nb=_num(b);if(!isNaN(na)&&!isNaN(nb))return na===nb;return String(a)===String(b);}
function _toList(rv){if(Array.isArray(rv))return rv;return String(rv==null?'':rv).split(',').map(function(s){return s.trim();}).filter(function(s){return s!=='';});}
function cmpOp(lv,op,rv){
  switch(op){
    case '==': return _looseEq(lv,rv);
    case '!=': return !_looseEq(lv,rv);
    case '>':  return _num(lv)>_num(rv);
    case '>=': return _num(lv)>=_num(rv);
    case '<':  return _num(lv)<_num(rv);
    case '<=': return _num(lv)<=_num(rv);
    case 'truthy': return !!lv && lv!=='false' && lv!=='0';
    case 'falsy':  return !lv || lv==='false' || lv==='0';
    case 'exists': return lv!==undefined && lv!==null && lv!=='';
    case 'in':     return _toList(rv).some(function(x){return _looseEq(lv,x);});
    case 'between':{var a=_toList(rv).map(_num);if(a.length<2)return false;return _num(lv)>=Math.min(a[0],a[1])&&_num(lv)<=Math.max(a[0],a[1]);}
    default: return true;
  }
}
export function evalCond(cond, ctx){
  if(cond==null)return true;
  if(typeof cond!=='object')return !!cond;
  if(Array.isArray(cond.all))return cond.all.every(function(c){return evalCond(c,ctx);});
  if(Array.isArray(cond.any))return cond.any.some(function(c){return evalCond(c,ctx);});
  if(cond.not!=null)return !evalCond(cond.not,ctx);
  if(cond.var==null)return true;
  var lv=ctx[cond.var];
  var rv=(cond.ref!=null)?ctx[cond.ref]:cond.val;
  return cmpOp(lv,cond.op||'truthy',rv);
}
function nodeSupportsStateSignals(n){return !!(n&&n.type!=='text');}
export function buildContext(topology, signals){
  var ctx={};
  (topology.nodes||[]).forEach(function(n){
    (n.data||[]).forEach(function(f){
      var key=(f.key&&typeof f.key==='object')?f.key.zh:f.key;
      if(key!=null)ctx[n.id+'.'+key]=(f.value==='--'?'':f.value);
    });
    if(nodeSupportsStateSignals(n)){
      ctx[n.id+'.status']=(n.status&&typeof n.status==='object')?n.status.zh:(n.status||'');
      ctx[n.id+'.online']=true;
    }
  });
  (topology.signals||[]).forEach(function(s){if(s&&s.name!=null&&s.sample!==undefined)ctx[s.name]=s.sample;});
  if(topology.sampleSignals)Object.keys(topology.sampleSignals).forEach(function(k){ctx[k]=topology.sampleSignals[k];});
  if(signals)Object.keys(signals).forEach(function(k){ctx[k]=signals[k];});
  return ctx;
}
export function resolveDynamic(topology, signals){
  var ctx=buildContext(topology, signals);
  var hidden={};
  (topology.nodes||[]).forEach(function(n){if(n.visibleWhen!=null&&!evalCond(n.visibleWhen,ctx))hidden[n.id]=true;});
  var nodes=(topology.nodes||[]).map(function(n){var o={},k;for(k in n)o[k]=n[k];o.visible=!hidden[n.id];return o;});
  var edges=(topology.edges||[]).map(function(e){
    var visible=!(hidden[e.from]||hidden[e.to]);
    if(visible&&e.showWhen!=null)visible=evalCond(e.showWhen,ctx);
    var dir=e.dir||'forward',i;
    if(Array.isArray(e.dirRules)){for(i=0;i<e.dirRules.length;i++){if(evalCond(e.dirRules[i].when,ctx)){dir=e.dirRules[i].dir;break;}}}
    var o={},k;for(k in e)o[k]=e[k];o.visible=visible;o.dir=dir;return o;
  });
  return {ctx:ctx, nodes:nodes, edges:edges};
}
export default resolveDynamic;
`;
function dlAllIconsZip(){
  const entries=allLibraryEntries();
  const files=[]; const seen=new Set();
  const paths={};     // type -> "icons/xxx.png"
  const meta={};      // type -> {file,labelZh,labelEn,group,groupEn,tab,sizeWorld}
  const dataMap={};   // type -> dataURI（内联，零请求）
  entries.forEach(e=>{
    if(seen.has(e.type))return; seen.add(e.type);
    const src=iconSrcOf(e.type); if(!src)return;          // 无图标(如纯文本)跳过
    const path='icons/'+e.type+'.'+iconExt(src);
    files.push({name:path, data:dataURLtoBytes(src)});
    paths[e.type]=path;
    dataMap[e.type]=src;
    meta[e.type]={file:path,labelZh:e.labelZh,labelEn:e.labelEn,group:e.group,groupEn:e.groupEn,tab:e.tab,sizeWorld:Math.round(nsz(e.type))};
  });
  const n=Object.keys(paths).length;
  if(n===0){alert('没有可导出的图标');return;}

  // 1) icon-map.json —— 规范映射（扁平 paths + 富信息 icons）
  files.push({name:'icon-map.json', data:strToBytes(JSON.stringify({
    meta:{note:'type→图标路径。前端：iconUrl = baseDir + paths[type]', total:n, generatedAt:new Date().toISOString()},
    paths, icons:meta
  },null,2))});

  // 2) icons.js —— 开箱即用的 ES 模块（路径 / 元信息 / 内联 dataURI 任选其一）
  const js=
'// 自动生成 · 储能拓扑全部元素图标（前端直接 import 使用）\n'+
'// 用法A(静态资源)：<img src={ICON_BASE + ICON_PATHS[type]} />\n'+
'// 用法B(零请求/内联)：<img src={ICON_DATA[type]} />\n'+
'export const ICON_BASE  = "/assets/topo-icons/"; // 改成你的部署目录\n'+
'export const ICON_PATHS = '+JSON.stringify(paths,null,2)+';\n'+
'export const ICON_META  = '+JSON.stringify(meta,null,2)+';\n'+
'export const ICON_DATA  = '+JSON.stringify(dataMap,null,2)+';\n'+
'export default ICON_PATHS;\n';
  files.push({name:'icons.js', data:strToBytes(js)});

  // 2.5) element-library.json —— 后台维护的「元素库 + 字典」单一事实来源（前端加载一次）
  files.push({name:'element-library.json', data:strToBytes(JSON.stringify(buildLibraryObj(),null,2))});

  // 2.6) runtime.js —— 数据驱动运行端（与编辑器预览同一套逻辑：动态显隐/流向/条件连线）
  files.push({name:'runtime.js', data:strToBytes(RUNTIME_JS)});

  // 3) preview.html —— 双击在浏览器打开即可看到全部图标
  let cards='';
  Object.keys(meta).forEach(t=>{const m=meta[t];
    cards+='<figure><img src="'+m.file+'" alt="'+t+'"><figcaption><b>'+t+'</b><span>'+m.labelZh+' · '+m.labelEn+'</span><em>'+m.group+'</em></figcaption></figure>';});
  const preview=
'<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>图标预览</title>'+
'<style>body{margin:0;background:#0d1a2e;color:#d8e4f0;font-family:-apple-system,"Microsoft YaHei",sans-serif;padding:24px}'+
'h1{font-size:18px;color:#4dd0ff;margin:0 0 16px}'+
'.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}'+
'figure{margin:0;background:#0a1628;border:1px solid #1a3a5c;border-radius:10px;padding:14px;text-align:center}'+
'figure img{width:64px;height:64px;object-fit:contain;display:block;margin:0 auto 10px;background:#08111f;border-radius:6px;padding:6px}'+
'figcaption b{display:block;font-size:13px;color:#4dd0ff;word-break:break-all}figcaption span{display:block;font-size:11px;color:#8aa8c4;margin:2px 0}figcaption em{font-size:10px;color:#5a7a98;font-style:normal}'+
'</style></head><body><h1>⚡ 储能拓扑 · 全部元素图标（'+n+'）</h1><div class="grid">'+cards+'</div></body></html>';
  files.push({name:'preview.html', data:strToBytes(preview)});

  // 4) README
  const readme=
'储能拓扑 · 元素库包\n==================\n\n'+
'架构：前端与后台共享同一套元素库；后台维护本包并提供给前端。\n'+
'前端加载本包(元素库+字典+图标)一次；之后每张「画布 JSON」只引用库版本(meta.libraryRef)，\n'+
'按 node.type 到库里取图标/默认字段/默认尺寸，再叠加画布 JSON 的实例信息即可还原渲染。\n\n'+
'目录：\n'+
'  element-library.json  ★元素库+字典(单一事实来源)：version / tabs / groups(每type: icon, defaultData, defaultSizeWorld) / edgeTypes / statusDict / dataLabelDict\n'+
'  runtime.js            ★数据驱动运行端：resolveDynamic(topology, signals) → 按规则算出每个节点/连线的 visible 与连线 dir（与编辑器预览同逻辑）\n'+
'  icons/                每个元素的图标文件（.png 实拍 / .svg 线框）\n'+
'  icon-map.json         type → 图标路径 映射（轻量）\n'+
'  icons.js              开箱即用 ES 模块：ICON_PATHS / ICON_META / ICON_DATA(内联 dataURI)\n'+
'  preview.html          双击在浏览器打开，预览全部图标\n\n'+
'当前库版本：'+LIBRARY_NAME+' @ '+LIBRARY_VERSION+'\n\n'+
'前端渲染流程：\n'+
'  1) 启动时加载 element-library.json（含全部 type 的图标文件名/默认值/分组/连线样式/字典）\n'+
'  2) 加载某张画布 topology.json，校验 meta.libraryRef.version 与本库一致\n'+
'  3) 遍历 nodes：icon = ICON_BASE + (库中该 type 的 icon)；位置用 node.position、尺寸用 node.sizeWorld；\n'+
'     名称/字段显隐用 node.display；文本/占位点分别读 node.textStyle / node.anchorStyle\n'+
'  4) 遍历 edges：样式查 library.edgeTypes[edge.edgeType]，按 route / waypoints 走线\n\n'+
'图标用法（任选）：\n'+
'  A) 静态资源：icons/ 部署到 /assets/topo-icons/，url = ICON_BASE + ICON_PATHS[type]\n'+
'  B) 内联零请求：ICON_DATA[type]（已是 dataURI）\n\n'+
'数据驱动（动态显隐 / 流向 / 条件连线）：\n'+
'  画布 JSON 中：node.visibleWhen（显示条件）、edge.showWhen（显示/存在条件）、edge.dirRules（流向规则，顺序匹配 e.dir 兜底）、顶层 signals（自定义全局信号）。\n'+
'  条件结构：叶子 {var,op,val|ref}；组合 {all:[...]}/{any:[...]}/{not:{...}}；op ∈ == != > >= < <= in between truthy falsy exists。\n'+
'  信号寻址：节点字段=“节点id.字段名(中文)”，支持状态的节点另有“节点id.status”“节点id.online”，以及 signals 里的全局信号。\n'+
'  运行端用法：\n'+
'    import { resolveDynamic } from "./runtime.js";\n'+
'    const state = resolveDynamic(topology, liveSignals);   // liveSignals 形如 {"bms_1.SOC(%)":18,"grid_1.online":false}\n'+
'    state.nodes/state.edges 上的 visible 决定是否渲染，edge.dir 为动态流向。\n\n'+
'前端接入（两种方式，按需选）：\n'+
'  方式A（推荐·零重写·像素级一致）：直接把本编辑器 HTML 以「只读运行模式」托管/内嵌，复用同一份渲染器+规则，\n'+
'    流向动画/智能走线/母线汇流/字段卡片都与运营端完全一致，无需自己实现渲染。\n'+
'    • URL 方式： 编辑器.html?mode=runtime&topology=<画布JSON地址>&signals=<实时数据地址>&interval=2000\n'+
'        其它参数：fit=0 关闭自动适配；interactive=1 允许平移缩放（默认只读不可交互）。\n'+
'    • iframe 内嵌：父页面 postMessage 推送：\n'+
'        iframe.contentWindow.postMessage({type:"topo:topology",data:画布JSON对象},"*");\n'+
'        iframe.contentWindow.postMessage({type:"topo:signals",data:{"grid_1.P(kW)":-2,"grid_1.online":true}},"*");  // 整批覆盖\n'+
'        iframe.contentWindow.postMessage({type:"topo:merge",data:{"bms_1.SOC(%)":55}},"*");                         // 增量合并\n'+
'        iframe 就绪后会向父页面 postMessage({type:"topo:ready"})，收到后再推数据更稳妥。\n'+
'    • JS API（同源/直接托管时）：window.TopoRuntime.loadTopology(对象或URL) / setSignals(obj) / mergeSignals(obj) / fit()\n'+
'    实时数据键名 = 规则里的信号名：节点字段「节点id.字段名」、支持状态节点的「节点id.status / 节点id.online」、全局信号名；\n'+
'    同一份实时数据既驱动规则(显隐/流向)，也用于字段卡片数值显示（注意编辑器约定：字段值为 0 显示为 --）。\n'+
'  方式B（自研渲染器）：用 runtime.js 的 resolveDynamic 仅取 visible/dir，再按上面「前端渲染流程」自行绘制\n'+
'    （注意 route="smart" 的智能走线路径未存入 JSON，自研渲染需自行实现走线，否则线形可能与运营端不一致）。\n';
  files.push({name:'README.md', data:strToBytes(readme)});

  const zip=makeZip(files);
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([zip],{type:'application/zip'}));
  a.download='topo-element-library.zip';a.click();
}

// ══════════════════════════════════════════════
// 示例模板库（4 种典型储能拓扑）
// ══════════════════════════════════════════════
function mkData(pairs){return pairs.map(([k,e,v])=>({key:k,keyEn:e,dv:(v==null?'':v)}));}
const TEMPLATES={
  t1:{
    name:'发散式拓扑', nameEn:'Radial Layout', desc:'PCS 居中，光伏/电网/电池/负载/发电机十字分布',
    build(){
      const W=900,H=600;
      const nodes=[
        {id:'pcs_1',type:'pcs',labelZh:'PCS变流器',labelEn:'PCS',x:W*.5,y:H*.5,status:'运行',fontSize:14,fontColor:'#2ecc71',data:mkData([['P(kW)','P(kW)'],['I(A)','I(A)'],['U(V)','U(V)']])},
        {id:'solar_1',type:'solar',labelZh:'光伏',labelEn:'PV',x:W*.28,y:H*.22,status:'发电',fontSize:14,fontColor:'#f9ca24',data:mkData([['P(kW)','P(kW)'],['Vpv(V)','Vpv(V)']])},
        {id:'bms_1',type:'bms',labelZh:'电池BMS',labelEn:'Battery BMS',x:W*.72,y:H*.22,status:'充电',fontSize:14,fontColor:'#3aa0ff',data:mkData([['SOC(%)','SOC(%)',60],['温度(℃)','Temp(℃)',26]])},
        {id:'grid_1',type:'grid',labelZh:'市电',labelEn:'Grid',x:W*.28,y:H*.78,status:'在线',fontSize:14,fontColor:'#e8f4ff',data:mkData([['P(kW)','P(kW)'],['今日用电(kWh)','Today(kWh)']])},
        {id:'load_1',type:'load',labelZh:'用户负载',labelEn:'Load',x:W*.72,y:H*.78,status:'在线',fontSize:14,fontColor:'#e8f4ff',data:mkData([['负载功率(kW)','Load(kW)']])},
        {id:'gen_1',type:'generator',labelZh:'发电机',labelEn:'Generator',x:W*.5,y:H*.86,status:'备用',fontSize:14,fontColor:'#e8f4ff',data:mkData([['P(kW)','P(kW)']])},
      ];
      const edges=[
        {from:'solar_1',to:'pcs_1',et:'pv_power',route:'straight',dir:'forward',lbl:''},
        {from:'pcs_1',to:'bms_1',et:'charge',route:'straight',dir:'both',lbl:''},
        {from:'grid_1',to:'pcs_1',et:'ac_power',route:'straight',dir:'forward',lbl:''},
        {from:'pcs_1',to:'load_1',et:'discharge',route:'straight',dir:'forward',lbl:''},
        {from:'gen_1',to:'pcs_1',et:'ac_power',route:'straight',dir:'forward',lbl:''},
      ];
      return {nodes,edges};
    }
  },
  t2:{
    name:'三角拓扑', nameEn:'Triangle Layout', desc:'电网/电池/负载三角连接，储能居中调度',
    build(){
      const W=1000,H=620;
      const nodes=[
        {id:'bms_1',type:'bms',labelZh:'储能电池',labelEn:'Battery',x:W*.62,y:H*.20,status:'并网运行',fontSize:14,fontColor:'#3aa0ff',data:mkData([['SOC(%)','SOC(%)',55],['温度(℃)','Temp(℃)',27],['电压(V)','U(V)',785],['电流(A)','I(A)',266],['今日充电(kWh)','Charge(kWh)',620],['今日放电(kWh)','Discharge(kWh)',310]])},
        {id:'grid_1',type:'grid',labelZh:'市电',labelEn:'Grid',x:W*.18,y:H*.74,status:'在线',fontSize:14,fontColor:'#e8f4ff',data:mkData([['实时功率(kW)','P(kW)',383],['今日用电(kWh)','Today(kWh)',2299]])},
        {id:'load_1',type:'load',labelZh:'用户负载',labelEn:'Load',x:W*.78,y:H*.74,status:'在线',fontSize:14,fontColor:'#e8f4ff',data:mkData([['实时功率(kW)','P(kW)',174],['今日用电(kWh)','Today(kWh)',2001]])},
      ];
      const edges=[
        {from:'grid_1',to:'bms_1',et:'pipe_blue',route:'straight',dir:'both',lbl:''},
        {from:'grid_1',to:'load_1',et:'pipe_blue',route:'straight',dir:'forward',lbl:''},
        {from:'bms_1',to:'load_1',et:'pipe_blue',route:'straight',dir:'forward',lbl:''},
      ];
      return {nodes,edges};
    }
  },
  t2b_busbar:{
    name:'母线汇流式', nameEn:'Busbar Collector', desc:'主电网 + 关口/并网表，母线下挂多个电池柜',
    build(){
      const W=1100,H=640;
      const nodes=[
        {id:'grid_1',type:'grid',labelZh:'主电网',labelEn:'Grid',x:W*.5,y:H*.08,status:'在线',fontSize:14,fontColor:'#e8f4ff',data:mkData([['P(kW)','P(kW)']])},
        {id:'meter_1',type:'meter2',labelZh:'关口表',labelEn:'Gateway Meter',x:W*.16,y:H*.30,status:'在线',fontSize:14,fontColor:'#e8f4ff',data:mkData([['P(kW)','P(kW)',200]])},
        {id:'meter_2',type:'meter2',labelZh:'并网表',labelEn:'Grid-tie Meter',x:W*.16,y:H*.46,status:'在线',fontSize:14,fontColor:'#e8f4ff',data:mkData([['P(kW)','P(kW)']])},
        {id:'load_1',type:'load',labelZh:'用户负载',labelEn:'Load',x:W*.66,y:H*.34,status:'在线',fontSize:14,fontColor:'#e8f4ff',data:mkData([['负载功率(kW)','Load(kW)']])},
        {id:'bus_1',type:'busbar',labelZh:'交流母线',labelEn:'AC Busbar',x:W*.5,y:H*.52,status:'在线',fontSize:14,fontColor:'#4dd0ff',data:mkData([['母线电压(V)','Bus V(V)',782]])},
        {id:'c1',type:'cabinet',labelZh:'1#柜',labelEn:'Rack 1',x:W*.2,y:H*.82,status:'并网运行',fontSize:14,fontColor:'#3aa0ff',data:mkData([['平均温度(℃)','Temp(℃)',25],['SOC(%)','SOC(%)',53]])},
        {id:'c2',type:'cabinet',labelZh:'2#柜',labelEn:'Rack 2',x:W*.4,y:H*.82,status:'并网运行',fontSize:14,fontColor:'#3aa0ff',data:mkData([['平均温度(℃)','Temp(℃)',26],['SOC(%)','SOC(%)',53]])},
        {id:'c3',type:'cabinet',labelZh:'3#柜',labelEn:'Rack 3',x:W*.6,y:H*.82,status:'并网运行',fontSize:14,fontColor:'#3aa0ff',data:mkData([['平均温度(℃)','Temp(℃)',26],['SOC(%)','SOC(%)',53]])},
        {id:'c4',type:'cabinet',labelZh:'4#柜',labelEn:'Rack 4',x:W*.8,y:H*.82,status:'并网运行',fontSize:14,fontColor:'#3aa0ff',data:mkData([['平均温度(℃)','Temp(℃)',26],['SOC(%)','SOC(%)',53]])},
      ];
      const edges=[
        {from:'grid_1',to:'bus_1',et:'ac_power',route:'ortho',dir:'forward',lbl:''},
        {from:'meter_1',to:'bus_1',et:'ac_power',route:'ortho',dir:'forward',lbl:''},
        {from:'meter_2',to:'bus_1',et:'ac_power',route:'ortho',dir:'forward',lbl:''},
        {from:'bus_1',to:'load_1',et:'discharge',route:'ortho',dir:'forward',lbl:''},
        {from:'bus_1',to:'c1',et:'charge',route:'ortho',dir:'both',lbl:''},
        {from:'bus_1',to:'c2',et:'charge',route:'ortho',dir:'both',lbl:''},
        {from:'bus_1',to:'c3',et:'charge',route:'ortho',dir:'both',lbl:''},
        {from:'bus_1',to:'c4',et:'charge',route:'ortho',dir:'both',lbl:''},
      ];
      return {nodes,edges};
    }
  },
  t3:{
    name:'环形回路', nameEn:'Ring Circuit', desc:'电网→高压箱→PCS→电池双路环线',
    build(){
      const W=760,H=640;
      const nodes=[
        {id:'grid_1',type:'grid',labelZh:'主电网',labelEn:'Grid',x:W*.5,y:H*.10,status:'在线',fontSize:14,fontColor:'#e8f4ff',data:mkData([['P(kW)','P(kW)']])},
        {id:'pcs_1',type:'pcs',labelZh:'变流器',labelEn:'PCS',x:W*.5,y:H*.34,status:'运行',fontSize:14,fontColor:'#2ecc71',data:mkData([['P(kW)','P(kW)'],['U(V)','U(V)']])},
        {id:'hv_1',type:'highvolt',labelZh:'高压箱',labelEn:'HV Box',x:W*.5,y:H*.56,status:'在线',fontSize:14,fontColor:'#ff7a6a',data:mkData([['直流电压(V)','DC V(V)']])},
        {id:'bms_1',type:'bms',labelZh:'电池',labelEn:'Battery',x:W*.5,y:H*.84,status:'充电',fontSize:14,fontColor:'#3aa0ff',data:mkData([['SOC(%)','SOC(%)',55],['温度(℃)','Temp(℃)',26]])},
      ];
      const edges=[
        {from:'grid_1',to:'pcs_1',et:'pipe_blue',route:'ortho',dir:'forward',lbl:''},
        {from:'pcs_1',to:'hv_1',et:'pipe_blue',route:'ortho',dir:'forward',lbl:''},
        {from:'hv_1',to:'bms_1',et:'pipe_gold',route:'ortho',dir:'both',lbl:''},
      ];
      return {nodes,edges};
    }
  },
  t4:{
    name:'多级母线树状', nameEn:'Multi-level Tree', desc:'市电/发电机/负载→多组PCS→光伏+电池',
    build(){
      const W=1200,H=720;
      const nodes=[
        {id:'grid_1',type:'grid',labelZh:'市电',labelEn:'Grid',x:W*.25,y:H*.10,status:'在线',fontSize:14,fontColor:'#e8f4ff',data:mkData([['P(kW)','P(kW)']])},
        {id:'gen_1',type:'generator',labelZh:'发电机',labelEn:'Generator',x:W*.5,y:H*.10,status:'备用',fontSize:14,fontColor:'#e8f4ff',data:mkData([['P(kW)','P(kW)']])},
        {id:'load_1',type:'load',labelZh:'用户负载',labelEn:'Load',x:W*.75,y:H*.10,status:'在线',fontSize:14,fontColor:'#e8f4ff',data:mkData([['负载功率(kW)','Load(kW)']])},
        {id:'bus_1',type:'busbar',labelZh:'主母线',labelEn:'Main Bus',x:W*.5,y:H*.36,status:'在线',fontSize:14,fontColor:'#4dd0ff',data:mkData([['母线电压(V)','Bus V(V)']])},
        {id:'pcs_1',type:'pcs',labelZh:'PCS-1',labelEn:'PCS-1',x:W*.2,y:H*.58,status:'运行',fontSize:13,fontColor:'#2ecc71',data:mkData([['SOC(%)','SOC(%)']])},
        {id:'pcs_2',type:'pcs',labelZh:'PCS-2',labelEn:'PCS-2',x:W*.4,y:H*.58,status:'运行',fontSize:13,fontColor:'#2ecc71',data:mkData([['SOC(%)','SOC(%)']])},
        {id:'pcs_3',type:'pcs',labelZh:'PCS-3',labelEn:'PCS-3',x:W*.6,y:H*.58,status:'运行',fontSize:13,fontColor:'#2ecc71',data:mkData([['SOC(%)','SOC(%)']])},
        {id:'pcs_4',type:'pcs',labelZh:'PCS-4',labelEn:'PCS-4',x:W*.8,y:H*.58,status:'运行',fontSize:13,fontColor:'#2ecc71',data:mkData([['SOC(%)','SOC(%)']])},
        {id:'pv_1',type:'solar',labelZh:'光伏1',labelEn:'PV-1',x:W*.12,y:H*.86,status:'发电',fontSize:13,fontColor:'#f9ca24',data:mkData([['P(kW)','P(kW)']])},
        {id:'b_1',type:'bms',labelZh:'电池1',labelEn:'Bat-1',x:W*.28,y:H*.86,status:'充电',fontSize:13,fontColor:'#3aa0ff',data:mkData([['SOC(%)','SOC(%)']])},
        {id:'pv_2',type:'solar',labelZh:'光伏2',labelEn:'PV-2',x:W*.52,y:H*.86,status:'发电',fontSize:13,fontColor:'#f9ca24',data:mkData([['P(kW)','P(kW)']])},
        {id:'b_2',type:'bms',labelZh:'电池2',labelEn:'Bat-2',x:W*.68,y:H*.86,status:'充电',fontSize:13,fontColor:'#3aa0ff',data:mkData([['SOC(%)','SOC(%)']])},
      ];
      const edges=[
        {from:'grid_1',to:'bus_1',et:'ac_power',route:'ortho',dir:'forward',lbl:''},
        {from:'gen_1',to:'bus_1',et:'ac_power',route:'ortho',dir:'forward',lbl:''},
        {from:'bus_1',to:'load_1',et:'discharge',route:'ortho',dir:'forward',lbl:''},
        {from:'bus_1',to:'pcs_1',et:'pipe_blue',route:'ortho',dir:'both',lbl:''},
        {from:'bus_1',to:'pcs_2',et:'pipe_blue',route:'ortho',dir:'both',lbl:''},
        {from:'bus_1',to:'pcs_3',et:'pipe_blue',route:'ortho',dir:'both',lbl:''},
        {from:'bus_1',to:'pcs_4',et:'pipe_blue',route:'ortho',dir:'both',lbl:''},
        {from:'pcs_1',to:'pv_1',et:'pv_power',route:'ortho',dir:'forward',lbl:''},
        {from:'pcs_1',to:'b_1',et:'charge',route:'ortho',dir:'both',lbl:''},
        {from:'pcs_3',to:'pv_2',et:'pv_power',route:'ortho',dir:'forward',lbl:''},
        {from:'pcs_3',to:'b_2',et:'charge',route:'ortho',dir:'both',lbl:''},
      ];
      return {nodes,edges};
    }
  },
  t5_series:{
    name:'横向串联式', nameEn:'Series Chain', desc:'母线→交流断路器→PCS→直流断路器→电池，横向串联',
    build(){
      const W=1200,H=400;
      const nodes=[
        {id:'bus_1',type:'busbar',labelZh:'交流母线',labelEn:'AC Busbar',x:W*.12,y:H*.5,status:'在线',fontSize:14,fontColor:'#4dd0ff',data:mkData([['A相电流(A)','Ia(A)'],['B相电流(A)','Ib(A)'],['C相电流(A)','Ic(A)'],['充放电功率(kW)','P(kW)'],['电网频率(Hz)','Freq(Hz)',50],['直流电压(V)','DC V(V)']])},
        {id:'sw_ac',type:'switch',labelZh:'交流断路器',labelEn:'AC Breaker',x:W*.36,y:H*.5,status:'闭合',fontSize:14,fontColor:'#ff7a6a',data:mkData([['状态','State']])},
        {id:'pcs_1',type:'pcs',labelZh:'变流器',labelEn:'PCS',x:W*.56,y:H*.5,status:'运行',fontSize:14,fontColor:'#2ecc71',data:mkData([['P(kW)','P(kW)'],['U(V)','U(V)']])},
        {id:'sw_dc',type:'switch',labelZh:'直流断路器',labelEn:'DC Breaker',x:W*.76,y:H*.5,status:'闭合',fontSize:14,fontColor:'#ff7a6a',data:mkData([['状态','State']])},
        {id:'bms_1',type:'bms',labelZh:'电池',labelEn:'Battery',x:W*.94,y:H*.5,status:'充电',fontSize:14,fontColor:'#3aa0ff',data:mkData([['SOC(%)','SOC(%)',55]])},
      ];
      const edges=[
        {from:'bus_1',to:'sw_ac',et:'ac_power',route:'straight',dir:'forward',lbl:''},
        {from:'sw_ac',to:'pcs_1',et:'ac_power',route:'straight',dir:'forward',lbl:''},
        {from:'pcs_1',to:'sw_dc',et:'dc_power',route:'straight',dir:'forward',lbl:''},
        {from:'sw_dc',to:'bms_1',et:'charge',route:'straight',dir:'both',lbl:''},
      ];
      return {nodes,edges};
    }
  },
  t6_lloop:{
    name:'L型回路式', nameEn:'L-Shape Loop', desc:'交流母线→断路器→PCS→断路器→电池，L型走线',
    build(){
      const W=820,H=620;
      const nodes=[
        {id:'bus_1',type:'busbar',labelZh:'交流母线',labelEn:'AC Busbar',x:W*.62,y:H*.16,status:'在线',fontSize:14,fontColor:'#4dd0ff',data:mkData([['A相电流(A)','Ia(A)'],['B相电流(A)','Ib(A)'],['C相电流(A)','Ic(A)'],['交流有功(kW)','AC P(kW)'],['输出电压(V)','Uout(V)']])},
        {id:'sw_ac',type:'switch',labelZh:'交流断路器',labelEn:'AC Breaker',x:W*.62,y:H*.36,status:'闭合',fontSize:14,fontColor:'#ff7a6a',data:mkData([['状态','State']])},
        {id:'pcs_1',type:'pcs',labelZh:'变流器',labelEn:'PCS',x:W*.62,y:H*.54,status:'运行',fontSize:14,fontColor:'#2ecc71',data:mkData([['直流功率(kW)','DC P(kW)'],['直流电流(A)','DC I(A)'],['直流电压(V)','DC V(V)']])},
        {id:'sw_dc',type:'switch',labelZh:'直流断路器',labelEn:'DC Breaker',x:W*.62,y:H*.72,status:'闭合',fontSize:14,fontColor:'#ff7a6a',data:mkData([['状态','State']])},
        {id:'bms_1',type:'bms',labelZh:'电池',labelEn:'Battery',x:W*.34,y:H*.86,status:'充电',fontSize:14,fontColor:'#3aa0ff',data:mkData([['SOC(%)','SOC(%)',55]])},
      ];
      const edges=[
        {from:'bus_1',to:'sw_ac',et:'pipe_blue',route:'ortho',dir:'forward',lbl:''},
        {from:'sw_ac',to:'pcs_1',et:'ac_power',route:'ortho',dir:'forward',lbl:''},
        {from:'pcs_1',to:'sw_dc',et:'dc_power',route:'ortho',dir:'forward',lbl:''},
        {from:'sw_dc',to:'bms_1',et:'pipe_blue',route:'ortho',dir:'both',lbl:''},
      ];
      return {nodes,edges};
    }
  },
  // ★ 数据驱动示例：规则随信号实时生效（编辑态虚化、运行视图隐藏）；点顶栏「⚙ 规则与信号」改 grid_1.online / pcs_1.P(kW) 看显隐与流向变化
  t7_dynamic:{
    name:'数据驱动示例', nameEn:'Data-Driven Demo', desc:'电网在线/PCS功率正负 → 元素与连线实时显隐、流向自动切换（规则即时生效；在「⚙ 规则与信号」里改信号值体验）',
    build(){
      const W=1000,H=620;
      const nodes=[
        {id:'pcs_1',type:'pcs',labelZh:'PCS变流器',labelEn:'PCS',x:W*.5,y:H*.5,status:'运行',fontSize:14,fontColor:'#2ecc71',
          data:mkData([['P(kW)','P(kW)',-30],['U(V)','U(V)',750]])},
        {id:'grid_1',type:'grid',labelZh:'市电',labelEn:'Grid',x:W*.18,y:H*.28,status:'在线',fontSize:14,fontColor:'#e8f4ff',
          data:mkData([['P(kW)','P(kW)',200]])},
        {id:'bms_1',type:'bms',labelZh:'储能电池',labelEn:'Battery',x:W*.82,y:H*.28,status:'充电',fontSize:14,fontColor:'#3aa0ff',
          data:mkData([['SOC(%)','SOC(%)',55]])},
        {id:'load_1',type:'load',labelZh:'用户负载',labelEn:'Load',x:W*.82,y:H*.72,status:'在线',fontSize:14,fontColor:'#e8f4ff',
          data:mkData([['负载功率(kW)','Load(kW)',80]])},
        // 发电机：仅在「市电离线(孤岛)」时显示（工况2：元素按数据动态显隐）
        {id:'gen_1',type:'generator',labelZh:'柴油发电机',labelEn:'Generator',x:W*.18,y:H*.72,status:'备用',fontSize:14,fontColor:'#f5c518',
          data:mkData([['P(kW)','P(kW)',0]]), visibleWhen:{var:'grid_1.online',op:'falsy'}},
      ];
      const edges=[
        // 工况2：市电在线才有这条并网连线；离线时整条消失
        {from:'grid_1',to:'pcs_1',et:'ac_power',route:'straight',dir:'forward',lbl:'并网',
          showWhen:{var:'grid_1.online',op:'truthy'}},
        // 工况1：PCS 功率正→充电(正向)，负→放电(反向)，由数据决定流向
        {from:'pcs_1',to:'bms_1',et:'charge',route:'straight',dir:'both',lbl:'',
          dirRules:[{when:{var:'pcs_1.P(kW)',op:'>',val:0},dir:'forward'},
                    {when:{var:'pcs_1.P(kW)',op:'<',val:0},dir:'reverse'}]},
        // 常显：PCS 向负载供电
        {from:'pcs_1',to:'load_1',et:'discharge',route:'straight',dir:'forward',lbl:''},
        // 工况2：仅孤岛(市电离线)时，发电机接入并供电
        {from:'gen_1',to:'pcs_1',et:'ac_power',route:'straight',dir:'forward',lbl:'孤岛',
          showWhen:{var:'grid_1.online',op:'falsy'}},
      ];
      return {nodes,edges};
    }
  },
};

function tplThumb(key){
  // 生成简易缩略图 SVG
  const t=TEMPLATES[key];const {nodes:tn,edges:te}=t.build();
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  tn.forEach(n=>{minX=Math.min(minX,n.x);minY=Math.min(minY,n.y);maxX=Math.max(maxX,n.x);maxY=Math.max(maxY,n.y);});
  const w=maxX-minX||1,h=maxY-minY||1,pad=40;
  const sc=Math.min((300-pad)/w,(130-pad)/h);
  const ox=(300-w*sc)/2-minX*sc, oy=(130-h*sc)/2-minY*sc;
  const px=n=>[n.x*sc+ox,n.y*sc+oy];
  let svg='<svg viewBox="0 0 300 130" xmlns="http://www.w3.org/2000/svg">';
  te.forEach(e=>{const a=tn.find(n=>n.id===e.from),b=tn.find(n=>n.id===e.to);if(!a||!b)return;const[ax,ay]=px(a),[bx,by]=px(b);const col=(ET[e.et]||ET.ac_power).color;svg+=`<path d="M${ax} ${ay} L${bx} ${ay} L${bx} ${by}" fill="none" stroke="${col}" stroke-width="1.5" opacity="0.8"/>`;});
  tn.forEach(n=>{const[x,y]=px(n);svg+=`<circle cx="${x}" cy="${y}" r="4" fill="#4dd0ff"/>`;});
  svg+='</svg>';
  return svg;
}
function openTemplates(){
  const grid=document.getElementById('tpl-grid');grid.innerHTML='';
  document.getElementById('tpl-title').textContent=lang==='en'?'📂 Choose a Template':'📂 选择示例模板';
  document.getElementById('tpl-close').textContent=lang==='en'?'Close':'关闭';
  Object.keys(TEMPLATES).forEach((key,i)=>{
    const t=TEMPLATES[key];
    const card=document.createElement('div');card.className='tpl-card'+(i===0?' default':'');
    card.onclick=()=>chooseTemplate(key);
    const nm=lang==='en'?t.nameEn:t.name;
    card.innerHTML='<div class="tpl-thumb">'+tplThumb(key)+'</div>'+
      '<div class="tpl-name">'+nm+(i===0?'<span class="tpl-badge">'+(lang==='en'?'Default':'默认')+'</span>':'')+'</div>'+
      '<div class="tpl-desc">'+(lang==='en'?'':t.desc)+'</div>';
    grid.appendChild(card);
  });
  document.getElementById('tpl-overlay').classList.add('show');
}
function closeTemplates(){document.getElementById('tpl-overlay').classList.remove('show');}
async function chooseTemplate(key){
  if(nodes.length>0){const ok=await uiConfirm(lang==='en'?'Load template and replace current content?':'加载模板将替换当前内容，确定？',false);if(!ok){return;}}
  loadTemplate(key);
  closeTemplates();
}
function loadTemplate(key){
  const t=TEMPLATES[key];if(!t)return;
  const {nodes:tn,edges:te}=t.build();
  nodes=tn;edges=te;
  selNode=selEdge=null;showPanel('none');
  // 重建 id 计数
  ids={};nodes.forEach(n=>{const m=n.id.match(/^(.+?)_?(\d+)$/);if(m){ids[m[1]]=Math.max(ids[m[1]]||0,parseInt(m[2]));}});
  busMerge=true;
  edges.forEach(e=>{ delete e.waypoints; });
  autoLayout(true);          // 布局 + 整理走线（静默，不单独入历史）
  history=[];histIdx=-1;snapshot();
}
// 整理走线：无障碍走直线，有障碍走正交，交叉则尝试正交化（无提示版，供初始化调用）
function _rawPathFor(e){ return edgePathRaw(e); }
function _countCrossRaw(){
  const paths=edges.map(e=>_rawPathFor(e)).filter(Boolean);
  let n=0;
  for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++){if(pathsCross(paths[i],paths[j]))n++;}
  return n;
}
// 基于「实际渲染路径」（含汇流合并）统计交叉——这才是用户看到的结果
function _countCrossRendered(){
  _pathCacheSig=''; recomputeAllPaths();
  const paths=edges.map(e=>_pathCache[e._cacheKey]).filter(Boolean);
  let n=0;
  for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++){if(pathsCross(paths[i],paths[j]))n++;}
  return n;
}
function applyTidyRouting(){
  // 交给智能路由引擎统一计算：重算端口 · 最短避障 · 少交叉
  resetEdgeRoutingForAutoLayout(edges);
  _pathCacheSig=''; recomputeAllPaths();
}
function _countCrossRendered(){ return _countCross(); }
function setRouteStyle(s){ routeStyle=parseInt(s); applyTidyRouting(); _pathCacheSig=''; snapshot();
  document.querySelectorAll('#seg-route .seg-btn').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.rs)===routeStyle));
  flashHint(['','全部正交走线','直连优先','智能(默认)'][routeStyle]+' · 剩余交叉 '+_countCross()); }
// 兼容旧调用：默认加载模板1
async function loadDemo(){ openTemplates(); }
function loadDefaultTemplate(){ loadTemplate('t1'); }

// ══════════════════════════════════════════════════════════════
// ★ 只读运行模式（前端嵌入/独立托管）：与运营端编辑器同一份渲染器 + 同一套规则引擎，
//   保证前端拓扑/连线/流向/字段与运营端「像素级一致」。前端动态拉取画布 JSON 与实时数据即可。
//   开启方式（任选）：
//     1) URL 参数：?mode=runtime&topology=<画布JSON地址>&signals=<实时数据地址>&interval=2000
//        其它参数：fit=0 关闭自动适配；interactive=1 允许平移/缩放（默认只读不可交互）
//     2) iframe 内嵌：父页面 postMessage({type:'topo:topology',data:画布JSON对象})、
//        {type:'topo:signals',data:{信号:值}}（整批覆盖）、{type:'topo:merge',data:{...}}（增量合并）
//     3) JS API：window.TopoRuntime.loadTopology(对象或URL) / setSignals(obj) / mergeSignals(obj) / fit()
//   实时数据键名 = 规则里用的信号名：节点字段「节点id.字段名」、支持状态节点的「节点id.status / 节点id.online」、全局信号名。
// ══════════════════════════════════════════════════════════════
let _rtCfg=null,_rtTimer=null;
function topoRuntimeConfig(){
  let cfg=null;
  try{
    const q=new URLSearchParams(location.search);
    const mode=(q.get('mode')||'').toLowerCase();
    const on=(mode==='runtime'||mode==='view'||mode==='embed'||q.has('embed')||(typeof window!=='undefined'&&window.__TOPO_RUNTIME__));
    if(!on)return null;
    cfg={ topology:q.get('topology')||q.get('topo')||null,
          signals:q.get('signals')||null,
          interval:parseInt(q.get('interval')||'0',10)||0,
          fit:q.get('fit')!=='0',
          interactive:q.get('interactive')==='1' };
    if(window.__TOPO_RUNTIME__&&typeof window.__TOPO_RUNTIME__==='object')cfg=Object.assign(cfg,window.__TOPO_RUNTIME__);
  }catch(e){ cfg=(typeof window!=='undefined'&&window.__TOPO_RUNTIME__)?Object.assign({fit:true},window.__TOPO_RUNTIME__):null; }
  return cfg;
}
// 实时数据 → 既喂规则(signalValues)，又回写字段值/状态用于显示（与编辑器同一套字段渲染）
function applyLiveSignals(payload){
  if(!payload||typeof payload!=='object')return;
  Object.keys(payload).forEach(k=>{
    const v=payload[k];
    signalValues[k]=v;                                   // 规则求值用
    const ps=parseSignal(k);                             // 映射到节点字段→更新显示
    if(ps&&ps.node&&ps.node!=='@global'){
      const n=nodes.find(x=>x.id===ps.node); if(!n)return;
      if(ps.field==='status'&&nodeSupportsStateSignals(n)) n.status=v;
      else if(ps.field==='online'){ /* 仅参与规则，无字段显示 */ }
      else { const f=(n.data||[]).find(d=>d.key===ps.field); if(f)f.dv=v; }
    }
  });
  // 流向/显隐由渲染循环每帧按 signalValues 实时求值，无需手动重绘
}
async function rtLoadTopology(src){
  let obj=src;
  try{ if(typeof src==='string'){ const r=await fetch(src,{cache:'no-store'}); obj=await r.json(); } }
  catch(e){ console.error('[TopoRuntime] 拉取画布 JSON 失败：',e); return false; }
  nodes=[];edges=[];selNode=selEdge=null; try{selSet&&selSet.clear&&selSet.clear();}catch(e){}   // 置空以跳过导入二次确认
  try{ await importCanvasJSON(obj); }catch(e){ console.error('[TopoRuntime] 还原画布失败：',e); return false; }
  previewMode=true;                                      // 运行视图：被规则隐藏者彻底不画
  if(!_rtCfg||_rtCfg.fit!==false){ resizeCanvas(); fitView(); }
  return true;
}
function _rtStartSignalFeed(){
  if(!_rtCfg||!_rtCfg.signals)return;
  const pull=()=>fetch(_rtCfg.signals,{cache:'no-store'}).then(r=>r.json()).then(applyLiveSignals).catch(e=>console.error('[TopoRuntime] 拉取实时数据失败：',e));
  pull();
  if(_rtCfg.interval>0){ if(_rtTimer)clearInterval(_rtTimer); _rtTimer=setInterval(pull,_rtCfg.interval); }
}
function enterRuntimeMode(cfg){
  _rtCfg=cfg||{fit:true};
  previewMode=true;
  document.body.classList.add('rt'); if(!_rtCfg.interactive)document.body.classList.add('rt-lock');
  // 注入只读样式：隐藏编辑器全部外壳，画布铺满容器
  if(!document.getElementById('topo-rt-style')){
    const st=document.createElement('style');st.id='topo-rt-style';
    st.textContent='body.rt #topbar,body.rt #ebar,body.rt #alignbar,body.rt #sidebar-wrap,body.rt #props,body.rt .panel-toggle,body.rt #chint,body.rt #ehint,body.rt #corner-info,body.rt #bgpanel,body.rt #bgpanel-overlay,body.rt #simpanel,body.rt #jpanel,body.rt #ctxmenu,body.rt #uo{display:none!important}'
      +'body.rt #main{height:100vh}body.rt #cwrap{width:100vw;height:100vh}body.rt.rt-lock #c{pointer-events:none}';
    document.head.appendChild(st);
  }
  resizeCanvas();
  // 对外 JS API
  window.TopoRuntime={ loadTopology:rtLoadTopology,
    setSignals:o=>{signalValues={};applyLiveSignals(o);},
    mergeSignals:applyLiveSignals,
    fit:()=>{resizeCanvas();fitView();},
    config:()=>_rtCfg };
  // iframe 内嵌：接收父页面推送的拓扑与实时数据
  window.addEventListener('message',ev=>{ const d=ev&&ev.data; if(!d||typeof d!=='object')return;
    if(d.type==='topo:topology'&&d.data)rtLoadTopology(d.data);
    else if(d.type==='topo:signals'&&d.data){ signalValues={}; applyLiveSignals(d.data); }
    else if(d.type==='topo:merge'&&d.data) applyLiveSignals(d.data); });
  // 容器尺寸变化时重新适配
  window.addEventListener('resize',()=>{ resizeCanvas(); if(_rtCfg.fit!==false)fitView(); });
  // 初始拓扑 → 实时数据
  if(_rtCfg.topology){ rtLoadTopology(_rtCfg.topology).then(_rtStartSignalFeed); }
  else { _rtStartSignalFeed(); }
  // 通知宿主已就绪（iframe 场景可据此再 postMessage 数据）
  try{ if(window.parent&&window.parent!==window)window.parent.postMessage({type:'topo:ready'},'*'); }catch(e){}
}
setTheme('blue_screen');
