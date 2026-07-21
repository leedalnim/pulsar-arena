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
};

/** Game state machine values. */
export const STATE = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  OVER: 'over',
};
