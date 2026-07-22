/**
 * rooms.js
 * ---------------------------------------------------------------------------
 * Roguelite room types. Before each non-boss stage the player picks one of two
 * rooms, trading risk for reward. Pure data + a picker — no browser APIs.
 *   normal  : baseline arena, draft 1 of 3 perks.
 *   elite   : tougher (more aggressive bots, less time) → draft 1 of 4 perks.
 *   fortune : easier (calmer bots, more time) + 2 bonus items → draft 1 of 3.
 * ---------------------------------------------------------------------------
 */
export const ROOMS = {
  normal: {
    id: 'normal', color: '#7fb0e0',
    name: { ko: '표준', en: 'NORMAL' },
    desc: { ko: '일반 교전 · 퍼크 3택', en: 'Standard · pick 1 of 3' },
  },
  elite: {
    id: 'elite', color: '#ff6a6a',
    name: { ko: '엘리트', en: 'ELITE' },
    desc: { ko: '강한 봇 · 시간↓ · 퍼크 4택', en: 'Tougher, less time · pick 1 of 4' },
  },
  fortune: {
    id: 'fortune', color: '#ffd76b',
    name: { ko: '행운', en: 'FORTUNE' },
    desc: { ko: '쉬움 · 시간↑ · 아이템 +2', en: 'Easier, more time · +2 items' },
  },
};

export const ROOM_IDS = ['normal', 'elite', 'fortune'];

/** Pick two distinct room types for a branch choice. */
export function pickTwoRooms() {
  const pool = ROOM_IDS.slice();
  const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  const b = pool[Math.floor(Math.random() * pool.length)];
  return [a, b];
}
