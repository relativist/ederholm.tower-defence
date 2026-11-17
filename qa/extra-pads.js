async (page) => {
 const context=await page.context().browser().newContext({viewport:{width:1440,height:960}});
 const desktop=await context.newPage(),errors=[];desktop.on('pageerror',e=>errors.push(e.message));
 await desktop.goto('http://127.0.0.1:8774/index.html');await desktop.locator('[data-action="new-game"]').click();
 const validation=await desktop.evaluate(()=>{
  const old=[[80,285],[220,290],[260,510],[280,365],[425,325],[470,160],[485,420],[645,355],[670,555],[710,230],[870,240],[865,415],[425,535],[70,515],[900,70],[275,175]];
  const preserved=old.every(([x,y],i)=>TD.PADS[i].x===x&&TD.PADS[i].y===y);
  const buildable=TD.PADS.every((p,i)=>{const g=new TD.Game(),r=g.build('archer',i);return r.ok&&TD.Game.restore(g.serialize()).towers[0].pad===i;});
  let spacing=Infinity;for(let i=0;i<TD.PADS.length;i++)for(let j=i+1;j<TD.PADS.length;j++)spacing=Math.min(spacing,Math.hypot(TD.PADS[i].x-TD.PADS[j].x,TD.PADS[i].y-TD.PADS[j].y));
  return{count:TD.PADS.length,preserved,buildable,minimumSpacing:spacing};
 });
 if(validation.count!==40||!validation.preserved||!validation.buildable)throw Error('Pad validation failed');
 const place=async(p,i)=>{await p.locator('.build-card[data-id="archer"]').click();const q=await p.evaluate(i=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=elderholm.view,p=TD.PADS[i];return{x:r.x+v.x+p.x*v.scale,y:r.y+v.y+p.y*v.scale};},i);await p.mouse.click(q.x,q.y);if(!await p.evaluate(i=>elderholm.game.towers.some(t=>t.pad===i),i))throw Error(`Cannot select pad ${i}`);};
 for(const i of [16,27,39,18])await place(desktop,i);
 await desktop.waitForTimeout(3300);await desktop.screenshot({path:'qa/40-pads-desktop.png'});
 const mobileContext=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const phone=await mobileContext.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto('http://127.0.0.1:8774/index.html');await phone.locator('[data-action="new-game"]').tap();
 await phone.locator('.build-card[data-id="frost"]').tap();
 const q=await phone.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=elderholm.view,p=TD.PADS[39];return{x:r.x+v.x+p.x*v.scale,y:r.y+v.y+p.y*v.scale};});
 await phone.touchscreen.tap(q.x,q.y);await phone.waitForTimeout(100);
 if(!await phone.evaluate(()=>elderholm.game.towers.some(t=>t.pad===39)))throw Error('Mobile pad 39 failed');
 await phone.locator('#zoomBtn').tap();await phone.waitForTimeout(100);await phone.screenshot({path:'qa/40-pads-mobile.png'});
 if(errors.length)throw Error(errors.join('; '));await context.close();await mobileContext.close();return{pass:true,...validation,desktopPlacements:4,touchPlacement:true,errors};
}
