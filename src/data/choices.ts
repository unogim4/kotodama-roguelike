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
