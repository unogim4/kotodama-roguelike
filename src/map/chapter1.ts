import { MapNode, NodeKind } from './nodes';

/** 같은 씨앗이면 같은 지도 (저장·이어하기용) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MAP_W = 640;
export const MAP_H = 1520;
/** 층 간격 (아래가 0층) */
const LAYER_GAP = 96;
const BOTTOM = MAP_H - 70;

/** 한 층의 설계: 고정 노드 하나, 또는 후보 중 무작위로 2~3개 */
type LayerSpec =
  | { fixed: NodeKind; row: number; title?: string; text?: string }
  | { pool: NodeKind[]; row: number; min: number; max: number };

/**
 * 1챕터 · 산기슭 신사 마을 (あ·か·さ)
 * 서고 · 시련 · 이야기 · 쉼터 · 보스는 길목(고정), 그 사이는 판마다 무작위.
 */
const CHAPTER1: LayerSpec[] = [
  { fixed: 'prologue', row: 0 },
  { fixed: 'library', row: 0 },
  { fixed: 'raid', row: 0 },
  { fixed: 'trial', row: 0 },
  { fixed: 'library', row: 1 },
  { fixed: 'story', row: 1, title: '콘과의 만남', text: '덫에 걸린 배고픈 아기 여우. 간판을 읽어 과자 가게를 찾아 주자 — 🦊 여우불' },
  { pool: ['raid', 'shop', 'spring'], row: 1, min: 2, max: 3 },
  { pool: ['raid', 'shop', 'spring'], row: 1, min: 2, max: 3 },
  { fixed: 'trial', row: 1 },
  { fixed: 'library', row: 2 },
  { pool: ['raid', 'shrine', 'grudge', 'event'], row: 2, min: 2, max: 3 },
  { pool: ['raid', 'shrine', 'grudge', 'event'], row: 2, min: 2, max: 3 },
  { fixed: 'trial', row: 2 },
  { fixed: 'rest', row: 2 },
  { fixed: 'boss', row: 2, title: '야마비코', text: '산 정상의 메아리 요괴. 훔친 마을 사람들의 목소리를 되던진다' },
];

export function generateChapter1(seed: number): MapNode[] {
  const rand = rng(seed);
  const nodes: MapNode[] = [];
  const layers: number[][] = [];

  CHAPTER1.forEach((spec, layer) => {
    const y = BOTTOM - layer * LAYER_GAP;
    let kinds: NodeKind[];
    if ('fixed' in spec) {
      kinds = [spec.fixed];
    } else {
      // 후보에서 겹치지 않게 2~3개
      const pool = [...spec.pool];
      const n = spec.min + Math.floor(rand() * (spec.max - spec.min + 1));
      kinds = [];
      while (kinds.length < n && pool.length > 0) kinds.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    }
    const ids = kinds.map((kind, i) => {
      const spread = 128;
      const x = MAP_W / 2 + (i - (kinds.length - 1) / 2) * spread + (kinds.length > 1 ? (rand() - 0.5) * 24 : 0);
      const node: MapNode = { id: nodes.length, layer, kind, row: spec.row, x: Math.round(x), y: Math.round(y + (rand() - 0.5) * 14), next: [] };
      if ('fixed' in spec && spec.title) {
        node.title = spec.title;
        node.text = spec.text;
      }
      nodes.push(node);
      return node.id;
    });
    layers.push(ids);
  });

  // 길 잇기: 길목(1개)은 전부와, 갈림길끼리는 가까운 1~2개와 (모든 노드가 오갈 수 있게)
  for (let l = 0; l < layers.length - 1; l++) {
    const cur = layers[l];
    const nxt = layers[l + 1];
    if (cur.length === 1 || nxt.length === 1) {
      for (const a of cur) nodes[a].next = [...nxt];
      continue;
    }
    for (const a of cur) {
      const sorted = [...nxt].sort((p, q) => Math.abs(nodes[p].x - nodes[a].x) - Math.abs(nodes[q].x - nodes[a].x));
      nodes[a].next = sorted.slice(0, rand() < 0.5 ? 1 : 2);
    }
    // 들어오는 길이 없는 노드에는 가장 가까운 노드에서 길을 낸다
    for (const b of nxt) {
      if (cur.some((a) => nodes[a].next.includes(b))) continue;
      const nearest = [...cur].sort((p, q) => Math.abs(nodes[p].x - nodes[b].x) - Math.abs(nodes[q].x - nodes[b].x))[0];
      nodes[nearest].next.push(b);
    }
  }
  return nodes;
}

/** 지도 간판 — 되찾은 글자만큼 채워진다 (1챕터 글자로만 된 단어) */
export const CHAPTER1_SIGNS: { word: string; ko: string; x: number; y: number }[] = [
  { word: 'いけ', ko: '연못', x: 150, y: 1290 },
  { word: 'おかし', ko: '과자 가게', x: 470, y: 1010 },
  { word: 'すし', ko: '초밥집', x: 140, y: 860 },
  { word: 'うえ', ko: '위 ↑ 산길', x: 470, y: 330 },
];
