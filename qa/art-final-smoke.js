async (page) => {
 const context=await page.context().browser().newContext({viewport:{width:1440,height:960}}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8774/index.html');await p.locator('[data-action="new-game"]').click();
 const tap=async i=>{const q=await p.evaluate(i=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=elderholm.view,p=TD.PADS[i];return{x:r.x+v.x+p.x*v.scale,y:r.y+v.y+p.y*v.scale};},i);await p.mouse.click(q.x,q.y);await p.waitForTimeout(80);};
 await tap(1);await p.locator('.build-card[data-id="frost"]').click();await tap(39);if(!await p.evaluate(()=>elderholm.game.towers.length===2&&elderholm.game.towers.some(t=>t.pad===39)))throw Error('Adjacent pad blocked by artwork');
 await p.locator('#codexBtn').click();await p.keyboard.press('Escape');if(!await p.locator('#modalBackdrop').isHidden())throw Error('Escape must close atlas');
 const state=await p.evaluate(()=>({images:Object.values(elderholm.images).filter(i=>i.naturalWidth>0).length,art:GENERATED_ART_IDS.length,pads:TD.PADS.length}));
 await context.close();if(errors.length)throw Error(errors.join('; '));return{pass:true,adjacentPlacement:true,atlasEscape:true,...state,errors};
}
