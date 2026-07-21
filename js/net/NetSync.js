/**
 * NetSync.js
 * ---------------------------------------------------------------------------
 * Host-authoritative state sync for P2P play. Pure data helpers (no browser
 * APIs) so the module stays testable under Node:
 *   - buildInit / applyInit        : one-time map + roster handshake
 *   - buildSnapshot / applySnapshot : per-tick world state (host -> client)
 *   - buildInput                    : client -> host intent
 *   - interpolate                   : smooth the client's rendered entities
 *
 * The client never simulates; it renders instances whose fields are filled
 * from snapshots, reusing every existing render() method unchanged.
 * ---------------------------------------------------------------------------
 */
import { Grid } from '../world/Grid.js';
import { TerritorySystem } from '../world/TerritorySystem.js';
import { Player } from '../entities/Player.js';
import { EnergyCore } from '../entities/EnergyCore.js';
import { PulseWave } from '../entities/PulseWave.js';
import { Crystal } from '../entities/Crystal.js';
import { Item } from '../entities/Item.js';
import { FACTIONS, THEMES, CORE_TYPES, ITEMS, STATE } from '../core/constants.js';

const r1 = (n) => Math.round(n);
const r2 = (n) => Math.round(n * 100) / 100;

/* ------------------------------- handshake ------------------------------ */

export function buildInit(game) {
  const g = game.grid;
  return {
    t: 'init',
    theme: game.theme.id,
    cells: Array.from(g.cells),
    tele: g.teleports.map((p) => ({ c: p.c, r: p.r, l: p.linkIndex })),
    dur: game.settings.duration,
    you: 1, // the joining client controls faction index 1
    roster: game.players.map((p) => ({ i: p.factionIndex, cls: p.classId, human: p.isHuman })),
  };
}

export function applyInit(game, init) {
  game.netRole = 'client';
  game.theme = THEMES[init.theme] || THEMES.facility;
  const grid = new Grid(game.theme);
  grid.cells = Uint8Array.from(init.cells);
  grid.teleports = init.tele.map((p) => ({ c: p.c, r: p.r, linkIndex: p.l }));
  game.grid = grid;

  const facs = FACTIONS.slice(0, init.roster.length);
  game.territory = new TerritorySystem(grid, facs);

  game.players = init.roster.map((rp) =>
    new Player(0, 0, FACTIONS[rp.i], rp.i, rp.i === init.you, rp.cls));
  game.localPlayer = game.players.find((p) => p.factionIndex === init.you) || game.players[0];
  game.humans = game.players.filter((p) => p.isHuman);

  game.cores = [];
  game.waves = [];
  game.shards = [];
  game.items = [];
  game.timeLeft = init.dur;
  game._netReady = false;

  game.camera.resize(game.viewW, game.viewH);
  game.state = STATE.PLAYING;
}

/* -------------------------------- snapshot ------------------------------ */

export function buildSnapshot(game) {
  return {
    t: 's',
    tl: r2(game.timeLeft),
    pl: game.players.map((p) => ({
      i: p.factionIndex, x: r1(p.x), y: r1(p.y), f: r2(p.facing), co: p.coreType,
      dn: p.downed ? 1 : 0, dt: r2(p.downTimer),
      sh: p.shielded ? 1 : 0, sl: p.slowed ? 1 : 0, iv: p.invuln > 0 ? 1 : 0,
      ov: p.overcharged ? 1 : 0, ha: p.hasted ? 1 : 0, ck: p.cloaked ? 1 : 0,
      e: r1(p.energy), me: r1(p.maxEnergy), cr: p.crystals,
    })),
    co: game.cores.map((c) => ({
      x: r1(c.x), y: r1(c.y), tp: c.type.id, ci: c.ownerFaction, col: c.color,
      tm: r2(c.timer), dn: c.detonated ? 1 : 0,
    })),
    wv: game.waves.map((w) => ({ x: r1(w.x), y: r1(w.y), r: r1(w.radius), mr: r1(w.maxRadius), col: w.color })),
    sh: game.shards.map((s) => ({ x: r1(s.x), y: r1(s.baseY), l: r2(s.life) })),
    it: game.items.map((i) => ({ x: r1(i.x), y: r1(i.baseY), l: r2(i.life), id: i.def.id })),
    ow: Array.from(game.territory.owner),
    cn: game.territory.counts.slice(),
  };
}

export function applySnapshot(game, snap) {
  game.timeLeft = snap.tl;

  // Players: keep instances, set interpolation target + discrete state.
  for (const ps of snap.pl) {
    let p = game.players.find((q) => q.factionIndex === ps.i);
    if (!p) continue;
    if (!game._netReady) { p.x = ps.x; p.y = ps.y; }  // first snap: snap into place
    p._tx = ps.x; p._ty = ps.y;
    p.facing = ps.f;
    p.coreType = ps.co;
    p.downed = !!ps.dn; p.downTimer = ps.dt;
    p.shieldTimer = ps.sh ? 1 : 0;
    p.slowTimer = ps.sl ? 1 : 0;
    p.invuln = ps.iv ? 1 : 0;
    p.overchargeTimer = ps.ov ? 1 : 0;
    p.hasteTimer = ps.ha ? 1 : 0;
    p.cloakTimer = ps.ck ? 1 : 0;
    p.energy = ps.e; p.maxEnergy = ps.me; p.crystals = ps.cr;
  }

  // Cores / waves / shards / items: rebuild render instances from the snapshot.
  game.cores = snap.co.map((c) => {
    const core = new EnergyCore(c.x, c.y, CORE_TYPES[c.tp] || CORE_TYPES.standard, c.ci, c.col);
    core.timer = c.tm; core.detonated = !!c.dn;
    return core;
  });
  game.waves = snap.wv.map((w) => {
    const wave = new PulseWave(w.x, w.y, { radius: w.mr, waveSpeed: 0 }, 0);
    wave.radius = w.r; wave.maxRadius = w.mr; wave.color = w.col;
    return wave;
  });
  game.shards = snap.sh.map((s) => { const c = new Crystal(s.x, s.y); c.life = s.l; return c; });
  game.items = snap.it.map((i) => new Item(i.x, i.y, ITEMS[i.id] || ITEMS.cell));

  // Territory ownership + counts (drives the floor wash, HUD bar, minimap).
  game.territory.owner.set(snap.ow);
  game.territory.charge.fill(1);
  game.territory.counts = snap.cn.slice();

  game._netReady = true;
}

/* --------------------------------- input -------------------------------- */

export function buildInput(actions) {
  const m = actions.move || { x: 0, y: 0 };
  return {
    t: 'in',
    mx: Math.round(m.x * 100) / 100, my: Math.round(m.y * 100) / 100,
    d: actions.deploy ? 1 : 0, da: actions.dash ? 1 : 0,
    s: actions.shield ? 1 : 0, c: actions.cycle ? 1 : 0,
  };
}

export function applyInput(intent, msg) {
  intent.move = { x: msg.mx || 0, y: msg.my || 0 };
  // Edge actions latch true until consumed by the player's next update.
  if (msg.d) intent.deploy = true;
  if (msg.da) intent.dash = true;
  if (msg.s) intent.shield = true;
  if (msg.c) intent.cycle = true;
}

/* ----------------------------- interpolation ---------------------------- */

/**
 * Smooth the client's rendered players toward the latest snapshot targets.
 * Remote players interpolate firmly; the LOCAL player (which is predicted from
 * input each frame) is only gently reconciled so its own movement stays snappy.
 */
export function interpolate(game, dt) {
  const kOther = Math.min(1, dt * 16);
  const kLocal = Math.min(1, dt * 3);
  for (const p of game.players) {
    if (p._tx === undefined) continue;
    const k = p === game.localPlayer ? kLocal : kOther;
    p.x += (p._tx - p.x) * k;
    p.y += (p._ty - p.y) * k;
  }
}
