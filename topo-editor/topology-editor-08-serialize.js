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
      data:(n.data||[]).map(f=>{
        const fo={
          key:{zh:f.key, en:(f.keyEn===''?'':(f.keyEn||f.key))},   // 显式空英文名保留为空(让校验/重载后仍能拦截)；仅 keyEn 缺省(旧数据)才兜底中文名
          value:(f.dv==null||f.dv==='')?'':f.dv,
          hidden:!!f.hidden,
          offset:{x:parseFloat((f.ox||0).toFixed(1)), y:parseFloat((f.oy||0).toFixed(1))}
        };
        if(f.bind&&f.bind.field){
          // 后台字段绑定：导出时把来源「显式化」——总是写全 deviceType/deviceId，并用 followNode 标明是否跟随本节点设备
          const follow=!(f.bind.deviceType||f.bind.deviceId);
          fo.bind={
            field:f.bind.field,
            deviceType:f.bind.deviceType||nodeDeviceType(n)||'',
            deviceId:f.bind.deviceId||n.deviceId||'',
            followNode:follow                                    // true=随节点设备（节点改设备它跟着变）；false=显式指定来源
          };
        }
        return fo;
      })
    };
    // 后台设备绑定：节点默认对应的后台设备（字段未单独指定来源时取此）
    if(n.deviceType)o.deviceType=n.deviceType;
    if(n.deviceId)o.deviceId=n.deviceId;
    // status / online 已移除：节点不再导出运行状态属性
    // 自定义图标的 type 不在后台库中，附带文件名以便前端解析
    if(String(n.type).startsWith('custom_')) o.icon=iconFileName(n.type);
    if(usesTextBox(n.type)){
      o.textStyle={bg:n.bg||'none',border:n.border||'none',borderColor:n.borderColor||'#4dd0ff',
        borderWidth:(n.borderWidth!=null?n.borderWidth:1.5), radius:(n.radius!=null?n.radius:6),
        padX:(n.padX!=null?n.padX:10), padY:(n.padY!=null?n.padY:6)};
    }
    if(n.type==='variable'){
      // 变量节点：label / value 两段的字体属性 + 排列方式（value 文本走 data[0] 的实时绑定/默认值）
      o.variableStyle={
        layout:(n.varLayout==='v'?'vertical':'horizontal'),
        label:{fontSize:(n.fontSize||16),color:(n.fontColor||'#e8f4ff'),bold:(n.labelBold!==false)},
        value:{fontSize:(n.valFontSize||n.fontSize||16),color:(n.valColor||'#4dd0ff'),bold:!!n.valBold}
      };
    }
    if(n.type==='anchor') o.anchorStyle={fill:n.fill||'none', opacity:(n.opacity!=null?n.opacity:1)};
    if(n.action&&n.action.url)o.action={trigger:n.action.trigger||'click',url:n.action.url,target:n.action.target||'same'};
    if(n.visibleWhen!=null) o.visibleWhen=n.visibleWhen;   // ★ 数据驱动：显示条件（条件不满足→运行端隐藏该元素）
    // ★ 数据驱动：图标规则（顺序匹配，首个命中的 icon 生效；都不命中用节点自身 type 的图标）。icon 为元素库中的 type，前端按 type→图标文件同一张映射解析
    if(Array.isArray(n.iconRules)&&n.iconRules.length) o.iconRules=n.iconRules.map(r=>({when:r.when,icon:r.icon}));
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
  // ★ 全局信号：与数据字段完全一致 —— key:{zh,en}（英文名作信号键）+ value(默认值) + 可选后台绑定 bind（无类型概念，类型按值推断）
  if(customSignals&&customSignals.length) obj.signals=customSignals.map(s=>{
    // key.en 用真实英文名（空则保留空）——不兜底成中文名，否则草稿/导出重载后会掩盖「缺英文名」使校验失效
    const o={key:{zh:s.key||'', en:(s.keyEn||'')}, value:(s.dv==null?'':s.dv)};
    if(s.bind&&s.bind.field)o.bind={field:s.bind.field, deviceType:s.bind.deviceType||'', deviceId:s.bind.deviceId||''};
    return o;
  });
  // ★ 数据驱动：当前注入的样例信号值（预览数据，随图导出，便于运行端/再次编辑时作默认值）
  if(signalValues&&Object.keys(signalValues).length){
    const valid=new Set(collectSignals().map(s=>s.name)),samples={};
    Object.keys(signalValues).forEach(k=>{if(valid.has(k))samples[k]=signalValues[k];});
    if(Object.keys(samples).length)obj.sampleSignals=samples;
  }
  // ★ 后台数据绑定清单：每条字段绑定 → {signal, node, source:{deviceType,deviceId,field}}（来源自包含，含跨设备）
  // 后台据此知道：取哪台设备的哪个字段、对应输出哪个实时信号键（signal=节点id.英文字段名，前端 applyLiveSignals 直接消费）
  const dataBindings=[];
  nodes.forEach(n=>{
    (n.data||[]).forEach(f=>{
      if(!f.bind||!f.bind.field||!fieldSigKey(f))return;
      const deviceType=f.bind.deviceType||nodeDeviceType(n)||'';
      const deviceId=f.bind.deviceId||n.deviceId||'';
      const dev=deviceId?DEVICE_LIST.find(d=>d.deviceId===deviceId):null;
      const source={deviceType, deviceId, field:f.bind.field};
      if(dev&&dev.deviceName)source.deviceName=dev.deviceName;   // 便于后台/排错人读，可选
      // signal=端到端信号键(节点id.英文字段名)；label 保留中文名便于人读
      dataBindings.push({ signal:fieldSig(n,f), node:n.id, label:f.key||fieldSigKey(f), source });
    });
  });
  // 全局信号的后台绑定：signal=英文名(无节点前缀)，node=null 表示全局量
  (customSignals||[]).forEach(s=>{
    if(!s.bind||!s.bind.field||!fieldSigKey(s))return;
    const deviceId=s.bind.deviceId||'';
    const dev=deviceId?DEVICE_LIST.find(d=>d.deviceId===deviceId):null;
    const source={deviceType:s.bind.deviceType||'', deviceId, field:s.bind.field};
    if(dev&&dev.deviceName)source.deviceName=dev.deviceName;
    dataBindings.push({ signal:fieldSigKey(s), node:null, label:sigDisplayName(s), source });
  });
  if(dataBindings.length)obj.dataBindings=dataBindings;
  return JSON.stringify(obj,null,2);
}
// 导出前校验：列出「有字段名但未绑定/绑定无法解析」的数据字段（风险项，不阻断导出）
// 已加载后台设备/字典时，进一步校验「设备实例真实存在」「location.field 在字典中存在」，以捕获导入/陈旧的失效绑定；
// 未加载参考数据时（DEVICE_LIST/DICTS 为空）则退化为存在性检查，避免误报。
function unboundBindingReport(){
  const miss=[];
  const haveDevices=DEVICE_LIST.length>0;
  const add=(n,f,reason)=>miss.push({node:n.id,label:nodeLabel(n),key:f.key,reason});
  nodes.forEach(n=>{
    if(n.type==='anchor')return;                       // 占位点无数据
    (n.data||[]).forEach(f=>{
      if(!f.key)return;
      if(!(f.bind&&f.bind.field)){add(n,f,'未绑定字段');return;}
      const dt=f.bind.deviceType||nodeDeviceType(n)||'';
      const did=f.bind.deviceId||n.deviceId||'';
      if(!did){add(n,f,'缺设备实例');return;}
      if(haveDevices&&!DEVICE_LIST.some(d=>d.deviceId===did)){add(n,f,'设备实例不存在');return;}
      const dict=DEVICE_DICTS[dt];
      if(dict&&dict.length){                            // 该类型字典已加载 → 校验字段确实存在
        const p=String(f.bind.field).split('.'),fld=p.pop(),loc=p.join('.');
        const g=dict.find(x=>x.location===loc);
        if(!g||!(g.fields||[]).includes(fld)){add(n,f,'字段不在字典');return;}
      }
    });
  });
  return miss;
}
// 导出前校验：节点 ID 是否重复/为空（ID 是 signal 键与 dataBindings 的主键，重复会冲突，属严重问题）
// 用 Object.create(null) 避免 __proto__/constructor/toString 等 ID 与对象原型属性碰撞导致误计数。
function duplicateIdReport(){
  const cnt=Object.create(null);nodes.forEach(n=>{const id=n.id||'';cnt[id]=(cnt[id]||0)+1;});
  const dups=Object.keys(cnt).filter(id=>id&&cnt[id]>1).map(id=>({id,count:cnt[id]}));
  const emptyCount=(cnt['']||0);
  return {dups,emptyCount};
}
// 导出前校验：列出「缺中文名或英文名」的数据字段（英文名是端到端信号键，缺失属严重问题，阻断导出）
function missingFieldNameReport(){
  const miss=[];
  nodes.forEach(n=>{
    if(n.type==='anchor')return;   // 占位点无数据字段
    (n.data||[]).forEach((f,i)=>{
      const noZh=!String(f.key||'').trim(), noEn=!String(f.keyEn||'').trim();
      if(noZh||noEn)miss.push({node:n.id,label:nodeLabel(n)||n.id,idx:i+1,
        reason:(noZh&&noEn)?'缺中文名和英文名':(noZh?'缺中文名':'缺英文名')});
    });
  });
  return miss;
}
// 导出前校验：同一节点内「中文名」或「英文名」重复的数据字段（英文名重复=信号键冲突，属严重问题，阻断导出）
function duplicateFieldNameReport(){
  const dups=[];
  nodes.forEach(n=>{
    if(n.type==='anchor')return;
    const iss=fieldNameIssues(n);
    iss.forEach((s,i)=>{
      if(s.dupZh||s.dupEn)dups.push({node:n.id,label:nodeLabel(n)||n.id,idx:i+1,
        reason:(s.dupZh&&s.dupEn)?'中文名、英文名均重复':(s.dupZh?('中文名重复：'+n.data[i].key):('英文名重复：'+n.data[i].keyEn))});
    });
  });
  return dups;
}
// 导出前校验：全局信号「中文名/英文名」缺失或全局重复（英文名是信号键，缺失/重复→冲突，属严重问题，阻断导出）
function globalSignalNameReport(){
  const out=[]; const gi=globalSigIssues();
  (customSignals||[]).forEach((s,i)=>{
    const iss=gi[i]; if(fieldNameOk(iss))return;
    let reason;
    if(iss.emptyZh&&iss.emptyEn)reason='缺中文名和英文名';
    else if(iss.emptyZh)reason='缺中文名';
    else if(iss.emptyEn)reason='缺英文名';
    else if(iss.dupZh&&iss.dupEn)reason='中文名、英文名均重复';
    else if(iss.dupZh)reason='中文名重复：'+s.key;
    else reason='英文名重复：'+s.keyEn;
    out.push({idx:i+1, name:(s.key||s.keyEn||('信号'+(i+1))), reason});
  });
  return out;
}
// 在 JSON 面板顶部渲染导出校验横幅：ID 重复/为空 + 字段缺中英文名/重名 + 全局信号缺名/重名（红·硬性·阻断导出）+ 字段未绑定（黄·风险·仍可导出）
function renderBindRisk(){
  const el=document.getElementById('jbind-risk');if(!el)return;
  const {dups,emptyCount}=duplicateIdReport();
  const nameMiss=missingFieldNameReport();
  const nameDup=duplicateFieldNameReport();
  const sigBad=globalSignalNameReport();
  const miss=unboundBindingReport();
  if(!dups.length&&!emptyCount&&!nameMiss.length&&!nameDup.length&&!sigBad.length&&!miss.length){el.style.display='none';el.innerHTML='';return;}
  // 有 ID 冲突 / 字段缺名/重名 / 全局信号缺名/重名 → 整条横幅切成红色（严重·阻断导出）；否则保持黄色（风险·仍可导出）
  const severe=!!(dups.length||emptyCount||nameMiss.length||nameDup.length||sigBad.length);
  el.style.borderColor=severe?'#ff6b6b':'';
  el.style.background=severe?'rgba(255,107,107,.12)':'';
  let html='';
  if(dups.length||emptyCount){
    const parts=dups.map(d=>'· ID「'+tplEsc(d.id)+'」重复 '+d.count+' 次');
    if(emptyCount)parts.push('· 有 '+emptyCount+' 个节点 ID 为空');
    html+='<div style="color:#ff6b6b"><b>✕ 节点 ID 冲突：会造成信号键/dataBindings 冲突，已阻止导出，请先修正：</b>'+
      '<div style="margin-top:5px;max-height:120px;overflow:auto;font-size:12px;line-height:1.5">'+parts.join('<br>')+'</div></div>';
  }
  if(nameMiss.length){
    const items=nameMiss.map(m=>'· '+tplEsc(m.label+' ('+m.node+') · 第'+m.idx+'个字段：'+m.reason)).join('<br>');
    html+=(html?'<div style="height:8px"></div>':'')+
      '<div style="color:#ff6b6b"><b>✕ '+nameMiss.length+' 个数据字段缺中文名或英文名：英文名是端到端信号键，已阻止导出，请先补全：</b>'+
      '<div style="margin-top:5px;max-height:160px;overflow:auto;font-size:12px;line-height:1.5">'+items+'</div></div>';
  }
  if(nameDup.length){
    const items=nameDup.map(m=>'· '+tplEsc(m.label+' ('+m.node+') · 第'+m.idx+'个字段：'+m.reason)).join('<br>');
    html+=(html?'<div style="height:8px"></div>':'')+
      '<div style="color:#ff6b6b"><b>✕ '+nameDup.length+' 个数据字段名在同节点内重复：中/英文名需唯一（英文名重复会造成信号键冲突），已阻止导出，请先修正：</b>'+
      '<div style="margin-top:5px;max-height:160px;overflow:auto;font-size:12px;line-height:1.5">'+items+'</div></div>';
  }
  if(sigBad.length){
    const items=sigBad.map(m=>'· '+tplEsc('全局信号「'+m.name+'」：'+m.reason)).join('<br>');
    html+=(html?'<div style="height:8px"></div>':'')+
      '<div style="color:#ff6b6b"><b>✕ '+sigBad.length+' 个全局信号缺中/英文名或名称重复：英文名是信号键，需必填且全局唯一，已阻止导出，请先修正：</b>'+
      '<div style="margin-top:5px;max-height:160px;overflow:auto;font-size:12px;line-height:1.5">'+items+'</div></div>';
  }
  if(miss.length){
    const items=miss.map(m=>'· '+tplEsc(m.label+' ('+m.node+') → '+m.key+'：'+m.reason)).join('<br>');
    html+=(html?'<div style="height:8px"></div>':'')+
      '<b>⚠ '+miss.length+' 个字段未绑定后台字段，导出后无实时数据（仍可导出）</b>'+
      '<div style="margin-top:5px;max-height:160px;overflow:auto;font-size:12px;line-height:1.5">'+items+'</div>';
  }
  el.style.display='';el.innerHTML=html;
}
function refreshJSON(){document.getElementById('jout').textContent=buildJSON();renderBindRisk();}
function showJSON(){document.getElementById('jout').textContent=buildJSON();renderBindRisk();document.getElementById('jpanel').classList.add('show');
  const {dups,emptyCount}=duplicateIdReport();const nameMiss=missingFieldNameReport();const nameDup=duplicateFieldNameReport();const sigBad=globalSignalNameReport();const miss=unboundBindingReport();
  if(dups.length||emptyCount)flashHint(lang==='en'?'⚠ Duplicate/empty node IDs — fix before use':'✕ 存在重复/为空的节点 ID，会造成信号键冲突，请先修正');
  else if(nameMiss.length)flashHint(lang==='en'?('✕ '+nameMiss.length+' field(s) missing zh/en name — fix before export'):('✕ 有 '+nameMiss.length+' 个数据字段缺中文名或英文名，请先补全（英文名作信号键）'));
  else if(nameDup.length)flashHint(lang==='en'?('✕ '+nameDup.length+' duplicate field name(s) — fix before export'):('✕ 有 '+nameDup.length+' 个数据字段名在同节点内重复，请先修正（英文名重复会冲突）'));
  else if(sigBad.length)flashHint(lang==='en'?('✕ '+sigBad.length+' global signal name issue(s) — fix before export'):('✕ 有 '+sigBad.length+' 个全局信号缺中/英文名或名称重复，请先修正'));
  else if(miss.length)flashHint(lang==='en'?('Warning: '+miss.length+' field(s) not bound — export allowed'):('⚠ 有 '+miss.length+' 个数据字段未绑定后台字段（仍可导出）'));
}
function hideJSON(){document.getElementById('jpanel').classList.remove('show');}
// 节点 ID 唯一/非空是硬性要求：重复或为空时拦截导出（复制/下载），必须先修正
function blockExportForIds(){
  const {dups,emptyCount}=duplicateIdReport();
  if(dups.length||emptyCount){
    renderBindRisk();
    flashHint(lang==='en'?'Export blocked: duplicate/empty node IDs — fix first':'✕ 存在重复或为空的节点 ID，已阻止导出，请先修正');
    return true;
  }
  const nameMiss=missingFieldNameReport();
  if(nameMiss.length){
    renderBindRisk();
    flashHint(lang==='en'?('Export blocked: '+nameMiss.length+' field(s) missing zh/en name — fill first'):('✕ 有 '+nameMiss.length+' 个数据字段缺中文名或英文名，已阻止导出，请先补全'));
    return true;
  }
  const nameDup=duplicateFieldNameReport();
  if(nameDup.length){
    renderBindRisk();
    flashHint(lang==='en'?('Export blocked: '+nameDup.length+' duplicate field name(s) in a node — fix first'):('✕ 有 '+nameDup.length+' 个数据字段名在同节点内重复，已阻止导出，请先修正'));
    return true;
  }
  const sigBad=globalSignalNameReport();
  if(sigBad.length){
    renderBindRisk();
    flashHint(lang==='en'?('Export blocked: '+sigBad.length+' global signal name issue(s) — fix first'):('✕ 有 '+sigBad.length+' 个全局信号缺中/英文名或名称重复，已阻止导出，请先修正'));
    return true;
  }
  return false;
}
function copyJSON(){if(blockExportForIds())return;navigator.clipboard.writeText(buildJSON()).then(()=>{const b=document.querySelector('#jpa .tb');const o=b.textContent;b.textContent='✓ 已复制';setTimeout(()=>b.textContent=o,1500);});}
function dlJSON(){if(blockExportForIds())return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buildJSON()],{type:'application/json'}));a.download='topology.json';a.click();}

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
  // status / online 已移除：忽略旧文件里的 status 字段（向后兼容，不再读入节点）
  // 后台设备绑定（节点默认设备）
  if(o.deviceType)n.deviceType=o.deviceType;
  if(o.deviceId)n.deviceId=o.deviceId;
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
    const fld={key:(key.zh||''), keyEn:(key.en===''?'':(key.en||key.zh||'')), dv:dv, hidden:!!f.hidden,   // 显式空英文名保留为空；仅 en 缺省(旧数据)才兜底中文名
            ox:(+off.x||+f.ox||0), oy:(+off.y||+f.oy||0)};
    if(f.bind&&f.bind.field){
      // followNode=true（或旧格式缺省 device）→ 内部只存 field 保持「跟随节点」；否则固化显式来源
      if(f.bind.followNode||!(f.bind.deviceType||f.bind.deviceId)) fld.bind={field:f.bind.field};
      else fld.bind={field:f.bind.field, ...(f.bind.deviceType?{deviceType:f.bind.deviceType}:{}), ...(f.bind.deviceId?{deviceId:f.bind.deviceId}:{})};
    }
    return fld;
  });
  // 文本框 / 变量节点 共用的盒子样式（背景/边框/圆角/内边距）
  if(usesTextBox(o.type)){const t=o.textStyle||{};n.bg=t.bg||o.bg||'none';n.border=t.border||o.border||'none';
    n.borderColor=t.borderColor||o.borderColor||'#4dd0ff';n.borderWidth=(t.borderWidth!=null?t.borderWidth:(o.borderWidth!=null?o.borderWidth:1.5));
    n.radius=(t.radius!=null?t.radius:(o.radius!=null?o.radius:6));n.padX=(t.padX!=null?t.padX:(o.padX!=null?o.padX:10));n.padY=(t.padY!=null?t.padY:(o.padY!=null?o.padY:6));
    const oldBind=t.bind||o.textBind;
    if(oldBind&&!n.data.length)n.data=[{key:String(oldBind).split('.').pop()||'数值',keyEn:'Value',dv:''}];
    if(!n.data.length)n.data=[{key:'数值',keyEn:'Value',dv:''}];}
  // 变量节点：label / value 两段字体属性 + 排列方式
  if(o.type==='variable'){const vs=o.variableStyle||{};const lb=vs.label||{},vl=vs.value||{};
    n.varLayout=(vs.layout==='vertical'||vs.layout==='v')?'v':'h';
    n.fontSize=(lb.fontSize!=null?lb.fontSize:(o.fontSize||16));n.fontColor=lb.color||o.fontColor||'#e8f4ff';n.labelBold=(lb.bold!==false);
    n.valFontSize=(vl.fontSize!=null?vl.fontSize:n.fontSize);n.valColor=vl.color||'#4dd0ff';n.valBold=!!vl.bold;}
  // 占位点样式
  if(o.type==='anchor'){const a=o.anchorStyle||{};n.fill=a.fill||o.fill||'none';n.opacity=(a.opacity!=null?a.opacity:(o.opacity!=null?o.opacity:1));}
  if(o.action&&o.action.url)n.action={trigger:o.action.trigger||'click',url:String(o.action.url),target:(o.action.target==='blank'?'blank':'same')};
  if(o.visibleWhen!=null)n.visibleWhen=o.visibleWhen;   // ★ 数据驱动：显示条件
  if(Array.isArray(o.iconRules)&&o.iconRules.length)n.iconRules=o.iconRules.filter(r=>r&&r.icon).map(r=>({when:r.when,icon:r.icon}));   // ★ 数据驱动：图标规则
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
// ───── 旧数据迁移：历史规则/样例信号的信号键曾用「中文字段名」，统一改为「英文字段名」 ─────
// 依据当前节点字段构建 id.中文 → id.英文 映射；只改能命中该映射的键，英文键/全局信号原样保留（幂等）。
function buildZhToEnSigMap(nodeList){
  const map={};
  (nodeList||[]).forEach(n=>{(n.data||[]).forEach(f=>{
    const zh=f.key, en=f.keyEn;
    if(zh&&en&&zh!==en) map[n.id+'.'+zh]=n.id+'.'+en;
  });});
  return map;
}
function migrateCondSignals(cond,map){
  if(cond==null||typeof cond!=='object')return cond;
  if(Array.isArray(cond.all))cond.all.forEach(c=>migrateCondSignals(c,map));
  else if(Array.isArray(cond.any))cond.any.forEach(c=>migrateCondSignals(c,map));
  else if(cond.not!=null)migrateCondSignals(cond.not,map);
  else{
    if(cond.var!=null&&map[cond.var])cond.var=map[cond.var];
    if(cond.ref!=null&&map[cond.ref])cond.ref=map[cond.ref];
  }
  return cond;
}
function migrateSignalKeys(nodeList,edgeList){
  const map=buildZhToEnSigMap(nodeList);
  if(!Object.keys(map).length)return map;
  (nodeList||[]).forEach(n=>{
    if(n.visibleWhen!=null)migrateCondSignals(n.visibleWhen,map);
    if(Array.isArray(n.iconRules))n.iconRules.forEach(r=>r&&migrateCondSignals(r.when,map));
  });
  (edgeList||[]).forEach(e=>{
    if(e.showWhen!=null)migrateCondSignals(e.showWhen,map);
    if(Array.isArray(e.dirRules))e.dirRules.forEach(r=>r&&migrateCondSignals(r.when,map));
  });
  return map;
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
  customSignals=(Array.isArray(obj.signals)?obj.signals:[]).map(normalizeSignal).filter(Boolean);
  signalValues={};injRows=[];injDraft=null;_injInited=false;
  // 2) 还原节点 / 连线（仅保留两端节点都存在的连线）
  const newNodes=obj.nodes.map(parseImportedNode).filter(Boolean);
  const idSet=new Set(newNodes.map(n=>n.id));
  const newEdges=(Array.isArray(obj.edges)?obj.edges:[]).map(parseImportedEdge)
    .filter(e=>e&&idSet.has(e.from)&&idSet.has(e.to));
  // 2.1) 旧数据迁移：把规则条件里「中文字段名」信号键统一改为「英文字段名」（幂等；返回 id.中文→id.英文 映射供样例信号迁移）
  const _sigMap=migrateSignalKeys(newNodes,newEdges);
  // 3) 应用状态
  snapshot();
  nodes=newNodes; edges=newEdges;
  normalizeEdgePorts(edges);
  selNode=selEdge=null; selSet.clear(); selChips.clear();
  // 还原注入的样例信号值（sampleSignals）→ 重建注入行
  if(obj.sampleSignals&&typeof obj.sampleSignals==='object'){
    Object.keys(obj.sampleSignals).forEach(k=>{const mk=_sigMap[k]||k;const ps=parseSignal(mk);injRows.push({node:ps.node,field:ps.field,val:obj.sampleSignals[k]});});
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
  invalidateRouting();
  updateAlignBar();
  history=[];histIdx=-1;snapshot();
  if(panelOpen)renderSimPanel();
  const missing=[...new Set(nodes.filter(n=>String(n.type).startsWith('custom_')&&!iconSrcOf(n.type)).map(n=>n.type))];
  let msg=(lang==='en'?'Imported ':'已导入 ')+nodes.length+(lang==='en'?' nodes, ':' 个节点、')+edges.length+(lang==='en'?' edges':' 条连线');
  if(missing.length)msg+=(lang==='en'?(' · '+missing.length+' custom icon(s) missing, re-upload in library'):('（'+missing.length+' 个自定义图标缺失，请在元素库重新上传）'));
  flashHint(msg);
}

