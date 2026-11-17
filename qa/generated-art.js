async (page) => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:960});
 await page.screenshot({path:'qa/painted-intro.png'});await page.locator('[data-action="new-game"]').click();
 const art=await page.evaluate(()=>({generated:GENERATED_ART_IDS.length,loaded:Object.values(elderholm.images).filter(i=>i.naturalWidth>0).length,raster:GENERATED_ART_IDS.every(id=>elderholm.images[id]?.src.startsWith('data:image/webp;base64,')),sizes:GENERATED_ART_IDS.map(id=>[id,elderholm.images[id].naturalWidth,elderholm.images[id].naturalHeight]),overflow:document.documentElement.scrollWidth>innerWidth}));
 if(art.generated!==20||art.loaded!==25||!art.raster||art.overflow)throw Error('Missing artwork or layout overflow');
 const clickPad=async i=>{const q=await page.evaluate(i=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=elderholm.view,p=TD.PADS[i];return{x:r.x+v.x+p.x*v.scale,y:r.y+v.y+p.y*v.scale};},i);await page.mouse.click(q.x,q.y);await page.waitForTimeout(80);};
 await page.locator('.build-card[data-id="archer"]').click();await clickPad(1);await page.locator('.build-card[data-id="mortar"]').click();await clickPad(3);await page.locator('.build-card[data-id="barracks"]').click();await clickPad(6);
 await page.waitForTimeout(3300);await page.screenshot({path:'qa/painted-game.png'});
 await page.locator('#codexBtn').click();if(await page.locator('.codex-card').count()!==6)throw Error('Tower atlas missing');await page.screenshot({path:'qa/painted-arsenal.png'});
 await page.locator('[data-action="codex-tab"][data-id="enemies"]').click();if(await page.locator('.codex-card').count()!==7)throw Error('Bestiary missing');await page.screenshot({path:'qa/painted-bestiary.png'});
 await page.locator('[data-action="codex-tab"][data-id="bosses"]').click();if(await page.locator('.codex-card').count()!==4)throw Error('Boss atlas missing');await page.screenshot({path:'qa/painted-bosses.png'});
 await page.locator('[data-action="close-modal"]').click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await page.screenshot({path:'qa/painted-mobile.png',fullPage:true});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
 await page.locator('#pauseBtn').click();await page.locator('[data-action="codex"]').click();await page.locator('[data-action="codex-tab"][data-id="bosses"]').click();await page.screenshot({path:'qa/painted-mobile-atlas.png'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile atlas overflow');
 await page.locator('[data-action="close-modal"]').click();if(await page.evaluate(()=>elderholm.paused))throw Error('Atlas close failed to resume');
 if(errors.length)throw Error(errors.join('; '));return{pass:true,art,atlas:{towers:6,enemies:7,bosses:4},errors};
}
