async (page) => {
 const checks=[];
 const assert=(condition,message)=>{if(!condition)throw Error(message);checks.push(message);};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const build=async(type,pad)=>{
  await page.locator(`.build-card[data-id="${type}"]`).click();
  const p=await page.evaluate(i=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=elderholm.view,p=TD.PADS[i];return{x:r.x+v.x+p.x*v.scale,y:r.y+v.y+p.y*v.scale};},pad);
  await page.mouse.click(p.x,p.y);await page.waitForTimeout(70);
 };
 await build('archer',1);await build('mortar',3);
 let s=await page.evaluate(()=>elderholm.state);assert(s.towers===2&&s.gold>=0&&s.gold<200,'Две постройки размещены мышью, золото списано');
 await page.screenshot({path:'qa/desktop-defense.png'});
 await page.locator('#waveBtn').click();await page.waitForTimeout(900);
 s=await page.evaluate(()=>elderholm.state);assert(s.phase==='wave'&&s.enemies>0,'Волна запускается, противники появляются');
 await page.locator('#pauseBtn').click();const before=await page.evaluate(()=>elderholm.game.time);await page.waitForTimeout(200);const after=await page.evaluate(()=>elderholm.game.time);assert(before===after,'Пауза останавливает время боя');
 await page.locator('[data-action="unpause"]').click();
 const simulated=await page.evaluate(()=>{const g=elderholm.game;let n=0;while(g.phase==='wave'&&n++<20000)g.update(.05);return{ticks:n,kills:g.kills,phase:g.phase,lives:g.lives};});
 await page.waitForTimeout(250);assert(simulated.phase==='research'&&simulated.kills>0,'Бой наносит урон, волна заканчивается советом');
 await page.locator('[data-action="research"]').first().waitFor();
 assert(await page.locator('[data-action="research"]').count()===5,'Доступны пять направлений развития');
 await page.locator('[data-action="research"][data-id="fire"]').click();
 assert(await page.evaluate(()=>elderholm.game.research.fire===1&&elderholm.game.phase==='build'),'Школа пламени изучена');
 // Select a built tower, choose its specialization, then enchant it.
 const p=await page.evaluate(()=>{const t=elderholm.game.towers[0],r=document.querySelector('canvas').getBoundingClientRect(),v=elderholm.view;return{x:r.x+v.x+t.x*v.scale,y:r.y+v.y+(t.y-19)*v.scale};});
 await page.mouse.click(p.x,p.y);await page.waitForTimeout(100);
 await page.locator('[data-action="upgrade"][data-id="a"]').click();await page.waitForTimeout(80);
 assert(await page.evaluate(()=>elderholm.game.towers[0].branch==='a'&&elderholm.game.towers[0].level===2),'Выбрана уникальная ветка улучшения');
 const cost=await page.evaluate(()=>elderholm.game.getEnchantCost(elderholm.game.towers[0]));const enough=await page.evaluate(c=>elderholm.game.gold>=c,cost);
 if(enough){await page.locator('[data-action="enchant"][data-id="fire"]').click();assert(await page.evaluate(()=>elderholm.game.towers[0].element==='fire'),'Стихийное зачарование применено');}
 const saved=await page.evaluate(()=>({gold:elderholm.game.gold,wave:elderholm.game.wave,towers:elderholm.game.towers.length,branch:elderholm.game.towers[0].branch}));
 await page.reload();await page.locator('[data-action="resume"]').click();
 const resumed=await page.evaluate(()=>({gold:elderholm.game.gold,wave:elderholm.game.wave,towers:elderholm.game.towers.length,branch:elderholm.game.towers[0].branch}));assert(JSON.stringify(saved)===JSON.stringify(resumed),'Сохранение восстановило казну, волну, постройки и ветку');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
 await page.screenshot({path:'qa/mobile-game.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Телефон 390px: нет горизонтального переполнения');
 assert(await page.locator('.build-card').count()===6,'Телефон: все шесть построек доступны');
 assert((await page.locator('#waveBtn').boundingBox()).width>100,'Телефон: кнопка волны доступна');
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(150);await page.screenshot({path:'qa/mobile-landscape.png'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Телефон в альбомной ориентации: нет переполнения');
 assert(errors.length===0,'Нет ошибок JavaScript');
 return {checks,simulated,saved,errors};
}
