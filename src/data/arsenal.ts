/**
 * 본편 무기 — 여러 개를 동시에 장착 (최대 4칸), Lv 1~5 + 진화.
 * 시작은 부적 하나. 여우불·방울은 스토리로 처음 해금한 뒤부터 레벨업 선택지에 나온다.
 */
export type ArmsId = 'ofuda' | 'kitsunebi' | 'suzu' | 'tsurugi';

export const MAX_SLOTS = 4;
export const MAX_LEVEL = 5;

/** 레벨별 수치 (index 0 = Lv1) */
export interface ArmsLevel {
  damage: number;
  /** 공격 간격 (여우불은 같은 적을 다시 태우는 간격) */
  cooldownMs: number;
  /** 부적 장수 · 여우불 개수 · 방울 연속 울림 */
  count: number;
  /** 부적 관통 / 사거리·반경 */
  pierce: number;
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
  /** 진화: Lv5 + 짝 가호를 갖추면 강화 카드에 나온다 */
  evo?: { name: string; icon: string; desc: string; blessing: string };
}

export const ARSENAL: Record<ArmsId, ArmsDef> = {
  ofuda: {
    id: 'ofuda',
    name: '부적',
    jp: 'お札',
    icon: '📜',
    desc: '가장 가까운 요괴에게 부적을 던진다',
    evo: { name: '일륜 부적', icon: '☀️', desc: '부적이 빛이 되어 끝없이 관통 · 맞은 자리에 빛 폭발 · 1장 더', blessing: 'sun-ofuda' },
    levels: [
      { damage: 10, cooldownMs: 620, count: 1, pierce: 0, range: 230, note: '기본 무기' },
      { damage: 10, cooldownMs: 620, count: 2, pierce: 0, range: 230, note: '한 번에 2장' },
      { damage: 14, cooldownMs: 600, count: 2, pierce: 0, range: 240, note: '피해 +40%' },
      { damage: 14, cooldownMs: 600, count: 2, pierce: 1, range: 250, note: '요괴 1마리 관통' },
      { damage: 16, cooldownMs: 500, count: 3, pierce: 1, range: 260, note: '3장 · 더 빠르게' },
    ],
  },
  kitsunebi: {
    id: 'kitsunebi',
    name: '여우불',
    jp: '狐火',
    icon: '🦊',
    desc: '푸른 여우불이 몸 주위를 돌며 닿는 요괴를 태운다',
    evo: { name: '여우불 폭풍', icon: '🌪️', desc: '여우불이 커지고 4초마다 회오리처럼 퍼졌다 돌아온다 · 피해 +30%', blessing: 'storm-fox' },
    levels: [
      { damage: 9, cooldownMs: 380, count: 2, pierce: 0, range: 34, note: '여우불 2개' },
      { damage: 9, cooldownMs: 380, count: 3, pierce: 0, range: 34, note: '여우불 3개' },
      { damage: 13, cooldownMs: 360, count: 3, pierce: 0, range: 36, note: '피해 +45%' },
      { damage: 13, cooldownMs: 340, count: 3, pierce: 0, range: 46, note: '회전 반경 넓게 · 빠르게' },
      { damage: 15, cooldownMs: 320, count: 4, pierce: 0, range: 48, note: '여우불 4개' },
    ],
  },
  suzu: {
    id: 'suzu',
    name: '방울',
    jp: '鈴',
    icon: '🔔',
    desc: '맑은 방울 소리가 퍼져 주변 요괴를 한꺼번에 친다',
    levels: [
      { damage: 8, cooldownMs: 1100, count: 1, pierce: 0, range: 58, note: '주변 음파' },
      { damage: 8, cooldownMs: 1100, count: 1, pierce: 0, range: 70, note: '범위 +20%' },
      { damage: 11, cooldownMs: 1050, count: 1, pierce: 0, range: 70, note: '피해 +40%' },
      { damage: 11, cooldownMs: 1050, count: 2, pierce: 0, range: 74, note: '메아리 — 두 번 울림' },
      { damage: 13, cooldownMs: 900, count: 2, pierce: 0, range: 86, note: '범위 · 속도 증가' },
    ],
  },
  tsurugi: {
    id: 'tsurugi',
    name: '신검',
    jp: '神剣',
    icon: '⚔️',
    desc: '가까운 요괴를 반원으로 크게 벤다 (텐구의 시험)',
    levels: [
      { damage: 20, cooldownMs: 950, count: 1, pierce: 0, range: 54, note: '앞쪽 반원 베기' },
      { damage: 20, cooldownMs: 900, count: 1, pierce: 0, range: 64, note: '베는 범위 +20%' },
      { damage: 28, cooldownMs: 880, count: 1, pierce: 0, range: 64, note: '피해 +40%' },
      { damage: 28, cooldownMs: 860, count: 2, pierce: 0, range: 68, note: '앞뒤로 두 번 베기' },
      { damage: 34, cooldownMs: 720, count: 2, pierce: 0, range: 76, note: '더 빠르고 넓게' },
    ],
  },
};

/** 장착 중인 무기 */
export interface Owned {
  id: ArmsId;
  level: number;
  /** 진화했는지 */
  evo?: boolean;
}
