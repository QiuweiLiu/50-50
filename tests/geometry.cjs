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
let seed=5050;
const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
let validCuts=0;
for(let i=0;i<12000;i++){
 const round=1+Math.floor(rng()*200),p=S.generate(round,rng);
 assert.ok(G.valid(p),`第 ${i} 个图形无效，回合 ${round}`);
 if(round>8)assert.ok(p.length>=5&&p.length<=8);
 const a={x:rng()*1000,y:rng()*800},b={x:rng()*1000,y:rng()*800};
 near(G.area(G.clip(p,a,b,1))+G.area(G.clip(p,a,b,-1)),G.area(p),1e-6);
 const r=G.split(p,a,b);
 if(r){validCuts++;near(r.a1+r.a2,G.area(p),1e-6);const reversed=G.split(p,b,a);near(reversed.percent,100-r.percent);}
 // 用二分法验证竖直面积平分线存在，不依赖图形质心。
 let lo=0,hi=1000;
 for(let n=0;n<45;n++){const x=(lo+hi)/2;const fraction=G.area(G.clip(p,{x,y:0},{x,y:800},1))/G.area(p);if(fraction<.5)lo=x;else hi=x;}
 const x=(lo+hi)/2;near(G.split(p,{x,y:0},{x,y:800}).percent,50,1e-7);
}
assert.equal(S.difficulty(1).tolerance,8);assert.equal(S.difficulty(4).tolerance,6);assert.equal(S.difficulty(9).tolerance,5);assert.equal(S.difficulty(999).seconds,7);
console.log(`通过：矩形、顶点、相切及退化情况检查；12000 个固定种子凸图形、面积守恒、${validCuts} 次有效随机切割与 12000 条面积平分线。`);
vm.runInContext(html.match(/<script id="scoring">([\s\S]*?)<\/script>/)[1]+'\nglobalThis.scoring=Scoring;',context);
const scoring=context.scoring;
for(const [e,label] of [[0,'PERFECT'],[.5,'PERFECT'],[.5001,'EXCELLENT'],[2,'EXCELLENT'],[2.0001,'PASS'],[8,'PASS'],[8.0001,'MISS']])assert.equal(scoring.evaluate(e,8,0).verdict,label);
assert.equal(scoring.evaluate(0,8,0).points,1000);assert.equal(scoring.evaluate(0,8,10).points,2000);assert.equal(scoring.evaluate(0,8,100).points,2000);
assert.equal(scoring.evaluate(9,8,10).combo,0);assert.equal(scoring.evaluate(9,8,10).points,0);
for(let combo=0;combo<20;combo++){let last=Infinity;for(let e=0;e<=8;e+=.01){const pts=scoring.evaluate(e,8,combo).points;assert.ok(pts<=last);last=pts;}}
assert.ok(!/<script[^>]+src=|<link[^>]+href=|@import|url\(\s*["']?https?:/i.test(html));
for(const block of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(block[1]);
console.log('通过：计分阈值、倍率上限、得分单调性、JavaScript 语法与完全内联的运行文件。');
