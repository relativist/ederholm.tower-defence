async (page) => {
 await page.setViewportSize({width:1440,height:960});await page.evaluate(()=>localStorage.removeItem('elderholm-save-v1'));await page.reload();await page.locator('[data-action="new-game"]').click();return {reset:true};
}
