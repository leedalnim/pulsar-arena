/**
 * HUD.js
 * ---------------------------------------------------------------------------
 * Draws the in-game heads-up display directly on the canvas (screen space, not
 * world space): the faction scoreboard, the local player's energy bar, ability
 * cooldown pips, the selected core type, the match timer, and a compact
 * minimap. Rendered after the world so it always sits on top.
 * ---------------------------------------------------------------------------
 */
import { CORE_TYPES, CORE_ORDER, PLAYER, TILE, ITEMS } from '../core/constants.js';
import { strings } from '../core/i18n.js';
import { TAU, rgba, clamp } from '../core/utils.js';

export class HUD {
  constructor() {
    this.font = '"Chakra Petch", system-ui, sans-serif';
  }

  render(ctx, game, W, H) {
    ctx.save();
    ctx.textBaseline = 'middle';
    this.T = strings(game.settings.lang);

    this._territoryBar(ctx, game, W);
    this._scoreboard(ctx, game, W);
    this._timer(ctx, game, W);
    this._stageLabel(ctx, game, W);
    if (game.localPlayer) this._playerPanel(ctx, game, W, H);
    if (game.localPlayer) this._buffs(ctx, game.localPlayer, W, H);
    if (game.coop && game.humans[1]) this._coopPanel(ctx, game.humans[1], W, H);
    this._minimap(ctx, game, W, H);

    ctx.restore();
  }

  /* --------------------------- active item buffs ------------------------- */
  _buffs(ctx, p, W, H) {
    const active = [];
    if (p.overchargeTimer > 0) active.push(['overcharge', p.overchargeTimer, ITEMS.overcharge.duration]);
    if (p.hasteTimer > 0) active.push(['haste', p.hasteTimer, ITEMS.haste.duration]);
    if (p.cloakTimer > 0) active.push(['cloak', p.cloakTimer, ITEMS.cloak.duration]);
    if (p.magnetTimer > 0) active.push(['magnet', p.magnetTimer, ITEMS.magnet.duration]);
    if (p.rapidTimer > 0) active.push(['rapidcore', p.rapidTimer, ITEMS.rapidcore.duration]);
    if (!active.length) return;

    const r = 15, gap = 40;
    const y = H - 92 - 16 - r - 12;                 // just above the player panel
    let x = W / 2 - ((active.length - 1) * gap) / 2;
    for (const [id, t, dur] of active) {
      const def = ITEMS[id];
      // Base disc.
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = rgba(def.color, 0.22);
      ctx.fill();
      // Remaining-time sweep.
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(t / dur, 0, 1));
      ctx.closePath();
      ctx.fillStyle = rgba(def.color, 0.5);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Seconds left.
      ctx.fillStyle = '#eaf3ff';
      ctx.font = `700 12px ${this.font}`;
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.ceil(t)), x, y + 0.5);
      x += gap;
    }
  }

  /* ---------------------------- scoreboard ------------------------------- */
  // Slim horizontal score strip along the very top (no filled box) so the
  // arena corners stay clear. Each faction is a chip + score; the human is
  // marked, the leader crowned.
  _scoreboard(ctx, game, W) {
    const scores = game.scores();
    const y = 30, startX = 16, cellW = 58;
    scores.forEach((s, i) => {
      const bx = startX + i * cellW;
      // colour chip
      ctx.beginPath();
      ctx.arc(bx + 7, y, 6, 0, TAU);
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      if (i === 0 && s.total > 0) this._crown(ctx, bx + 7, y - 11, 9, '#ffd76b');
      // "you" tick under the human's chip
      if (s.isHuman) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 8px ${this.font}`;
        ctx.textAlign = 'center';
        ctx.fillText(this.T.youTag, bx + 7, y + 14);
      }
      // score
      ctx.fillStyle = s.color;
      ctx.font = `700 16px ${this.font}`;
      ctx.textAlign = 'left';
      ctx.fillText(String(s.total), bx + 18, y);
    });
  }

  /* -------------------------- territory bar ------------------------------ */
  // Slim top strip showing each faction's share of claimed tiles (à la 62/37).
  _territoryBar(ctx, game, W) {
    const counts = game.territory.counts;
    const total = counts.reduce((a, b) => a + b, 0);
    const h = 10, x = 16, y = 4, boxW = W - 32;

    this._round(ctx, x, y, boxW, h, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    if (total <= 0) return;

    ctx.save();
    this._round(ctx, x, y, boxW, h, 5);
    ctx.clip();
    let cx = x;
    const facs = game.factions.slice(0, counts.length);
    facs.forEach((f, i) => {
      const w = (counts[i] / total) * boxW;
      if (w <= 0.5) return;
      ctx.fillStyle = rgba(f.color, 0.85);
      ctx.fillRect(cx, y, w, h);
      if (w > 42) {
        ctx.fillStyle = 'rgba(6,10,18,0.92)';
        ctx.font = `700 9px ${this.font}`;
        ctx.textAlign = 'center';
        ctx.fillText(Math.round((counts[i] / total) * 100) + '%', cx + w / 2, y + h / 2 + 0.5);
      }
      cx += w;
    });
    ctx.restore();
  }

  // Minimal three-peak crown for the leader.
  _crown(ctx, cx, cy, s, color) {
    const w = s, h = s * 0.62;
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy - h / 2);
    ctx.lineTo(cx - w / 4, cy + h / 6);
    ctx.lineTo(cx, cy - h / 2 - s * 0.16);
    ctx.lineTo(cx + w / 4, cy + h / 6);
    ctx.lineTo(cx + w / 2, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy + h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ------------------------------- timer --------------------------------- */
  _timer(ctx, game, W) {
    const t = Math.max(0, Math.ceil(game.timeLeft));
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    const s = String(t % 60).padStart(2, '0');
    const label = `${m}:${s}`;
    const boxW = 120, x = W / 2 - boxW / 2, y = 16;
    this._panel(ctx, x, y, boxW, 40, 12);
    ctx.font = `700 22px ${this.font}`;
    ctx.fillStyle = t <= 15 ? '#ff6b8a' : '#eaf3ff';
    if (t <= 15) { ctx.shadowColor = '#ff6b8a'; ctx.shadowBlur = 12; }
    // Fixed digit cells so the clock doesn't wobble as numbers change width.
    this._drawFixed(ctx, label, W / 2, y + 21, 14);
    ctx.shadowBlur = 0;
  }

  /** Stage / boss indicator under the timer (stage mode only). */
  _stageLabel(ctx, game, W) {
    if (game.mode !== 'stages') return;
    const boss = game.isBossStage;
    const txt = boss ? `⚠ BOSS · STAGE ${game.stage}` : `STAGE ${game.stage}`;
    ctx.font = `700 12px ${this.font}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = boss ? '#ff5a6a' : 'rgba(210,225,245,0.85)';
    if (boss) { ctx.shadowColor = '#ff5a6a'; ctx.shadowBlur = 10; }
    ctx.fillText(txt, W / 2, 66);
    ctx.shadowBlur = 0;
  }

  /** Render text with a fixed advance per character (stable, non-jittery). */
  _drawFixed(ctx, text, cx, cy, cellW) {
    const prev = ctx.textAlign;
    ctx.textAlign = 'center';
    let x = cx - (text.length * cellW) / 2 + cellW / 2;
    for (const ch of text) {
      // Punctuation reads better on a slightly narrower cell.
      const w = ch === ':' ? cellW * 0.6 : cellW;
      ctx.fillText(ch, x + (w - cellW) / 2, cy);
      x += w;
    }
    ctx.textAlign = prev;
  }

  /* --------------------------- player panel ------------------------------ */
  _playerPanel(ctx, game, W, H) {
    const p = game.localPlayer;
    const boxW = 260, boxH = 92;
    const x = W / 2 - boxW / 2, y = H - boxH - 16;
    this._panel(ctx, x, y, boxW, boxH, 14);

    // Energy bar.
    const barX = x + 16, barY = y + 18, barW = boxW - 32, barH = 12;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    this._round(ctx, barX, barY, barW, barH, 6); ctx.fill();
    const e = p.energy / p.maxEnergy;
    const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    g.addColorStop(0, '#22e6ff');
    g.addColorStop(1, '#a6ff2e');
    ctx.fillStyle = g;
    this._round(ctx, barX, barY, Math.max(4, barW * e), barH, 6); ctx.fill();
    ctx.font = `600 10px ${this.font}`;
    ctx.fillStyle = 'rgba(210,225,245,0.75)';
    ctx.textAlign = 'left';
    ctx.fillText(this.T.energy, barX, barY - 8);

    // Ability pips: DASH, SHIELD, and current CORE.
    const pipY = y + 52, pipR = 15, gap = 60;
    const cx0 = x + 40;
    this._abilityPip(ctx, cx0, pipY, pipR, this.T.hudDash, 1 - p.dashCd / p.dashCooldown, '»');
    this._abilityPip(ctx, cx0 + gap, pipY, pipR, this.T.hudShield,
      p.shielded ? 1 : 1 - p.shieldCd / p.shieldCooldown, '◈', p.shielded);

    // Core selector.
    const type = CORE_TYPES[p.coreType];
    const label = this.T.core[p.coreType] || type.label;
    const affordable = p.energy >= type.cost;
    const ccx = x + boxW - 58, ccy = pipY;
    ctx.beginPath();
    ctx.arc(ccx, ccy, pipR + 2, 0, TAU);
    ctx.fillStyle = affordable ? rgba(p.color, 0.22) : 'rgba(120,120,140,0.15)';
    ctx.fill();
    ctx.strokeStyle = affordable ? p.color : 'rgba(150,150,170,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = affordable ? '#ffffff' : 'rgba(200,200,210,0.5)';
    ctx.font = `700 11px ${this.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, ccx, ccy - 2);
    ctx.font = `600 9px ${this.font}`;
    ctx.fillStyle = affordable ? rgba(p.color, 0.9) : 'rgba(200,200,210,0.5)';
    ctx.fillText(`${type.cost}⚡`, ccx, ccy + 10);
  }

  /* ------------------------- coop P2 mini panel -------------------------- */
  _coopPanel(ctx, p, W, H) {
    const boxW = 176, boxH = 58, x = 16, y = H - boxH - 16;
    this._panel(ctx, x, y, boxW, boxH, 12);
    // P2 tag chip.
    ctx.beginPath();
    ctx.arc(x + 18, y + 20, 6, 0, TAU);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#eaf3ff';
    ctx.font = `700 12px ${this.font}`;
    ctx.textAlign = 'left';
    ctx.fillText('P2', x + 30, y + 20);
    ctx.fillStyle = rgba(p.color, 0.9);
    ctx.font = `700 10px ${this.font}`;
    ctx.textAlign = 'right';
    ctx.fillText((CORE_TYPES[p.coreType] && (this.T.core[p.coreType] || CORE_TYPES[p.coreType].label)) || '', x + boxW - 12, y + 20);
    // Energy bar.
    const barX = x + 14, barY = y + 34, barW = boxW - 28, barH = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    this._round(ctx, barX, barY, barW, barH, 5); ctx.fill();
    const e = p.energy / p.maxEnergy;
    ctx.fillStyle = rgba(p.color, 0.9);
    this._round(ctx, barX, barY, Math.max(4, barW * e), barH, 5); ctx.fill();
  }

  _abilityPip(ctx, cx, cy, r, label, ready, glyph, active = false) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    // Cooldown sweep.
    const rd = clamp(ready, 0, 1);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * rd);
    ctx.closePath();
    ctx.fillStyle = active ? 'rgba(255,255,255,0.35)' : (rd >= 1 ? 'rgba(34,230,255,0.30)' : 'rgba(120,140,170,0.2)');
    ctx.fill();
    ctx.strokeStyle = rd >= 1 ? '#22e6ff' : 'rgba(150,170,200,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#eaf3ff';
    ctx.font = `700 14px ${this.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(glyph, cx, cy);
    ctx.font = `600 8px ${this.font}`;
    ctx.fillStyle = 'rgba(210,225,245,0.7)';
    ctx.fillText(label, cx, cy + r + 8);
  }

  /* ------------------------------ radar ---------------------------------- */
  // Circular radar (concept-art style): territory map clipped to a disc, with
  // concentric rings, a rotating sweep, item blips and player dots.
  _minimap(ctx, game, W, H) {
    const R = 62, pad = 18;
    const cx = W - R - pad, cy = H - R - pad;
    const grid = game.grid;

    // Disc panel.
    ctx.beginPath();
    ctx.arc(cx, cy, R + 7, 0, TAU);
    ctx.fillStyle = 'rgba(8,13,23,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,160,220,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const s = (2 * R) / Math.max(grid.worldW, grid.worldH);
    const ox = cx - (grid.worldW * s) / 2, oy = cy - (grid.worldH * s) / 2;
    const cell = grid.tile * s;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(18,28,46,0.55)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();

    // Walls (faint) + owned territory (faction-tinted).
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const type = grid.get(c, r);
        const owner = game.territory.owner[r * grid.cols + c];
        if (type === TILE.WALL) ctx.fillStyle = 'rgba(90,120,160,0.28)';
        else if (owner > 0) ctx.fillStyle = rgba(game.factions[owner - 1].color, 0.5);
        else continue;
        ctx.fillRect(ox + c * cell, oy + r * cell, cell + 0.6, cell + 0.6);
      }
    }
    // Item blips.
    for (const it of game.items || []) {
      ctx.fillStyle = rgba(it.def.color, 0.95);
      ctx.beginPath();
      ctx.arc(ox + it.x * s, oy + it.baseY * s, 2, 0, TAU);
      ctx.fill();
    }
    // Rotating radar sweep.
    const ang = (performance.now() / 1400) % 1 * TAU;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, ang - 0.55, ang);
    ctx.closePath();
    ctx.fillStyle = 'rgba(120,230,255,0.09)';
    ctx.fill();
    ctx.strokeStyle = rgba('#78e6ff', 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
    ctx.stroke();
    // Players.
    for (const p of game.players) {
      if (p.downed) continue;
      const px = ox + p.x * s, py = oy + p.y * s;
      ctx.beginPath();
      ctx.arc(px, py, p.isHuman ? 3.4 : 2.6, 0, TAU);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 6;
      ctx.fill(); ctx.shadowBlur = 0;
      if (p.isHuman) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(px, py, 5.4, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();

    // Rings + crosshair on top of the clip.
    ctx.strokeStyle = 'rgba(120,180,240,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.5, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();
  }

  /* ------------------------------ helpers -------------------------------- */
  _panel(ctx, x, y, w, h, r) {
    this._round(ctx, x, y, w, h, r);
    ctx.fillStyle = 'rgba(12,18,32,0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,150,220,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
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
}
