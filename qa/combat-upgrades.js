async (page) => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.reload();await page.locator('[data-action="new-game"]').click();
 // A fresh test campaign with two learned schools and enough gold for all actions.
 await page.evaluate(()=>{elderholm.game.gold=5000;elderholm.game.research.fire=1;elderholm.game.research.frost=1;});
 const selectPad=async()=>{
  const p=await page.evaluate(()=>{const r=document.getElementById('battleCanvas').getBoundingClientRect(),v=elderholm.view,p=TD.PADS[1];return{x:r.x+v.x+p.x*v.scale,y:r.y+v.y+p.y*v.scale};});
  await page.mouse.click(p.x,p.y);
 };
 await selectPad();await page.waitForFunction(()=>elderholm.state.towers===1);
 await page.locator('#waveBtn').click();
 await page.waitForFunction(()=>elderholm.state.phase==='wave'&&elderholm.state.enemies>0);
 await selectPad();
 const before=await page.evaluate(()=>({wave:elderholm.state.wave,enemy:elderholm.game.enemies[0].id,progress:elderholm.game.enemies[0].progress}));
 const upgrade=page.locator('[data-action="upgrade"][data-id="a"]');
 if(!await upgrade.isEnabled())throw Error('Combat specialization is disabled');
 await upgrade.click();await page.waitForFunction(()=>elderholm.game.towers[0].level===2);
 await upgrade.click();await page.waitForFunction(()=>elderholm.game.towers[0].level===3);
 await page.locator('[data-action="enchant"][data-id="fire"]').click();
 await page.waitForFunction(()=>elderholm.game.towers[0].element==='fire');
 await page.setViewportSize({width:390,height:844});
 const frost=page.locator('[data-action="enchant"][data-id="frost"]');
 await frost.scrollIntoViewIfNeeded();await frost.click();
 await page.waitForFunction(()=>elderholm.game.towers[0].element==='frost');
 if(await page.locator('[data-action="enchant"][data-id="storm"]').isEnabled())throw Error('Unlearned school is enabled');
 const after=await page.evaluate(id=>({state:elderholm.state,tower:{level:elderholm.game.towers[0].level,branch:elderholm.game.towers[0].branch,element:elderholm.game.towers[0].element},enemy:elderholm.game.enemies.find(e=>e.id===id)?.progress}),before.enemy);
 if(after.state.phase!=='wave'||after.state.wave!==before.wave||!(after.enemy>before.progress))throw Error('Combat stopped or reset during upgrades');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
 await page.screenshot({path:'/tmp/td-combat-upgrades.png',fullPage:true});
 if(errors.length)throw Error(errors.join('; '));
 return{pass:true,level:after.tower.level,branch:after.tower.branch,element:after.tower.element,wave:after.state.wave,combatContinued:true,mobileWidth:390,errors};
}
