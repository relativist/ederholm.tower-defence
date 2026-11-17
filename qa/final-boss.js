async (page) => {
 const context=await page.context().browser().newContext({viewport:{width:1440,height:960}});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto('http://127.0.0.1:8774/index.html');
 await p.evaluate(async()=>{const data=await fetch('qa/final-preparation.json').then(r=>r.json());localStorage.setItem('elderholm-save-v1',JSON.stringify(data));localStorage.setItem('elderholm-sound','off');});
 await p.reload();await p.locator('[data-action="resume"]').click();
 if(await p.evaluate(()=>elderholm.game.wave)!==29)throw Error('Preparation did not restore wave29');
 await p.locator('#waveBtn').click();
 const during=await p.evaluate(()=>{const g=elderholm.game;let ticks=0,boss;while(g.phase==='wave'&&ticks++<50000){g.update(.06);boss=g.enemies.find(e=>e.type==='boss20');g.drainEvents();if(boss?.progress>200)break;}return{phase:g.phase,wave:g.wave,boss:boss?{hp:Math.round(boss.hp),maxHp:boss.maxHp,progress:boss.progress}:null};});
 await p.waitForTimeout(100);await p.screenshot({path:'qa/final-boss.png'});
 if(!during.boss||during.boss.hp<=0||during.wave!==30)throw Error('Final boss did not appear alive');
 const result=await p.evaluate(()=>{const g=elderholm.game;let ticks=0,killed=false,casts=0;while(g.phase==='wave'&&ticks++<50000){const boss=g.enemies.find(e=>e.type==='boss20'&&e.hp>0);if(boss&&boss.x>100&&g.gold>=100&&g.spellCooldowns.meteor<=0){if(g.cast('meteor',boss.x,boss.y).ok)casts++;}else if(boss&&boss.progress>500&&g.gold>=80&&g.spellCooldowns.freeze<=0){if(g.cast('freeze',boss.x,boss.y).ok)casts++;}g.update(.06);for(const e of g.drainEvents())if(e.type==='kill'&&e.enemy==='boss20')killed=true;}return{phase:g.phase,lives:g.lives,gold:g.gold,killed,casts,wavesWon:g.stats.wavesWon};});
 await p.waitForFunction(()=>!document.querySelector('#modalBackdrop').hidden&&document.querySelector('#modalTitle')?.textContent.includes('выстоял'));await p.screenshot({path:'qa/victory.png'});
 if(result.phase!=='victory'||!result.killed||result.wavesWon!==30)throw Error('30 wave victory failed');
 if(errors.length)throw Error(errors.join('; '));return{pass:true,during,result,errors};
 }finally{await context.close();}
}
