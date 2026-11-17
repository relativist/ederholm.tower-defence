const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const TD = require('../engine.js');

assert.equal(TD.PADS.length, 40);
assert.equal(Object.keys(TD.TOWERS).length, 6);
assert.equal(Object.keys(TD.ENEMIES).length, 11);
assert.equal(TD.TOTAL_WAVES, 30);
assert.equal(TD.MAX_TOWER_LEVEL, 8);
assert.equal(TD.MAX_RESEARCH_LEVEL, 7);
for (const n of [-20, 0, 1, 100, 101, 1000]) {
  const info = TD.getWaveInfo(n);
  assert.ok(info.count >= 1 && info.count <= 100, `wave count clamped at ${n}`);
}
assert.equal(TD.getWaveInfo(-50).name, TD.getWaveInfo(1).name);
assert.notEqual(TD.getWaveInfo(999).name, TD.getWaveInfo(30).name);
const expectedBosses = Array.from({length: 6}, (_, i) => i===5?'boss20':['boss5', 'boss10', 'boss15', 'boss20'][i % 4]);
assert.deepEqual(Array.from({length: 6}, (_, i) => TD.getWaveInfo((i + 1) * 5).boss), expectedBosses);
assert.equal(Object.keys(TD.WAVE_BOSSES).length, 6);

// Research remains available through the full 30-wave campaign, and every
// branch can reach its cap without making a later choice impossible.
const research = new TD.Game();
let researchChoices = 0;
while (researchChoices < 25) {
  research.phase = 'research';
  const id = ['economy', 'military', 'fire', 'frost', 'storm'][researchChoices % 5];
  assert.equal(research.chooseResearch(id).ok, true, `research choice ${researchChoices + 1}`);
  researchChoices++;
}
while (researchChoices < 35) {
  research.phase = 'research';
  const id = Object.keys(research.research).find(key => research.research[key] < TD.MAX_RESEARCH_LEVEL);
  assert.ok(id, `research remains selectable at ${researchChoices}`);
  assert.equal(research.chooseResearch(id).ok, true);
  researchChoices++;
}
assert.ok(Object.values(research.research).every(level => level === TD.MAX_RESEARCH_LEVEL));
research.phase = 'research';
assert.equal(research.chooseResearch('economy').ok, false, 'all-max research rejects a 36th choice');

// Every tower can reach eight levels; prices rise, and milestones expose perks.
const tiers = new TD.Game();
tiers.gold = 1_000_000;
for (const [index, type] of Object.keys(TD.TOWERS).entries()) {
  const tower = tiers.build(type, index).tower;
  let previousCost = 0;
  const milestoneText = {};
  while (tower.level < TD.MAX_TOWER_LEVEL) {
    const option = tiers.getUpgradeOptions(tower)[0];
    assert.ok(option.cost > previousCost, `${type} upgrade costs rise at level ${tower.level + 1}`);
    previousCost = option.cost;
    assert.equal(tiers.upgrade(tower.id, option.id).ok, true, `${type} reaches level ${tower.level + 1}`);
    if ([4, 6, 8].includes(tower.level)) milestoneText[tower.level] = option.description;
  }
  assert.equal(tower.level, 8);
  for (const level of [4, 6, 8]) assert.ok(milestoneText[level]?.trim(), `${type} has level ${level} perk text`);
  assert.equal(tiers.getUpgradeOptions(tower).length, 0);
}

// Upgrades and enchantments can be purchased during combat without replacing
// the current wave, its enemies, or a damaged tower's remaining health ratio.
const liveUpgrades = new TD.Game();
liveUpgrades.gold = 50_000;
liveUpgrades.research.fire = 1;
liveUpgrades.research.frost = 1;
const liveTower = liveUpgrades.build('archer', 0).tower;
liveUpgrades.phase = 'wave';
liveUpgrades.wave = 3;
const liveEnemy = makeEnemy(990);
liveUpgrades.enemies = [liveEnemy];
const liveEnemyBefore = {id: liveEnemy.id, hp: liveEnemy.hp};
const liveWave = liveUpgrades.wave;
const healthRatio = .5;
liveTower.hp = Math.round(liveTower.maxHp * healthRatio);
let option = liveUpgrades.getUpgradeOptions(liveTower)[0];
let goldBeforeAction = liveUpgrades.gold;
assert.equal(liveUpgrades.upgrade(liveTower.id, option.id).ok, true,
  'specialization is available during a wave');
assert.equal(liveTower.level, 2);
assert.equal(liveTower.branch, option.id);
assert.equal(liveUpgrades.gold, goldBeforeAction - option.cost,
  'wave specialization spends its displayed cost');
assert.equal(liveTower.hp, Math.round(liveTower.maxHp * healthRatio),
  'upgrade preserves the tower health ratio');

option = liveUpgrades.getUpgradeOptions(liveTower)[0];
goldBeforeAction = liveUpgrades.gold;
assert.equal(liveUpgrades.upgrade(liveTower.id, option.id).ok, true,
  'later upgrade tiers are available during a wave');
assert.equal(liveTower.level, 3);
assert.equal(liveUpgrades.gold, goldBeforeAction - option.cost);

let enchantCost = liveUpgrades.getEnchantCost(liveTower);
goldBeforeAction = liveUpgrades.gold;
assert.equal(liveUpgrades.enchant(liveTower.id, 'fire').ok, true,
  'enchanting is available during a wave');
assert.equal(liveTower.element, 'fire');
assert.equal(liveUpgrades.gold, goldBeforeAction - enchantCost);
enchantCost = liveUpgrades.getEnchantCost(liveTower);
goldBeforeAction = liveUpgrades.gold;
assert.equal(liveUpgrades.enchant(liveTower.id, 'frost').ok, true,
  'changing an enchantment is available during a wave');
assert.equal(liveTower.element, 'frost');
assert.equal(liveUpgrades.gold, goldBeforeAction - enchantCost);
assert.equal(liveUpgrades.wave, liveWave);
assert.equal(liveUpgrades.phase, 'wave');
assert.deepEqual(liveUpgrades.enemies.map(e => ({id: e.id, hp: e.hp})), [liveEnemyBefore],
  'upgrades and enchantments preserve enemies in the current wave');

const rejectedLiveActions = new TD.Game();
rejectedLiveActions.gold = 50_000;
rejectedLiveActions.research.fire = 1;
const rejectedLiveTower = rejectedLiveActions.build('archer', 0).tower;
for (const phase of ['research', 'victory', 'defeat']) {
  rejectedLiveActions.phase = phase;
  assert.equal(rejectedLiveActions.upgrade(rejectedLiveTower.id).ok, false,
    `upgrade stays unavailable in ${phase}`);
  assert.equal(rejectedLiveActions.enchant(rejectedLiveTower.id, 'fire').ok, false,
    `enchant stays unavailable in ${phase}`);
}
rejectedLiveActions.phase = 'wave';
rejectedLiveActions.gold = 0;
assert.equal(rejectedLiveActions.upgrade(rejectedLiveTower.id).ok, false,
  'upgrade still checks the available gold during a wave');
assert.equal(rejectedLiveActions.enchant(rejectedLiveTower.id, 'fire').ok, false,
  'enchant still checks the available gold during a wave');
rejectedLiveActions.gold = 50_000;
rejectedLiveActions.research.fire = 0;
assert.equal(rejectedLiveActions.enchant(rejectedLiveTower.id, 'fire').ok, false,
  'enchant still requires its research during a wave');
rejectedLiveTower.hp = 0;
rejectedLiveActions.research.fire = 1;
assert.equal(rejectedLiveActions.enchant(rejectedLiveTower.id, 'fire').ok, false,
  'destroyed towers cannot be enchanted during a wave');

// Repair is based on damage and the saved construction value.
const maintenance = new TD.Game();
maintenance.gold = 50_000;
const structure = maintenance.build('archer', 0).tower;
structure.hp = Math.floor(structure.maxHp / 2);
const repairCost = maintenance.getRepairCost(structure);
assert.ok(repairCost > 0);
const beforeRepairGold = maintenance.gold;
assert.equal(maintenance.repair(structure.id).ok, true);
assert.equal(maintenance.gold, beforeRepairGold - repairCost);
assert.equal(structure.hp, structure.maxHp);
assert.equal(maintenance.getRepairCost(structure), 0);
assert.equal(maintenance.repair(structure.id).ok, false, 'full-health tower does not consume a repair');
maintenance.lives = 0;
assert.equal(TD.Game.restore({...maintenance.serialize(), lives: 0}).lives, 0,
  'save restoration preserves zero lives');

// V2 saves round-trip, and legacy victory saves migrate to the expanded map.
const save = maintenance.serialize();
assert.equal(save.v, 2);
const restored = TD.Game.restore(save);
assert.equal(restored.wave, maintenance.wave);
assert.equal(restored.lives, 0);
assert.equal(restored.towers[0].maxHp, structure.maxHp);
const oldVictory = TD.Game.restore({v: 1, phase: 'victory', wave: 20, gold: 80,
  lives: 4, towers: [], research: {military: 5}, stats: {wavesWon: 20}});
assert.equal(oldVictory.wave, 20);
assert.equal(oldVictory.phase, 'build', 'old victory becomes the expanded campaign build boundary');
const preparation={v:2,wave:29,phase:'build',gold:100,lives:20};
assert.equal(TD.Game.restore(preparation).wave,29);

function makeEnemy(id, type='raider', affinity=null, fly=false) {
  return {id, type, name:type, affinity, hp:100_000, maxHp:100_000, armor:0,
    marked:0, burn:0, burnDps:0, poison:0, poisonDps:0, slow:0, slowFactor:1,
    x:500, y:325, radius:10, progress:500, fly, alive:true};
}

// Exercise each tower's real attack handler for each enchantment.
function attackOnce(type, element, affinity='fire') {
  const game = new TD.Game();
  game.gold = 100_000;
  game.research[element] = 1;
  const tower = game.build(type, 0).tower;
  tower.element = element;
  const target = makeEnemy(100, 'raider', affinity);
  target.x = tower.x + 20; target.y = tower.y;
  const nearby = makeEnemy(101, 'raider', affinity);
  nearby.x = target.x + 26; nearby.y = target.y;
  game.enemies = [target, nearby];
  game.phase = 'wave';
  const stats = game.getTowerStats(tower);
  if (type === 'trap') {
    game.triggerTrap(tower, stats, target);
  } else if (type === 'barracks') {
    game.ensureTroops(tower, stats);
    for (const troop of game.troops) troop.cooldown = 0;
    game.updateTroops(.06);
  } else {
    tower.cooldown = 0;
    game.updateTowers(.06);
    const projectile = game.projectiles.find(p => p.targetId === target.id);
    assert.ok(projectile, `${type}/${element} launches an attack`);
    game.impact(target, projectile, tower);
  }
  return {game, target, nearby};
}

for (const type of Object.keys(TD.TOWERS)) for (const element of ['fire', 'frost', 'storm']) {
  const {game, target, nearby} = attackOnce(type, element);
  const neutralPath = attackOnce(type, element, null);
  assert.ok(target.hp < target.maxHp, `${type}/${element} damages the main target`);
  assert.ok(game.getDamageMultiplier(target, element) > 0, `${type}/${element} resolves enemy traits`);
  const directMultiplier = (target.maxHp - target.hp) /
    (neutralPath.target.maxHp - neutralPath.target.hp);
  assert.ok(Math.abs(directMultiplier - game.getDamageMultiplier(target, element)) < .015,
    `${type}/${element} direct attack applies affinity damage multiplier`);
  if (element === 'fire') assert.ok(target.burn > 0, `${type} fire enchantment applies burn`);
  if (element === 'frost') assert.ok(target.slow > 0, `${type} frost enchantment applies slow`);
  if (element === 'storm') assert.ok(nearby.hp < nearby.maxHp, `${type} storm chain damages nearby target`);
}

// Enemy affinities affect direct and status damage, including DoT ticks.
for (const [affinity, weak, resistant] of [['fire', 'frost', 'fire'], ['frost', 'fire', 'frost'], ['storm', 'fire', 'storm']]) {
  const game = new TD.Game();
  const enemy = makeEnemy(1, 'raider', affinity);
  assert.ok(game.getDamageMultiplier(enemy, weak) > 1);
  assert.ok(game.getDamageMultiplier(enemy, resistant) < 1);
  const beforeDirect = enemy.hp;
  game.damageEnemy(enemy, 100, weak);
  const weakDamage = beforeDirect - enemy.hp;
  const beforeResist = enemy.hp;
  game.damageEnemy(enemy, 100, resistant);
  assert.ok(beforeResist - enemy.hp < weakDamage, `${affinity} resistance reduces direct damage`);
  const burnTarget = makeEnemy(2, 'raider', affinity);
  burnTarget.burn = 1; burnTarget.burnDps = 100;
  game.enemies = [burnTarget]; game.phase = 'wave';
  const beforeBurn = burnTarget.hp;
  game.updateEnemies(.06);
  const burnDamage = beforeBurn - burnTarget.hp;
  assert.ok(burnDamage > 0, `${affinity} burn DoT ticks`);
  const neutralBurn = makeEnemy(3);
  neutralBurn.burn = 1; neutralBurn.burnDps = 100; game.enemies = [neutralBurn];
  const beforeNeutralBurn = neutralBurn.hp;
  game.updateEnemies(.06);
  assert.ok(Math.abs(burnDamage / (beforeNeutralBurn - neutralBurn.hp) -
    game.getDamageMultiplier(burnTarget, 'fire')) < .02, `${affinity} burn DoT applies resistance/weakness`);
  const poisonTarget = makeEnemy(4, 'raider', affinity);
  poisonTarget.poison = 1; poisonTarget.poisonDps = 100; game.enemies = [poisonTarget];
  const beforePoison = poisonTarget.hp;
  game.updateEnemies(.06);
  assert.ok(Math.abs((beforePoison - poisonTarget.hp) / 6 - game.getDamageMultiplier(poisonTarget, 'poison')) < .02,
    `${affinity} poison DoT uses trait multiplier`);
}

// Mortar target selection and splash, plus storm-chain, must exclude flying units.
const antiAir = new TD.Game();
antiAir.gold = 100_000;
const mortar = antiAir.build('mortar', 0).tower;
mortar.element = 'storm';
const flyer = makeEnemy(200, 'wraith', null, true);
flyer.x = mortar.x + 20; flyer.y = mortar.y;
const ground = makeEnemy(201);
ground.x = mortar.x + 24; ground.y = mortar.y;
antiAir.enemies = [flyer, ground];
antiAir.phase = 'wave'; mortar.cooldown = 0;
antiAir.updateTowers(.06);
const mortarShot = antiAir.projectiles.find(p => p.type === 'mortar');
assert.ok(mortarShot && mortarShot.targetId !== flyer.id, 'mortar does not target a flyer');
antiAir.impact(ground, mortarShot, mortar);
assert.equal(flyer.hp, flyer.maxHp, 'mortar splash cannot hit a flyer');
// Boss warning precedes impact; defeating the boss during telegraph cancels it.
function siegeGame(killBoss, destroyTower=false) {
  const game = new TD.Game(); game.gold = 100_000; game.wave = 30;
  const tower = game.build('archer', 13).tower; game.phase = 'wave';
  if (destroyTower) tower.hp = 1;
  const boss = makeEnemy(300, 'boss20'); boss.x = tower.x; boss.y = tower.y;
  boss.hp = killBoss ? 1 : 10_000; boss.maxHp = boss.hp;
  boss.siegeCooldown = 0; boss.siegeTimer = 0; boss.siegeTarget = null;
  game.enemies = [boss];
  game.updateEnemies(.06);
  const warning = game.drainEvents().find(e => e.type === 'siege-warning');
  assert.ok(warning, 'boss telegraphs before siege hit');
  if (killBoss) game.damageEnemy(boss, 10, 'arcane');
  boss.siegeTimer = .06;
  game.updateEnemies(.06);
  const events = game.drainEvents();
  return {warning, events};
}
assert.ok(siegeGame(false).events.some(e => e.type === 'tower-hit'));
assert.ok(!siegeGame(true).events.some(e => e.type === 'tower-hit'), 'dead boss cannot complete telegraphed siege');
const destroyed = siegeGame(false, true);
assert.ok(destroyed.events.some(e => e.type === 'tower-destroyed'));

// The last boss escaping on wave 30 is the terminal loss condition.
const escape = new TD.Game(); escape.phase = 'wave'; escape.wave = 30; escape.spawn('boss20');
const lastBoss = escape.enemies[0];
lastBoss.progress = TD.PATH.slice(1).reduce((sum, p, i) => {
  const q = TD.PATH[i]; return sum + Math.hypot(p.x - q.x, p.y - q.y);
}, 0) - 1;
escape.update(.06);
assert.equal(escape.phase, 'defeat');
assert.equal(escape.defeatReason, 'last-boss-escaped');

console.log(JSON.stringify({result:'pass', waves:TD.TOTAL_WAVES, bossWaves:expectedBosses.length,
  towerTypes:Object.keys(TD.TOWERS).length, enemyTypes:Object.keys(TD.ENEMIES).length,
  tierCases:Object.keys(TD.TOWERS).length, elementalAttackCases:Object.keys(TD.TOWERS).length*3,
  affinityCases:3, bossSiegeCases:3, finalBossEscape:escape.defeatReason,
  preparationWave:preparation.wave, preparationPhase:preparation.phase}));

// Construction and upgrades keep combat running.
const combatBuild=new TD.Game();combatBuild.gold=10000;combatBuild.startWave();
assert.equal(combatBuild.build('archer',0).ok,true);
assert.equal(combatBuild.upgrade(combatBuild.towers[0].id,'a').ok,true);
assert.equal(combatBuild.phase,'wave');
const auto=new TD.Game();auto.autoWaves=true;auto.wave=29;auto.phase='research';
assert.equal(auto.chooseResearch('storm').ok,true);auto.startWave();
assert.equal(auto.wave,30);auto.finishWave();
assert.equal(auto.phase,'wave');assert.equal(auto.wave,31);assert.equal(auto.research.storm,2);
auto.research.storm=7;const beforeGold=auto.gold;auto.finishWave();
assert.equal(auto.wave,32);assert.equal(auto.research.storm,7);assert.ok(auto.gold>beforeGold);
const savedAuto=TD.Game.restore(auto.serialize());
assert.equal(savedAuto.autoWaves,true);assert.equal(savedAuto.lastResearch,'storm');assert.equal(savedAuto.wave,32);
auto.autoWaves=false;auto.finishWave();assert.equal(auto.phase,'victory');
const firstAuto=new TD.Game();firstAuto.autoWaves=true;firstAuto.startWave();firstAuto.finishWave();
assert.equal(firstAuto.phase,'research');assert.equal(firstAuto.lastResearch,null);
console.log('Combat construction, auto waves, cap 7, persistence and stop: PASS');
