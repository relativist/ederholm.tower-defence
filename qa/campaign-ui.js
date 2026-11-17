async (page) => {
  const browser = page.context().browser();
  const errors = [];
  const checks = [];
  const check = (name, ok, detail = null) => {
    checks.push({name, ok: !!ok, ...(detail == null ? {} : {detail})});
    if (!ok) errors.push(name);
  };
  const newGame = async (viewport = {width: 1440, height: 960}, setup = null) => {
    const context = await browser.newContext({viewport, deviceScaleFactor: 1});
    await context.addInitScript(() => localStorage.setItem('elderholm-sound', 'off'));
    if (setup) await setup(context);
    const p = await context.newPage();
    p.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    await p.goto('http://127.0.0.1:8774/', {waitUntil: 'load'});
    await p.waitForFunction(() => !!window.elderholm && !!window.TD, null, {timeout: 15000});
    return {context, p};
  };
  const start = async p => {
    const btn = p.locator('[data-action="new-game"]');
    if (await btn.count()) await btn.click();
    await p.waitForFunction(() => !!window.elderholm?.game, null, {timeout: 10000});
    await p.waitForTimeout(150);
  };
  const gameState = async p => p.evaluate(() => ({
    state: elderholm.state, phase: elderholm.game?.phase, wave: elderholm.game?.wave,
    gold: elderholm.game?.gold, lives: elderholm.game?.lives,
    towers: elderholm.game?.towers?.map(t => ({...t})), enemies: elderholm.game?.enemies?.map(e => ({...e}))
  }));
  const setFixture = async (p, values = {}) => p.evaluate(v => {
    const g = elderholm.game;
    if (v.gold != null) g.gold = v.gold;
    if (v.wave != null) g.wave = v.wave;
    if (v.phase != null) g.phase = v.phase;
    if (v.research) Object.assign(g.research, v.research);
    if (v.towerHp != null && g.towers[0]) g.towers[0].hp = v.towerHp;
    return {phase: g.phase, wave: g.wave, gold: g.gold};
  }, values);
  const canvasClickPad = async (p, index, selected = false) => {
    const point = await p.evaluate(({index, selected}) => {
      const r = document.querySelector('#battleCanvas').getBoundingClientRect();
      const v = elderholm.view, pad = TD.PADS[index];
      return {x: r.x + v.x + pad.x * v.scale, y: r.y + v.y + (pad.y - (selected ? 19 : 0)) * v.scale};
    }, {index, selected});
    await p.mouse.click(point.x, point.y);
    await p.waitForTimeout(100);
  };
  const buildTower = async (p, type, pad) => {
    await p.locator(`.build-card[data-id="${type}"]`).click();
    await canvasClickPad(p, pad);
    await canvasClickPad(p, pad, true);
    await p.waitForTimeout(100);
  };
  const screenshot = async (p, name) => p.screenshot({path: `qa/${name}`, animations: 'disabled'});

  let context;
  try {
    // Intro, campaign limits and controlled UI fixture for the complete upgrade panel.
    ({context, p: page} = await newGame());
    const intro = await page.locator('body').innerText();
    check('intro advertises 100 waves', /100\s*(волн|wave)/i.test(intro), intro.match(/.{0,30}100.{0,35}/i)?.[0] || null);
    await start(page);
    const initial = await gameState(page);
    const totalWaves = await TD_TOTAL(page);
    check('new game starts at wave 0 with a 100 wave cap', initial.wave === 0 && totalWaves === 100,
      {wave: initial.wave, cap: totalWaves});
    const levelCap = await page.evaluate(() => TD.MAX_TOWER_LEVEL);
    check('tower cap is eight levels', levelCap === 8, levelCap);
    await setFixture(page, {gold: 150000});
    await buildTower(page, 'archer', 0);
    let tower = (await gameState(page)).towers[0];
    check('controlled archer placed through build UI', !!tower && tower.type === 'archer', tower?.type || null);

    const perkDescriptions = [];
    for (let level = 1; level < 8 && tower; level++) {
      const upgrade = page.locator('[data-action="upgrade"]').first();
      const branch = page.locator('[data-action="upgrade"][data-id="a"]');
      const chosen = await branch.count() ? branch : upgrade;
      if (!(await chosen.count())) break;
      const description = await page.locator('#sideBody').innerText();
      if ([3, 5, 7].includes(level)) perkDescriptions.push(description);
      await chosen.click();
      await page.waitForTimeout(100);
      tower = (await gameState(page)).towers[0];
    }
    check('upgrade UI reaches level eight', tower?.level === 8, tower?.level || null);
    check('tier perks show concrete descriptions', perkDescriptions.length === 3 && perkDescriptions.every(s => s.length > 45),
      perkDescriptions.map(s => s.slice(-220)));
    await buildTower(page, 'arcane', 1);
    await setFixture(page, {research: {fire: 1, frost: 1, storm: 1}});
    await canvasClickPad(page, 1, true);
    const enchantButtons = page.locator('[data-action="enchant"]');
    check('enchantment choices are available', await enchantButtons.count() >= 3, await enchantButtons.count());
    if (await page.locator('[data-action="enchant"][data-id="fire"]').count()) {
      await page.locator('[data-action="enchant"][data-id="fire"]').click();
      await page.waitForTimeout(80);
      const beforeReplace = await gameState(page);
      const selected = page.locator('[data-action="enchant"][data-id="frost"]');
      if (await selected.count()) await selected.click();
      await page.waitForTimeout(80);
      const afterReplace = await gameState(page);
      check('enchantment can be replaced through UI', beforeReplace.towers[1]?.element === 'fire' && afterReplace.towers[1]?.element === 'frost',
        {before: beforeReplace.towers[1]?.element, after: afterReplace.towers[1]?.element});
    }
    // Damage, paid repair, screenshot, and persistence after a reload.
    await page.evaluate(() => {
      const [primary, secondary] = elderholm.game.towers;
      primary.hp = Math.max(1, primary.maxHp * .35);
      if (secondary) secondary.hp = Math.max(1, secondary.maxHp * .55);
    });
    await canvasClickPad(page, 0, true);
    await page.waitForTimeout(100);
    const health = await page.locator('.structure-health').innerText().catch(() => '');
    check('selected building exposes HP status', /\d/.test(health), health.slice(0, 100));
    await screenshot(page, 'campaign-hp-repair.png');
    const repair = page.locator('[data-action="repair"]');
    check('repair is exposed in build phase', await repair.count() === 1, await repair.count());
    if (await repair.count()) await repair.click();
    await page.waitForTimeout(100);
    const primaryRepaired = await gameState(page);
    const bulk = page.locator('#repairAllBtn');
    check('bulk repair is exposed for other damaged buildings', await bulk.count() === 1, await bulk.count());
    const goldBeforeBulk = primaryRepaired.gold;
    if (await bulk.count()) await bulk.click();
    await page.waitForTimeout(100);
    const repaired = await gameState(page);
    check('paid repair restores tower health and spends gold', repaired.towers[0]?.hp > repaired.towers[0]?.maxHp * .35 && repaired.gold < 150000,
      {hp: repaired.towers[0]?.hp, maxHp: repaired.towers[0]?.maxHp, gold: repaired.gold});
    check('bulk repair restores remaining damaged buildings and charges gold', repaired.towers.length > 1 && repaired.towers[1].hp > repaired.towers[1].maxHp * .8 && repaired.gold < goldBeforeBulk,
      {goldBefore: goldBeforeBulk, goldAfter: repaired.gold, towers: repaired.towers.map(t => ({hp:t.hp,maxHp:t.maxHp}))});
    await page.reload({waitUntil: 'load'});
    await page.waitForFunction(() => !!window.elderholm?.game, null, {timeout: 10000});
    const resumeRepair = page.locator('[data-action="resume"]');
    if (await resumeRepair.count()) await resumeRepair.click();
    await page.waitForTimeout(150);
    const persisted = await gameState(page);
    check('repaired tower health persists after reload', persisted.towers.some(t => t.type === 'archer' && t.hp > t.maxHp * .8),
      persisted.towers.map(t => ({type: t.type, hp: t.hp, maxHp: t.maxHp})));
    await context.close();

    // Atlas affinity codex and actual live enemy selection.
    ({context, p: page} = await newGame());
    await start(page);
    await page.locator('#codexBtn').click().catch(async () => {
      await page.locator('#pauseBtn').click();
      await page.locator('[data-action="codex"]').click();
    });
    await page.locator('[data-action="codex-tab"][data-id="affinities"]').click();
    const codexText = await page.locator('body').innerText();
    check('element codex lists affinities and counters', /стих|уязв|сопротив/i.test(codexText) && /огн|лед|молни/i.test(codexText), codexText.slice(-350));
    await screenshot(page, 'campaign-affinities.png');
    await page.keyboard.press('Escape');
    await setFixture(page, {gold: 150000});
    await buildTower(page, 'archer', 14);
    await page.locator('#waveTraits summary').click().catch(async () => {});
    const details = page.locator('#waveTraits');
    const forecastAvailable = await details.count() === 1;
    if (forecastAvailable && !(await details.locator('details').evaluate(e => e.open))) await details.locator('summary').click();
    const wasForecastOpen = forecastAvailable && await details.locator('details').evaluate(e => e.open).catch(() => false);
    await page.locator('#waveBtn').click();
    await page.waitForTimeout(500);
    const forecastOpen = forecastAvailable && await details.locator('details').evaluate(e => e.open).catch(() => false);
    check('forecast remains expanded through combat HUD refresh', wasForecastOpen && forecastOpen,
      {exists: forecastAvailable, wasOpen: wasForecastOpen, isOpen: forecastOpen});
    await page.evaluate(() => {
      const g = elderholm.game;
      g.spawn('raider');
      const enemy = g.enemies.at(-1);
      if (enemy) { enemy.affinity = 'fire'; enemy.name = `Огненный ${enemy.name}`; enemy.x = 500; enemy.y = 245; enemy.progress = 500; enemy.speed = 0; }
    });
    await page.waitForTimeout(150);
    const enemy = await page.evaluate(() => elderholm.game.enemies.find(e => e.affinity === 'fire') && ({x: elderholm.game.enemies.find(e => e.affinity === 'fire').x, y: elderholm.game.enemies.find(e => e.affinity === 'fire').y}));
    if (enemy) {
      const point = await page.evaluate(({x, y}) => { const r = document.querySelector('#battleCanvas').getBoundingClientRect(), v = elderholm.view; return {x:r.x+v.x+x*v.scale,y:r.y+v.y+(y-17)*v.scale}; }, enemy);
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(100);
      const side = await page.locator('#sideBody').innerText();
      check('live enemy selection shows affinity traits', /огн|уязв|сопротив/i.test(side), side.slice(-300));
    } else check('controlled fire-affinity enemy spawned', false);
    await context.close();

    // Small screen HUD; wave and resources are deliberately fixture-controlled.
    for (const width of [390, 360]) {
      ({context, p: page} = await newGame({width, height: 844}));
      await start(page);
      await setFixture(page, {wave: 30, phase: 'build', gold: 150000});
      await page.evaluate(() => elderholm.selectBuild('archer'));
      await page.waitForTimeout(120);
      const layout = await page.evaluate(() => ({
        viewport: innerWidth, document: document.documentElement.scrollWidth,
        wave: document.querySelector('#wave')?.innerText, cap: document.querySelector('#campaignLabel')?.innerText,
        gold: document.querySelector('#gold')?.innerText, modelWave: elderholm.game.wave,
        waveButton: document.querySelector('#waveBtn')?.innerText,
        waveButtonDisabled: document.querySelector('#waveBtn')?.disabled,
        xOverflow: document.documentElement.scrollWidth > innerWidth
      }));
      check(`mobile ${width}px wave-30 HUD has no horizontal overflow`, !layout.xOverflow && layout.document <= width,
        {...layout, controlledFixture: true});
      check(`mobile ${width}px wave-30 cannot start wave 31`, layout.waveButtonDisabled && /поход завершён/i.test(layout.waveButton || ''), layout);
      if (width === 390) await screenshot(page, 'campaign-mobile-30.png');
      await context.close();
    }

    // Real v1 victory save migration must lead into wave 21 from the intro UI.
    const legacy = {
      v: 1, phase: 'victory', wave: 20, gold: 500, lives: 20, kills: 0,
      towers: [{id: 1, type: 'archer', pad: 0, level: 1, spent: 360}], nextId: 2, enemies: [], research: {military: 0, economy: 0, fire: 0, frost: 0, storm: 0},
      spellCooldowns: {meteor: 0, freeze: 0}
    };
    ({context, p: page} = await newGame({width: 1440, height: 960}, async ctx => {
      await ctx.addInitScript(data => localStorage.setItem('elderholm-save-v1', JSON.stringify(data)), legacy);
    }));
    const resume = page.locator('[data-action="resume"]');
    check('legacy wave-20 victory save offers resume', await resume.count() === 1, (await page.locator('body').innerText()).slice(0, 500));
    if (await resume.count()) await resume.click();
    await page.waitForFunction(() => !!window.elderholm?.game, null, {timeout: 10000});
    if (await page.locator('#waveBtn').count()) await page.locator('#waveBtn').click();
    await page.waitForFunction(() => elderholm.game.wave === 21 || elderholm.game.phase === 'research', null, {timeout: 5000}).catch(() => {});
    const migrated = await gameState(page);
    check('legacy resume starts wave 21 through the campaign UI', migrated.wave === 21 && migrated.phase === 'wave',
      {wave: migrated.wave, phase: migrated.phase});
    await context.close();

    // Controlled siege fixture: position a boss at a damaged building and let
    // the real update/event path produce warning, impact, and destruction.
    ({context, p: page} = await newGame());
    await start(page);
    await setFixture(page, {gold: 150000});
    await buildTower(page, 'barracks', 0);
    const siegeSetup = await page.evaluate(() => {
      const g = elderholm.game, tower = g.towers[0];
      window.__campaignEvents = [];
      const drain = g.drainEvents.bind(g);
      g.drainEvents = function() { const events = drain(); window.__campaignEvents.push(...events); return events; };
      tower.hp = 1;
      g.spawn('boss5');
      const boss = g.enemies.at(-1);
      if (!boss) return null;
      boss.x = tower.x + 35; boss.y = tower.y; boss.progress = 500; boss.siegeCooldown = 0;
      boss.hp = boss.maxHp; boss.speed = 0;
      g.phase = 'wave';
      return {towerId: tower.id, bossId: boss.id, towerHp: tower.hp, towerMaxHp: tower.maxHp};
    });
    check('controlled boss siege fixture was set', !!siegeSetup, siegeSetup);
    await page.waitForFunction(id => elderholm.game.troops?.some(t => t.owner === id), siegeSetup?.towerId, {timeout: 5000}).catch(() => {});
    const ownedTroopsBefore = await page.evaluate(id => elderholm.game.troops.filter(t => t.owner === id).length, siegeSetup?.towerId);
    await page.waitForFunction(() => window.__campaignEvents?.some(e => e.type === 'siege-warning') || /осад|здан/.test(document.querySelector('#toast')?.innerText || ''), null, {timeout: 5000}).catch(() => {});
    const warning = await page.evaluate(() => ({
      events: window.__campaignEvents.filter(e => e.type === 'siege-warning'),
      toast: document.querySelector('#toast')?.innerText,
      marked: !!document.querySelector('#battleCanvas') && [...document.querySelectorAll('#toast,#waveBanner')].some(e => e.innerText.includes('осад') || e.innerText.includes('здан'))
    }));
    check('boss siege telegraph appears before impact', /осад|здан|!/.test(warning.toast || '') || warning.events.some(e => e.type === 'siege-warning'), warning);
    await screenshot(page, 'campaign-siege-warning.png');
    await page.waitForFunction(() => window.__campaignEvents?.some(e => e.type === 'tower-hit' || e.type === 'tower-destroyed'), null, {timeout: 8000}).catch(() => {});
    const impact = await page.evaluate(id => ({
      towers: elderholm.game.towers.map(t => t.id),
      troops: elderholm.game.troops.map(t => t.owner),
      hpText: document.querySelector('.structure-health')?.innerText || '',
      events: window.__campaignEvents.filter(e => e.type === 'tower-hit' || e.type === 'tower-destroyed')
    }), siegeSetup.towerId);
    check('boss damages building or removes it after warning', !impact.towers.includes(siegeSetup.towerId) || /\d/.test(impact.hpText), impact);
    check('destroyed barracks removes its owned troops', ownedTroopsBefore > 0 && !impact.troops.includes(siegeSetup.towerId),
      {before: ownedTroopsBefore, remainingOwners: impact.troops});
    await screenshot(page, 'campaign-siege-destroyed.png');
    await context.close();

    return {pass: errors.length === 0, checks, errors, screenshots: [
      'qa/campaign-hp-repair.png', 'qa/campaign-affinities.png', 'qa/campaign-mobile-30.png',
      'qa/campaign-siege-warning.png', 'qa/campaign-siege-destroyed.png'
    ]};
  } catch (e) {
    errors.push(`uncaught: ${e.message}`);
    return {pass: false, checks, errors};
  } finally {
    if (context) await context.close().catch(() => {});
  }

  function TD_TOTAL(p) {
    // Kept as a local helper so the assertion reads the loaded app's exports.
    return p.evaluate(() => TD.TOTAL_WAVES);
  }
}
