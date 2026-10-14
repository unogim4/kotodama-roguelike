/**
 * 본편 무기 (던그리드식) — 손에 든 무기 하나가 마우스 쪽으로 자동 공격한다.
 * 손은 두 개: Tab · 휠로 바꿔 든다 (바꿔 드는 순간 한 번 친다). 두 손이 다 차면 그 판은 강화만. Lv 1~5 + 진화.
 * 대시는 나기나타(찌르며 돌진) · 텐구 부채(바람 타고 도약)만.
 */
export type ArmsId = 'ofuda' | 'kitsunebi' | 'suzu' | 'tsurugi' | 'hamayumi' | 'naginata' | 'nusa' | 'uchiwa';

/** 손 두 개 */
export const MAX_SLOTS = 2;
export const MAX_LEVEL = 5;

/** 레벨별 수치 (index 0 = Lv1) */
export interface ArmsLevel {
  damage: number;
  /** 공격 간격 */
  cooldownMs: number;
  /** 무기마다 뜻이 다르다: 부적 장수 · 여우불 개수 · 화살 갈래 · 되베기 · 추가 기술 */
  count: number;
  /** 관통 수 */
  pierce: number;
  /** 사거리 · 반경 */
  range: number;
  /** 선택지에 보이는 이번 레벨의 변화 */
  note: string;
}

export interface ArmsDef {
  id: ArmsId;
  name: string;
  jp: string;
  icon: string;
  desc: string;
  levels: ArmsLevel[];
  /** 넉백 배율 (오오누사 · 부채는 멀리 밀어낸다) */
  knock?: number;
  /** 대시 — 우클릭 · Shift */
  dash?: { name: string; cooldownMs: number; distance: number };
  /** 진화: Lv5 + 짝 가호를 갖추면 강화 카드에 나온다 */
  evo?: { name: string; icon: string; desc: string; blessing: string };
}

const L = (damage: number, cooldownMs: number, count: number, pierce: number, range: number, note: string): ArmsLevel => ({
  damage,
  cooldownMs,
  count,
  pierce,
  range,
  note,
});

export const ARSENAL: Record<ArmsId, ArmsDef> = {
  ofuda: {
    id: 'ofuda',
    name: '부적',
    jp: 'お札',
    icon: '📜',
    desc: '마우스 쪽으로 부적을 던진다 · 멀리까지',
    evo: { name: '일륜 부적', icon: '☀️', desc: '부적이 빛이 되어 끝없이 관통 · 맞은 자리에 빛 폭발 · 1장 더', blessing: 'sun-ofuda' },
    levels: [
      L(16, 460, 1, 0, 260, '기본 무기'),
      L(16, 450, 2, 0, 260, '한 번에 2장'),
      L(19, 480, 2, 0, 270, '피해 +35%'),
      L(19, 470, 2, 1, 280, '요괴 1마리 관통'),
      L(22, 420, 3, 1, 290, '3장 · 더 빠르게'),
    ],
  },
  tsurugi: {
    id: 'tsurugi',
    name: '신검',
    jp: '神剣',
    icon: '⚔️',
    desc: '마우스 쪽을 반원으로 크게 벤다 · 가까이서 강하다',
    levels: [
      L(26, 640, 1, 0, 46, '앞쪽 반원 베기'),
      L(26, 600, 1, 0, 52, '베는 범위 +15%'),
      L(34, 580, 1, 0, 54, '피해 +30%'),
      L(34, 560, 2, 0, 56, '되베기 — 한 번 더'),
      L(42, 480, 2, 0, 62, '더 빠르고 넓게'),
    ],
  },
  suzu: {
    id: 'suzu',
    name: '방울',
    jp: '鈴',
    icon: '🔔',
    desc: '방울을 흔들어 마우스 쪽으로 소리 물결을 보낸다',
    levels: [
      L(17, 780, 1, 0, 74, '앞쪽 소리 물결'),
      L(17, 760, 1, 0, 84, '범위 +15%'),
      L(18, 850, 1, 0, 84, '피해 +30%'),
      L(18, 820, 2, 0, 86, '메아리 — 몸 둘레로도 울린다'),
      L(22, 720, 2, 0, 98, '범위 · 속도 증가'),
    ],
  },
  kitsunebi: {
    id: 'kitsunebi',
    name: '여우불',
    jp: '狐火',
    icon: '🦊',
    desc: '여우불이 몸 주위를 돌고, 마우스 쪽으로 불꽃을 날린다',
    evo: { name: '여우불 폭풍', icon: '🌪️', desc: '여우불이 커지고 4초마다 회오리처럼 퍼졌다 돌아온다 · 피해 +30%', blessing: 'storm-fox' },
    levels: [
      L(12, 900, 2, 0, 34, '여우불 2개'),
      L(12, 880, 3, 0, 34, '여우불 3개'),
      L(17, 850, 3, 0, 36, '피해 +40%'),
      L(17, 800, 3, 0, 46, '회전 반경 넓게 · 빠르게'),
      L(20, 700, 4, 0, 48, '여우불 4개'),
    ],
  },
  hamayumi: {
    id: 'hamayumi',
    name: '하마유미',
    jp: '破魔弓',
    icon: '🏹',
    desc: '시위를 당겨 마우스 쪽으로 꿰뚫는 화살을 쏜다',
    levels: [
      L(22, 720, 1, 1, 340, '요괴 2마리 꿰뚫기'),
      L(22, 680, 1, 2, 340, '3마리 꿰뚫기'),
      L(30, 660, 1, 2, 360, '피해 +35%'),
      L(30, 640, 1, 3, 380, '4마리 꿰뚫기'),
      L(36, 560, 3, 3, 400, '세 갈래 화살'),
    ],
  },
  naginata: {
    id: 'naginata',
    name: '나기나타',
    jp: '薙刀',
    icon: '🔱',
    desc: '마우스 쪽으로 길게 찌른다 · 우클릭으로 찌르며 돌진',
    dash: { name: '찌르며 돌진', cooldownMs: 1300, distance: 84 },
    levels: [
      L(24, 700, 1, 0, 58, '긴 찌르기'),
      L(24, 680, 1, 0, 64, '찌르기 거리 +10%'),
      L(32, 650, 2, 0, 66, '세 번째마다 크게 휘돌리기'),
      L(32, 620, 2, 0, 70, '피해 +30%'),
      L(40, 560, 2, 0, 76, '더 빠르고 길게'),
    ],
  },
  nusa: {
    id: 'nusa',
    name: '오오누사',
    jp: '大幣',
    icon: '🎋',
    desc: '크게 휘둘러 요괴를 멀리 밀어낸다',
    knock: 2.2,
    levels: [
      L(18, 900, 0, 0, 56, '넓게 휘둘러 밀어내기'),
      L(18, 880, 0, 0, 60, '범위 +10%'),
      L(24, 860, 1, 0, 62, '정화 장판 — 휘두른 자리를 3초 정화'),
      L(24, 840, 1, 0, 66, '피해 +30%'),
      L(30, 760, 1, 0, 72, '더 빠르고 넓게'),
    ],
  },
  uchiwa: {
    id: 'uchiwa',
    name: '텐구 부채',
    jp: '天狗の団扇',
    icon: '🍃',
    desc: '부채질로 돌풍을 일으켜 요괴를 날려 보낸다 · 우클릭으로 바람 타고 도약',
    knock: 3,
    dash: { name: '바람 타고 도약', cooldownMs: 1600, distance: 96 },
    levels: [
      L(16, 700, 1, 0, 92, '앞쪽 돌풍'),
      L(16, 680, 1, 0, 100, '돌풍 범위 +10%'),
      L(16, 760, 1, 0, 104, '피해 +30%'),
      L(16, 740, 2, 0, 110, '돌풍 두 번'),
      L(20, 640, 2, 0, 120, '더 빠르고 멀리'),
    ],
  },
};

/** 든 무기 (owned[0]이 지금 손에 든 무기) */
export interface Owned {
  id: ArmsId;
  level: number;
  /** 진화했는지 */
  evo?: boolean;
}
