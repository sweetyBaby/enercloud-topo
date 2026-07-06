// Topology editor runtime and UI logic.
let DEVICE_GROUPS=[];  // 运行时由 loadIconLibrary() 从 icons/index.json（图标库）填充
const NODE_DEFAULTS={"grid": {"data": ["P(kW)", "Q(kvar)"]}, "solar": {"data": ["P(kW)", "Vpv(V)"]}, "generator": {"data": ["P(kW)", "频率(Hz)"]}, "pcs": {"data": ["P(kW)", "Q(kvar)", "I(A)", "U(V)"]}, "bms": {"data": ["U(V)", "I(A)", "SOC(%)", "温度(℃)"]}, "cabinet": {"data": ["簇电压(V)", "簇电流(A)", "SOC(%)", "温度(℃)"]}, "transformer": {"data": ["输入电压(V)", "输出电压(V)"]}, "switch": {"data": []}, "highvolt": {"data": ["直流电压(V)", "直流电流(A)"]}, "busbar": {"data": ["母线电压(V)"]}, "trunk_ac": {"data": ["电压(V)", "电流(A)"]}, "trunk_dc": {"data": ["电压(V)", "电流(A)"]}, "tie_line": {"data": ["P(kW)"]}, "meter": {"data": ["P(kW)", "Q(kvar)"]}, "meter2": {"data": ["P(kW)", "Q(kvar)", "今日用电(kWh)"]}, "load": {"data": ["负载功率(kW)", "今日用电(kWh)"]}, "charger": {"data": ["功率(kW)"]}, "ems": {"data": ["运行模式"]}, "aircon": {"data": ["温度(℃)"]}, "fire": {"data": ["告警"]}, "sensor": {"data": ["数值", "单位"]}, "cb_closed": {"data": ["电流(A)"]}, "switch_open": {"data": []}, "disconnector": {"data": []}, "contactor": {"data": []}, "fuse": {"data": ["额定电流(A)"]}, "resistor": {"data": ["阻值(Ω)"]}, "inductor": {"data": ["电感(mH)"]}, "capacitor": {"data": ["容值(μF)"]}, "ct": {"data": ["变比", "二次电流(A)"]}, "pt": {"data": ["变比", "二次电压(V)"]}, "spd": {"data": []}, "ground": {"data": []}, "h2_storage": {"data": ["压力(MPa)", "SOC(%)", "温度(℃)"]}, "iso_g": {"data": []}, "lbs_g": {"data": []}, "disc_v_g": {"data": []}}, PRESET_BG=["#060e1a", "#0a2040", "#102a52", "#0d1b2a", "#1a1a2e", "#0a1a14", "#10240f", "#1a1000", "#2a0a0a", "#160020", "#2b2118", "#1a2630", "#23252b", "#2b1a2a", "#0f2a2a", "#3a2a1a", "#2a1a3a", "#1a3a2a", "#3a1a2a", "#1f1f0a", "#ffffff", "#f0f3f8", "#eaeef4", "#fdf6e3", "#f5eef5", "#e8f4f0", "#fff4e6", "#eef2ff", "#f0fff4", "#fff0f0", "#fef0f5", "#f0f9ff", "#fffbe8", "#f3f0ff", "#eafaf1"], DATA_LABEL_EN={"P(kW)": "P(kW)", "Q(kvar)": "Q(kvar)", "I(A)": "I(A)", "U(V)": "U(V)", "Vpv(V)": "Vpv(V)", "频率(Hz)": "Freq(Hz)", "SOC(%)": "SOC(%)", "温度(℃)": "Temp(℃)", "簇电压(V)": "Cluster V(V)", "簇电流(A)": "Cluster I(A)", "状态": "Status", "输入电压(V)": "Vin(V)", "输出电压(V)": "Vout(V)", "直流电压(V)": "DC V(V)", "直流电流(A)": "DC I(A)", "母线电压(V)": "Bus V(V)", "今日用电(kWh)": "Today(kWh)", "负载功率(kW)": "Load(kW)", "功率(kW)": "Power(kW)", "运行模式": "Mode", "告警": "Alarm", "数值": "Value", "单位": "Unit", "电流(A)": "I(A)", "额定电流(A)": "Rated I(A)", "阻值(Ω)": "R(Ω)", "电感(mH)": "L(mH)", "容值(μF)": "C(μF)", "变比": "Ratio", "二次电流(A)": "Sec I(A)", "二次电压(V)": "Sec V(V)", "电压(V)": "U(V)"}, STATUS_EN={"待机": "Standby", "充电": "Charging", "放电": "Discharging", "发电": "Generating", "在线": "Online", "离线": "Offline", "备用": "Standby", "运行": "Running", "停机": "Stopped", "并网运行": "Grid-tied", "离网运行": "Off-grid", "闭合": "Closed", "断开": "Open", "故障": "Fault", "告警": "Alarm", "正常": "Normal", "充电中": "Charging", "放电中": "Discharging"};
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

/* ───── 图标库（文件化）：运行时从 icons/index.json 加载「分组结构 + 图片文件」。
   增删改图标 = 直接增删改 icons/ 下的图片（dev-server / build 会自动扫描登记并同步清单），无需改动代码。
   清单里的 file-less 元素（如文本框/变量节点等纯绘制元素）不需要图片。 ───── */
const ICON_BASE='icons/';              // 图标文件目录（相对 topo.html）
// 图标库写接口（上传/重命名/替换/删除 → 落盘 icons/ + index.json）；dev-server / 生产 server 均提供。
// 如需对接父平台后端，可在加载本脚本前设置 window.TOPO_ICON_API 覆盖（支持绝对 URL）。
const ICON_API=(typeof window!=='undefined'&&window.TOPO_ICON_API)||'api/icons';
const ICON_FILE={};                    // type → 图片文件名（导出元素库清单 / iconFileName 用）
const ICON_GROUP_ORDER=['电源侧','储能设备','母线/主干线','电气设备','计量与负载','开关元件','辅助系统','无源元件','辅助元素'];
let _iconBust=0;                       // 图片缓存版本号：每次「重扫图标」+1，绕过浏览器缓存
async function loadIconLibrary(){
  let manifest=null;
  try{
    const res=await fetch(ICON_BASE+'index.json',{cache:'no-store'});
    if(res.ok) manifest=await res.json();
    else console.error('加载图标库失败：HTTP '+res.status+' '+ICON_BASE+'index.json');
  }catch(err){ console.error('加载图标库 '+ICON_BASE+'index.json 失败：',err); }
  // 清单拉取失败/无效：保留上一次成功加载的图标库（不重建分组、不清缓存），
  //   避免瞬时网络失败把画布上已加载的图标全刷成占位。下次成功重扫再更新。
  if(!(manifest&&Array.isArray(manifest.groups))) return;
  const groups=manifest.groups;
  // 由清单构建分组结构（替代旧的硬编码 DEVICE_GROUPS）
  // _ord = 清单(index.json)原始顺序：左栏会按 ICON_GROUP_ORDER 重排（常用优先），
  //   但图标库管理面板改用 _ord 还原「服务端顺序」，从而让新增分组(服务端 unshift 到最前)显示在最上面。
  DEVICE_GROUPS=groups.map((g,gi)=>({
    title:g.title, title_en:g.title_en||g.title, color:g.color||'#42a5f5', tab:g.tab||'device', _ord:gi,
    devices:(g.devices||[]).map(d=>{
      const dev={type:d.type, label:d.label||d.type, label_en:d.label_en||d.label||d.type, badge:d.badge||d.type};
      if(d.file){ dev.file=d.file; ICON_FILE[d.type]=d.file; }
      // 图标库可携带默认数据字段；仅对代码中尚无默认值的类型补充（不覆盖既有 NODE_DEFAULTS）
      if(Array.isArray(d.data)&&!NODE_DEFAULTS[d.type]) NODE_DEFAULTS[d.type]={data:d.data.slice()};
      return dev;
    })
  }));
  // 分类顺序：常用优先；自动扫描出的「自定义图标」等未列入顺序的分组排在最后
  DEVICE_GROUPS.sort((a,b)=>{const ia=ICON_GROUP_ORDER.indexOf(a.title),ib=ICON_GROUP_ORDER.indexOf(b.title);return (ia<0?999:ia)-(ib<0?999:ib);});
  // 清理已从图标库移除(删除/重命名/替换文件)的类型缓存：否则 IMGS 里的旧 Image 会让画布/导出继续用到已删除的图标。
  //   会话内存图标(CUSTOM_ICONS，无写接口时的兜底)不在清单里，需保留。
  const liveTypes=new Set();
  DEVICE_GROUPS.forEach(g=>g.devices.forEach(d=>{if(d.file)liveTypes.add(d.type);}));
  Object.keys(IMGS).forEach(t=>{if(!liveTypes.has(t)&&!CUSTOM_ICONS[t])delete IMGS[t];});
  Object.keys(IMG_DATA).forEach(t=>{if(!liveTypes.has(t)&&!CUSTOM_ICONS[t])delete IMG_DATA[t];});
  Object.keys(ICON_FILE).forEach(t=>{if(!liveTypes.has(t))delete ICON_FILE[t];});
  // 预加载图片到 IMGS（drawImage 用）；同时把 IMG_DATA[type] 记为图片 URL（iconSrcOf / 上传预览用）
  const tasks=[];
  const bust=_iconBust?('?v='+_iconBust):'';   // 重新扫描时给图片 URL 加版本号，强制绕过浏览器缓存（替换同名图片即生效）
  DEVICE_GROUPS.forEach(g=>g.devices.forEach(d=>{
    if(!d.file)return;                 // 文本框/变量节点等纯绘制元素无图片
    const url=ICON_BASE+d.file;
    IMG_DATA[d.type]=url;
    tasks.push(new Promise(resolve=>{const im=new Image();im.onload=im.onerror=()=>{IMGS[d.type]=im;resolve();};im.src=url+bust;}));
  }));
  await Promise.all(tasks);
}
// 重新扫描图标库：重新拉取 icons/index.json + 图片并重建左栏（增删改图片后点一下即可，无需刷新整页）
async function reloadIconLibrary(){
  _iconBust++;
  try{
    await loadIconLibrary();
    buildSidebar();
    buildSelects();
    if(selNode&&nodes.find(x=>x.id===selNode))selectNode(selNode);   // buildSelects 重建了下拉，恢复当前选中项的属性面板
    else if(selEdge&&edges.includes(selEdge))selectEdge(selEdge);
    flashHint(lang==='en'?'Icon library reloaded':'图标库已重新扫描');
  }catch(err){
    console.error('重新扫描图标失败：',err);
    flashHint(lang==='en'?'Reload failed':'图标库刷新失败');
  }
}
/* ───── 后台数据绑定：设备类型(device-type.json)、设备实例(device-info.json)、字段字典(dic/ 扫描合并)。
   三者都「动态加载」：dic 走扫描路由、device 走 no-store 拉取，增删改后台 JSON 重新加载即生效。 ───── */
let DEVICE_TYPES=[];   // [{value,label}] 来自 device-type.json 的 dictValue/dictLabel
let DEVICE_LIST=[];    // [{deviceId,deviceName,deviceType,projectName}] 来自 device-info.json
let DEVICE_DICTS={};   // { deviceType: [{location,fields:[...]}] } 来自 dic/index.json（扫描合并）
// 画布元素类型 → 后台 deviceType 的默认映射（仅作选中节点时的默认值，用户仍可在面板改选任意类型）
const CANVAS_TYPE_TO_DEVICE={bms:'BCU',cabinet:'BCU',pcs:'PCS',ems:'EMS'};
async function loadBackendBindingData(){
  const getJSON=async(u)=>{try{const r=await fetch(u,{cache:'no-store'});return r.ok?await r.json():null;}catch(e){return null;}};
  const [types,list,dicts]=await Promise.all([
    getJSON('device/device-type.json'), getJSON('device/device-info.json'), getJSON('dic/index.json')
  ]);
  if(Array.isArray(types))DEVICE_TYPES=types.filter(t=>t&&t.dictValue&&(t.status==null||String(t.status)==='0'))
    .map(t=>({value:t.dictValue,label:t.dictLabel||t.dictValue}));
  if(Array.isArray(list))DEVICE_LIST=list.filter(d=>d&&d.deviceId&&d.delFlag!=='2')
    .map(d=>({deviceId:d.deviceId,deviceName:d.deviceName||d.deviceId,deviceType:d.deviceType||d.archiveDeviceType||'',projectId:d.projectId||'',projectName:d.projectName||''}));
  if(dicts&&typeof dicts==='object'&&!Array.isArray(dicts))DEVICE_DICTS=dicts;
}
// 字典查询助手
function nodeDeviceType(n){ return (n&&n.deviceType)||CANVAS_TYPE_TO_DEVICE[n&&n.type]||''; }
function dictLocations(dt){ return (DEVICE_DICTS[dt]||[]).map(g=>g.location); }
function dictFields(dt,loc){ const g=(DEVICE_DICTS[dt]||[]).find(x=>x.location===loc); return g?g.fields:[]; }
function devicesOfType(dt,projId){ return DEVICE_LIST.filter(d=>(!dt||d.deviceType===dt)&&(!projId||d.projectId===projId)); }
// 某设备类型下「有设备」的项目列表(按项目分组用):去重，保持出现顺序
function projectsOfType(dt){ const seen={},out=[]; DEVICE_LIST.forEach(d=>{ if((!dt||d.deviceType===dt)&&d.projectId&&!seen[d.projectId]){seen[d.projectId]=1;out.push({id:d.projectId,name:d.projectName||d.projectId});} }); return out; }
function deviceNameOf(id){ const d=DEVICE_LIST.find(x=>x.deviceId===id); return d?(d.deviceName+(d.projectName?(' · '+d.projectName):'')):(id||''); }
function deviceTypeLabel(v){ const t=DEVICE_TYPES.find(x=>x.value===v); return t?t.label:(v||''); }
// 后台绑定数据动态刷新：重新拉取设备/字典并刷新当前节点面板
async function reloadBackendBindingData(){
  try{ await loadBackendBindingData(); const n=nodes.find(x=>x.id===selNode); if(n)selectNode(n.id);
    flashHint(lang==='en'?'Backend dict/devices reloaded':'后台字典/设备已刷新'); }
  catch(err){ console.error('刷新后台绑定数据失败：',err); }
}
/* ───── 值字典（code 码 → 中/英显示文案）：共享字典库（value-dicts/ 落盘，跨拓扑复用，类似图标库）
   + 文档内嵌快照（导出 JSON 的 valueDicts，导入时恢复，保证无字典服务也能正确转义）。
   转义逻辑在 packages/topology-runtime（fieldDisplayValue 等），此处只负责数据的加载与合并。 ───── */
const VD_BASE=(typeof window!=='undefined'&&window.TOPO_DICT_BASE)||'value-dicts/';   // 清单/文件目录（相对 topo.html）
const VD_API=(typeof window!=='undefined'&&window.TOPO_DICT_API)||'api/value-dicts';  // 写接口（dev/生产 server 均提供；可被父平台覆盖）
let VALUE_DICTS=[];      // 共享字典库（服务端扫描 value-dicts/*.json 合并）
let docValueDicts=[];    // 当前文档内嵌的字典快照（importCanvasJSON 恢复；仅补库里没有的 type）
async function loadValueDicts(){
  try{
    const r=await fetch(VD_BASE+'index.json',{cache:'no-store'});
    if(!r.ok)return;
    const m=await r.json();
    if(m&&Array.isArray(m.dicts))VALUE_DICTS=m.dicts.filter(d=>d&&d.type);
  }catch(err){ console.warn('加载值字典 '+VD_BASE+'index.json 失败：',err); }
}
// 生效字典 = 共享库优先 + 文档内嵌兜底（库是编辑器内可管理的事实源：改库立即生效；内嵌快照只补缺）
function effectiveValueDicts(){
  const have=new Set(VALUE_DICTS.map(d=>d.type));
  return VALUE_DICTS.concat((docValueDicts||[]).filter(d=>d&&d.type&&!have.has(d.type)));
}
async function reloadValueDicts(){ await loadValueDicts(); }

// 应用启动（Promise.all(...).then(init)）已移至最后加载的 topology-editor-12-bootstrap.js：
//  init() 体内会调用分布在 02/03/06/11 等后续文件的函数，必须待全部 <script> 求值后再启动，
//  否则若 loadIconLibrary/loadBackendBindingData 在后续脚本加载前 resolve，init() 会 ReferenceError。
const CUSTOM_ICONS={},CUSTOM_LABELS={};let pendingDataURL=null;

let nodes=[],edges=[],selNode=null,selEdge=null;
let edgeMode=false,edgeFrom=null,edgeFromPort=null,edgeWaypoints=[],pendingET='ac_power',pendingRoute='smart',mouseWX=null,mouseWY=null,selectMode=false;
let dragNode=null,dox=0,doy=0,panX=0,panY=0,zoom=1,isPanning=false,panSX=0,panSY=0;
let dragChip=null,dchox=0,dchoy=0,dragWaypoint=null,dragBus=null,dragResize=null,dragGroupScale=null,_groupBox=null,dragRotate=null,_hud=null,dragChipGroup=null,dragEndpoint=null,dragEdgeLabel=null,dragLblRotate=null,dragLblScale=null;
let selSet=new Set(),selChips=new Set(),rubber=null,_groupDrag=false,_groupStart={},alignGuides=[],_overlapHandles=[]; // 多选集合 + 选中字段 + 框选矩形 + 对齐辅助线 + 重叠线拐点浅色手柄
let ids={},animT=0,ctxTgt=null,ctxKind=null,bgColor='#0a1f40',showGrid=true,showEdgeLabels=true,showFieldChips=true,showAnchors=true,busMerge=true,busMergeGap=16,busTrunkBold=true,busStyle='busbar',busOffsets={},busShareTrunk=false,busShowHandles=false,routeStyle=3,busAggregation=false;
let history=[],histIdx=-1;
let suppressNodeActionClick=false;
// ★ 数据驱动（动态显隐/流向）：规则随信号实时求值并自动生效；面板开关与「运行视图」互相独立
// previewMode=运行视图（彻底隐藏被规则隐藏的元素）；panelOpen=「规则与信号」侧栏是否展开；
// _drawAlpha=当前绘制透明度（编辑态把被规则隐藏的元素「虚化」仍可点选编辑）
let previewMode=false,panelOpen=false,_drawAlpha=1,signalValues={},injRows=[],customSignals=[],_dyn={hiddenNodes:new Set(),hiddenEdges:new Set(),dirMap:new Map(),iconMap:new Map()};
let showRuleBadges=false;   // 是否在画布上标出「带规则」的元素/连线；进入规则面板默认开、关闭面板则关（面板内可手动切换）
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
function undo(){if(histIdx<=0)return;histIdx--;const s=JSON.parse(history[histIdx]);nodes=s.nodes;edges=s.edges;if(s.bgColor!==undefined)bgColor=s.bgColor;if(s.routeStyle!==undefined)routeStyle=s.routeStyle;selNode=selEdge=null;selSet.clear();selChips.clear();updateAlignBar();showPanel('none');invalidateRouting();updUR();}
function redo(){if(histIdx>=history.length-1)return;histIdx++;const s=JSON.parse(history[histIdx]);nodes=s.nodes;edges=s.edges;if(s.bgColor!==undefined)bgColor=s.bgColor;if(s.routeStyle!==undefined)routeStyle=s.routeStyle;selNode=selEdge=null;selSet.clear();selChips.clear();updateAlignBar();showPanel('none');invalidateRouting();updUR();}
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

