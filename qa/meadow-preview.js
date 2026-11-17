async (page) => {
 const context=await page.context().browser().newContext({viewport:{width:1440,height:960}}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8774/index.html');await p.locator('[data-action="new-game"]').click();
 const place=async(type,i)=>{await p.locator(`.build-card[data-id="${type}"]`).click();const q=await p.evaluate(i=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=elderholm.view,p=TD.PADS[i];return{x:r.x+v.x+p.x*v.scale,y:r.y+v.y+p.y*v.scale};},i);await p.mouse.click(q.x,q.y);await p.waitForTimeout(60);};
 await place('archer',1);await place('mortar',3);await place('frost',6);
 await p.waitForFunction(()=>!document.querySelector('#waveBanner').classList.contains('show'));await p.waitForTimeout(550);await p.screenshot({path:'qa/meadow-muted-desktop.png'});
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(100);await p.screenshot({path:'qa/meadow-muted-mobile.png',fullPage:true});
 const state=await p.evaluate(()=>({pads:TD.PADS.length,towers:elderholm.game.towers.length,images:Object.values(elderholm.images).filter(i=>i.naturalWidth>0).length,atlas:Object.values(elderholm.atlasImages).filter(i=>i.naturalWidth>0).length,overflow:document.documentElement.scrollWidth>innerWidth}));
 await context.close();if(state.pads!==40||state.towers!==3||state.images!==25||state.atlas!==18||state.overflow||errors.length)throw Error(JSON.stringify({state,errors}));return{pass:true,...state,errors};
}
