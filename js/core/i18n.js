/**
 * i18n.js
 * ---------------------------------------------------------------------------
 * Lightweight localisation. Korean ('ko') is the default; English ('en') is
 * selectable in Settings. Every UI-facing string lives here so the rest of the
 * code stays language-agnostic — callers just do `strings(settings.lang).key`.
 *
 * Adding a language means adding one more block with the same keys.
 * ---------------------------------------------------------------------------
 */

export const LANGS = ['ko', 'en'];
export const LANG_NAMES = { ko: '한국어', en: 'English' };
export const DEFAULT_LANG = 'ko';

const DICT = {
  ko: {
    tagline: '에너지 코어 아레나',
    enterArena: '게임 시작',
    howToPlay: '게임 방법',
    settings: '설정',
    chooseDrone: '드론 선택',
    namePlaceholder: '이름 입력',
    online: '온라인 1v1 (P2P)',
    stageMode: '스테이지 모드',
    stageClear: '스테이지 {n} 클리어!',
    nextStage: '스테이지 {n} →',
    nextStageHint: '다음 스테이지는 적이 더 많고 강해집니다.',
    stageReached: '스테이지 {n} 도달',
    bestStage: '최고 {n}',
    stageIntroGo: '영역을 점령하라!',
    stageIntroBoss: '보스를 압도하라!',
    roguelite: '로그라이크',
    pickPerk: '퍼크를 하나 선택하세요',
    defeated: '패배...',
    retry: '재도전',
    runOver: '런 종료',
    perksTaken: '획득 퍼크',
    shardsEarned: '샤드 획득',
    shardsTotal: '보유 샤드',
    shopTitle: '강화 상점',
    reroll2: '리롤 (남은 {n})',
    mainFootnote: '오리지널 네온 아레나 — 영역을 점령하고 코어를 연쇄시키세요.',

    // How to play
    move: '이동',
    deployCore: '에너지 코어 설치',
    dash: '대시 (순간 가속 + 무적)',
    shield: '실드 (짧은 무적)',
    cycleCore: '코어 종류 전환',
    pause: '일시정지',
    howtoNote1: '에너지 코어는 <strong>잠시 뒤 활성화</strong>되어 <strong>원형 펄스</strong>를 방출합니다. 펄스는 크리스탈을 부수고, 바닥을 내 색으로 물들이며, 상대를 넘어뜨리고, 근처 코어를 <strong>연쇄</strong>시킵니다. 승리는 상대 제거가 아니라 <strong>가장 넓은 영역 점령 + 크리스탈 수집</strong>으로 결정됩니다. 코어 주변의 <strong>점선 원</strong>이 폭발 범위이니 그 바깥으로 피하세요. <strong>솔리드 벽</strong>은 파동을 막아주므로 벽 뒤로 숨으면 안전합니다.',
    howtoNote2: '터치 기기에서는 왼쪽 스틱으로 이동하고, 오른쪽 버튼으로 설치 / 대시 / 실드 / 전환을 사용합니다.',
    back: '뒤로',

    // Settings
    language: '언어',
    masterVolume: '마스터 볼륨',
    soundEffects: '효과음',
    screenShake: '화면 흔들림',
    opponentBots: '상대 봇',
    matchLength: '매치 시간',
    on: '켜짐',
    off: '꺼짐',
    secShort: '초',

    // Pause
    paused: '일시정지',
    resume: '계속하기',
    restart: '다시 시작',
    quitToMenu: '메뉴로 나가기',

    // Results
    dominates: '{name} 승리!',
    playAgain: '다시 플레이',
    mainMenu: '메인 메뉴',
    youParen: '(나)',
    tilesUnit: '칸',

    // HUD
    energy: '에너지',
    hudDash: '대시',
    hudShield: '실드',
    youTag: '◄ 나',
    core: {
      standard: '펄스', rapid: '래피드', heavy: '헤비',
      resonant: '공명', magnetic: '자기', freeze: '빙결',
    },
  },

  en: {
    tagline: 'ENERGY\u00A0CORE\u00A0ARENA',
    enterArena: 'ENTER ARENA',
    chooseDrone: 'CHOOSE YOUR DRONE',
    namePlaceholder: 'Enter your name',
    online: 'ONLINE 1v1 (P2P)',
    stageMode: 'STAGE MODE',
    stageClear: 'STAGE {n} CLEAR!',
    nextStage: 'STAGE {n} →',
    nextStageHint: 'The next stage has more, tougher rivals.',
    stageReached: 'REACHED STAGE {n}',
    bestStage: 'BEST {n}',
    stageIntroGo: 'CLAIM THE ARENA!',
    stageIntroBoss: 'CRUSH THE BOSS!',
    roguelite: 'ROGUELIKE',
    pickPerk: 'Choose one perk',
    defeated: 'DEFEATED...',
    retry: 'RETRY',
    runOver: 'RUN OVER',
    perksTaken: 'Perks taken',
    shardsEarned: 'Shards earned',
    shardsTotal: 'Total shards',
    shopTitle: 'UPGRADE SHOP',
    reroll2: 'Reroll ({n} left)',
    howToPlay: 'HOW TO PLAY',
    settings: 'SETTINGS',
    mainFootnote: 'An original neon arena. Claim territory. Chain the cores.',

    move: 'Move',
    deployCore: 'Deploy Energy Core',
    dash: 'Dash (burst + i-frames)',
    shield: 'Shield (brief invulnerability)',
    cycleCore: 'Cycle core type',
    pause: 'Pause',
    howtoNote1: 'Energy Cores <strong>arm after a delay</strong>, then release an expanding <strong>circular pulse</strong>. Pulses shatter crystals, paint territory in your colour, knock down rivals, and <strong>chain-trigger</strong> nearby cores. Win by controlling the most territory and collecting crystal shards — not just by knocking others out. The <strong>dashed ring</strong> around a core marks its blast radius — get outside it. <strong>Solid walls</strong> block the pulse, so you can take cover behind them.',
    howtoNote2: 'On touch devices, use the left stick to move and the right buttons for deploy / dash / shield / cycle.',
    back: 'BACK',

    language: 'Language',
    masterVolume: 'Master Volume',
    soundEffects: 'Sound Effects',
    screenShake: 'Screen Shake',
    opponentBots: 'Opponent Bots',
    matchLength: 'Match Length',
    on: 'ON',
    off: 'OFF',
    secShort: 's',

    paused: 'PAUSED',
    resume: 'RESUME',
    restart: 'RESTART',
    quitToMenu: 'QUIT TO MENU',

    dominates: '{name} DOMINATES',
    playAgain: 'PLAY AGAIN',
    mainMenu: 'MAIN MENU',
    youParen: '(YOU)',
    tilesUnit: 'tiles',

    energy: 'ENERGY',
    hudDash: 'DASH',
    hudShield: 'SHIELD',
    youTag: '◄ YOU',
    core: {
      standard: 'STANDARD', rapid: 'RAPID', heavy: 'HEAVY',
      resonant: 'RESONANT', magnetic: 'MAGNETIC', freeze: 'FREEZE',
    },
  },
};

/** Return the string table for a language, falling back to the default. */
export function strings(lang) {
  return DICT[lang] || DICT[DEFAULT_LANG];
}
