const fs = require('node:fs');
const path = require('node:path');
const TD = require('../engine.js');

// Fixed QA-only seed keeps troop behavior and the final preparation save reproducible.
let qaRandomState = 0x54444331;
Math.random = () => {
  qaRandomState = (Math.imul(1664525, qaRandomState) + 1013904223) >>> 0;
  return qaRandomState / 0x1_0000_0000;
};

const game = new TD.Game();
const log = {bossKills: [], leaks: 0, towerDestroys: 0, repairSpending: 0,
  bossLeaks: [], research: [], progress: [], events: 0, ticks: 0, defeat: null,
  casts:{meteor:0,freeze:0},castSpending:0,bossMilestones:[]};
const towerOrder = ['archer', 'mortar', 'frost', 'barracks', 'arcane', 'trap'];
const pads = [13, 9, 12, 0, 2, 8, 7, 1, 6, 10, 4, 11, 5, 3, 14, 15,
  16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
  32, 33, 34, 35, 36, 37, 38, 39];

function drain() {
  const events = game.drainEvents();
  log.events += events.length;
  for (const e of events) {
    if (e.type === 'kill' && /^boss/.test(e.enemy)) log.bossKills.push({wave: game.wave, enemy: e.enemy});
    if (e.type === 'leak') { log.leaks++; if (/^boss/.test(e.enemy)) log.bossLeaks.push({wave:game.wave,enemy:e.enemy}); }
    if (e.type === 'tower-destroyed') log.towerDestroys++;
    if (e.type === 'repair') log.repairSpending += e.cost || 0;
  }
}

function build(type) {
  const occupied = new Set(game.towers.map(t => t.pad));
  const pad = pads.find(n => !occupied.has(n));
  if (pad === undefined || game.gold < game.getBuildCost(type)) return false;
  const result = game.build(type, pad);
  if (result.ok) return true;
  return false;
}

function upcomingElement() {
  const info = TD.getWaveInfo(Math.min(TD.TOTAL_WAVES, game.wave + 1));
  const boss = info.boss;
  const traits = boss ? game.getEnemyTraits(boss) : info.affinity && info.affinity !== 'neutral'
    ? game.getEnemyTraits({type: info.enemies[0], affinity: info.affinity}) : null;
  if (!traits) return null;
  return [...traits.weaknesses].sort((a, b) => b.multiplier - a.multiplier)[0]?.element || null;
}

function manageBuild() {
  // Repair only towers that survived the previous siege and can be restored.
  for (const tower of [...game.towers].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))) {
    const cost = game.getRepairCost(tower);
    if (cost && cost <= game.gold && (tower.hp / tower.maxHp < .78 || game.gold > 900)) {
      const result = game.repair(tower.id);
      if (result.ok) { drain(); }
    }
  }

  // Put the upcoming boss counter on an aerial-capable tower before upgrades
  // can consume the available build budget.
  const openingElement = upcomingElement();
  if (openingElement && game.research[openingElement] > 0) {
    const counter = game.towers.filter(t => ['arcane', 'archer', 'frost'].includes(t.type) && t.element !== openingElement)
      .sort((a, b) => {
        const antiAir = t => t.type === 'arcane' ? 0 : t.type === 'archer' ? 1 : 2;
        return (antiAir(a) - antiAir(b)) || b.level - a.level;
      })[0];
    if (counter && game.getEnchantCost(counter) <= game.gold) game.enchant(counter.id, openingElement);
  }

  // Establish six attack roles first, then grow a mixed line. The order adapts
  // enchantment to the wave affinity and uses only resources earned in play.
  let guard = 0;
  while (guard++ < 160) {
    const missing = towerOrder.find(type => !game.towers.some(t => t.type === type));
    if (missing) { if (build(missing)) continue; break; }
    const minimumLevel = game.towers.length ? Math.min(...game.towers.map(t => t.level)) : 0;
    const coverageTarget = game.wave < 22 ? 9 : minimumLevel >= 4 && game.gold > 2200 ? 40 : 16;
    if (game.towers.length < coverageTarget) {
      const type = game.wave < 22
        ? ['arcane', 'archer', 'frost'][(game.wave + game.towers.length) % 3]
        : towerOrder[(game.wave + game.towers.length) % towerOrder.length];
      if (build(type)) continue;
    }
    const upgrade = game.towers.filter(t => t.level < TD.MAX_TOWER_LEVEL)
      .map(t => ({t, opt: game.getUpgradeOptions(t)[0]}))
      .filter(x => x.opt && x.opt.cost <= game.gold)
      .sort((a, b) => {
        const antiAir = t => t.type === 'arcane' ? 0 : t.type === 'archer' ? 1 : t.type === 'frost' ? 2 : 3;
        return (antiAir(a.t) - antiAir(b.t)) || (a.t.level - b.t.level) || a.opt.cost - b.opt.cost;
      })[0];
    if (upgrade && (game.towers.length >= coverageTarget || game.gold < 2200)) {
      if (game.upgrade(upgrade.t.id, upgrade.opt.id).ok) continue;
    }
    if (game.towers.length < coverageTarget) {
      const type = game.wave < 22
        ? ['arcane', 'archer', 'frost'][(game.wave + game.towers.length) % 3]
        : towerOrder[(game.wave + game.towers.length) % towerOrder.length];
      if (build(type)) continue;
    }
    break;
  }

  const element = upcomingElement();
}

function chooseResearch() {
  const candidates = ['economy', 'military', 'fire', 'frost', 'storm'];
  const affinityElement = upcomingElement();
  const preferred = affinityElement && ['fire', 'frost', 'storm'].includes(affinityElement) ? affinityElement : null;
  const order = game.wave < 8 ? ['economy', 'military', preferred, 'storm', 'fire', 'frost'] :
    [preferred, 'military', 'economy', 'storm', 'fire', 'frost'];
  if (game.wave < 22 && preferred && game.research[preferred] === 0) order.unshift(preferred);
  else if (game.wave < 22 && game.research.economy >= 3 && game.research.military < TD.MAX_RESEARCH_LEVEL)
    order.unshift('military');
  for (const id of order) {
    if (!id || !candidates.includes(id) || game.research[id] >= TD.MAX_RESEARCH_LEVEL) continue;
    if (game.chooseResearch(id).ok) { log.research.push({wave: game.wave, id}); return; }
  }
  throw new Error(`No available research choice after wave ${game.wave}`);
}

for (let wave = 1; wave <= TD.TOTAL_WAVES; wave++) {
  if (game.phase === 'research') chooseResearch();
  if (game.phase !== 'build') throw new Error(`Expected build before wave ${wave}, got ${game.phase}`);
  const waveBoss = TD.getWaveInfo(wave).boss;
  const bossStart = waveBoss ? {gold:game.gold,lives:game.lives,towers:game.towers.map(t=>({type:t.type,level:t.level,element:t.element,hp:t.hp})),research:{...game.research}} : null;
  manageBuild(); drain();
  if (wave === TD.TOTAL_WAVES) {
    fs.writeFileSync(path.join(__dirname, 'final-preparation.json'), `${JSON.stringify(game.serialize(), null, 2)}\n`);
  }
  const started = game.startWave();
  if (!started.ok) throw new Error(`Cannot start wave ${wave}: ${started.message}`);
  drain();
  let ticks = 0;
  const maxTicks = 45000;
  while (game.phase === 'wave' && ticks++ < maxTicks) {
    const boss = game.enemies.filter(e => /^boss/.test(e.type) && e.hp > 0)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (boss && boss.x > 100 && game.gold >= 100 && game.spellCooldowns.meteor <= 0) {
      const cast = game.cast('meteor', boss.x, boss.y);
      if (cast.ok) { log.casts.meteor++; log.castSpending += 55; }
    } else if (boss && boss.progress > 500 && game.gold >= 80 && game.spellCooldowns.freeze <= 0) {
      const cast = game.cast('freeze', boss.x, boss.y);
      if (cast.ok) { log.casts.freeze++; log.castSpending += 40; }
    }
    game.update(.06);
    log.ticks++;
    drain();
  }
  if (game.phase === 'wave') throw new Error(`Wave ${wave} exceeded ${maxTicks} ticks`);
  if (game.phase === 'defeat') { log.defeat = {wave, reason: game.defeatReason}; break; }
  if (waveBoss) log.bossMilestones.push({wave,boss:waveBoss,killed:log.bossKills.some(x=>x.wave===wave),escaped:log.bossLeaks.some(x=>x.wave===wave),
    before:bossStart,after:{gold:game.gold,lives:game.lives,towers:game.towers.length,levels:game.towers.map(t=>`${t.type}:${t.level}${t.element?'/'+t.element:''}`)}});
  if (wave % 20 === 0 || wave === TD.TOTAL_WAVES) log.progress.push({wave, phase: game.phase, gold: game.gold,
    lives: game.lives, towers: game.towers.length, kills: game.kills, bossKills: log.bossKills.length,
    research:{...game.research}});
}

function runBenchmark(arcaneOnly) {
  const g = new TD.Game();
  const events = [];
  if (arcaneOnly) g.build('arcane', 0);
  let ticks = 0;
  for (let wave = 1; wave <= TD.TOTAL_WAVES; wave++) {
    if (g.phase === 'research') {
      const info = TD.getWaveInfo(wave);
      const traits = info.boss ? g.getEnemyTraits(info.boss) : info.affinity !== 'neutral'
        ? g.getEnemyTraits({type:info.enemies[0],affinity:info.affinity}) : null;
      const counter = traits?.weaknesses.slice().sort((a,b)=>b.multiplier-a.multiplier)[0]?.element;
      g.phase = 'research';
      const choices = [counter, 'military', 'economy', 'fire', 'frost', 'storm'];
      for (const id of choices) if (id && g.research[id] < TD.MAX_RESEARCH_LEVEL && g.chooseResearch(id).ok) break;
    }
    if (arcaneOnly && g.phase === 'build') {
      const tower = g.towers[0];
      if (tower && tower.hp < tower.maxHp && g.getRepairCost(tower) <= g.gold) g.repair(tower.id);
      const info = TD.getWaveInfo(wave);
      const traits = info.boss ? g.getEnemyTraits(info.boss) : info.affinity !== 'neutral'
        ? g.getEnemyTraits({type:info.enemies[0],affinity:info.affinity}) : null;
      const counter = traits?.weaknesses.slice().sort((a,b)=>b.multiplier-a.multiplier)[0]?.element;
      if (counter && g.research[counter] && tower.element !== counter && g.getEnchantCost(tower) <= g.gold) g.enchant(tower.id,counter);
      while (tower.level < TD.MAX_TOWER_LEVEL) {
        const option = g.getUpgradeOptions(tower)[0];
        if (!option || option.cost > g.gold || !g.upgrade(tower.id,option.id).ok) break;
      }
    }
    if (g.phase !== 'build') break;
    if (!g.startWave().ok) break;
    let waveTicks = 0;
    while (g.phase === 'wave' && waveTicks++ < 45000) {
      g.update(.06); ticks++; events.push(...g.drainEvents());
    }
    if (g.phase === 'defeat') break;
  }
  return {kind:arcaneOnly?'single-arcane':'no-defense',phase:g.phase,wave:g.wave,
    lives:g.lives,kills:g.kills,towers:g.towers.length,bossKills:events.filter(e=>e.type==='kill'&&/^boss/.test(e.enemy)).length,
    ticks,resourcesInjected:false};
}
const benchmarks = [runBenchmark(false),runBenchmark(true)];
const levelDistribution = Object.fromEntries([...new Set(game.towers.map(t => t.level).sort((a,b)=>a-b))]
  .map(level => [level, game.towers.filter(t => t.level === level).length]));
const towerComposition = Object.fromEntries(Object.keys(TD.TOWERS)
  .map(type => [type, game.towers.filter(t => t.type === type).length]));
const upgradeProbe = TD.Game.restore(game.serialize());
upgradeProbe.phase = 'build';
let maxAllUpgradeCost = 0;
for (const original of upgradeProbe.towers) {
  const tower = {...original};
  while (tower.level < TD.MAX_TOWER_LEVEL) {
    const option = upgradeProbe.getUpgradeOptions(tower)[0];
    if (!option) break;
    maxAllUpgradeCost += option.cost;
    if (tower.level === 1) tower.branch = option.id;
    tower.level++;
  }
}
const affordableNextUpgrades = upgradeProbe.towers.filter(t => t.level < TD.MAX_TOWER_LEVEL)
  .filter(t => upgradeProbe.getUpgradeOptions(t)[0]?.cost <= game.gold).length;

const result = {result: game.phase === 'victory' ? 'victory' : 'defeat', finalWave: game.wave,
  phase: game.phase, gold: game.gold, lives: game.lives, towers: game.towers.length,
  levelDistribution,towerComposition,
  maxAllUpgradeCost,upgradeGoldShortfall:Math.max(0,maxAllUpgradeCost-game.gold),
  canUpgradeAllTowersToMax:maxAllUpgradeCost<=game.gold,affordableNextUpgrades,
  kills: game.kills, bossKills: log.bossKills, bossLeaks:log.bossLeaks, leaks: log.leaks, towerDestroys: log.towerDestroys,
  repairSpending: log.repairSpending, researchChoices:log.research.length, research:{...game.research}, progress: log.progress,
  casts:log.casts,castSpending:log.castSpending,eventsDrained: log.events, ticks: log.ticks, defeat: log.defeat,
  earlyBosses:log.bossMilestones.filter(m=>m.wave<=20).map(m=>({wave:m.wave,boss:m.boss,killed:m.killed,escaped:m.escaped,
    goldBefore:m.before.gold,livesBefore:m.before.lives,antiAirBefore:m.before.towers.filter(t=>['arcane','archer','frost'].includes(t.type)).map(t=>`${t.type}:${t.level}/${t.element||'-'}`),
    researchBefore:m.before.research,goldAfter:m.after.gold,livesAfter:m.after.lives})),benchmarks,
  preparation: 'qa/final-preparation.json', injectedResources: false};
console.log(JSON.stringify(result));
if (game.phase !== 'victory') process.exitCode = 1;
