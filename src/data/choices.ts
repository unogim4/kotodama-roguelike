/**
 * 레벨업 등에서 고르는 선택지 한 장 (무기 강화 · 새 무기 · 가호 · 회복 …)
 */
export interface ChoiceDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  apply: () => void;
}

/** 고를 것이 모자랄 때 채워 넣는 회복 */
export function healChoice(heal: (amount: number) => void): ChoiceDef {
  return { id: 'heal', name: '정화', desc: '체력 30 회복', icon: '🍵', apply: () => heal(30) };
}

/** 강화 선택지가 모자랄 때 채우는 기본 강화 (서로 겹치지 않게) */
export interface BuildStats {
  hp: number;
  maxHp: number;
  speed: number;
  orbs: number;
}

export function basicChoices(b: BuildStats): ChoiceDef[] {
  return [
    { id: 'tough', name: '단련', desc: '최대 체력 +20 (체력도 20 회복)', icon: '💪', apply: () => ((b.maxHp += 20), (b.hp = Math.min(b.maxHp, b.hp + 20))) },
    { id: 'heal', name: '정화', desc: '체력 30 회복', icon: '🍵', apply: () => (b.hp = Math.min(b.maxHp, b.hp + 30)) },
    { id: 'swift', name: '가벼운 발걸음', desc: '이동 속도 +10%', icon: '👣', apply: () => (b.speed = Math.round((b.speed + 0.1) * 10) / 10) },
    { id: 'purse', name: '구슬 주머니', desc: '언령 구슬 +6', icon: '🔮', apply: () => (b.orbs += 6) },
  ];
}
