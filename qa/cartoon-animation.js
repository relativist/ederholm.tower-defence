async (page) => {
 const browser=page.context().browser();const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir:'/home/rest/ai/proj/td/qa/cartoon-video',size:{width:1000,height:700}}});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8774/index.html');await p.locator('[data-action="new-game"]').click();
 const assets=await p.evaluate(()=>{
  const out=[];for(const [id,def] of Object.entries(ANIMATION_ATLAS)){
   const im=elderholm.atlasImages[id],cv=document.createElement('canvas');cv.width=def.frameWidth;cv.height=def.frameHeight;const c=cv.getContext('2d');let hashes=[],heights=[];
   for(let i=0;i<def.cols*def.rows;i++){c.clearRect(0,0,cv.width,cv.height);c.drawImage(im,(i%def.cols)*def.frameWidth,Math.floor(i/def.cols)*def.frameHeight,def.frameWidth,def.frameHeight,0,0,cv.width,cv.height);const d=c.getImageData(0,0,cv.width,cv.height).data;let h=0,minY=cv.height,maxY=-1;for(let j=0;j<d.length;j+=4){h=(Math.imul(h,31)+d[j]+d[j+1]*3+d[j+2]*7+d[j+3]*13)|0;if(d[j+3]>16){const y=Math.floor(j/4/cv.width);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}hashes.push(h);heights.push(maxY<0?0:maxY-minY+1);}
   out.push({id,frames:hashes.length,unique:new Set(hashes).size,standing:heights[0],fallen:heights.at(-1),size:[im.naturalWidth,im.naturalHeight]});
  }return out;
 });
 if(assets.length!==18||assets.reduce((n,a)=>n+a.frames,0)!==168)throw Error('Not all animation sheets loaded');
 for(const a of assets){if(a.unique<3)throw Error('Static duplicate sheet '+a.id);if(a.frames===12&&a.fallen>=a.standing*.85)throw Error('No falling/lying pose '+a.id);}
 const place=async(type,i)=>{await p.locator(`.build-card[data-id="${type}"]`).click();const q=await p.evaluate(i=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=elderholm.view,p=TD.PADS[i];return{x:r.x+v.x+p.x*v.scale,y:r.y+v.y+p.y*v.scale};},i);await p.mouse.click(q.x,q.y);await p.waitForTimeout(60);};
 await place('archer',9);await place('barracks',3);await p.locator('#waveBtn').click();
 await p.evaluate(()=>{for(let i=0;i<160;i++)elderholm.game.update(.06);});await p.waitForTimeout(80);
 const walking=await p.evaluate(()=>{const e=elderholm.game.enemies.find(e=>e.type==='raider');return{id:e.id,frame:SpriteFrames.select(ANIMATION_ATLAS[e.type],e.animState,e.animTime,e.id*.071).index,time:e.animTime};});await p.waitForTimeout(150);
 const walk2=await p.evaluate(id=>{const e=elderholm.game.enemies.find(e=>e.id===id);return{frame:SpriteFrames.select(ANIMATION_ATLAS[e.type],e.animState,e.animTime,e.id*.071).index,time:e.animTime};},walking.id);if(walk2.frame===walking.frame)throw Error('Walking sprite frame did not change');if(walk2.time<=walking.time)throw Error('Walk clock frozen');
 await p.screenshot({path:'qa/cartoon-battle.png'});
 const victim=await p.evaluate(()=>{const g=elderholm.game,e=g.enemies.find(e=>e.type==='raider');const v={id:e.id,x:e.x,y:e.y};g.damageEnemy(e,e.hp+100,'arcane');return v;});
 await p.waitForFunction(id=>elderholm.deaths.some(d=>d.id===id),victim.id);
 const frames=[];for(const elapsed of [0,.22,.42,.62]){await p.waitForFunction(({id,t})=>elderholm.deaths.some(d=>d.id===id&&d.elapsed>=t),{id:victim.id,t:elapsed});const f=await p.evaluate(id=>{const d=elderholm.deaths.find(d=>d.id===id);return SpriteFrames.select(ANIMATION_ATLAS[d.type],'die',d.elapsed).index;},victim.id);frames.push(f);await p.screenshot({path:`qa/cartoon-death-${frames.length}.png`});}
 if(new Set(frames).size<3||frames.at(-1)!==11)throw Error('Death clip not progressing '+frames.join(','));
 await p.waitForTimeout(700);if(await p.evaluate(id=>elderholm.deaths.some(d=>d.id===id),victim.id))throw Error('Corpse not cleaned');
 await p.locator('#codexBtn').click();await p.locator('[data-action="codex-tab"][data-id="enemies"]').click();await p.locator('[data-action="animation-preview"][data-id="die"]').click();await p.waitForTimeout(220);await p.screenshot({path:'qa/cartoon-atlas.png'});await p.keyboard.press('Escape');
 if(!await p.locator('#modalBackdrop').isHidden())throw Error('Atlas did not close');
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(100);await p.screenshot({path:'qa/cartoon-mobile.png',fullPage:true});if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
 const video=p.video();await context.close();await video.saveAs('/home/rest/ai/proj/td/qa/cartoon-animation.webm');if(errors.length)throw Error(errors.join('; '));return{pass:true,assets,walking:walk2.time>walking.time,deathFrames:frames,corpseCleaned:true,errors,video:'qa/cartoon-animation.webm'};
}
