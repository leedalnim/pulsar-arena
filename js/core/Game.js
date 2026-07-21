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
  PULSE, CLASS_ORDER, ITEMS, ITEM_ORDER, ITEM_CFG,
} from './constants.js';
import { rand, randInt, rgba, TAU, pick, shuffle } from './utils.js';
import { Camera } from './Camera.js';
import { MapGenerator } from '../world/MapGenerator.js';
import { TerritorySystem } from '../world/TerritorySystem.js';
import { Player } from '../entities/Player.js';
import { Bot } from '../entities/Bot.js';
import { EnergyCore } from '../entities/EnergyCore.js';
import { PulseWave } from '../entities/PulseWave.js';
import { Crystal } from '../entities/Crystal.js';
import { Item } from '../entities/Item.js';
import { HUD } from '../ui/HUD.js';
import * as NetSync from '../net/NetSync.js';

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
    this.items = [];          // floating item pickups
    this._echoes = [];        // scheduled delayed pulses (resonant cores)
    this._flashes = [];       // brief detonation light pops
    this._itemAcc = 0;        // item spawn accumulator

    this.localPlayer = null;
    this.humans = [];         // 1 (solo) or 2 (local coop) human players
    this.coop = false;
    this.grid = null;

    // Game mode: 'arena' (single match) | 'stages' (escalating progression).
    this.mode = 'arena';
    this.stage = 1;
    this.botAggro = 1;        // bot difficulty multiplier (scaled by stage)
    this.isBossStage = false; // every 5th stage is a 1v1 vs an elite boss

    // P2P networking.
    this.netRole = null;      // null (offline) | 'host' | 'client'
    this.net = null;          // NetPeer handle (browser only)
    this.remotePlayer = null; // host: the joined client's player
    this.netRemoteClass = null;
    this.remoteInput = { move: { x: 0, y: 0 }, deploy: false, dash: false, shield: false, cycle: false };
    this._snapAcc = 0;
    this._netReady = false;
    this.territory = null;
    this.timeLeft = 0;
    this._presenceAcc = 0;
    this._territoryAcc = 0;
    this._bg = this._makeBackdrop();

    this.onGameOver = null;   // set by main.js to surface the results screen
    this.onReturnMenu = null; // set by main.js to return to the main menu
    this.onStageClear = null; // set by main.js to surface the stage interstitial
    this._activeChainWave = null;
    this._last = 0;
    this._raf = null;
  }

  /* --------------------------- match lifecycle --------------------------- */

  /** Build a fresh arena and spawn all combatants. */
  newMatch() {
    const isHost = this.netRole === 'host';
    const isStages = this.mode === 'stages';
    this.coop = !isHost && !isStages && !!this.settings.coop; // local coop: offline arena only
    this.input.setCoop(this.coop);
    const humanCount = (isHost || this.coop) ? 2 : 1;

    // Stage mode ramps difficulty; arena uses the player's settings.
    let botCount, duration;
    if (isStages) {
      this.isBossStage = this.stage % 5 === 0;   // boss every 5th stage
      botCount = this.isBossStage ? 1 : (this.stage < 2 ? 1 : this.stage < 3 ? 2 : 3);
      duration = this.isBossStage ? 60 : Math.max(45, 70 - (this.stage - 1) * 5);
      this.botAggro = this.isBossStage ? 2.0 : Math.min(1.9, 1 + Math.max(0, this.stage - 3) * 0.12);
    } else {
      this.isBossStage = false;
      botCount = Math.min(3, Math.max(1, this.settings.botCount));
      duration = this.settings.duration;
      this.botAggro = 1;
    }
    const factionCount = Math.min(4, humanCount + botCount);
    this._matchDuration = duration;

    this.theme = THEMES[pick(THEME_ORDER)];
    const { grid, spawns } = MapGenerator.generate(factionCount, this.theme);
    this.grid = grid;
    this.territory = new TerritorySystem(grid, this.factions.slice(0, factionCount));

    this.players = [];
    this.cores = [];
    this.waves = [];
    this.shards = [];
    this.items = [];
    this._echoes = [];
    this._flashes = [];
    this._itemAcc = 0;
    this.particles.clear();

    // Human(s) first; bots fill the rest. In coop, P2 gets a different class.
    this.humans = [];
    const humanClass = this.settings.charClass || 'specter';
    this.localPlayer = new Player(spawns[0].x, spawns[0].y, this.factions[0], 0, true, humanClass);
    this.players.push(this.localPlayer);
    this.humans.push(this.localPlayer);
    this.remotePlayer = null;
    if (isHost) {
      // Faction 1 is the joined client's human, driven by network input.
      const rc = this.netRemoteClass || CLASS_ORDER.find((c) => c !== humanClass) || 'nova';
      this.remotePlayer = new Player(spawns[1].x, spawns[1].y, this.factions[1], 1, true, rc);
      this.players.push(this.remotePlayer);
      this.humans.push(this.remotePlayer);
    } else if (this.coop) {
      const p2class = CLASS_ORDER.find((c) => c !== humanClass) || 'nova';
      const p2 = new Player(spawns[1].x, spawns[1].y, this.factions[1], 1, true, p2class);
      this.players.push(p2);
      this.humans.push(p2);
    }
    const botClasses = shuffle(CLASS_ORDER.concat(CLASS_ORDER));
    for (let i = humanCount; i < factionCount; i++) {
      this.players.push(new Bot(spawns[i].x, spawns[i].y, this.factions[i], i, botClasses[i]));
    }

    // Boss stage: buff the lone bot into an oversized, relentless elite.
    if (isStages && this.isBossStage) {
      const boss = this.players.find((p) => p instanceof Bot);
      if (boss) {
        boss.isBoss = true;
        boss.radius *= 1.5;
        boss.maxEnergy *= 1.9;
        boss.energy = boss.maxEnergy;
        boss.speedMul *= 1.1;
        boss.regenMul *= 1.7;
        boss.coreType = 'heavy';
      }
      this.bossRef = boss || null;
      this._bossAtk = 4;              // seconds until the first boss nova
    } else {
      this.bossRef = null;
    }

    // Seed each spawn with owned territory so scores start non-zero.
    for (const p of this.players) {
      const { c, r } = grid.toTile(p.x, p.y);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          this.territory.claim(c + dc, r + dr, p.factionIndex);
    }

    this.timeLeft = this._matchDuration;
    this.camera.resize(this.viewW, this.viewH);
    this.camera.shakeEnabled = this.settings.shake;
    const mid = this._humansMid();
    this.camera.snapTo(mid.x, mid.y);
  }

  /** Centre point of the human player(s) — the camera focus. */
  _humansMid() {
    const hs = this.humans && this.humans.length ? this.humans : [this.localPlayer];
    let x = 0, y = 0, n = 0;
    for (const p of hs) { if (!p) continue; x += p.x; y += p.y; n++; }
    return n ? { x: x / n, y: y / n } : { x: 0, y: 0 };
  }

  start() {
    this.mode = 'arena';
    this.newMatch();
    this.state = STATE.PLAYING;
    this.input.flush();
    this.input.setTouchVisible(true);
  }

  /** Begin stage mode from stage 1 (escalating difficulty). */
  startStages() {
    this.mode = 'stages';
    this.stage = 1;
    this._beginStage();
  }

  /** Advance to the next stage (called from the interstitial). */
  nextStage() {
    this.stage += 1;
    this._beginStage();
  }

  _beginStage() {
    this.mode = 'stages';
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

  restart() {
    if (this.netRole) {          // online matches can't be restarted locally
      this.quitToMenu();
      this.onReturnMenu?.();
      return;
    }
    if (this.mode === 'stages') { this.startStages(); return; }
    this.start();
  }

  quitToMenu() {
    this.state = STATE.MENU;
    this.input.setTouchVisible(false);
    if (this.net) { try { this.net.close(); } catch { /* ignore */ } }
    this.net = null;
    this.netRole = null;
    this.remotePlayer = null;
    this._netReady = false;
    this.mode = 'arena';
    this.stage = 1;
    this.botAggro = 1;
  }

  _endMatch() {
    this.state = STATE.OVER;
    this.input.setTouchVisible(false);
    const scores = this.scores();
    if (this.netRole === 'host' && this.net) this.net.send({ t: 'over', scores });

    // Stage mode: finishing first clears the stage and advances; otherwise the
    // run ends at the stage you reached.
    if (this.mode === 'stages') {
      const humanWon = scores[0] && scores[0].isHuman && scores[0].total > 0;
      if (humanWon) {
        this.sound.win();
        this.onStageClear?.(this.stage, scores);
        return;
      }
      this.sound.win();
      this.onGameOver?.(scores, { stage: this.stage });
      return;
    }

    this.sound.win();
    this.onGameOver?.(scores);
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
    if (this.netRole === 'client') { this._clientTick(dt); return; }

    // Input -> local player intent + pause handling.
    const actions = this.input.poll();
    if (actions.pause) { this.pause(); this.onPauseRequested?.(); return; }
    if (this.localPlayer) this.localPlayer.applyIntent(actions);
    if (this.coop && this.humans[1]) this.humans[1].applyIntent(this.input.poll2());
    if (this.netRole === 'host' && this.remotePlayer) {
      this.remotePlayer.applyIntent(this.remoteInput);
      // Consume edge actions so each press fires exactly once.
      this.remoteInput.deploy = this.remoteInput.dash = this.remoteInput.shield = this.remoteInput.cycle = false;
    }

    // Entities.
    for (const p of this.players) p.update(dt, this);
    for (const c of this.cores) c.update(dt, this);
    for (const w of this.waves) w.update(dt, this);
    for (const s of this.shards) s.update(dt, this);
    for (const it of this.items) it.update(dt, this);

    this._updateEchoes(dt);
    this._updateFlashes(dt);
    this._updateItems(dt);
    if (this.isBossStage) this._bossTick(dt);
    this._presenceClaim(dt);

    this.grid.update(dt);
    this.territory.update(dt);
    this.particles.update(dt);

    // Camera follows the human(s) midpoint (frames both in coop) + timer.
    const mid = this._humansMid();
    this.camera.follow(mid.x, mid.y, this.grid.worldW, this.grid.worldH, dt);
    this.camera.update(dt);

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this._endMatch(); }

    this._cull();

    // Host: broadcast authoritative state to the client (~20 Hz).
    if (this.netRole === 'host' && this.net) {
      this._snapAcc += dt;
      if (this._snapAcc >= 0.05) { this._snapAcc = 0; this.net.send(NetSync.buildSnapshot(this)); }
    }
  }

  /* ----------------------------- net (P2P) ------------------------------- */

  /** Client-side frame: send input, interpolate rendered state, move camera. */
  _clientTick(dt) {
    const actions = this.input.poll();
    if (actions.pause) { this.pause(); this.onPauseRequested?.(); return; }
    if (this.net) this.net.send(NetSync.buildInput(actions));
    this._predictLocal(dt, actions);   // move own drone immediately (no ping wait)
    NetSync.interpolate(this, dt);      // then gently reconcile toward the host
    this.grid.update(dt);
    this.particles.update(dt);
    if (this.localPlayer) {
      this.camera.follow(this.localPlayer.x, this.localPlayer.y,
        this.grid.worldW, this.grid.worldH, dt);
    }
    this.camera.update(dt);
  }

  /** Client-side prediction: move the local drone from input right away so it
   *  responds instantly; interpolate() then reconciles it with host snapshots. */
  _predictLocal(dt, actions) {
    const p = this.localPlayer;
    if (!p || p.downed) return;
    const mx = actions.move.x, my = actions.move.y;
    if (mx || my) p.facing = Math.atan2(my, mx);
    const speed = PLAYER.SPEED * (p.speedMul || 1);
    const res = this.grid.resolveCircle(p.x + mx * speed * dt, p.y + my * speed * dt, p.radius);
    p.x = res.x;
    p.y = res.y;
  }

  /** Host: build the arena, then send the init handshake to the client. */
  startNetHost(net, remoteClass) {
    this.net = net;
    this.netRole = 'host';
    this.netRemoteClass = remoteClass || null;
    this.remoteInput = { move: { x: 0, y: 0 }, deploy: false, dash: false, shield: false, cycle: false };
    this._snapAcc = 0;
    this.start();                       // newMatch() (host mode) + state PLAYING
    if (this.net) this.net.send(NetSync.buildInit(this));
  }

  /** Host: apply the latest input message from the client. */
  setRemoteInput(msg) { NetSync.applyInput(this.remoteInput, msg); }

  /** Client: build the world from the host's handshake. */
  applyNetInit(net, init) {
    this.net = net;
    this.input.setCoop(false);
    NetSync.applyInit(this, init);
    this.input.flush();
    this.input.setTouchVisible(true);
    if (this.localPlayer) this.camera.snapTo(this.localPlayer.x, this.localPlayer.y);
  }

  /** Client: apply an authoritative snapshot. */
  applyNetSnapshot(snap) {
    const first = !this._netReady;
    NetSync.applySnapshot(this, snap);
    if (first && this.localPlayer) this.camera.snapTo(this.localPlayer.x, this.localPlayer.y);
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
    this.items = this.items.filter((i) => !i.dead);
  }

  /** Boss special: charge, then release a large "boss nova" pulse centred on it. */
  _bossTick(dt) {
    const boss = this.bossRef;
    if (!boss || boss.downed) return;
    // Telegraph flash in the last ~0.5s so players can dodge.
    if (this._bossAtk > 0 && this._bossAtk <= 0.5 && !this._bossTele) {
      this._bossTele = true;
      this._flashes.push({ x: boss.x, y: boss.y, t: 0, dur: 0.5, color: '#ff3b4e' });
    }
    this._bossAtk -= dt;
    if (this._bossAtk <= 0) {
      this._bossAtk = 7;
      this._bossTele = false;
      const nova = { radius: this.grid.tile * 4.6, waveSpeed: 540, damage: true };
      this.spawnPulse(boss.x, boss.y, nova, boss.factionIndex, boss.color, null);
      this.camera.addShake(15);
      this.sound.detonate();
    }
  }

  /** Periodically drop an item pickup on a random reachable floor tile. */
  _updateItems(dt) {
    this._itemAcc += dt;
    if (this._itemAcc < ITEM_CFG.SPAWN_INTERVAL) return;
    this._itemAcc = 0;
    if (this.items.length >= ITEM_CFG.MAX_ACTIVE) return;
    const spot = this._randomFloor();
    if (!spot) return;
    const def = ITEMS[pick(ITEM_ORDER)];
    this.items.push(new Item(spot.x, spot.y, def));
    this.particles.sparkle(spot.x, spot.y, def.color, 12);
  }

  /** Find a random empty floor tile's world centre (a few tries). */
  _randomFloor() {
    const g = this.grid;
    for (let n = 0; n < 24; n++) {
      const c = randInt(1, g.cols - 2), r = randInt(1, g.rows - 2);
      if (g.get(c, r) === TILE.FLOOR) return g.toWorld(c, r);
    }
    return null;
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
    player.energy = Math.min(player.maxEnergy, player.energy + MATCH.CRYSTAL_ENERGY);
    this.particles.sparkle(shard.x, shard.y, player.color, 12);
    if (player.isHuman) this.sound.pickup();
  }

  onItemCollected(item, player) {
    player.applyItem(item.def, this);
    this.particles.burst(item.x, item.baseY, item.def.color, 22, 240);
    this.particles.sparkle(item.x, item.baseY, item.def.accent || '#ffffff', 10);
    this._flashes.push({ x: item.x, y: item.baseY, t: 0, dur: 0.2, color: item.def.color });
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
      // Heavier cores hit harder; applied as a decaying impulse (px/s).
      const power = PULSE.KNOCKBACK * (wave.maxRadius > 150 ? 1.25 : 1);
      player.applyKnockback(ang, power);
      if (player.isHuman) this.camera.addShake(16);
    }
  }

  onCoreDetonated(core) {
    this.particles.burst(core.x, core.y, core.color, 20, 260);
    this.sound.detonate();
  }

  onTeleport(player) {
    this.particles.burst(player.x, player.y, '#c76bff', 26, 260);
    this.sound.teleport();
    // Re-centre on the human focus (midpoint in coop) so the view keeps up.
    if (player.isHuman) {
      const mid = this._humansMid();
      this.camera.snapTo(this.coop ? mid.x : player.x, this.coop ? mid.y : player.y);
    }
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
    for (const it of this.items) it.render(ctx);
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
      // Crisp expanding shockwave ring.
      ctx.beginPath();
      ctx.arc(f.x, f.y, rad * 1.1, 0, TAU);
      ctx.strokeStyle = rgba('#ffffff', a * 0.7);
      ctx.lineWidth = 2;
      ctx.stroke();
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
