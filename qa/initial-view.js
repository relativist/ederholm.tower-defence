async (page) => {
 await page.locator('[data-action="new-game"]').click();
 await page.waitForTimeout(500);
 await page.screenshot({path:'qa/desktop-game.png'});
 return await page.evaluate(()=>({state:elderholm.state,canvas:document.querySelector('canvas').getBoundingClientRect().toJSON(),errors:document.querySelector('.modal-backdrop').hidden}));
}
