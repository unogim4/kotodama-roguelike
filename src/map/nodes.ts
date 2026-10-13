/** 지역 지도의 노드 종류 */
export type NodeKind =
  | 'prologue'
  | 'arrive'
  | 'library'
  | 'raid'
  | 'trial'
  | 'story'
  | 'event'
  | 'shop'
  | 'spring'
  | 'shrine'
  | 'grudge'
  | 'rest'
  | 'boss';

export interface NodeInfo {
  icon: string;
  name: string;
  desc: string;
  /** 지도 배지 테두리 색 (CSS 변수 이름이 아닌 실제 색) */
  ring: string;
  /** 보상 미리보기 */
  reward?: string;
}

export const NODE_INFO: Record<NodeKind, NodeInfo> = {
  prologue: { icon: '🏚️', name: '무너진 서고', desc: '모든 것이 시작된 곳', ring: '#8fa0d8' },
  arrive: { icon: '🏮', name: '도착', desc: '새 지역에 들어섰다', ring: '#8fa0d8' },
  library: { icon: '⛩️', name: '서고', desc: '봉인된 두루마리를 펼쳐 글자를 되찾는다', ring: '#f0b84a', reward: '새 글자' },
  raid: { icon: '👹', name: '습격', desc: '몰려오는 요괴를 45초 동안 버틴다', ring: '#d8432e', reward: '구슬 · 강화' },
  trial: { icon: '⚔️', name: '시련', desc: '습격을 버틴 뒤 이 행의 글자를 모두 연속으로 맞힌다', ring: '#fffaf0', reward: '체크포인트 · 다음 행' },
  story: { icon: '📜', name: '이야기', desc: '', ring: '#9be3b0' },
  event: { icon: '❔', name: '이벤트', desc: '누군가 도움을 청한다 — 단어를 읽어 해결하자', ring: '#9be3b0', reward: '단어 · 무언가' },
  shop: { icon: '🍵', name: '찻집', desc: '언령 구슬로 강화·회복을 산다', ring: '#b9773f', reward: '구매' },
  spring: { icon: '♨️', name: '온천', desc: '회복하거나, 약한 글자를 복습한다', ring: '#8fd8ff', reward: '회복 / 복습' },
  shrine: { icon: '🎐', name: '신사', desc: '신이 가호를 내린다 (3개 중 하나)', ring: '#e6c9ff', reward: '가호' },
  grudge: { icon: '💀', name: '원한 요괴', desc: '틀렸던 글자가 요괴가 되었다 — 어렵지만 보상이 크다', ring: '#7a62b8', reward: '가호 · 진화 재료' },
  rest: { icon: '♨️', name: '산길 쉼터', desc: '보스를 앞두고 한숨 돌린다', ring: '#8fd8ff', reward: '회복' },
  boss: { icon: '👺', name: '보스', desc: '', ring: '#d8432e', reward: '마지막 언령' },
};

export interface MapNode {
  id: number;
  layer: number;
  kind: NodeKind;
  /** 이 노드가 속한 행 (0 = あ, 1 = か, 2 = さ …) */
  row: number;
  x: number;
  y: number;
  /** 다음 층에서 갈 수 있는 노드 id */
  next: number[];
  /** 이야기 노드 종류 (kon · suzu · tengu · small) */
  story?: string;
  /** 이야기 노드 · 보스의 고유 이름과 설명 */
  title?: string;
  text?: string;
}
