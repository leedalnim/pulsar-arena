/**
 * constants.js
 * ---------------------------------------------------------------------------
 * All tunable game configuration lives here. Keeping magic numbers in a single
 * place makes the game easy to balance and extend without hunting through
 * gameplay code. Everything is grouped by domain.
 * ---------------------------------------------------------------------------
 */

/** Tile grid + rendering scale (world units are pixels). */
export const GRID = {
  TILE: 56,          // pixel size of a single tile
  COLS: 23,          // map width in tiles (odd -> clean pillar lattice)
  ROWS: 23,          // map height in tiles
};

/** Tile type identifiers used by the Grid. */
export const TILE = {
  FLOOR: 0,          // walkable
  WALL: 1,           // solid, indestructible
  CRYSTAL: 2,        // destructible energy crystal (blocks movement)
  TELEPORT: 3,       // walkable teleport pad
};

/** The four arena factions. Colours drive both rendering and territory. */
export const FACTIONS = [
  { id: 'cyan',    name: 'CYAN',    color: '#22e6ff', glow: 'rgba(34,230,255,0.55)' },
  { id: 'magenta', name: 'MAGENTA', color: '#ff3ea5', glow: 'rgba(255,62,165,0.55)' },
  { id: 'lime',    name: 'LIME',    color: '#a6ff2e', glow: 'rgba(166,255,46,0.55)' },
  { id: 'amber',   name: 'AMBER',   color: '#ffb02e', glow: 'rgba(255,176,46,0.55)' },
];

/**
 * Arena visual themes. Only floor/wall/backdrop colours change — the layout
 * stays procedural — so a match can feel like a different place at near-zero
 * cost. One is picked at random each match.
 */
export const THEMES = {
  facility: {
    id: 'facility', name: '연구 시설',
    floorLine: 'rgba(90,120,160,0.10)',
    floorPanel: 'rgba(42,72,112,0.14)', floorEdge: 'rgba(130,175,225,0.10)',
    wallTop: '#1b2740', wallBot: '#0e1626', wallEdge: 'rgba(90,150,220,0.25)',
    backdropGlow: 'rgba(20,40,70,0.35)', mote: '#5fb0ff',
  },
  mine: {
    id: 'mine', name: '에너지 광산',
    floorLine: 'rgba(150,110,60,0.10)',
    floorPanel: 'rgba(96,64,28,0.15)', floorEdge: 'rgba(235,185,115,0.10)',
    wallTop: '#3a2a16', wallBot: '#1d1408', wallEdge: 'rgba(230,160,70,0.24)',
    backdropGlow: 'rgba(70,45,15,0.38)', mote: '#ffb060',
  },
  city: {
    id: 'city', name: '네온 시티',
    floorLine: 'rgba(150,90,190,0.11)',
    floorPanel: 'rgba(74,44,116,0.15)', floorEdge: 'rgba(196,138,236,0.10)',
    wallTop: '#2a1b40', wallBot: '#160e26', wallEdge: 'rgba(180,90,230,0.26)',
    backdropGlow: 'rgba(45,20,70,0.38)', mote: '#c88fff',
  },
};
export const THEME_ORDER = ['facility', 'mine', 'city'];

/** Player / bot movement + combat feel. */
export const PLAYER = {
  RADIUS: 17,
  SPEED: 235,             // px / second
  MAX_ENERGY: 100,
  ENERGY_REGEN: 4,        // passive energy per second
  STUN_TIME: 1.15,        // seconds a player is downed after a pulse hit
  RESPAWN_INVULN: 1.4,    // grace period after recovering
  // Dash
  DASH_SPEED: 620,
  DASH_TIME: 0.16,
  DASH_COOLDOWN: 1.6,
  // Shield
  SHIELD_TIME: 1.8,
  SHIELD_COOLDOWN: 6.0,
};

/**
 * Character classes (drones). Each is a stat profile plus a vector look (drawn
 * procedurally by DroneArt.js — no image assets). Multipliers scale the base
 * PLAYER values so balance stays centralised. `shape` selects the silhouette.
 */
export const CLASSES = {
  specter: {
    id: 'specter', name: 'SPECTER', role: { ko: '밸런스형', en: 'BALANCED' },
    shape: 'round', accent: '#7ff0ff', eye: '#7ff0ff',
    light: '#eef6ff', mid: '#c3d2e6', dark: '#3c4a63',
    speedMul: 1.0, regenMul: 1.0, maxEnergyMul: 1.0,
    dashCdMul: 1.0, shieldTimeMul: 1.0, radiusMul: 1.0,
  },
  nova: {
    id: 'nova', name: 'NOVA', role: { ko: '스피드형', en: 'SPEED' },
    shape: 'chevron', accent: '#ffcf4a', eye: '#8ff0ff',
    light: '#fdf3cf', mid: '#e0b84a', dark: '#4a3a14',
    speedMul: 1.18, regenMul: 1.0, maxEnergyMul: 0.9,
    dashCdMul: 0.68, shieldTimeMul: 0.85, radiusMul: 0.94,
  },
  phantom: {
    id: 'phantom', name: 'PHANTOM', role: { ko: '스킬형', en: 'STEALTH' },
    shape: 'teardrop', accent: '#c76bff', eye: '#8ff0ff',
    light: '#e6ddf7', mid: '#7a6ca6', dark: '#241a3d',
    speedMul: 1.06, regenMul: 1.28, maxEnergyMul: 0.95,
    dashCdMul: 0.9, shieldTimeMul: 1.0, radiusMul: 0.96,
  },
  guardian: {
    id: 'guardian', name: 'GUARDIAN', role: { ko: '뱅커형', en: 'TANK' },
    shape: 'armored', accent: '#5fb8ff', eye: '#7ff0ff',
    light: '#eaf2fb', mid: '#9db4d2', dark: '#38506e',
    speedMul: 0.86, regenMul: 1.0, maxEnergyMul: 1.22,
    dashCdMul: 1.3, shieldTimeMul: 1.6, radiusMul: 1.12,
  },
};
export const CLASS_ORDER = ['specter', 'nova', 'phantom', 'guardian'];

/**
 * Energy Core archetypes. Cores are deployed onto a tile, arm after `fuse`
 * seconds, then release an expanding PulseWave. They cost energy to deploy.
 */
export const CORE_TYPES = {
  standard: {
    id: 'standard', label: 'STANDARD', glyph: 'circle',
    fuse: 1.9, radius: GRID.TILE * 2.6, waveSpeed: 520,
    cost: 22, damage: true,
  },
  rapid: {
    id: 'rapid', label: 'RAPID', glyph: 'triangle',
    fuse: 1.0, radius: GRID.TILE * 1.7, waveSpeed: 640,
    cost: 16, damage: true,
  },
  heavy: {
    id: 'heavy', label: 'HEAVY', glyph: 'hex',
    fuse: 2.8, radius: GRID.TILE * 3.9, waveSpeed: 430,
    cost: 40, damage: true,
  },
  resonant: {
    id: 'resonant', label: 'RESONANT', glyph: 'rings',
    fuse: 2.1, radius: GRID.TILE * 2.4, waveSpeed: 500,
    cost: 34, damage: true, echoes: 2, echoDelay: 0.45,
  },
  // MAGNETIC: on detonation it yanks nearby cores into an instant chain,
  // producing large spatial cascades (distinct from resonant's repeated echoes).
  magnetic: {
    id: 'magnetic', label: 'MAGNETIC', glyph: 'magnet',
    fuse: 2.2, radius: GRID.TILE * 2.2, waveSpeed: 480,
    cost: 34, damage: true, magnet: GRID.TILE * 3.4,
  },
  // FREEZE: deals no knockback. Its wave slows every player it sweeps for a
  // few seconds — a control tool rather than a takedown.
  freeze: {
    id: 'freeze', label: 'FREEZE', glyph: 'snow',
    fuse: 1.7, radius: GRID.TILE * 2.8, waveSpeed: 500,
    cost: 30, damage: false, effect: 'slow', slowFactor: 0.45, slowTime: 2.4,
  },
};

export const CORE_ORDER = ['standard', 'rapid', 'heavy', 'resonant', 'magnetic', 'freeze'];

/** Pulse wave behaviour. */
export const PULSE = {
  RING_THICKNESS: 22,     // how "thick" the damaging ring front is
  KNOCKBACK: 360,
  CLAIM_ON_SWEEP: true,   // territory painted where the ring passes
};

/** Scoring + match rules. */
export const MATCH = {
  DEFAULT_DURATION: 150,  // seconds
  TERRITORY_TICK: 0.5,    // how often territory score is tallied
  POINTS_PER_TILE: 1,
  POINTS_PER_CRYSTAL: 5,
  CRYSTAL_ENERGY: 18,     // energy restored when collecting a crystal shard
};

/** Ambient collectible crystal shards. */
export const CRYSTAL_CFG = {
  SCATTER_CHANCE: 0.42,   // chance an eligible floor tile spawns a crystal block
  SHARD_LIFETIME: 16,     // seconds a dropped shard floats before fading
  SHARD_MAGNET: 74,       // pickup radius
};

/**
 * Item pickups. Spawn on floor tiles during a match; walking over one applies
 * a timed buff (or an instant effect). Drawn procedurally by their `glyph`.
 */
export const ITEMS = {
  overcharge: {
    id: 'overcharge', glyph: 'bolt', color: '#ff6a3c', accent: '#ffd08a',
    label: { ko: '과부하', en: 'OVERCHARGE' }, duration: 8,
    // Cheaper, larger pulses while active.
    costMul: 0.5, radiusMul: 1.32,
  },
  haste: {
    id: 'haste', glyph: 'chevron', color: '#a6ff2e', accent: '#e4ffb0',
    label: { ko: '가속', en: 'HASTE' }, duration: 6, speedMul: 1.35,
  },
  cloak: {
    id: 'cloak', glyph: 'eye', color: '#c76bff', accent: '#ecd0ff',
    label: { ko: '은신', en: 'CLOAK' }, duration: 6,
    // Bots stop targeting a cloaked player.
  },
  cell: {
    id: 'cell', glyph: 'cell', color: '#8ff6ff', accent: '#ffffff',
    label: { ko: '에너지', en: 'ENERGY' }, instant: true, // full energy refill
  },
  barrier: {
    id: 'barrier', glyph: 'shield', color: '#5fb8ff', accent: '#d6ecff',
    label: { ko: '보호막', en: 'BARRIER' }, instant: true, duration: 4, // instant shield
  },
  blink: {
    id: 'blink', glyph: 'warp', color: '#b06bff', accent: '#e9d6ff',
    label: { ko: '점멸', en: 'BLINK' }, instant: true, // teleport to a random floor tile
  },
  magnet: {
    id: 'magnet', glyph: 'magnet', color: '#39d98a', accent: '#c6ffe4',
    label: { ko: '자기장', en: 'MAGNET' }, duration: 7, // auto-collects nearby shards
  },
  rapidcore: {
    id: 'rapidcore', glyph: 'rapid', color: '#ff8a3c', accent: '#ffe0c0',
    label: { ko: '쾌속코어', en: 'RAPID CORE' }, duration: 6, fuseMul: 0.4, // faster fuses
  },
};
export const ITEM_ORDER = ['overcharge', 'haste', 'cloak', 'cell', 'barrier', 'blink', 'magnet', 'rapidcore'];

export const ITEM_CFG = {
  SPAWN_INTERVAL: 9,   // seconds between item spawns
  MAX_ACTIVE: 3,       // cap simultaneous uncollected items
  LIFETIME: 18,        // seconds before an uncollected item fades
  PICKUP_RADIUS: 26,
};

/** Camera behaviour. */
export const CAMERA = {
  LERP: 0.12,             // follow smoothing
  SHAKE_DECAY: 6.5,
  SHAKE_MAX: 26,
};

/** LocalStorage key for persisted settings. */
export const STORAGE_KEY = 'pulsar-arena/settings/v1';

/** Default persisted settings. */
export const DEFAULT_SETTINGS = {
  volume: 0.7,
  sfx: true,
  shake: true,
  botCount: 3,
  duration: MATCH.DEFAULT_DURATION,
  lang: 'ko',        // Korean by default; English selectable in settings
  charClass: 'specter', // chosen drone class for the human player
  coop: false,       // local 2-player split (P1 WASD, P2 arrows)
  bestStage: 0,      // highest stage cleared (stage mode record)
};

/** Game state machine values. */
export const STATE = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  OVER: 'over',
};
