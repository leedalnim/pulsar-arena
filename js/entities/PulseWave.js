/**
 * PulseWave.js
 * ---------------------------------------------------------------------------
 * The signature mechanic. When an Energy Core detonates it releases a PulseWave:
 * a ring that expands outward from `radius = 0` to the core's max radius. As the
 * ring FRONT sweeps across the world it:
 *   - shatters destructible crystals it touches,
 *   - knocks back + stuns unshielded players,
 *   - triggers (chains) other armed cores in range,
 *   - paints territory for the owning faction.
 *
 * Crucially this is a smooth circular wave, not a cross/plus explosion — a
 * distinct identity from grid-aligned bomb games.
 * ---------------------------------------------------------------------------
 */
import { Entity } from './Entity.js';
import { PULSE } from '../core/constants.js';
import { TAU, rgba, dist } from '../core/utils.js';

export class PulseWave extends Entity {
  /**
   * @param {number} x world x (centre)
   * @param {number} y world y (centre)
   * @param {object} type   core type descriptor (radius, waveSpeed...)
   * @param {number} ownerFaction faction index of the deploying player
   */
  constructor(x, y, type, ownerFaction) {
    super(x, y);
    this.type = type;
    this.ownerFaction = ownerFaction;
    this.radius = 0;
    this.maxRadius = type.radius;
    this.speed = type.waveSpeed;
    this.prevRadius = 0;
    this.hitPlayers = new Set(); // players are only hit once per wave
    this.color = null;           // assigned by Game from faction colour
  }

  update(dt, game) {
    this.prevRadius = this.radius;
    this.radius += this.speed * dt;

    const front = this.radius;
    const back = Math.max(0, this.prevRadius - PULSE.RING_THICKNESS);

    // --- Shatter crystals inside the ring band (front sweep) ---
    const grid = game.grid;
    const t = grid.tile;
    const c0 = Math.floor((this.x - front) / t);
    const c1 = Math.floor((this.x + front) / t);
    const r0 = Math.floor((this.y - front) / t);
    const r1 = Math.floor((this.y + front) / t);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const w = grid.toWorld(c, r);
        const d = dist(this.x, this.y, w.x, w.y);
        if (d <= front && d >= back && !grid.lineBlockedByWall(this.x, this.y, w.x, w.y)) {
          if (grid.destroyCrystal(c, r)) game.onCrystalDestroyed(c, r, this.ownerFaction);
        }
      }
    }

    // --- Paint territory along the sweep ---
    if (PULSE.CLAIM_ON_SWEEP) {
      game.territory.claimRing(this.x, this.y, front, this.ownerFaction);
    }

    // --- Knock back + stun players caught by the front ---
    for (const p of game.players) {
      if (p.downed) continue;
      if (this.hitPlayers.has(p)) continue;
      const d = dist(this.x, this.y, p.x, p.y);
      if (d <= front + p.radius && d >= back - p.radius
          && !game.grid.lineBlockedByWall(this.x, this.y, p.x, p.y)) {
        this.hitPlayers.add(p);
        game.onPulseHitPlayer(p, this, d);
      }
    }

    // --- Chain: trigger other armed cores the front reaches ---
    // Expose ourselves as the active chain source so triggered cores can avoid
    // immediately re-triggering us (prevents infinite feedback loops).
    game._activeChainWave = this;
    for (const core of game.cores) {
      if (core.dead || core.detonated) continue;
      if (core.chainSource === this) continue;
      const d = dist(this.x, this.y, core.x, core.y);
      if (d <= front && !game.grid.lineBlockedByWall(this.x, this.y, core.x, core.y)) {
        core.chainTrigger(game);
      }
    }
    game._activeChainWave = null;

    if (this.radius >= this.maxRadius) this.dead = true;
  }

  render(ctx) {
    const p = this.radius / this.maxRadius;      // 0..1 progress
    const alpha = (1 - p) * 0.9;
    const color = this.color || '#ffffff';

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Bright leading ring.
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, TAU);
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = 6;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.stroke();

    // Soft inner fill wash.
    const g = ctx.createRadialGradient(this.x, this.y, this.radius * 0.55,
      this.x, this.y, this.radius);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(1, rgba(color, alpha * 0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, TAU);
    ctx.fill();

    ctx.restore();
  }
}
