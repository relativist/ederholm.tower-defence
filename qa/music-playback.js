async (page) => {
 const browser=page.context().browser(),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,offline:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///tmp/elderholm-standalone/index.html');await p.bringToFront();
 await p.locator('[data-action="new-game"]').tap();
 await p.waitForFunction(()=>{const a=document.getElementById('backgroundMusic');return a&&!a.paused&&a.currentTime>.25&&a.readyState>=2;});
 const playing=await p.evaluate(()=>{const a=document.getElementById('backgroundMusic');return{time:a.currentTime,duration:a.duration,loop:a.loop,volume:a.volume,embedded:a.src.startsWith('data:audio/mpeg;base64,'),error:a.error?.code||null};});
 if(!playing.embedded||playing.loop||playing.duration<=0||playing.error)throw Error('Invalid music media');
 const tracks=await p.evaluate(()=>EMBEDDED_PLAYLIST.length);if(tracks!==11)throw Error('Expected eleven tracks');
 await p.locator('#soundBtn').tap();await p.waitForFunction(()=>document.getElementById('backgroundMusic').paused);const mutedTime=await p.evaluate(()=>document.getElementById('backgroundMusic').currentTime);await p.waitForTimeout(300);if(!await p.evaluate(t=>document.getElementById('backgroundMusic').paused&&Math.abs(document.getElementById('backgroundMusic').currentTime-t)<.1,mutedTime))throw Error('Mute failed');
 await p.locator('#soundBtn').tap();await p.waitForFunction(t=>!document.getElementById('backgroundMusic').paused&&document.getElementById('backgroundMusic').currentTime>t+.15,mutedTime);
 await p.locator('#pauseBtn').tap();await p.waitForFunction(()=>document.getElementById('backgroundMusic').paused);const pausedTime=await p.evaluate(()=>document.getElementById('backgroundMusic').currentTime);await p.waitForTimeout(200);if(!await p.evaluate(t=>Math.abs(document.getElementById('backgroundMusic').currentTime-t)<.1,pausedTime))throw Error('Music advances on game pause');
 await p.locator('[data-action="unpause"]').tap();await p.waitForFunction(t=>!document.getElementById('backgroundMusic').paused&&document.getElementById('backgroundMusic').currentTime>t+.15,pausedTime);
 const firstSrc=await p.locator('audio').getAttribute('src');
 await p.evaluate(()=>{const a=document.getElementById('backgroundMusic');a.currentTime=a.duration-.2;});
 await p.waitForFunction(src=>document.getElementById('backgroundMusic').getAttribute('src')!==src,firstSrc);
 await p.waitForFunction(()=>{const a=document.getElementById('backgroundMusic');return a.currentTime>.15&&!a.paused;});
 const looped=await p.evaluate(()=>elderholm.sound);
 await context.close();if(errors.length)throw Error(errors.join('; '));return{pass:true,offlineFile:true,touchStart:true,playing,tracks,muteResume:true,gamePauseResume:true,looped,errors};
}
