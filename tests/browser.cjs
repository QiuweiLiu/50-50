const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {homedir}=require('node:os');
const playwrightModules=process.env.PLAYWRIGHT_NODE_MODULES||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=require(path.join(playwrightModules,'playwright'));
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
function countFireworkPixels(){const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2];if(data[i+3]>20&&r-g>5&&r-g<45&&g-b>12)count++;}return count;}
const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||path.join(homedir(),'Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium');
const url=process.env.GAME_URL||pathToFileURL(path.join(root,'index.html')).href;
fs.mkdirSync(path.join(root,'outputs/browser'),{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath,headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2});
  if(!process.env.GAME_URL)await context.setOffline(true);
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
  await page.clock.install({time:new Date('2026-10-12T05:00:00Z')});await page.clock.pauseAt(new Date('2026-10-12T05:00:01Z'));await page.goto(url);await page.clock.runFor(50);
  await page.screenshot({path:path.join(root,'outputs/browser/desktop-home.png'),fullPage:true});
  assert.equal(await page.locator('#start').isVisible(),true);assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');assert.ok((await page.locator('#start').textContent()).includes('开始挑战'));
  await page.locator('#start').click();await page.clock.runFor(50);
  assert.equal(await page.evaluate(()=>state.phase),'playing');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'桌面游戏界面须完整显示在首屏');
  assert.equal(await page.locator('#sound-button').getAttribute('aria-label'),'音效');assert.equal(await page.locator('#sound-button').getAttribute('aria-pressed'),'true');await page.locator('#sound-button').click();assert.equal(await page.locator('#sound-button').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#sound-button').getAttribute('aria-label'),'音效');await page.locator('#sound-button').click();
  const mapped=await page.evaluate(()=>{const r=canvas.getBoundingClientRect();return{rect:{x:r.x,y:r.y},scale:view.scale,x:view.x,y:view.y};});
  const screen=(x,y)=>({x:mapped.rect.x+mapped.x+x*mapped.scale,y:mapped.rect.y+mapped.y+y*mapped.scale});
  async function drag(a,b){await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();}
  const short=screen(500,400);await drag(short,{x:short.x+3,y:short.y});
  assert.equal(await page.evaluate(()=>state.phase),'playing');assert.equal(await page.evaluate(()=>state.lives),3);
  await drag({x:mapped.rect.x+8,y:mapped.rect.y+55},{x:mapped.rect.x+8,y:mapped.rect.y+120});assert.equal(await page.evaluate(()=>state.phase),'playing');
  await drag(screen(500,220),screen(500,580));
  assert.equal(await page.evaluate(()=>state.phase),'reveal');assert.equal(await page.evaluate(()=>state.judgment.verdict),'PERFECT');
  assert.equal(await page.evaluate(()=>state.score),1000);assert.equal(await page.evaluate(()=>state.combo),1);assert.equal(await page.locator('#verdict').textContent(),'完美平分');
  await page.clock.runFor(750);assert.ok(await page.evaluate(countFireworkPixels)>20,'完美判定应显示克制烟花');await page.screenshot({path:path.join(root,'outputs/browser/desktop-perfect.png'),fullPage:true});
  await page.locator('#help-button').click();assert.equal(await page.evaluate(()=>state.phase),'paused');
  await page.clock.runFor(20000);assert.equal(await page.evaluate(()=>state.round),1);assert.equal(await page.evaluate(()=>state.lives),3);
  await page.locator('#help-done').click();await page.clock.runFor(50);assert.equal(await page.evaluate(()=>state.phase),'reveal');
  const before=await page.evaluate(()=>state.score);await drag(screen(500,220),screen(500,580));assert.equal(await page.evaluate(()=>state.score),before);
  await page.clock.runFor(1200);assert.equal(await page.evaluate(()=>state.round),2);
  await page.screenshot({path:path.join(root,'outputs/browser/desktop-game.png'),fullPage:true});
  await page.locator('#pause-button').click();const remaining=await page.evaluate(()=>state.remaining);await page.clock.runFor(25000);assert.equal(await page.evaluate(()=>state.remaining),remaining);assert.equal(await page.evaluate(()=>state.lives),3);
  await page.locator('#resume').click();assert.equal(await page.evaluate(()=>state.phase),'playing');
  await page.locator('#help-button').click();assert.equal(await page.evaluate(()=>state.phase),'paused');await page.locator('#help-done').click();await page.clock.runFor(50);assert.equal(await page.evaluate(()=>state.phase),'playing');
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange'))); // 页面仍可见时，该事件不应暂停游戏
  assert.equal(await page.evaluate(()=>state.phase),'playing');
  // 用浏览器虚拟时钟验证三次超时，包括揭晓阶段的状态转换。
  for(let i=0;i<3;i++){const remaining=await page.evaluate(()=>state.remaining*1000);await page.clock.runFor(remaining+1600);if(i<2)assert.equal(await page.evaluate(()=>state.lives),2-i);}
  assert.equal(await page.evaluate(()=>state.phase),'over');assert.equal(await page.locator('#retry').isVisible(),true);
  await page.screenshot({path:path.join(root,'outputs/browser/desktop-end.png'),fullPage:true});
  await page.locator('#retry').click();assert.equal(await page.evaluate(()=>state.lives),3);assert.equal(await page.evaluate(()=>state.round),1);assert.equal(await page.evaluate(()=>state.score),0);
  // 失败切割清空连击，刷新后仍保留已保存的纪录。
  await page.evaluate(()=>{state.combo=4;submitCut({x:state.poly[0].x+10,y:0},{x:state.poly[0].x+10,y:800});});
  assert.equal(await page.evaluate(()=>state.judgment.verdict),'MISS');assert.equal(await page.evaluate(()=>state.combo),0);assert.equal(await page.evaluate(()=>state.lives),2);
  await page.reload();await page.clock.runFor(50);assert.equal(await page.evaluate(()=>state.records.score),1000);
  await page.locator('#start').click();await page.clock.runFor(50);await page.locator('#canvas').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>state.phase),'reveal');
  assert.equal(await page.evaluate(()=>state.judgment.verdict),'PERFECT');
  // 用真实鼠标在放大的后期图形上完成已知面积切割，验证逆变换与分级反馈。
  for(const [target,verdict,css] of [[51,'EXCELLENT','excellent'],[52.5,'PASS','pass'],[62,'MISS','miss']]){
   await page.evaluate(()=>{startRun();state.round=9;nextRound();});
   const line=await page.evaluate(target=>{const ys=state.poly.map(p=>p.y),y1=Math.min(...ys)-12,y2=Math.max(...ys)+12;let low=140,high=860;for(let i=0;i<60;i++){const x=(low+high)/2,percent=Geometry.area(Geometry.clip(state.poly,{x,y:y1},{x,y:y2},true))/Geometry.area(state.poly)*100;if(percent<target)low=x;else high=x;}const x=(low+high)/2,r=canvas.getBoundingClientRect();return {a:{x:r.x+view.x+x*view.scale,y:r.y+view.y+y1*view.scale},b:{x:r.x+view.x+x*view.scale,y:r.y+view.y+y2*view.scale}};},target);
   await drag(line.a,line.b);assert.equal(await page.evaluate(()=>state.judgment.verdict),verdict);assert.ok(Math.abs(await page.evaluate(()=>state.cut.percent)-target)<.01);assert.ok(await page.locator('#reveal').evaluate((el,css)=>el.classList.contains(css),css));
   if(verdict==='MISS')assert.equal(await page.evaluate(()=>state.lives),2);
  }
  // 每局只入榜一次；退出揭晓/暂停/拖动状态时复位，并保留本机排行。
  await page.locator('#exit-button').click();assert.equal(await page.evaluate(()=>state.phase),'home');assert.equal(await page.evaluate(()=>state.records.runs.length),2);
  await page.locator('#leaderboard-button').click();assert.equal(await page.locator('#leaderboard').evaluate(el=>el.open),true);assert.equal(await page.locator('#rank-list li').count(),2);assert.equal(await page.locator('#rank-list strong').first().textContent(),'1,000');await page.locator('#leaderboard-done').click();
  await page.reload();await page.clock.runFor(50);assert.equal(await page.evaluate(()=>state.records.runs.length),2);
  await page.locator('#start').click();await page.clock.runFor(50);await page.locator('#leaderboard-button').click();assert.equal(await page.evaluate(()=>state.phase),'paused');const frozen=await page.evaluate(()=>state.remaining);await page.clock.runFor(20000);assert.equal(await page.evaluate(()=>state.remaining),frozen);await page.keyboard.press('Escape');await page.clock.runFor(50);assert.equal(await page.evaluate(()=>state.phase),'playing');
  await page.locator('#pause-button').click();await page.locator('#exit-button').click();assert.equal(await page.evaluate(()=>state.phase),'home');assert.equal(await page.evaluate(()=>state.records.runs.length),3);
  await page.locator('#start').click();await page.clock.runFor(9100);assert.equal(await page.locator('#clock').evaluate(el=>el.classList.contains('urgent')),true);await page.locator('#exit-button').click();assert.equal(await page.evaluate(()=>state.records.runs.length),4);
  // 后期曲边形真实渲染与多段预览；烟花只能由完美判定触发且不干扰游戏状态。
  await page.evaluate(()=>{startRun();state.round=12;nextRound();});await page.clock.runFor(50);await page.screenshot({path:path.join(root,'outputs/browser/desktop-animal.png'),fullPage:true});
  const curved=await page.evaluate(()=>({name:state.poly.kind,vertices:state.poly.length,seconds:state.difficulty.seconds}));assert.ok(curved.name&&curved.vertices>30);assert.ok(curved.seconds<8);
  await page.evaluate(()=>{state.round=13;nextRound();});assert.equal(await page.evaluate(()=>state.poly.family),'polygon');assert.ok(await page.evaluate(()=>state.poly.length>=4&&state.poly.length<=8));
  await page.evaluate(()=>{state.round=14;nextRound();});assert.equal(await page.evaluate(()=>state.poly.family),'curve');
  await page.locator('#exit-button').click();
  assert.deepEqual(errors,[]);if(!process.env.GAME_URL)assert.deepEqual(external,[]);
  // 验证真实触摸事件、手势取消、移动坐标映射与窗口缩放。
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});if(!process.env.GAME_URL)await mobile.setOffline(true);
  const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));await mp.clock.install({time:new Date('2026-10-12T05:00:00Z')});await mp.clock.pauseAt(new Date('2026-10-12T05:00:01Z'));await mp.goto(url);await mp.clock.runFor(50);
  await mp.screenshot({path:path.join(root,'outputs/browser/mobile-home.png'),fullPage:true});
  for(const size of [{width:320,height:568},{width:375,height:667},{width:390,height:844}]){await mp.setViewportSize(size);await mp.clock.runFor(50);assert.ok(await mp.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'手机首页应在首屏显示预览与按钮');}
  await mp.setViewportSize({width:390,height:844});await mp.clock.runFor(50);
  assert.ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mp.locator('#start').tap();await mp.clock.runFor(50);
  assert.ok(await mp.evaluate(()=>Math.abs(canvas.width-canvas.getBoundingClientRect().width*devicePixelRatio)<=1));
  const coordinates=await mp.evaluate(()=>{const r=canvas.getBoundingClientRect();return{x:r.x+view.x+500*view.scale,y1:r.y+view.y+220*view.scale,y2:r.y+view.y+580*view.scale};});
  const cdp=await mobile.newCDPSession(mp);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:coordinates.x,y:coordinates.y1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:coordinates.x,y:coordinates.y2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await mp.evaluate(()=>state.judgment.verdict),'PERFECT');assert.equal(await mp.evaluate(()=>scrollY),0);
  await mp.clock.runFor(700);await mp.evaluate(()=>{Renderer.draw(performance.now());Renderer.fireworks(performance.now());});await mp.screenshot({path:path.join(root,'outputs/browser/mobile-perfect.png'),fullPage:true});
  assert.ok(await mp.evaluate(()=>{const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let filled=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])filled++;return filled>1000;}),'截图触发缩放后，手机画布仍须显示几何图形');
  await mp.clock.runFor(1200);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:coordinates.x,y:coordinates.y1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.equal(await mp.evaluate(()=>input.pointerId),null);assert.equal(await mp.evaluate(()=>state.phase),'playing');assert.equal(await mp.evaluate(()=>state.lives),3);
  for(const size of [{width:320,height:568},{width:375,height:667},{width:768,height:1024},{width:844,height:390}]){
   await mp.setViewportSize(size);await mp.clock.runFor(50);assert.ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`宽度 ${size.width} 的视口横向溢出`);
   const result=await mp.evaluate(()=>{const rect=canvas.getBoundingClientRect(),p={x:500,y:400};const e={clientX:rect.x+view.x+p.x*view.scale,clientY:rect.y+view.y+p.y*view.scale};return mapPointer(e);});
   assert.ok(Math.abs(result.x-500)<1e-7&&Math.abs(result.y-400)<1e-7);
   if(size.height>size.width&&size.width<=390)assert.ok(await mp.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),`尺寸 ${size.width}×${size.height} 的视口纵向溢出`);
   if(size.width===320){await mp.screenshot({path:path.join(root,'outputs/browser/mobile-small.png'),fullPage:true});await mp.evaluate(()=>{state.records.runs=Array.from({length:10},(_,i)=>({score:1000+i*100,round:10+i,combo:i,at:Date.now()+i,reason:'结束'}));});await mp.locator('#leaderboard-button').tap();assert.equal(await mp.locator('#rank-list li').count(),10);assert.ok(await mp.locator('#leaderboard').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight+1&&el.scrollHeight>el.clientHeight),'小屏十行排行榜应可在对话框内滚动');await mp.locator('#leaderboard-done').click();await mp.clock.runFor(50);assert.equal(await mp.evaluate(()=>state.phase),'playing');}
  }
  const blocked=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});if(!process.env.GAME_URL)await blocked.setOffline(true);
  await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('存储已禁用','SecurityError');}}));
  const bp=await blocked.newPage();bp.on('pageerror',e=>errors.push(e.message));await bp.clock.install({time:new Date('2026-10-12T05:00:00Z')});await bp.clock.pauseAt(new Date('2026-10-12T05:00:01Z'));await bp.goto(url);await bp.clock.runFor(50);await bp.locator('#start').click();
  await bp.locator('#canvas').focus();await bp.keyboard.press('Enter');assert.equal(await bp.evaluate(()=>state.score),1000);assert.equal(await bp.locator('#footer-note').textContent(),'存储不可用，纪录仅在本次会话保留。');
  await bp.clock.runFor(300);assert.equal(await bp.evaluate(countFireworkPixels),0,'减少动态偏好应停用烟花');await bp.clock.runFor(850);assert.equal(await bp.evaluate(()=>state.round),2);await bp.locator('#exit-button').click();assert.equal(await bp.evaluate(()=>state.records.runs.length),1);await bp.locator('#leaderboard-button').click();assert.equal(await bp.locator('#rank-list li').count(),1);assert.ok((await bp.locator('#rank-summary').textContent()).includes('仅本次会话保留'));await bp.locator('#leaderboard-done').click();
  assert.deepEqual(errors,[]);
  console.log('通过：桌面与手机 Chromium（默认离线，GAME_URL 指定线上）；鼠标、触摸和键盘切割；无效手势、取消及揭晓期间的输入限制；暂停、说明、超时、退出、结束与重试；本机排行、十行小屏滚动、存储与刷新；曲边轮廓、完美烟花与减少动态偏好；高像素密度；320/375/390/768/844 宽度；减少动态效果；无运行错误；离线模式无外部请求。');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
