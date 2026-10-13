const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const context=vm.createContext({});
vm.runInContext(html.match(/<script id="geometry">([\s\S]*?)<\/script>/)[1]+'\nglobalThis.api={Geometry,ShapeGenerator};',context);
const {Geometry:G,ShapeGenerator:S}=context.api;
const rectangle=[{x:0,y:0},{x:100,y:0},{x:100,y:80},{x:0,y:80}];
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
near(G.area(rectangle),8000);
for(const [a,b] of [[{x:50,y:-10},{x:50,y:90}],[{x:-10,y:40},{x:110,y:40}],[{x:0,y:0},{x:100,y:80}]]){
 const r=G.split(rectangle,a,b);near(r.percent,50);near(r.a1+r.a2,8000);
}
assert.equal(G.split(rectangle,{x:0,y:0},{x:100,y:0}),null);
assert.equal(G.split(rectangle,{x:120,y:0},{x:120,y:80}),null);
assert.equal(G.split(rectangle,{x:50,y:40},{x:50,y:40}),null);
near(G.split(rectangle,{x:25,y:-1},{x:25,y:81}).error,25);
assert.equal(G.intersections(rectangle,{x:0,y:0},{x:100,y:80}).length,2);
const cShape=[{x:140,y:120},{x:500,y:120},{x:500,y:220},{x:260,y:220},{x:260,y:460},{x:500,y:460},{x:500,y:560},{x:140,y:560}];
assert.ok(G.valid(cShape),'凹 C 形轮廓应当有效');
const cLineA={x:350,y:80},cLineB={x:350,y:600},cSegments=G.segments(cShape,cLineA,cLineB);
assert.equal(cSegments.length,2,'凹 C 形竖切应产生两段实际交线');
const cCut=G.split(cShape,cLineA,cLineB);
assert.ok(cCut&&cCut.leftParts.length>1&&cCut.rightParts.length>1,'凹切割应保留多个无重叠裁剪片');
near(cCut.a1+cCut.a2,G.area(cShape),1e-7);
near(G.area(cCut.leftParts),cCut.a1,1e-7);near(G.area(cCut.rightParts),cCut.a2,1e-7);
assert.equal(G.triangulate(cShape).length,cShape.length-2,'凹 C 形应完成 n-2 耳切三角剖分');
near(G.triangulate(cShape).reduce((sum,triangle)=>sum+G.area(triangle),0),G.area(cShape),1e-7);
// 带共线边界点的凹轮廓：共线点不能让耳切漏掉面积，也不能制造重复边。
const collinearShape=[{x:140,y:140},{x:320,y:140},{x:500,y:140},{x:500,y:260},{x:300,y:260},{x:300,y:460},{x:500,y:460},{x:500,y:580},{x:140,y:580}];
assert.ok(G.valid(collinearShape),'带共线边界点的凹轮廓应当有效');
const collinearTriangles=G.triangulate(collinearShape);
near(collinearTriangles.reduce((sum,triangle)=>sum+G.area(triangle),0),G.area(collinearShape),1e-7);
near(G.area(G.clip(collinearShape,{x:340,y:40},{x:340,y:680},1))+G.area(G.clip(collinearShape,{x:340,y:40},{x:340,y:680},-1)),G.area(collinearShape),1e-7);
assert.equal(G.split(collinearShape,{x:140,y:140},{x:500,y:140}),null,'贴边相切线不能算有效切割');
assert.ok(!G.valid([{x:140,y:120},{x:500,y:560},{x:500,y:120},{x:140,y:560}]),'自交轮廓不能通过有效性检查');

// 用实际四种动物轮廓比较 16 点与 32 点曲线采样，覆盖竖直、水平和斜向多位置，
// 要求同一条切线的面积百分比收敛到 0.1 个百分点以内。
function bounds(points){const xs=points.map(point=>point.x),ys=points.map(point=>point.y);return{cx:(Math.min(...xs)+Math.max(...xs))/2,cy:(Math.min(...ys)+Math.max(...ys))/2,w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};}
function convergenceLines(points){const {cx,cy,w,h}=bounds(points),reach=Math.max(w,h)*3;return[
  [{x:cx-.23*w,y:cy-reach},{x:cx-.23*w,y:cy+reach}],
  [{x:cx+.19*w,y:cy-reach},{x:cx+.19*w,y:cy+reach}],
  [{x:cx-reach,y:cy-.17*h},{x:cx+reach,y:cy-.17*h}],
  [{x:cx-reach,y:cy+.21*h},{x:cx+reach,y:cy+.21*h}],
  [{x:cx-reach,y:cy-reach*.62},{x:cx+reach,y:cy+reach*.62}],
  [{x:cx-reach,y:cy+reach*.58},{x:cx+reach,y:cy-reach*.58}],
];}
assert.equal(Array.from(S.kinds).sort().join(','),['猫','兔','鸭','鱼'].sort().join(','),'动物轮廓种类必须固定为四种');
for(const kind of S.kinds){
  const low=S.sampleOutline(kind,16),high=S.sampleOutline(kind,32);
  assert.equal(low.length*2,high.length,`${kind} 高密度采样点数不为 2 倍`);
  let compared=0;
  for(const [a,b] of convergenceLines(low)){
    const lowCut=G.split(low,a,b),highBounds=bounds(high);
    // 将切线按低密度轮廓的相对位置映射到高密度轮廓，避免端点密度改变测试位置。
    const lowBounds=bounds(low),u=(a.x-lowBounds.cx)/(lowBounds.w||1),v=(a.y-lowBounds.cy)/(lowBounds.h||1),u2=(b.x-lowBounds.cx)/(lowBounds.w||1),v2=(b.y-lowBounds.cy)/(lowBounds.h||1);
    const highA={x:highBounds.cx+u*highBounds.w,y:highBounds.cy+v*highBounds.h},highB={x:highBounds.cx+u2*highBounds.w,y:highBounds.cy+v2*highBounds.h};
    const highCut=G.split(high,highA,highB);
    assert.ok(lowCut&&highCut,`${kind} 曲线收敛测试切线未有效穿过轮廓`);
    assert.ok(Math.abs(lowCut.percent-highCut.percent)<.1,`${kind} 曲线采样收敛不足：${lowCut.percent} / ${highCut.percent}`);
    compared++;
  }
  assert.equal(compared,6);
}

let seed=5050;
const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
let validCuts=0,balancedChecks=0,kindCounts={},familyCounts={};
for(let i=0;i<12000;i++){
 const round=1+Math.floor(rng()*200),p=S.generate(round,rng);
 assert.ok(G.valid(p),`第 ${i} 个图形无效，回合 ${round}`);
 if(round<=3||round%2===1){assert.equal(p.family,'polygon',`回合 ${round} 应生成多边形族`);if(round<=3)assert.equal(p.length,4);else assert.ok(p.length>=4&&p.length<=8,`不规则多边形顶点数异常：${p.length}`);}
 else {assert.equal(p.family,'curve',`回合 ${round} 应生成曲边族`);assert.ok(p.length>=144&&p.length<=208,`曲线轮廓顶点数异常：${p.length}`);assert.ok(typeof p.kind==='string'&&p.kind.length>0);kindCounts[p.kind]=(kindCounts[p.kind]||0)+1;}
 familyCounts[p.family]=(familyCounts[p.family]||0)+1;
 const a={x:rng()*1000,y:rng()*800},b={x:rng()*1000,y:rng()*800};
 near(G.area(G.clip(p,a,b,1))+G.area(G.clip(p,a,b,-1)),G.area(p),1e-6);
 const r=G.split(p,a,b);
 if(r){validCuts++;near(r.a1+r.a2,G.area(p),1e-6);near(G.area(r.leftParts),r.a1,1e-7);near(G.area(r.rightParts),r.a2,1e-7);const reversed=G.split(p,b,a);near(reversed.percent,100-r.percent,1e-7);}
 // 每个固定种子轮廓都用 45 次二分验证真实面积平分，误差保持在 1e-7 个百分点内。
 {let lo=0,hi=1000;for(let n=0;n<45;n++){const x=(lo+hi)/2;const fraction=G.area(G.clip(p,{x,y:0},{x,y:800},1))/G.area(p);if(fraction<.5)lo=x;else hi=x;}const x=(lo+hi)/2;near(G.split(p,{x,y:0},{x,y:800}).percent,50,1e-7);balancedChecks++;}
}
assert.equal(Object.keys(kindCounts).sort().join(','),['猫','兔','鸭','鱼'].sort().join(','),`动物轮廓种类不足：${Object.keys(kindCounts).join('、')}`);
assert.ok(familyCounts.curve>0&&familyCounts.polygon>0,'固定种子未覆盖曲边与多边形族');
assert.equal(S.difficulty(1).tolerance,6);assert.equal(S.difficulty(1).seconds,12);assert.equal(S.difficulty(4).tolerance,4);assert.equal(S.difficulty(4).seconds,9);assert.equal(S.difficulty(9).tolerance,3);assert.equal(S.difficulty(9).seconds,7.5);assert.equal(S.difficulty(999).seconds,4.5);
console.log(`通过：矩形、凹 C 形多交段、多块裁剪、零长/相切、四种动物 16/32 点曲线采样收敛；12000 个固定种子轮廓、面积守恒、${validCuts} 次有效随机切割、${balancedChecks} 条面积平分线；动物种类：${Object.keys(kindCounts).join('、')}；族：${JSON.stringify(familyCounts)}。`);
vm.runInContext(html.match(/<script id="scoring">([\s\S]*?)<\/script>/)[1]+'\nglobalThis.scoring=Scoring;',context);
const scoring=context.scoring;
for(const [e,label] of [[0,'PERFECT'],[.5,'PERFECT'],[.5001,'EXCELLENT'],[2,'EXCELLENT'],[2.0001,'PASS'],[8,'PASS'],[8.0001,'MISS']])assert.equal(scoring.evaluate(e,8,0).verdict,label);
assert.equal(scoring.evaluate(0,8,0).points,1000);assert.equal(scoring.evaluate(0,8,10).points,2000);assert.equal(scoring.evaluate(0,8,100).points,2000);
assert.equal(scoring.evaluate(9,8,10).combo,0);assert.equal(scoring.evaluate(9,8,10).points,0);
for(let combo=0;combo<20;combo++){let last=Infinity;for(let e=0;e<=8;e+=.01){const pts=scoring.evaluate(e,8,combo).points;assert.ok(pts<=last);last=pts;}}
assert.ok(!/<script[^>]+src=|<link[^>]+href=|@import|url\(\s*["']?https?:/i.test(html));
for(const block of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(block[1]);
console.log('通过：计分阈值、倍率上限、得分单调性、JavaScript 语法与完全内联的运行文件。');
