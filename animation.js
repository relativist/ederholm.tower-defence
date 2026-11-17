(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SpriteFrames = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  function finiteNonnegative(value) {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function stateFor(def, requested) {
    const states = def && def.states || {};
    if (states[requested]) return states[requested];
    if (states.idle) return states.idle;
    if (states.walk) return states.walk;
    return { frames: [0], fps: 1, loop: true };
  }

  function select(def, state, elapsed, offset) {
    const animation = stateFor(def, state);
    const cols = Math.max(1, Math.floor(Number(def && def.cols) || 1));
    const rawFrames = Array.isArray(animation.frames) && animation.frames.length ? animation.frames : [0];
    const frames = rawFrames.map((frame) => Math.floor(Number(frame))).filter((frame) => Number.isFinite(frame) && frame >= 0 && frame < cols * Math.max(1, Math.floor(Number(def && def.rows) || 1)));
    const usable = frames.length ? frames : [0];
    const fps = Number.isFinite(animation.fps) && animation.fps > 0 ? animation.fps : 1;
    const duration = usable.length / fps;
    const time = finiteNonnegative(elapsed) + finiteNonnegative(offset);
    const progress = time * fps;
    const done = animation.loop !== true && progress >= usable.length;
    const framePosition = animation.loop === true
      ? Math.floor(progress) % usable.length
      : Math.min(usable.length - 1, Math.floor(progress));
    const index = usable[framePosition];
    return { index, col: index % cols, row: Math.floor(index / cols), done, duration };
  }

  function draw(ctx, image, def, options) {
    options = options || {};
    const selected = select(def, options.state, options.time, options.offset);
    const frameWidth = Number(def && def.frameWidth) || 1;
    const frameHeight = Number(def && def.frameHeight) || 1;
    const width = Number.isFinite(options.width) && options.width > 0 ? options.width : frameWidth;
    const height = Number.isFinite(options.height) && options.height > 0 ? options.height : width * frameHeight / frameWidth;
    const x = Number.isFinite(options.x) ? options.x : 0;
    const y = Number.isFinite(options.y) ? options.y : 0;
    const anchorY = Number.isFinite(def && def.anchorY) ? def.anchorY : 1;
    const alpha = Number.isFinite(options.alpha) ? Math.max(0, Math.min(1, options.alpha)) : 1;
    ctx.save();
    try {
      ctx.globalAlpha *= alpha;
      if (options.flip) {
        ctx.translate(2 * x, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(image,
        selected.col * frameWidth, selected.row * frameHeight, frameWidth, frameHeight,
        x - width / 2, y - height * anchorY, width, height);
    } finally {
      ctx.restore();
    }
    return selected;
  }

  return { select, draw };
});
