async (page) => {
 const browser=page.context().browser();const context=await browser.newContext({viewport:{width:1280,height:800},offline:true});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///tmp/elderholm-standalone/index.html');await p.locator('[data-action="new-game"]').click();await p.waitForTimeout(100);
 const offline=await p.evaluate(()=>({state:elderholm.state,animations:Object.values(elderholm.atlasImages).filter(i=>i.naturalWidth>0).length,images:Object.values(elderholm.images).filter(i=>i.naturalWidth>0).length,scripts:[...document.scripts].filter(e=>e.src).length,links:[...document.querySelectorAll('link')].filter(e=>e.href.startsWith('http')).length}));
 if(offline.images!==25||offline.animations!==18||offline.scripts!==0||offline.links!==0)throw Error('Single file contract failed');
 await p.screenshot({path:'qa/offline-file.png'});await context.close();
 const restricted=await browser.newContext({viewport:{width:360,height:740}});await restricted.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Disabled','SecurityError');}}));
 const q=await restricted.newPage();q.on('pageerror',e=>errors.push(e.message));await q.goto('http://127.0.0.1:8774/index.html');await q.locator('[data-action="new-game"]').click();const fallback=await q.locator('#saveStatus').textContent();
 if(!fallback.includes('НЕДОСТУПНО'))throw Error('Blocked storage fallback failed');
 const overflows=await q.evaluate(()=>({horizontal:document.documentElement.scrollWidth>innerWidth,width:innerWidth,height:innerHeight}));if(overflows.horizontal)throw Error('360px overflow');
 await restricted.close();if(errors.length)throw Error(errors.join('; '));return {pass:true,offline,fallback,overflows,errors};
}
