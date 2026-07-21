/**
 * Item.js
 * ---------------------------------------------------------------------------
 * A floating item pickup. Spawns on a floor tile during a match, bobs with a
 * glowing halo, and is collected on contact by any living player — applying a
 * timed buff (or an instant effect) via Player.applyItem. Uncollected items
 * fade out after ITEM_CFG.LIFETIME so the board stays readable.
 *
 * Every icon is drawn procedurally from its `glyph`, echoing the concept
 * sheet's neon-token look without any image assets.
 * ---------------------------------------------------------------------------
 */
import { Entity } from './Entity.js';
import { ITEM_CFG } from '../core/constants.js';
import { TAU, rgba, dist, shadowEllipse } from '../core/utils.js';

export class Item extends Entity {
  constructor(x, y, def) {
    super(x, y);
    this.def = def;               // ITEMS entry
    this.life = ITEM_CFG.LIFETIME;
    this.baseY = y;
    this.bob = Math.random() * TAU;
    this.spin = 0;
  }

  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.bob += dt * 2.4;
    this.spin += dt * 1.6;
    this.y = this.baseY + Math.sin(this.bob) * 4;

    // Collected by the first living player within pickup range.
    const R = ITEM_CFG.PICKUP_RADIUS;
    for (const p of game.players) {
      if (p.downed) continue;
      if (dist(this.x, this.baseY, p.x, p.y) < R + p.radius) {
        this.dead = true;
        game.onItemCollected(this, p);
        return;
      }
    }
  }

  render(ctx) {
    const fade = Math.min(1, this.life / 2);   // fade out in last 2s
    const c = this.def.color, a = this.def.accent || '#ffffff';
    shadowEllipse(ctx, this.x, this.baseY + 12, 13, 6, 0.22 * fade);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = fade;

    // Rotating halo ring.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(this.spin);
    ctx.beginPath();
    ctx.arc(0, 0, 15, this.spin, this.spin + Math.PI * 1.5);
    ctx.strokeStyle = rgba(c, 0.7);
    ctx.lineWidth = 2;
    ctx.shadowColor = c;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();

    // Token disc.
    const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 13);
    g.addColorStop(0, a);
    g.addColorStop(0.6, c);
    g.addColorStop(1, rgba(c, 0.15));
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TAU);
    ctx.fillStyle = g;
    ctx.shadowColor = c;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Glyph.
    ctx.strokeStyle = '#0b1220';
    ctx.fillStyle = '#0b1220';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this._glyph(ctx, this.def.glyph);

    ctx.restore();
  }

  _glyph(ctx, glyph) {
    if (glyph === 'bolt') {              // OVERCHARGE — lightning
      ctx.beginPath();
      ctx.moveTo(2, -7); ctx.lineTo(-4, 1); ctx.lineTo(0, 1);
      ctx.lineTo(-2, 7); ctx.lineTo(4, -1); ctx.lineTo(0, -1);
      ctx.closePath();
      ctx.fill();
    } else if (glyph === 'chevron') {    // HASTE — double chevron
      ctx.beginPath();
      ctx.moveTo(-5, 2); ctx.lineTo(0, -4); ctx.lineTo(5, 2);
      ctx.moveTo(-5, 6); ctx.lineTo(0, 0); ctx.lineTo(5, 6);
      ctx.stroke();
    } else if (glyph === 'eye') {        // CLOAK — eye
      ctx.beginPath();
      ctx.moveTo(-7, 0); ctx.quadraticCurveTo(0, -6, 7, 0);
      ctx.quadraticCurveTo(0, 6, -7, 0); ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, TAU);
      ctx.fill();
    } else if (glyph === 'shield') {     // BARRIER — shield + check
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(6, -4); ctx.lineTo(6, 2);
      ctx.quadraticCurveTo(6, 7, 0, 8); ctx.quadraticCurveTo(-6, 7, -6, 2);
      ctx.lineTo(-6, -4); ctx.closePath(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3, 0); ctx.lineTo(-1, 3); ctx.lineTo(4, -3); ctx.stroke();
    } else if (glyph === 'warp') {        // BLINK — sparkle / teleport
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(1.6, -1.6); ctx.lineTo(8, 0); ctx.lineTo(1.6, 1.6);
      ctx.lineTo(0, 8); ctx.lineTo(-1.6, 1.6); ctx.lineTo(-8, 0); ctx.lineTo(-1.6, -1.6);
      ctx.closePath(); ctx.fill();
    } else if (glyph === 'magnet') {      // MAGNET — horseshoe
      ctx.beginPath();
      ctx.moveTo(-5, -6); ctx.lineTo(-5, 0);
      ctx.quadraticCurveTo(-5, 6, 0, 6); ctx.quadraticCurveTo(5, 6, 5, 0);
      ctx.lineTo(5, -6); ctx.stroke();
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(-5, -3.5);
      ctx.moveTo(5, -6); ctx.lineTo(5, -3.5); ctx.stroke();
    } else if (glyph === 'rapid') {       // RAPID CORE — fast-forward
      ctx.beginPath();
      ctx.moveTo(-6, -5); ctx.lineTo(-1, 0); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
    } else {                            // ENERGY — cell / battery
      ctx.beginPath();
      ctx.rect(-5, -6, 10, 12);
      ctx.moveTo(-2, -8.5); ctx.lineTo(2, -8.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(1, -3); ctx.lineTo(-2, 0.5); ctx.lineTo(1.5, 0.5); ctx.lineTo(-1, 4);
      ctx.stroke();
    }
  }
}
