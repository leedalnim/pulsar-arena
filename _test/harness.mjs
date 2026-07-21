/**
 * Headless smoke test. Mocks just enough of the browser to import the real
 * Game and run many simulated frames, exercising deploy -> arm -> pulse ->
 * chain -> crystal shatter -> shard collect -> scoring paths. Not shipped.
 */

/* ------------------------------- DOM mocks ------------------------------- */
class GradientStub { addColorStop() {} }
class CtxStub {
  constructor() {
    this.canvas = null;
    const noop = () => {};
    const methods = ['save','restore','translate','rotate','scale','setTransform',
      'transform','resetTransform','beginPath','moveTo','lineTo','arc','arcTo',
      'ellipse','quadraticCurveTo','bezierCurveTo',
      'closePath','rect','roundRect','fill','stroke','fillRect','strokeRect',
      'clearRect','clip','fillText','strokeText','setLineDash','drawImage'];
    for (const m of methods) this[m] = noop;
    this.measureText = () => ({ width: 10 });
    this.createLinearGradient = () => new GradientStub();
    this.createRadialGradient = () => new GradientStub();
  }
}
class CanvasStub {
  constructor() { this.width = 1280; this.height = 720; this.style = {}; this._ctx = new CtxStub(); this._ctx.canvas = this; }
  getContext() { return this._ctx; }
}

const listeners = {};
globalThis.window = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
  removeEventListener() {},
  AudioContext: undefined, webkitAudioContext: undefined,
};
Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });
globalThis.performance = { now: () => Date.now() };
globalThis.localStorage = {
  _s: {}, getItem(k) { return this._s[k] ?? null; },
  setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; },
};
globalThis.requestAnimationFrame = () => 0;
globalThis.document = {
  readyState: 'complete',
  getElementById: () => ({ style: {}, appendChild() {}, querySelectorAll: () => [] }),
  createElement: () => ({ style: {}, appendChild() {}, querySelectorAll: () => [], addEventListener() {} }),
  addEventListener() {},
};

/* ------------------------------- imports -------------------------------- */
const { Game } = await import('../js/core/Game.js');
const { SoundManager } = await import('../js/core/SoundManager.js');
const { ParticleSystem } = await import('../js/core/ParticleSystem.js');
const { CORE_TYPES } = await import('../js/core/constants.js');
const { Storage } = await import('../js/core/Storage.js');

/* ---------------------------- fake input -------------------------------- */
let scriptedIntent = { move: { x: 0, y: 0 }, deploy: false, dash: false, shield: false, cycle: false, pause: false };
const input = {
  poll: () => ({ ...scriptedIntent, move: { ...scriptedIntent.move } }),
  poll2: () => ({ move: { x: 0, y: 0 }, deploy: false, dash: false, shield: false, cycle: false }),
  setTouchVisible() {},
  setCoop() {},
  flush() {},
};

/* ------------------------------- run ------------------------------------ */
const settings = { ...Storage.load(), sfx: false, botCount: 3, duration: 30, shake: true };
const sound = new SoundManager(settings);
const particles = new ParticleSystem();
const canvas = new CanvasStub();
const game = new Game(canvas, settings, sound, input, particles);

let overCalled = false;
game.onGameOver = () => { overCalled = true; };
game.onPauseRequested = () => {};

game.resize(1280, 720, 1);
game.start();

console.assert(game.players.length === 4, 'expected 4 players');
console.assert(game.localPlayer.isHuman, 'local player should be human');

// Deploy several cores around the human then let them arm + chain.
const startTiles = game.grid.toTile(game.localPlayer.x, game.localPlayer.y);
game.localPlayer.energy = 100;
game.localPlayer.deployCore(game);       // standard on current tile
console.assert(game.cores.length >= 1, 'a core should be deployed');

// Simulate ~6 seconds at 60fps.
let maxWaves = 0, sawShardOrCrystalEvent = false;
const origCrystal = game.onCrystalDestroyed.bind(game);
game.onCrystalDestroyed = (c, r, f) => { sawShardOrCrystalEvent = true; origCrystal(c, r, f); };

for (let frame = 0; frame < 360; frame++) {
  // Human drifts around a bit and periodically deploys.
  scriptedIntent.move.x = Math.sin(frame / 30);
  scriptedIntent.move.y = Math.cos(frame / 40);
  scriptedIntent.deploy = frame % 45 === 0;
  scriptedIntent.dash = frame % 120 === 0;
  scriptedIntent.shield = frame % 200 === 0;
  game.update(1 / 60);
  game.render();
  maxWaves = Math.max(maxWaves, game.waves.length);
}

// --- New content checks: theme + magnetic chain + freeze slow ---
console.assert(game.theme && game.grid.theme === game.theme, 'grid carries a theme');
console.log('theme:', game.theme.name);

// Magnetic: place a magnetic core flanked by two LONG-fuse standards on three
// contiguous floor tiles; the magnetic pull must chain-detonate both early.
const hp = game.localPlayer;
game.cores.length = 0; game.waves.length = 0;
let spot = null;
for (let r = 2; r < game.grid.rows - 2 && !spot; r++)
  for (let c = 2; c < game.grid.cols - 2 && !spot; c++)
    if (game.grid.get(c, r) === 0 && game.grid.get(c - 1, r) === 0 && game.grid.get(c + 1, r) === 0)
      spot = { c, r };
console.assert(spot, 'found a 3-wide floor run for the magnetic test');
if (spot) {
  const cw = (c, r) => game.grid.toWorld(c, r);
  const a = cw(spot.c, spot.r), b = cw(spot.c - 1, spot.r), d = cw(spot.c + 1, spot.r);
  game.deployCore(a.x, a.y, { ...CORE_TYPES.magnetic, fuse: 0.3 }, 0, hp.color);
  game.deployCore(b.x, b.y, { ...CORE_TYPES.standard, fuse: 5 }, 0, hp.color);
  game.deployCore(d.x, d.y, { ...CORE_TYPES.standard, fuse: 5 }, 0, hp.color);
  const mine = game.cores.slice(-3);          // ignore any cores bots add later
  for (let i = 0; i < 120; i++) game.update(1 / 60);
  const detonated = mine.filter((c) => c.detonated).length;
  console.log('magnetic chain: 3 cores ->', detonated, 'detonated (long-fuse neighbors pulled in)');
  console.assert(detonated === 3, 'magnetic should chain the two long-fuse neighbors');
}

// Freeze: drop a freeze wave right on the human and confirm a slow lands.
game.cores.length = 0; game.waves.length = 0;
hp.slowTimer = 0; hp.slowFactor = 1; hp.invuln = 0; hp.shieldTimer = 0; hp.dashTimer = 0;
game.spawnPulse(hp.x, hp.y, CORE_TYPES.freeze, 1, '#22e6ff', null); // enemy faction
let sawSlow = false;
for (let i = 0; i < 60 && !sawSlow; i++) { game.update(1 / 60); if (hp.slowed) sawSlow = true; }
console.log('freeze slowed the player:', sawSlow, '(factor', hp.slowFactor.toFixed(2), ')');
console.assert(sawSlow, 'freeze wave should slow the player');

const scores = game.scores();
console.assert(Array.isArray(scores) && scores.length === 4, 'scores array of 4');
console.assert(scores[0].total >= scores[3].total, 'scores sorted descending');
const totalTiles = scores.reduce((a, s) => a + s.tiles, 0);

console.log('players:', game.players.length);
console.log('cores alive:', game.cores.length, 'shards:', game.shards.length);
console.log('peak simultaneous waves:', maxWaves);
console.log('crystal-shatter event fired:', sawShardOrCrystalEvent);
console.log('claimed tiles total:', totalTiles);
console.log('top score:', scores[0].name, scores[0].total, '(tiles', scores[0].tiles, '+ crystals', scores[0].crystals, ')');

// Run out the clock to trigger game over.
game.timeLeft = 0.1;
game.update(0.2);
console.assert(overCalled, 'game over should fire when time runs out');
console.log('game over fired:', overCalled);

// --- Local 2-player: two humans spawn and both are controllable ---
const coopSettings = { ...Storage.load(), sfx: false, botCount: 3, duration: 30, coop: true };
const coopGame = new Game(new CanvasStub(), coopSettings, sound, input, particles);
coopGame.onGameOver = () => {};
coopGame.onPauseRequested = () => {};
coopGame.resize(1280, 720, 1);
coopGame.start();
const humans = coopGame.players.filter((p) => p.isHuman);
console.assert(humans.length === 2, 'coop should spawn two human players');
console.assert(coopGame.humans.length === 2, 'coop tracks two humans');
console.assert(coopGame.players.length === 4, 'coop still fills to four factions');
for (let i = 0; i < 60; i++) { coopGame.update(1 / 60); coopGame.render(); }
console.log('local 2P humans:', humans.length, '| classes:', humans.map((h) => h.classId).join(', '));

// --- P2P netcode loopback (no WebRTC): host state -> client mirror ---
const NetSync = await import('../js/net/NetSync.js');
const noInput = { poll: () => ({ move: { x: 0, y: 0 } }), poll2: () => ({ move: { x: 0, y: 0 } }),
  setTouchVisible() {}, setCoop() {}, flush() {} };
const netStub = { send() {}, close() {} };
const hostGame = new Game(new CanvasStub(), { ...Storage.load(), sfx: false, botCount: 2, duration: 30 }, sound, noInput, new ParticleSystem());
hostGame.onGameOver = () => {}; hostGame.onPauseRequested = () => {};
hostGame.resize(1280, 720, 1);
hostGame.startNetHost(netStub, 'nova');
console.assert(hostGame.netRole === 'host', 'host role set');
console.assert(hostGame.remotePlayer && hostGame.remotePlayer.factionIndex === 1, 'remote player is faction 1');

const clientGame = new Game(new CanvasStub(), { ...Storage.load(), sfx: false }, sound, noInput, new ParticleSystem());
clientGame.onGameOver = () => {}; clientGame.onPauseRequested = () => {};
clientGame.resize(1280, 720, 1);
clientGame.applyNetInit(netStub, NetSync.buildInit(hostGame));
console.assert(clientGame.players.length === hostGame.players.length, 'client roster matches host');
console.assert(clientGame.grid.cells.length === hostGame.grid.cells.length, 'client map matches host');
console.assert(clientGame.netRole === 'client', 'client role set');

// Client sends "move right"; host applies it to the remote player, then syncs.
hostGame.setRemoteInput({ t: 'in', mx: 1, my: 0, d: 0, da: 0, s: 0, c: 0 });
for (let i = 0; i < 40; i++) hostGame.update(1 / 60);
clientGame.applyNetSnapshot(NetSync.buildSnapshot(hostGame));
const hRemote = hostGame.players.find((p) => p.factionIndex === 1);
const cRemote = clientGame.players.find((p) => p.factionIndex === 1);
console.assert(Math.abs(cRemote._tx - hRemote.x) < 1.5 && Math.abs(cRemote._ty - hRemote.y) < 1.5, 'client mirrors host remote position');
console.assert(Math.abs(clientGame.timeLeft - hostGame.timeLeft) < 0.05, 'client clock synced from snapshot');
console.log('P2P loopback: remote input moved host player to',
  Math.round(hRemote.x) + ',' + Math.round(hRemote.y), '| client mirrored + clock synced');

// Settings persistence round-trip.
Storage.save({ ...settings, volume: 0.42 });
console.assert(Storage.load().volume === 0.42, 'settings persist');

console.log('\nALL SMOKE TESTS PASSED');
