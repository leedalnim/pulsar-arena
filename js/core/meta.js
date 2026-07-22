/**
 * meta.js
 * ---------------------------------------------------------------------------
 * Roguelite meta-progression: permanent upgrades bought with shards (earned
 * per run, banked in settings.shards). Levels persist in settings.meta.
 * Pure data + helpers — no browser APIs. Effects are read at run start by Game.
 * ---------------------------------------------------------------------------
 */

export const META = [
  {
    id: 'heart', max: 2,
    name: { ko: '추가 하트', en: 'EXTRA HEART' },
    desc: { ko: '런 시작 하트 +1', en: '+1 heart at run start' },
    cost: (lvl) => [40, 90][lvl],
  },
  {
    id: 'startperk', max: 2,
    name: { ko: '시작 퍼크', en: 'STARTING PERK' },
    desc: { ko: '런 시작 시 랜덤 퍼크 +1', en: '+1 random perk at run start' },
    cost: (lvl) => [50, 120][lvl],
  },
  {
    id: 'reroll', max: 2,
    name: { ko: '리롤', en: 'REROLL' },
    desc: { ko: '퍼크 선택 리롤 +1', en: '+1 perk-draft reroll' },
    cost: (lvl) => [45, 100][lvl],
  },
  {
    id: 'shardboost', max: 2,
    name: { ko: '샤드 부스트', en: 'SHARD BOOST' },
    desc: { ko: '샤드 획득 +50%', en: 'Shards earned +50%' },
    cost: (lvl) => [40, 90][lvl],
  },
];

const BY_ID = Object.fromEntries(META.map((m) => [m.id, m]));

/** Owned level of an upgrade (0 if none). */
export function metaLevel(settings, id) {
  return (settings.meta && settings.meta[id]) || 0;
}

/** Cost of the next level, or null if maxed / unknown. */
export function metaCostNext(settings, id) {
  const u = BY_ID[id];
  if (!u) return null;
  const lvl = metaLevel(settings, id);
  return lvl >= u.max ? null : u.cost(lvl);
}

/**
 * Try to buy the next level of an upgrade. Mutates settings (shards + meta) and
 * returns true on success. Persistence (Storage.save) is the caller's job.
 */
export function buyMeta(settings, id) {
  const cost = metaCostNext(settings, id);
  if (cost == null || (settings.shards || 0) < cost) return false;
  settings.shards -= cost;
  settings.meta = settings.meta || {};
  settings.meta[id] = metaLevel(settings, id) + 1;
  return true;
}
