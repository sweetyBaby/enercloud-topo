// ───── 正交布线 ─────
// 布线引擎（A* 路由 / 通道布线 / 汇流合并 / 交叉消除）已抽到
// packages/topology-runtime（headless 单一事实源），经 04-geometry 的接线层
// 以原函数名（edgePath / channelRoute / recomputeAllPaths / applyBusMerge …）落回全局。
// 本文件只保留纯编辑态的布线辅助。

// 手动拐点质量控制：若手动路径明显比自动路径绕（分数超阈值），丢弃拐点退回智能走线
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
