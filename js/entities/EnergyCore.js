/**
 * EnergyCore.js
 * ---------------------------------------------------------------------------
 * A deployed device that arms over a short fuse then releases a PulseWave.
 * Different core types (see CORE_TYPES) vary fuse time, wave radius and speed.
 * The RESONANT type additionally spawns delayed "echo" waves for extra reach.
 *
 * Cores can be detonated early via chain reaction when another wave reaches
 * them — this is what produces satisfying cascades across the arena.
 *
 * Each core type draws a distinct original glyph (circle / triangle / hexagon /
 * concentric rings) so players can read the board at a glance.
 * ---------------------------------------------------------------------------
 */
import { Entity } from './Entity.js';
import { TAU, rgba, easeOutCubic, shadowEllipse } from '../core/utils.js';
import { PulseWave } from './PulseWave.js';

export class EnergyCore extends Entity {
  /**
   * @param {number} x world x (snapped to tile centre)
   * @param {number} y world y
   * @param {object} type core type descriptor
   * @param {number} ownerFaction faction index
   * @param {string} color faction colour hex
   */
  constructor(x, y, type, ownerFaction, color) {
    super(x, y);
    this.type = type;
    this.ownerFaction = ownerFaction;
    this.color = color;
    this.fuse = type.fuse;
    this.timer = type.fuse;
    this.detonated = false;
    this.spin = 0;
    this.chainSource = null;   // the wave that chained us (avoids self-retrigger)
    this._tickAcc = 0;
  }

  /** Force immediate detonation via a chaining wave. */
  chainTrigger(game) {
    if (this.detonated) return;
    this.chainSource = game._activeChainWave || null;
    this.timer = 0.001;        // near-instant so cascades feel snappy
    game.sound.chain();
  }

  update(dt, game) {
    this.spin += dt * 2;
    this.timer -= dt;

    // Arming tick sound as the fuse runs down.
    this._tickAcc += dt;
    const tickRate = this.timer < this.fuse * 0.4 ? 0.14 : 0.3;
    if (this._tickAcc >= tickRate && this.timer > 0) {
      this._tickAcc = 0;
      game.sound.arm();
    }

    if (this.timer <= 0 && !this.detonated) this._detonate(game);
  }

  _detonate(game) {
    this.detonated = true;
    this.dead = true;

    game.spawnPulse(this.x, this.y, this.type, this.ownerFaction, this.color, this);

    // RESONANT cores emit additional delayed echo waves.
    if (this.type.echoes) {
      for (let i = 1; i <= this.type.echoes; i++) {
        game.scheduleEcho(this.x, this.y, this.type, this.ownerFaction, this.color,
          this.type.echoDelay * i, 1 - i * 0.22);
      }
    }

    // MAGNETIC cores yank every nearby core into an instant chain, streaking
    // particles inward for the "pull" read.
    if (this.type.magnet) {
      const m2 = this.type.magnet * this.type.magnet;
      for (const other of game.cores) {
        if (other === this || other.dead || other.detonated) continue;
        const dx = other.x - this.x, dy = other.y - this.y;
        if (dx * dx + dy * dy <= m2
            && !game.grid.lineBlockedByWall(this.x, this.y, other.x, other.y)) {
          const inward = Math.atan2(this.y - other.y, this.x - other.x);
          game.particles.trail(other.x, other.y, this.color, inward, 5);
          other.chainTrigger(game);
        }
      }
    }

    game.onCoreDetonated(this);
  }

  render(ctx) {
    const prog = 1 - this.timer / this.fuse;         // 0..1 arming progress
    const pulse = 0.5 + 0.5 * Math.sin(this.spin * 4 + prog * 12);
    const armGlow = easeOutCubic(prog);
    const r = 16;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Contact shadow (drawn before switching to additive glow).
    shadowEllipse(ctx, 0, 16, 20, 8, 0.3);

    ctx.globalCompositeOperation = 'lighter';

    // Danger telegraph — previews the EXACT blast radius on the floor so players
    // can judge how far to run. The pulse is a full circle (not a Bomberman
    // cross), so the whole ring is the danger zone. It clarifies as the fuse
    // nears zero and flashes urgently in the final moment.
    const R = this.type.radius;
    const warn = prog > 0.72 ? 0.5 + 0.5 * Math.sin(this.spin * 22) : 0;
    const fillR = R * (0.4 + 0.6 * prog);
    const stop = Math.max(0.02, Math.min(0.98, fillR / R));
    const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    fg.addColorStop(0, rgba(this.color, 0.05 + 0.12 * armGlow));
    fg.addColorStop(stop, rgba(this.color, 0.04 + 0.09 * armGlow));
    fg.addColorStop(1, rgba(this.color, 0));
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fill();
    // Dashed outer edge marks exactly where the wave stops.
    ctx.beginPath();
    ctx.arc(0, 0, R - 1.5, 0, TAU);
    ctx.strokeStyle = rgba(this.color, 0.14 + 0.34 * armGlow + warn * 0.4);
    ctx.lineWidth = 1.5 + warn * 2;
    ctx.setLineDash([7, 9]);
    ctx.lineDashOffset = -this.spin * 8;
    ctx.stroke();
    ctx.setLineDash([]);

    // Fuse ring: fills up as the core arms.
    ctx.beginPath();
    ctx.arc(0, 0, r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * prog);
    ctx.strokeStyle = rgba(this.color, 0.85);
    ctx.lineWidth = 3;
    ctx.stroke();

    // Body glow intensifies near detonation.
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10 + armGlow * 22 * (0.6 + pulse * 0.4);
    ctx.fillStyle = rgba(this.color, 0.35 + armGlow * 0.5);

    this._drawGlyph(ctx, r, pulse);

    ctx.restore();
  }

  /** Original per-type glyph — no borrowed iconography. */
  _drawGlyph(ctx, r, pulse) {
    ctx.beginPath();
    switch (this.type.glyph) {
      case 'triangle':
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + (i / 3) * TAU + this.spin;
          const px = Math.cos(a) * r, py = Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      case 'hex':
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + this.spin * 0.5;
          const px = Math.cos(a) * r, py = Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      case 'rings':
        ctx.arc(0, 0, r * 0.6, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = rgba(this.color, 0.7 + pulse * 0.3);
        ctx.stroke();
        return;
      case 'magnet': {
        // Horseshoe silhouette (gap at the bottom) + glowing pole tips.
        const g = 0.42;
        ctx.strokeStyle = rgba(this.color, 0.9);
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.72, Math.PI / 2 + g, Math.PI / 2 - g, true);
        ctx.stroke();
        ctx.lineCap = 'butt';
        for (const s of [1, -1]) {
          const a = Math.PI / 2 + g * s;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, 3, 0, TAU);
          ctx.fillStyle = rgba('#ffffff', 0.9);
          ctx.fill();
        }
        return;
      }
      case 'snow': {
        // Six-spoke snowflake.
        ctx.strokeStyle = rgba(this.color, 0.9);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + this.spin * 0.5;
          const ex = Math.cos(a) * r, ey = Math.sin(a) * r;
          const bx = Math.cos(a) * r * 0.6, by = Math.sin(a) * r * 0.6;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(ex, ey);
          ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + 0.5) * r * 0.24, by + Math.sin(a + 0.5) * r * 0.24);
          ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - 0.5) * r * 0.24, by + Math.sin(a - 0.5) * r * 0.24);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
        return;
      }
      default: // circle
        ctx.arc(0, 0, r * (0.7 + pulse * 0.15), 0, TAU);
    }
    ctx.fill();
    // core dot
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, TAU);
    ctx.fillStyle = rgba('#ffffff', 0.9);
    ctx.fill();
  }
}
