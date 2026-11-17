async (page) => {
 const errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
 page.on('requestfailed',r=>failed.push(`${r.failure()?.errorText} ${r.url()}`));
 await page.reload();
 await page.waitForFunction(()=>window.elderholm&&
  Object.values(elderholm.images).every(i=>i.complete&&i.naturalWidth>0)&&
  Object.values(elderholm.atlasImages).every(i=>i.complete&&i.naturalWidth>0));
 const art=await page.evaluate(()=>({
  images:Object.keys(elderholm.images).length,
  atlases:Object.keys(elderholm.atlasImages).length,
  externalImages:Object.values(elderholm.images).filter(i=>i.src.includes('/assets/images/')).length,
  externalAtlases:Object.values(elderholm.atlasImages).every(i=>i.src.includes('/assets/images/'))
 }));
 if(art.images!==25||art.atlases!==18||art.externalImages!==20||!art.externalAtlases)throw Error(JSON.stringify(art));
 await page.locator('[data-action="new-game"]').click();
 await page.waitForFunction(()=>{const a=document.getElementById('backgroundMusic');return a&&!a.paused&&a.currentTime>.2&&a.readyState>=2;});
 const music=await page.evaluate(()=>{const a=document.getElementById('backgroundMusic');return{src:a.src,duration:a.duration,loop:a.loop,error:a.error?.code||null};});
 if(!music.src.includes('/assets/audio/')||!music.loop||music.duration<218||music.duration>223||music.error)throw Error(JSON.stringify(music));
 await page.locator('#pauseBtn').click();
 await page.waitForFunction(()=>document.getElementById('backgroundMusic').paused);
 await page.locator('[data-action="unpause"]').click();
 await page.waitForFunction(()=>!document.getElementById('backgroundMusic').paused);
 const pad=await page.evaluate(()=>{const r=document.getElementById('battleCanvas').getBoundingClientRect(),v=elderholm.view,p=TD.PADS[1];return{x:r.x+v.x+p.x*v.scale,y:r.y+v.y+p.y*v.scale};});
 await page.mouse.click(pad.x,pad.y);
 await page.waitForFunction(()=>elderholm.state.towers===1);
 await page.locator('#waveBtn').click();
 await page.waitForFunction(()=>elderholm.state.wave===1&&elderholm.state.enemies>0);
 const combat=await page.evaluate(()=>elderholm.state);
 await page.screenshot({path:'/tmp/td-web-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 if(overflow)throw Error('Horizontal overflow on mobile');
 await page.screenshot({path:'/tmp/td-web-mobile.png'});
 if(errors.length||failed.length)throw Error(JSON.stringify({errors,failed}));
 return{pass:true,art,music,combat,mobileWidth:390,overflow,errors,failed};
}
