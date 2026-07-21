/**
 * Game.js
 * ---------------------------------------------------------------------------
 * The orchestrator. Owns the world, the entity lists, the fixed game loop and
 * the state machine (menu / playing / paused / over). Gameplay systems raise
 * semantic events here (onPulseHitPlayer, onCrystalDestroyed, ...) and the Game
 * routes them to feedback systems: sound, particles and camera shake.
 *
 * Everything is composed rather than inherited, keeping the file readable and
 * every subsystem independently testable and replaceable.
 * ---------------------------------------------------------------------------
 */
import {
  FACTIONS, STATE, MATCH, CRYSTAL_CFG, TILE, PLAYER, THEMES, THEME_ORDER,
} from './constants.js';
import { rand, randInt, rgba, TAU, pick } from './utils.js';
import { Camera } from './Camera.js';
import { MapGenerator } from '../world/MapGenerator.js';
import { TerritorySystem } from '../world/TerritorySystem.js';
import { Player } from '../entities/Player.js';
import { Bot } from '../entities/Bot.js';
import { EnergyCore } from '../entities/EnergyCore.js';
import { PulseWave } from '../entities/PulseWave.js';
import { Crystal } from '../entities/Crystal.js';
import { HUD } from '../ui/HUD.js';

export class Game {
  constructor(canvas, settings, sound, input, particles) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.settings = settings;
    this.sound = sound;
    this.input = input;
    this.particles = particles;

    // Logical viewport size in CSS pixels (backing store may be larger for DPR).
    this.viewW = canvas.width || window.innerWidth;
    this.viewH = canvas.height || window.innerHeight;
    this.dpr = 1;

    this.state = STATE.MENU;
    this.factions = FACTIONS;
    this.hud = new HUD();
    this.camera = new Camera(this.viewW, this.viewH);

    // Entity collections.
    this.players = [];
    this.cores = [];
    this.waves = [];
    this.shards = [];
    this._echoes = [];        // scheduled delayed pulses (resonant cores)
    this._flashes = [];       // brief detonation light pops

    this.localPlayer = null;
    this.grid = null;
    this.territory = null;
    this.timeLeft = 0;
    this._presenceAcc = 0;
    this._territoryAcc = 0;
    this._bg = this._makeBackdrop();

    this.onGameOver = null;   // set by main.js to surface the results screen
    this._activeChainWave = null;
    this._last = 0;
    this._raf = null;
  }

  /* --------------------------- match lifecycle --------------------------- */

  /** Build a fresh arena and spawn all combatants. */
  newMatch() {
    const botCount = Math.min(3, Math.max(1, this.settings.botCount));
    const factionCount = botCount + 1;

    this.theme = THEMES[pick(THEME_ORDER)];
    const { grid, spawns } = MapGenerator.generate(factionCount, this.theme);
    this.grid = grid;
    this.territory = new TerritorySystem(grid, this.factions.slice(0, factionCount));

    this.players = [];
    this.cores = [];
    this.waves = [];
    this.shards = [];
    this._echoes = [];
    this._flashes = [];
    this.particles.clear();

    // Human is faction 0; remaining are bots.
    this.localPlayer = new Player(spawns[0].x, spawns[0].y, this.factions[0], 0, true);
    this.players.push(this.localPlayer);
    for (let i = 1; i < factionCount; i++) {
      this.players.push(new Bot(spawns[i].x, spawns[i].y, this.factions[i], i));
    }

    // Seed each spawn with owned territory so scores start non-zero.
    for (const p of this.players) {
      const { c, r } = grid.toTile(p.x, p.y);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          this.territory.claim(c + dc, r + dr, p.factionIndex);
    }

    this.timeLeft = this.settings.duration;
    this.camera.resize(this.viewW, this.viewH);
    this.camera.shakeEnabled = this.settings.shake;
    this.camera.snapTo(this.localPlayer.x, this.localPlayer.y);
  }

  start() {
    this.newMatch();
    this.state = STATE.PLAYING;
    this.input.flush();
    this.input.setTouchVisible(true);
  }

  pause() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    this.input.setTouchVisible(false);
  }

  resume() {
    if (this.state !== STATE.PAUSED) return;
    this.state = STATE.PLAYING;
    this.input.flush();
    this.input.setTouchVisible(true);
    this._last = performance.now();
  }

  restart() { this.start(); }

  quitToMenu() {
    this.state = STATE.MENU;
    this.input.setTouchVisible(false);
  }

  _endMatch() {
    this.state = STATE.OVER;
    this.input.setTouchVisible(false);
    this.sound.win();
    this.onGameOver?.(this.scores());
  }

  /* ------------------------------- loop ---------------------------------- */

  loop(now) {
    this._raf = requestAnimationFrame((t) => this.loop(t));
    let dt = (now - this._last) / 1000;
    this._last = now;
    if (dt > 0.05) dt = 0.05;              // clamp huge frame gaps (tab switch)

    if (this.state === STATE.PLAYING) this.update(dt);
    this.render();
  }

  startLoop() {
    this._last = performance.now();
    if (!this._raf) this._raf = requestAnimationFrame((t) => this.loop(t));
  }

  /* ------------------------------ update --------------------------------- */

  update(dt) {
    // Input -> local player intent + pause handling.
    const actions = this.input.poll();
    if (actions.pause) { this.pause(); this.onPauseRequested?.(); return; }
    if (this.localPlayer) this.localPlayer.applyIntent(actions);

    // Entities.
    for (const p of this.players) p.update(dt, this);
    for (const c of this.cores) c.update(dt, this);
    for (const w of this.waves) w.update(dt, this);
    for (const s of this.shards) s.update(dt, this);

    this._updateEchoes(dt);
    this._updateFlashes(dt);
    this._presenceClaim(dt);

    this.grid.update(dt);
    this.territory.update(dt);
    this.particles.update(dt);

    // Camera + timer.
    this.camera.follow(this.localPlayer.x, this.localPlayer.y,
      this.grid.worldW, this.grid.worldH, dt);
    this.camera.update(dt);

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this._endMatch(); }

    this._cull();
  }

  /** Players slowly claim the tile beneath them by presence. */
  _presenceClaim(dt) {
    this._presenceAcc += dt;
    if (this._presenceAcc < 0.25) return;
    this._presenceAcc = 0;
    for (const p of this.players) {
      if (p.downed) continue;
      const { c, r } = this.grid.toTile(p.x, p.y);
      this.territory.claim(c, r, p.factionIndex);
    }
  }

  _updateEchoes(dt) {
    for (let i = this._echoes.length - 1; i >= 0; i--) {
      const e = this._echoes[i];
      e.delay -= dt;
      if (e.delay <= 0) {
        const type = { ...e.type, radius: e.type.radius * e.intensity };
        this.spawnPulse(e.x, e.y, type, e.faction, e.color, null);
        this._echoes.splice(i, 1);
      }
    }
  }

  _updateFlashes(dt) {
    for (let i = this._flashes.length - 1; i >= 0; i--) {
      const f = this._flashes[i];
      f.t += dt;
      if (f.t >= f.dur) this._flashes.splice(i, 1);
    }
  }

  _cull() {
    this.cores = this.cores.filter((c) => !c.dead);
    this.waves = this.waves.filter((w) => !w.dead);
    this.shards = this.shards.filter((s) => !s.dead);
  }

  /* --------------------------- gameplay API ------------------------------ */

  /** True if an armed core already occupies tile (c,r). */
  coreAt(c, r) {
    return this.cores.some((core) => {
      const t = this.grid.toTile(core.x, core.y);
      return t.c === c && t.r === r && !core.detonated;
    });
  }

  deployCore(x, y, type, factionIndex, color) {
    this.cores.push(new EnergyCore(x, y, type, factionIndex, color));
  }

  spawnPulse(x, y, type, factionIndex, color, source) {
    const wave = new PulseWave(x, y, type, factionIndex);
    wave.color = color;
    if (source) wave.chainSource = source;
    this.waves.push(wave);
    this.camera.addShake(type.radius > 150 ? 12 : 7);
    this.particles.burst(x, y, color, 26, 320, 1.2);
    this._flashes.push({ x, y, t: 0, dur: 0.17, color });
  }

  scheduleEcho(x, y, type, faction, color, delay, intensity) {
    this._echoes.push({ x, y, type, faction, color, delay, intensity });
  }

  spawnShard(x, y, scatter = false) {
    const ox = scatter ? rand(-18, 18) : 0;
    const oy = scatter ? rand(-18, 18) : 0;
    this.shards.push(new Crystal(x + ox, y + oy));
  }

  /* ------------------------------- events -------------------------------- */

  onCrystalDestroyed(c, r, factionIndex) {
    const w = this.grid.toWorld(c, r);
    this.spawnShard(w.x, w.y);
    this.territory.claim(c, r, factionIndex);
    this.particles.burst(w.x, w.y, '#8ff6ff', 16, 220);
    this.sound.crystal();
  }

  onShardCollected(shard, player) {
    player.crystals += 1;
    player.energy = Math.min(PLAYER.MAX_ENERGY, player.energy + MATCH.CRYSTAL_ENERGY);
    this.particles.sparkle(shard.x, shard.y, player.color, 12);
    if (player.isHuman) this.sound.pickup();
  }

  onPulseHitPlayer(player, wave, distance) {
    // FREEZE waves apply a slow instead of a takedown.
    if (wave.type.effect === 'slow') {
      if (player.applySlow(wave.type.slowFactor, wave.type.slowTime)) {
        this.particles.sparkle(player.x, player.y, '#9fe8ff', 10);
        this.sound.hit();
      }
      return;
    }
    // Chain waves that touch a player still knock them back.
    const downed = player.takeHit(this, wave, distance);
    if (downed) {
      const ang = Math.atan2(player.y - wave.y, player.x - wave.x);
      player.x += Math.cos(ang) * 14;
      player.y += Math.sin(ang) * 14;
      if (player.isHuman) this.camera.addShake(16);
    }
  }

  onCoreDetonated(core) {
    this.particles.burst(core.x, core.y, core.color, 20, 260);
  }

  onTeleport(player) {
    this.particles.burst(player.x, player.y, '#c76bff', 26, 260);
    this.sound.teleport();
    if (player.isHuman) this.camera.snapTo(player.x, player.y);
  }

  /* ------------------------------- scoring ------------------------------- */

  scores() {
    const arr = this.players.map((p) => {
      const tiles = this.territory.tileCount(p.factionIndex);
      const crystals = p.crystals;
      return {
        name: p.faction.name,
        color: p.color,
        isHuman: p.isHuman,
        factionIndex: p.factionIndex,
        tiles,
        crystals,
        total: tiles * MATCH.POINTS_PER_TILE + crystals * MATCH.POINTS_PER_CRYSTAL,
      };
    });
    arr.sort((a, b) => b.total - a.total);
    return arr;
  }

  /* ------------------------------ rendering ------------------------------ */

  render() {
    const ctx = this.ctx;
    const W = this.viewW, H = this.viewH;

    // Backdrop (screen space).
    ctx.fillStyle = '#060912';
    ctx.fillRect(0, 0, W, H);
    this._renderBackdrop(ctx, W, H);

    if (this.state === STATE.MENU) return; // menu overlay handles visuals

    // World (camera space).
    ctx.save();
    this.camera.apply(ctx);

    this.grid.renderFloor(ctx, this.camera);
    this.territory.render(ctx, this.camera);
    this.grid.renderTiles(ctx, this.camera);

    for (const s of this.shards) s.render(ctx);
    for (const c of this.cores) c.render(ctx);
    for (const p of this.players) p.render(ctx);
    for (const w of this.waves) w.render(ctx);
    this.particles.render(ctx);
    this._renderFlashes(ctx);

    ctx.restore();

    // Cinematic vignette framing over the world (below the HUD).
    this._renderVignette(ctx, W, H);

    // HUD (screen space) — hidden while the pause overlay is up for clarity.
    if (this.state === STATE.PLAYING) this.hud.render(ctx, this, W, H);
  }

  _renderFlashes(ctx) {
    if (!this._flashes.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this._flashes) {
      const p = f.t / f.dur, a = 1 - p, rad = 10 + p * 52;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
      g.addColorStop(0, rgba('#ffffff', a));
      g.addColorStop(0.45, rgba(f.color, a * 0.7));
      g.addColorStop(1, rgba(f.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, rad, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  _renderVignette(ctx, W, H) {
    const g = ctx.createRadialGradient(
      W / 2, H * 0.46, Math.min(W, H) * 0.30,
      W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /** Precompute a set of slow-drifting background motes for atmosphere. */
  _makeBackdrop() {
    const motes = [];
    for (let i = 0; i < 60; i++) {
      motes.push({
        x: Math.random(), y: Math.random(),
        r: rand(0.5, 2.2), a: rand(0.05, 0.25),
        sp: rand(0.005, 0.02),
      });
    }
    return motes;
  }

  _renderBackdrop(ctx, W, H) {
    const theme = this.theme || THEMES.facility;
    // Radial vignette glow (tinted per theme).
    const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, theme.backdropGlow);
    g.addColorStop(1, 'rgba(4,6,14,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Drifting motes.
    const t = performance.now() / 1000;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this._bg) {
      const y = ((m.y + t * m.sp) % 1) * H;
      ctx.beginPath();
      ctx.arc(m.x * W, y, m.r, 0, TAU);
      ctx.fillStyle = rgba(theme.mote, m.a);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Resize the canvas for a given CSS-pixel viewport, handling high-DPR
   * displays. The backing store is scaled by `dpr` while all game logic keeps
   * working in CSS pixels via the context transform.
   */
  resize(cssW, cssH, dpr = 1) {
    this.dpr = dpr;
    this.viewW = cssW;
    this.viewH = cssH;
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.resize(cssW, cssH);
  }
}
