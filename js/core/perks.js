/**
 * perks.js
 * ---------------------------------------------------------------------------
 * Roguelite run perks. Each cleared stage offers a draft of 3; the chosen perk
 * stacks into the run's modifier object (game.run), which is applied to the
 * player and deploy logic each stage. A few perks are "special" (they act on
 * the game directly, e.g. healing a heart). Pure data — no browser APIs.
 * ---------------------------------------------------------------------------
 */

/** Fresh run-modifier object (multipliers = 1, additives = 0). */
export function freshRun() {
  return {
    speedMul: 1, radiusMul: 1, waveMul: 1, costMul: 1,
    regenMul: 1, maxEnergyMul: 1, dashCdMul: 1, shieldTimeMul: 1,
    crystalMul: 1, startItems: 0,
  };
}

export const PERKS = [
  { id: 'bigpulse', name: { ko: '대형 펄스', en: 'BIG PULSE' }, desc: { ko: '펄스 반경 +20%', en: 'Pulse radius +20%' },
    apply: (r) => { r.radiusMul *= 1.2; } },
  { id: 'swift', name: { ko: '가속 회로', en: 'OVERDRIVE' }, desc: { ko: '이동 속도 +15%', en: 'Move speed +15%' },
    apply: (r) => { r.speedMul *= 1.15; } },
  { id: 'thrift', name: { ko: '효율 코어', en: 'EFFICIENT' }, desc: { ko: '코어 설치 비용 -20%', en: 'Core cost -20%' },
    apply: (r) => { r.costMul *= 0.8; } },
  { id: 'reactor', name: { ko: '고속 리액터', en: 'REACTOR' }, desc: { ko: '에너지 재생 +35%', en: 'Energy regen +35%' },
    apply: (r) => { r.regenMul *= 1.35; } },
  { id: 'dashmaster', name: { ko: '대시 특화', en: 'DASH TECH' }, desc: { ko: '대시 쿨다운 -30%', en: 'Dash cooldown -30%' },
    apply: (r) => { r.dashCdMul *= 0.7; } },
  { id: 'aegis', name: { ko: '강화 실드', en: 'AEGIS' }, desc: { ko: '실드 지속 +50%', en: 'Shield duration +50%' },
    apply: (r) => { r.shieldTimeMul *= 1.5; } },
  { id: 'capacitor', name: { ko: '대용량', en: 'CAPACITOR' }, desc: { ko: '최대 에너지 +30%', en: 'Max energy +30%' },
    apply: (r) => { r.maxEnergyMul *= 1.3; } },
  { id: 'velocity', name: { ko: '고속 파동', en: 'VELOCITY' }, desc: { ko: '파동 속도 +30%', en: 'Wave speed +30%' },
    apply: (r) => { r.waveMul *= 1.3; } },
  { id: 'harvest', name: { ko: '채굴 강화', en: 'HARVEST' }, desc: { ko: '크리스탈 에너지 +50%', en: 'Crystal energy +50%' },
    apply: (r) => { r.crystalMul *= 1.5; } },
  { id: 'stockpile', name: { ko: '보급', en: 'STOCKPILE' }, desc: { ko: '스테이지 시작 아이템 +1', en: '+1 item each stage' },
    apply: (r) => { r.startItems += 1; } },
  { id: 'overload', name: { ko: '과부하 회로', en: 'OVERLOAD' }, desc: { ko: '반경 +12%, 비용 -10%', en: 'Radius +12%, cost -10%' },
    apply: (r) => { r.radiusMul *= 1.12; r.costMul *= 0.9; } },
  // Special: acts on the game, not the run modifiers.
  { id: 'mend', name: { ko: '수리', en: 'REPAIR' }, desc: { ko: '하트 +1 회복', en: 'Restore 1 heart' },
    special: true, apply: (r, game) => { if (game) game.hearts = Math.min(game.maxHearts || 5, game.hearts + 1); } },
];

const BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p]));
export function perkById(id) { return BY_ID[id]; }

/**
 * Draft `count` distinct perks. Deterministic randomness is avoided (Math.random
 * is fine at runtime; the harness seeds nothing). Returns perk objects.
 */
export function draftPerks(count = 3) {
  const pool = PERKS.slice();
  const out = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
