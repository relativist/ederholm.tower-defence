async (page) => {
 await page.setViewportSize({width:1440,height:960});await page.reload();await page.locator('[data-action="resume"]').click();
 const state=await page.evaluate(()=>elderholm.state);if(state.wave!==1)throw Error('Expected saved wave1');
 await page.locator('#waveBtn').click();
 await page.evaluate(()=>{const g=elderholm.game;let i=0;while(g.phase==='wave'&&i++<10000)g.update(.05);});await page.waitForTimeout(100);
 await page.locator('[data-action="research"][data-id="economy"]').click();
 const p=await page.evaluate(()=>{const t=elderholm.game.towers[0],r=document.querySelector('canvas').getBoundingClientRect(),v=elderholm.view;return{x:r.x+v.x+t.x*v.scale,y:r.y+v.y+(t.y-19)*v.scale};});
 await page.mouse.click(p.x,p.y);await page.waitForTimeout(70);
 const costShown=await page.locator('[data-action="upgrade"]').first().locator('.cost').textContent();
 const costActual=await page.evaluate(()=>elderholm.game.getUpgradeOptions(elderholm.game.towers[0])[0].cost);
 if(costShown!==`${costActual} ◈`)throw Error('Upgrade price differs');
 await page.locator('[data-action="enchant"][data-id="fire"]').click();
 if(await page.evaluate(()=>elderholm.game.towers[0].element)!=='fire')throw Error('Fire enchant UI failed');
 await page.locator('#waveBtn').click();
 await page.evaluate(()=>{const g=elderholm.game;for(let i=0;i<120;i++)g.update(.05);});await page.waitForTimeout(100);
 // The fire-enchanted multishot tower hits enemies on the first bend.
 const effects=await page.evaluate(()=>({burning:elderholm.game.enemies.filter(e=>e.burn>0).length,kills:elderholm.game.kills,gold:elderholm.game.gold}));
 const e=await page.evaluate(()=>{const e=elderholm.game.enemies.find(e=>e.x>=0);if(!e)return null;const r=document.querySelector('canvas').getBoundingClientRect(),v=elderholm.view;return{x:r.x+v.x+e.x*v.scale,y:r.y+v.y+e.y*v.scale};});
 if(e&&effects.gold>=55){await page.locator('#meteorBtn').click();await page.mouse.click(e.x,e.y);await page.waitForTimeout(100);if(await page.evaluate(()=>elderholm.game.spellCooldowns.meteor)<=0)throw Error('Meteor UI failed');}
 await page.screenshot({path:'qa/desktop-combat.png'});
 // Reload in battle must replay the wave from its preparation snapshot.
 await page.reload();await page.locator('[data-action="resume"]').click();
 const resumed=await page.evaluate(()=>elderholm.state);if(resumed.phase!=='build'||resumed.wave!==2)throw Error('Mid-wave checkpoint skipped wave');
 return {pass:true,checks:['Зачарование через интерфейс','Цена улучшения совпадает со списанием','Метеор','Возврат к подготовке после закрытия в бою'],effects,resumed};
}
