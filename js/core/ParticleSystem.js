/**
 * ParticleSystem.js
 * ---------------------------------------------------------------------------
 * A pooled particle system. Particles are recycled from a free list to avoid
 * garbage-collection spikes during heavy chain reactions. Every particle is a
 * soft glowing dot; higher level "bursts" are just convenience spawners.
 * ---------------------------------------------------------------------------
 */
import { rand, TAU, rgba } from './utils.js';

class Particle {
  constructor() { this.active = false; this.reset(); }
  reset() {
    this.x = this.y = 0;
    this.vx = this.vy = 0;
    this.life = 0; this.maxLife = 1;
    this.size = 2; this.color = '#fff';
    this.drag = 0.9; this.grow = 0;
  }
}

export class ParticleSystem {
  constructor(max = 1400) {
    this.pool = Array.from({ length: max }, () => new Particle());
    this.active = [];
  }

  _acquire() {
    const p = this.pool.pop();
    if (!p) return null;         // pool exhausted -> silently drop
    p.reset();
    p.active = true;
    this.active.push(p);
    return p;
  }

  /** Spawn a single particle with explicit config. */
  spawn(cfg) {
    const p = this._acquire();
    if (!p) return;
    Object.assign(p, cfg);
    p.maxLife = p.life;
  }

  /** Radial burst — used for detonations, hits, teleports. */
  burst(x, y, color, count = 24, speed = 240, spread = 1) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const s = rand(speed * 0.3, speed) * spread;
      this.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.35, 0.8), size: rand(2, 5), color,
        drag: 0.9, grow: rand(-3, 0),
      });
    }
  }

  /** A short directional spark trail (dash, movement). */
  trail(x, y, color, dir, count = 4) {
    for (let i = 0; i < count; i++) {
      const a = dir + rand(-0.5, 0.5);
      const s = rand(30, 130);
      this.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.2, 0.4), size: rand(1.5, 3.5), color,
        drag: 0.86, grow: -2,
      });
    }
  }

  /** Rising shard sparkle for crystal pickups. */
  sparkle(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x, y, vx: rand(-40, 40), vy: rand(-120, -30),
        life: rand(0.4, 0.9), size: rand(1.5, 3.5), color,
        drag: 0.94, grow: -1.5,
      });
    }
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.active.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.size = Math.max(0.2, p.size + p.grow * dt);
    }
  }

  /** Render with additive blending for a neon glow feel. */
  render(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.active) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fillStyle = rgba(p.color, a);
      ctx.fill();
    }
    ctx.restore();
  }

  clear() {
    while (this.active.length) {
      const p = this.active.pop();
      p.active = false;
      this.pool.push(p);
    }
  }
}
