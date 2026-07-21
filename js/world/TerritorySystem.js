/**
 * TerritorySystem.js
 * ---------------------------------------------------------------------------
 * Tracks which faction "owns" each floor tile. Ownership is painted wherever a
 * player's pulse wave sweeps, and (subtly) around where a player stands. The
 * per-faction tile counts feed directly into scoring, so controlling space —
 * not kills — is how you win.
 *
 * Owned tiles are rendered as a soft translucent wash so the board visibly
 * shifts colour as the battle for territory swings.
 * ---------------------------------------------------------------------------
 */
import { TILE } from '../core/constants.js';
import { rgba } from '../core/utils.js';

export class TerritorySystem {
  /**
   * @param {Grid} grid
   * @param {Array} factions  faction descriptor objects (id + color)
   */
  constructor(grid, factions) {
    this.grid = grid;
    this.factions = factions;
    // owner[i] = faction index + 1, or 0 for neutral.
    this.owner = new Uint8Array(grid.cols * grid.rows);
    // charge[i] = 0..1 fade-in strength for smooth colour transitions.
    this.charge = new Float32Array(grid.cols * grid.rows);
    this.counts = new Array(factions.length).fill(0);
    this._recount();
  }

  _recount() {
    this.counts.fill(0);
    for (let i = 0; i < this.owner.length; i++) {
      const o = this.owner[i];
      if (o > 0) this.counts[o - 1]++;
    }
  }

  /** Claim a single tile for a faction index (0-based). */
  claim(c, r, factionIndex) {
    if (c < 0 || r < 0 || c >= this.grid.cols || r >= this.grid.rows) return;
    if (this.grid.get(c, r) !== TILE.FLOOR && this.grid.get(c, r) !== TILE.TELEPORT) return;
    const idx = r * this.grid.cols + c;
    const prev = this.owner[idx];
    const next = factionIndex + 1;
    if (prev === next) { this.charge[idx] = 1; return; }
    if (prev > 0) this.counts[prev - 1]--;
    this.owner[idx] = next;
    this.counts[factionIndex]++;
    this.charge[idx] = 0; // start faded, animate in
  }

  /** Claim all floor tiles a wave front (ring at radius) currently touches. */
  claimRing(cx, cy, radius, factionIndex) {
    const t = this.grid.tile;
    const c0 = Math.floor((cx - radius) / t);
    const c1 = Math.floor((cx + radius) / t);
    const r0 = Math.floor((cy - radius) / t);
    const r1 = Math.floor((cy + radius) / t);
    const inner = Math.max(0, radius - t);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const wc = c * t + t / 2, wr = r * t + t / 2;
        const d = Math.hypot(wc - cx, wr - cy);
        if (d <= radius && d >= inner
            && !this.grid.lineBlockedByWall(cx, cy, wc, wr)) {
          this.claim(c, r, factionIndex);
        }
      }
    }
  }

  tileCount(factionIndex) { return this.counts[factionIndex] || 0; }

  update(dt) {
    // Animate charge fade-in for a soft colour bloom.
    for (let i = 0; i < this.charge.length; i++) {
      if (this.owner[i] > 0 && this.charge[i] < 1) {
        this.charge[i] = Math.min(1, this.charge[i] + dt * 3);
      }
    }
  }

  _own(c, r) {
    if (c < 0 || r < 0 || c >= this.grid.cols || r >= this.grid.rows) return 0;
    return this.owner[r * this.grid.cols + c];
  }

  _round(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  render(ctx, cam) {
    const t = this.grid.tile;
    const startC = Math.max(0, Math.floor(cam.x / t));
    const endC = Math.min(this.grid.cols - 1, Math.ceil((cam.x + cam.viewW) / t));
    const startR = Math.max(0, Math.floor(cam.y / t));
    const endR = Math.min(this.grid.rows - 1, Math.ceil((cam.y + cam.viewH) / t));

    // Pass 1: soft rounded colour wash for each owned tile.
    for (let r = startR; r <= endR; r++) {
      for (let c = startC; c <= endC; c++) {
        const idx = r * this.grid.cols + c;
        const o = this.owner[idx];
        if (o === 0) continue;
        const color = this.factions[o - 1].color;
        ctx.fillStyle = rgba(color, 0.14 * this.charge[idx]);
        this._round(ctx, c * t + 2, r * t + 2, t - 4, t - 4, 7);
        ctx.fill();
      }
    }

    // Pass 2: glowing neon outline along the borders of each owned region.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let r = startR; r <= endR; r++) {
      for (let c = startC; c <= endC; c++) {
        const o = this.owner[r * this.grid.cols + c];
        if (o === 0) continue;
        const color = this.factions[o - 1].color;
        const a = 0.55 * this.charge[r * this.grid.cols + c];
        const x = c * t, y = r * t;
        ctx.strokeStyle = rgba(color, a);
        ctx.beginPath();
        if (this._own(c, r - 1) !== o) { ctx.moveTo(x + 4, y + 2.5); ctx.lineTo(x + t - 4, y + 2.5); }
        if (this._own(c, r + 1) !== o) { ctx.moveTo(x + 4, y + t - 2.5); ctx.lineTo(x + t - 4, y + t - 2.5); }
        if (this._own(c - 1, r) !== o) { ctx.moveTo(x + 2.5, y + 4); ctx.lineTo(x + 2.5, y + t - 4); }
        if (this._own(c + 1, r) !== o) { ctx.moveTo(x + t - 2.5, y + 4); ctx.lineTo(x + t - 2.5, y + t - 4); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
