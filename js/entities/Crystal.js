/**
 * Crystal.js
 * ---------------------------------------------------------------------------
 * A collectible energy shard that appears when a crystal tile is shattered by
 * a pulse. Shards drift, bob, gently magnetise toward nearby players, then are
 * collected on contact — restoring energy and awarding score. They fade out if
 * left uncollected so the board never clutters.
 * ---------------------------------------------------------------------------
 */
import { Entity } from './Entity.js';
import { CRYSTAL_CFG } from '../core/constants.js';
import { TAU, rgba, dist, angleBetween, shadowEllipse } from '../core/utils.js';

export class Crystal extends Entity {
  constructor(x, y) {
    super(x, y);
    this.life = CRYSTAL_CFG.SHARD_LIFETIME;
    this.spin = Math.random() * TAU;
    this.bob = Math.random() * TAU;
    this.baseY = y;
    this.collected = false;
  }

  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.spin += dt * 2;
    this.bob += dt * 3;

    // Magnetise toward the nearest living player within range.
    let nearest = null, nd = CRYSTAL_CFG.SHARD_MAGNET;
    for (const p of game.players) {
      if (p.downed) continue;
      const d = dist(this.x, this.y, p.x, p.y);
      if (d < nd) { nd = d; nearest = p; }
    }
    if (nearest) {
      const a = angleBetween(this.x, this.y, nearest.x, nearest.y);
      const pull = (1 - nd / CRYSTAL_CFG.SHARD_MAGNET) * 380;
      this.x += Math.cos(a) * pull * dt;
      this.baseY += Math.sin(a) * pull * dt;
      if (nd < nearest.radius + 8) {
        this.dead = true;
        game.onShardCollected(this, nearest);
      }
    }
    this.y = this.baseY + Math.sin(this.bob) * 3;
  }

  render(ctx) {
    const fade = Math.min(1, this.life / 2);      // fade out in last 2s
    const s = 9;
    // Ground shadow stays on the floor (doesn't bob with the shard).
    shadowEllipse(ctx, this.x, this.baseY + s * 0.7, s * 1.1, s * 0.5, 0.22 * fade);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = 'rgba(150,245,255,0.9)';
    ctx.shadowBlur = 14;
    // Diamond shard.
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.7, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.7, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, rgba('#c9fbff', fade));
    g.addColorStop(1, rgba('#37c2e6', fade));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }
}
