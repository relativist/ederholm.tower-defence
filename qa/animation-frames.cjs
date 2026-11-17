'use strict';

const assert = require('node:assert/strict');
const SpriteFrames = require('../animation.js');

const def = {
  cols: 4, rows: 3, frameWidth: 32, frameHeight: 40, anchorY: 0.86,
  states: {
    walk: { frames: [0, 1, 2, 3], fps: 8, loop: true },
    attack: { frames: [4, 5, 6, 7], fps: 9, loop: true },
    die: { frames: [8, 9, 10, 11], fps: 5, loop: false },
    idle: { frames: [0], fps: 1, loop: true },
  },
};

assert.deepEqual(SpriteFrames.select(def, 'walk', 0.25), { index: 2, col: 2, row: 0, done: false, duration: 0.5 });
assert.equal(SpriteFrames.select(def, 'walk', 0.5).index, 0, 'walk wraps at clip duration');
assert.equal(SpriteFrames.select(def, 'attack', 1 / 9).index, 5, 'attack advances by its own fps');
assert.equal(SpriteFrames.select(def, 'die', 0.8).index, 11, 'death clamps to last frame');
assert.equal(SpriteFrames.select(def, 'die', 0.8).done, true, 'death finishes after duration');
assert.equal(SpriteFrames.select(def, 'die', 0.79).done, false);
assert.equal(SpriteFrames.select(def, 'walk', -1).index, 0, 'negative time starts at first frame');
assert.equal(SpriteFrames.select(def, 'walk', NaN).index, 0, 'NaN time starts at first frame');
assert.equal(SpriteFrames.select(def, 'unknown', 0).index, 0, 'unknown state falls back to idle');

const calls = [];
const alphaStack = [];
const ctx = {
  globalAlpha: 0.8,
  save() { alphaStack.push(this.globalAlpha); calls.push(['save']); },
  restore() { this.globalAlpha = alphaStack.pop(); calls.push(['restore']); },
  translate(...args) { calls.push(['translate', ...args]); },
  scale(...args) { calls.push(['scale', ...args]); },
  drawImage(...args) { calls.push(['drawImage', ...args]); },
};
const image = { width: 128, height: 120 };
const result = SpriteFrames.draw(ctx, image, def, { state: 'walk', time: 0.25, x: 50, y: 100, width: 64, flip: true, alpha: 0.5 });
assert.equal(result.index, 2);
const drawCall = calls.find((call) => call[0] === 'drawImage');
assert.deepEqual(drawCall.slice(1, 7), [image, 64, 0, 32, 40, 18]);
assert.ok(Math.abs(drawCall[7] - 31.2) < 1e-9, 'destination y follows ground anchor');
assert.deepEqual(drawCall.slice(8), [64, 80]);
assert.deepEqual(calls.filter((call) => ['translate', 'scale'].includes(call[0])), [['translate', 100, 0], ['scale', -1, 1]]);
assert.equal(calls[0][0], 'save');
assert.equal(calls[calls.length - 1][0], 'restore');
assert.equal(ctx.globalAlpha, 0.8, 'restore returns canvas state after alpha adjustment');

console.log('animation frame utility checks passed');
