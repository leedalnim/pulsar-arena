/**
 * utils.js
 * ---------------------------------------------------------------------------
 * Small, dependency-free helpers shared across the whole engine: math,
 * random number generation, colour manipulation and geometry.
 * ---------------------------------------------------------------------------
 */

export const TAU = Math.PI * 2;

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};

export const angleBetween = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

/** Random float in [min, max). */
export const rand = (min, max) => min + Math.random() * (max - min);

/** Random integer in [min, max] inclusive. */
export const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

/** Pick a random element of an array. */
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/** Chance test: true with probability p (0..1). */
export const chance = (p) => Math.random() < p;

/** Fisher-Yates shuffle (in place) returning the same array. */
export const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/** Convert a hex colour (#rrggbb) to an {r,g,b} object. */
export const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

/** Build an rgba() string from a hex colour and alpha. */
export const rgba = (hex, a) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/** Ease helpers for soft animation. */
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * Draw a soft radial "contact shadow" ellipse at (cx, cy). Grounds top-down
 * objects so they don't look like they're floating. Uses source-over darkening
 * regardless of the caller's current composite/shadow state.
 */
export const shadowEllipse = (ctx, cx, cy, rx, ry, a = 0.32) => {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(0.7, `rgba(0,0,0,${a * 0.5})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/**
 * A tiny event emitter used to decouple gameplay (which raises events) from
 * feedback systems (sound, particles, camera shake) that react to them.
 */
export class Emitter {
  constructor() { this._map = new Map(); }
  on(type, fn) {
    if (!this._map.has(type)) this._map.set(type, new Set());
    this._map.get(type).add(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) { this._map.get(type)?.delete(fn); }
  emit(type, payload) {
    const set = this._map.get(type);
    if (set) for (const fn of set) fn(payload);
  }
}
