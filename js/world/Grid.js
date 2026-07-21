/**
 * Grid.js
 * ---------------------------------------------------------------------------
 * The tile grid: stores tile types, teleport pad pairings, and provides the
 * collision + coordinate helpers every gameplay system relies on. Rendering of
 * the floor, walls, crystals and teleport pads also lives here so the visual
 * language of the arena is defined in one place.
 * ---------------------------------------------------------------------------
 */
import { GRID, TILE, THEMES } from '../core/constants.js';
import { TAU, rgba, clamp, shadowEllipse } from '../core/utils.js';

export class Grid {
  constructor(theme) {
    this.theme = theme || THEMES.facility;
    this.cols = GRID.COLS;
    this.rows = GRID.ROWS;
    this.tile = GRID.TILE;
    this.worldW = this.cols * this.tile;
    this.worldH = this.rows * this.tile;
    this.cells = new Uint8Array(this.cols * this.rows);
    this.teleports = [];          // list of {c, r, linkIndex}
    this._pulse = 0;              // ambient animation clock
  }

  index(c, r) { return r * this.cols + c; }
  get(c, r) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return TILE.WALL;
    return this.cells[this.index(c, r)];
  }
  set(c, r, v) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
    this.cells[this.index(c, r)] = v;
  }

  /** World pixel -> tile coordinate. */
  toTile(x, y) {
    return { c: Math.floor(x / this.tile), r: Math.floor(y / this.tile) };
  }
  /** Tile coordinate -> world pixel centre. */
  toWorld(c, r) {
    return { x: c * this.tile + this.tile / 2, y: r * this.tile + this.tile / 2 };
  }

  isSolid(c, r) {
    const t = this.get(c, r);
    return t === TILE.WALL || t === TILE.CRYSTAL;
  }

  /**
   * Line-of-sight test used for pulse occlusion: returns true if a solid WALL
   * tile lies strictly between two world points (origin/target tiles excluded).
   * Samples densely enough (≤0.4 tile) that no full-tile wall can be skipped, so
   * players/crystals/cores behind a wall are shielded from the blast — walls act
   * as cover, the way bomb games work. (Destructible crystals do NOT block.)
   */
  lineBlockedByWall(x0, y0, x1, y1) {
    const t = this.tile;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1) return false;
    const steps = Math.ceil(len / (t * 0.4));
    const oc = Math.floor(x0 / t), or = Math.floor(y0 / t);
    const tc = Math.floor(x1 / t), tr = Math.floor(y1 / t);
    for (let i = 1; i < steps; i++) {
      const f = i / steps;
      const c = Math.floor((x0 + dx * f) / t);
      const r = Math.floor((y0 + dy * f) / t);
      if ((c === oc && r === or) || (c === tc && r === tr)) continue;
      if (this.get(c, r) === TILE.WALL) return true;
    }
    return false;
  }

  /**
   * Circle-vs-grid collision resolution. Given a desired position and radius,
   * returns a corrected {x, y} that does not overlap solid tiles. Uses simple
   * axis-separated push-out against the (up to) 9 surrounding tiles.
   */
  resolveCircle(x, y, radius) {
    const c0 = Math.floor((x - radius) / this.tile);
    const c1 = Math.floor((x + radius) / this.tile);
    const r0 = Math.floor((y - radius) / this.tile);
    const r1 = Math.floor((y + radius) / this.tile);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (!this.isSolid(c, r)) continue;
        const left = c * this.tile, top = r * this.tile;
        const nx = clamp(x, left, left + this.tile);
        const ny = clamp(y, top, top + this.tile);
        let dx = x - nx, dy = y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 < radius * radius) {
          const d = Math.sqrt(d2) || 0.0001;
          const push = radius - d;
          x += (dx / d) * push;
          y += (dy / d) * push;
        }
      }
    }
    return { x, y };
  }

  /** Destroy a crystal tile, returning true if one was there. */
  destroyCrystal(c, r) {
    if (this.get(c, r) === TILE.CRYSTAL) {
      this.set(c, r, TILE.FLOOR);
      return true;
    }
    return false;
  }

  /** Find the teleport pad linked to the given one. */
  linkedPad(pad) {
    return this.teleports.find((p) => p !== pad && p.linkIndex === pad.linkIndex);
  }

  update(dt) { this._pulse += dt; }

  /* ------------------------------ rendering ------------------------------ */

  /** Draw the arena floor as subtly bevelled tech panels within the camera view. */
  renderFloor(ctx, cam) {
    const t = this.tile;
    const startC = Math.max(0, Math.floor(cam.x / t));
    const endC = Math.min(this.cols - 1, Math.ceil((cam.x + cam.viewW) / t));
    const startR = Math.max(0, Math.floor(cam.y / t));
    const endR = Math.min(this.rows - 1, Math.ceil((cam.y + cam.viewH) / t));
    const th = this.theme;

    // The floor is drawn FLAT (a recessed tiled ground) so it never reads as a
    // raised block — only walls do. Tiles get a subtle tint plus inset seams.
    for (let r = startR; r <= endR; r++) {
      for (let c = startC; c <= endC; c++) {
        if (this.get(c, r) === TILE.WALL) continue;   // walls draw their own body
        const x = c * t, y = r * t;
        ctx.fillStyle = th.floorPanel;
        ctx.fillRect(x, y, t, t);
        // Recessed seam: dark on top/left, faint light on bottom/right.
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.30)';
        ctx.beginPath();
        ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + t);
        ctx.moveTo(x, y + 0.5); ctx.lineTo(x + t, y + 0.5);
        ctx.stroke();
        ctx.strokeStyle = th.floorEdge;
        ctx.beginPath();
        ctx.moveTo(x + t - 0.5, y + 1); ctx.lineTo(x + t - 0.5, y + t);
        ctx.moveTo(x + 1, y + t - 0.5); ctx.lineTo(x + t, y + t - 0.5);
        ctx.stroke();
      }
    }
  }

  /** Draw walls, crystals and teleport pads. */
  renderTiles(ctx, cam) {
    const t = this.tile;
    const startC = Math.max(0, Math.floor(cam.x / t));
    const endC = Math.min(this.cols - 1, Math.ceil((cam.x + cam.viewW) / t));
    const startR = Math.max(0, Math.floor(cam.y / t));
    const endR = Math.min(this.rows - 1, Math.ceil((cam.y + cam.viewH) / t));

    for (let r = startR; r <= endR; r++) {
      for (let c = startC; c <= endC; c++) {
        const type = this.get(c, r);
        if (type === TILE.WALL) this._drawWall(ctx, c, r, t);
        else if (type === TILE.CRYSTAL) this._drawCrystal(ctx, c, r, t);
        else if (type === TILE.TELEPORT) this._drawTeleport(ctx, c, r, t);
      }
    }
  }

  _drawWall(ctx, c, r, t) {
    const th = this.theme;
    const x = c * t, y = r * t, pad = 2, rad = 8, lift = 6;
    // Strong contact shadow so the block clearly floats above the flat floor.
    shadowEllipse(ctx, x + t / 2, y + t - 1, t * 0.54, t * 0.22, 0.5);
    // Height/side: a darker base filling the tile; its lower band shows below
    // the raised top face, giving the wall obvious thickness.
    this._roundRect(ctx, x + pad, y + pad, t - pad * 2, t - pad * 2, rad);
    ctx.fillStyle = th.wallBot;
    ctx.fill();
    // Raised top face, lifted up so the side band is visible beneath it.
    this._roundRect(ctx, x + pad, y + pad - lift, t - pad * 2, t - pad * 2, rad);
    const g = ctx.createLinearGradient(x, y - lift, x, y + t - lift);
    g.addColorStop(0, th.wallTop);
    g.addColorStop(1, th.wallBot);
    ctx.fillStyle = g;
    ctx.fill();
    // Bright neon rim around the top face makes walls pop as solid obstacles.
    ctx.lineWidth = 2;
    ctx.strokeStyle = th.wallEdge;
    ctx.stroke();
    // Top light strip for a bevelled, raised read.
    ctx.beginPath();
    ctx.moveTo(x + pad + 6, y + pad - lift + 3);
    ctx.lineTo(x + t - pad - 6, y + pad - lift + 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /**
   * Destructible crystal tile drawn as an embedded ORE CLUSTER — a rocky base
   * with several faceted mineral spires — so it reads as a mineable resource /
   * cover, clearly distinct from the small floating collectible shards.
   */
  _drawCrystal(ctx, c, r, t) {
    const cx = c * t + t / 2, cy = r * t + t / 2;
    const pulse = 0.5 + 0.5 * Math.sin(this._pulse * 2.5 + (c + r));
    const base = cy + t * 0.24;                 // crystals sit on this ground line
    shadowEllipse(ctx, cx, base + 3, t * 0.34, t * 0.14, 0.3);

    // Rocky mound the crystals grow out of.
    ctx.beginPath();
    ctx.moveTo(cx - t * 0.30, base + 2);
    ctx.quadraticCurveTo(cx - t * 0.20, base - t * 0.10, cx, base - t * 0.06);
    ctx.quadraticCurveTo(cx + t * 0.22, base - t * 0.10, cx + t * 0.30, base + 2);
    ctx.closePath();
    const rock = ctx.createLinearGradient(0, base - t * 0.14, 0, base + 4);
    rock.addColorStop(0, '#2c3a4e');
    rock.addColorStop(1, '#141c28');
    ctx.fillStyle = rock;
    ctx.fill();

    // Ambient glow pooled at the base.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(cx, base - t * 0.06, 1, cx, base - t * 0.06, t * 0.34);
    gl.addColorStop(0, rgba('#6fe8ff', 0.35 + pulse * 0.25));
    gl.addColorStop(1, rgba('#6fe8ff', 0));
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(cx, base - t * 0.06, t * 0.34, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Three faceted spires of varying height/lean.
    const spire = (dx, h, w, lean) => {
      const x = cx + dx, y = base - t * 0.04;
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.lineTo(x - w * 0.55, y - h * 0.72);
      ctx.lineTo(x + lean, y - h);
      ctx.lineTo(x + w * 0.55, y - h * 0.72);
      ctx.lineTo(x + w, y);
      ctx.closePath();
      const g = ctx.createLinearGradient(x - w, y - h, x + w, y);
      g.addColorStop(0, '#b6fbff');
      g.addColorStop(0.5, '#4fc6e8');
      g.addColorStop(1, '#1f7fb0');
      ctx.shadowColor = 'rgba(120,240,255,0.8)';
      ctx.shadowBlur = 8 + pulse * 8;
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowBlur = 0;
      // Bright front facet edge.
      ctx.beginPath();
      ctx.moveTo(x + lean, y - h);
      ctx.lineTo(x, y);
      ctx.strokeStyle = rgba('#ffffff', 0.5 + pulse * 0.3);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    };
    spire(-t * 0.16, t * 0.34, t * 0.11, -t * 0.03);   // left, shorter
    spire(t * 0.15, t * 0.30, t * 0.10, t * 0.03);      // right, shorter
    spire(0, t * 0.50, t * 0.13, 0);                    // centre, tall
  }

  _drawTeleport(ctx, c, r, t) {
    const cx = c * t + t / 2, cy = r * t + t / 2;
    const spin = this._pulse * 1.5;
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 3; i++) {
      const rad = t * (0.16 + i * 0.10);
      const a = 0.4 - i * 0.1 + 0.2 * Math.sin(this._pulse * 4 + i);
      ctx.beginPath();
      ctx.strokeStyle = rgba('#c76bff', a);
      ctx.lineWidth = 2;
      ctx.arc(0, 0, rad, spin + i, spin + i + Math.PI * 1.4);
      ctx.stroke();
    }
    ctx.fillStyle = rgba('#e3b3ff', 0.6);
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
