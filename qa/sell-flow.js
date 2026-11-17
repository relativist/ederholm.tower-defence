async (page) => {
 const errors=[],browser=page.context().browser();
 const context=await browser.newContext({viewport:{width:1440,height:960}}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8774/index.html');await p.locator('[data-action="new-game"]').click();
 const tapPad=async(q,i,selected=false,touch=false)=>{const point=await q.evaluate(({i,selected})=>{const r=document.querySelector('canvas').getBoundingClientRect(),v=elderholm.view,t=TD.PADS[i];return{x:r.x+v.x+t.x*v.scale,y:r.y+v.y+(t.y-(selected?19:0))*v.scale};},{i,selected});if(touch)await q.touchscreen.tap(point.x,point.y);else await q.mouse.click(point.x,point.y);await q.waitForTimeout(70);};
 await tapPad(p,1);await tapPad(p,3);await tapPad(p,1,true);await p.locator('[data-action="upgrade"][data-id="a"]').click();
 const before=await p.evaluate(()=>({gold:elderholm.game.gold,refund:Math.floor(elderholm.game.towers.find(t=>t.pad===1).spent*.62)}));
 await p.waitForFunction(refund=>document.querySelector('[data-action="sell"]')?.textContent.includes('+'+refund+' '),before.refund);
 const label=await p.locator('[data-action="sell"]').textContent();if(!label.includes(String(before.refund)))throw Error('Wrong refund shown');
 await p.screenshot({path:'qa/sell-desktop.png'});await p.locator('[data-action="sell"]').click();
 const after=await p.evaluate(()=>({gold:elderholm.game.gold,count:elderholm.game.towers.length,removed:!elderholm.game.towers.some(t=>t.pad===1)}));
 if(!after.removed||after.count!==1||after.gold-before.gold!==before.refund)throw Error('Sale/refund failed');
 await p.reload();await p.locator('[data-action="resume"]').click();if(!await p.evaluate(g=>elderholm.game.gold===g&&elderholm.game.towers.length===1&&!elderholm.game.towers.some(t=>t.pad===1),after.gold))throw Error('Sale not saved');
 await context.close();
 const mc=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),phone=await mc.newPage();phone.on('pageerror',e=>errors.push(e.message));
 await phone.goto('http://127.0.0.1:8774/index.html');await phone.locator('[data-action="new-game"]').tap();await tapPad(phone,39,false,true);await tapPad(phone,39,true,true);
 const visible=await phone.evaluate(()=>{const button=document.querySelector('[data-action="sell"]').getBoundingClientRect(),panel=document.querySelector('#sideBody').getBoundingClientRect();return button.top>=panel.top&&button.bottom<=panel.bottom&&button.height>=44;});if(!visible)throw Error('Sale hidden below mobile fold');
 await phone.screenshot({path:'qa/sell-mobile.png'});await phone.locator('[data-action="sell"]').tap();if(!await phone.evaluate(()=>elderholm.game.towers.length===0&&elderholm.game.gold===327))throw Error('Touch sale failed');
 await tapPad(phone,39,false,true);await phone.locator('#waveBtn').tap();await tapPad(phone,39,true,true);
 if(!await phone.locator('[data-action="sell"]').isDisabled())throw Error('Sale must be locked during wave');
 await mc.close();if(errors.length)throw Error(errors.join('; '));return{pass:true,label,before,after,mobileVisible:visible,touchSale:true,waveLocked:true,persisted:true,errors};
}
