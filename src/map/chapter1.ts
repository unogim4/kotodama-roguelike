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

/** 가로 두루마리 지도: 왼쪽 신사 마을 → 오른쪽 산 정상 (화면 3장 분량) */
export const MAP_W = 1920;
export const MAP_H = 360;
/** 층 간격 (왼쪽이 0층) */
const LAYER_GAP = 126;
const LEFT = 80;
/** 갈림길 노드 사이 세로 간격 */
const SPREAD = 66;
/** 갈림길 층의 가운데 높이 */
const MID_Y = 202;

/** l층의 가로 위치 */
export function layerX(l: number): number {
  return LEFT + l * LAYER_GAP;
}

/** 길목(고정 노드) 높이 — 완만하게 굽이치는 큰길 */
export function spineY(l: number): number {
  return MID_Y + Math.round(Math.sin(l * 0.9) * 18);
}

/** 두 노드를 잇는 길 위의 한 점 (가로로 나갔다가 가로로 들어오는 S자 곡선) */
export function trailPoint(a: { x: number; y: number }, b: { x: number; y: number }, t: number): [number, number] {
  const dx = (b.x - a.x) * 0.5;
  const u = 1 - t;
  const x = u * u * u * a.x + 3 * u * u * t * (a.x + dx) + 3 * u * t * t * (b.x - dx) + t * t * t * b.x;
  const y = u * u * u * a.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t * t * t * b.y;
  return [x, y];
}

/** 한 층의 설계: 고정 노드 하나, 또는 후보 중 무작위로 2~3개 (row = ROWS 전체 번호) */
export type LayerSpec =
  | { fixed: NodeKind; row: number; title?: string; text?: string; story?: string }
  | { pool: NodeKind[]; row: number; min: number; max: number };

/** 층 수에 맞춘 지도 너비 */
export function mapWidth(layers: number): number {
  return LEFT * 2 + (layers - 1) * LAYER_GAP;
}

/**
 * 1챕터 · 산기슭 신사 마을 (あ·か·さ)
 * 서고 · 시련 · 이야기 · 쉼터 · 보스는 길목(고정), 그 사이는 판마다 무작위.
 */
export const CHAPTER1: LayerSpec[] = [
  { fixed: 'prologue', row: 0 },
  { fixed: 'library', row: 0 },
  { fixed: 'raid', row: 0 },
  { fixed: 'trial', row: 0 },
  { fixed: 'library', row: 1 },
  { fixed: 'story', row: 1, story: 'kon', title: '콘과의 만남', text: '덫에 걸린 배고픈 아기 여우. 간판을 읽어 쌀과자(おかき) 가게를 찾아 주자 — 🦊 여우불' },
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
  return generateChapter(CHAPTER1, seed);
}

/** 장 설계(층 목록)로 지도 노드를 만든다 */
export function generateChapter(specs: LayerSpec[], seed: number): MapNode[] {
  const rand = rng(seed);
  const nodes: MapNode[] = [];
  const layers: number[][] = [];

  specs.forEach((spec, layer) => {
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
      const many = kinds.length > 1;
      const x = layerX(layer) + (many ? Math.round((rand() - 0.5) * 20) : 0);
      const y = many ? MID_Y + (i - (kinds.length - 1) / 2) * SPREAD + Math.round((rand() - 0.5) * 8) : spineY(layer);
      const node: MapNode = { id: nodes.length, layer, kind, row: spec.row, x, y: Math.round(y), next: [] };
      if ('fixed' in spec && spec.title) {
        node.title = spec.title;
        node.text = spec.text;
      }
      if ('fixed' in spec && spec.story) node.story = spec.story;
      nodes.push(node);
      return node.id;
    });
    layers.push(ids);
  });

  // 갈림길 층끼리: 같은 종류가 곧장 이어지지 않도록 다음 층 노드의 순서(필요하면 종류)를 고른다
  for (let l = 1; l < layers.length; l++) {
    const cur = layers[l - 1];
    const nxt = layers[l];
    if (cur.length === 1 || nxt.length === 1) continue;
    const kinds = nxt.map((id) => nodes[id].kind);
    // 순서만 바꿔서 안 되면(3갈래 → 2갈래 등) 후보 종류를 다시 뽑아 본다
    const options = permutations(kinds);
    const spec = specs[l];
    if ('pool' in spec) {
      for (let k = 0; k < 12; k++) {
        const pool = [...spec.pool];
        const draw = nxt.map(() => pool.splice(Math.floor(rand() * pool.length), 1)[0]);
        options.push(...permutations(draw));
      }
    }
    let best = kinds;
    let bestSame = Infinity;
    for (const perm of options) {
      const same = baseLinks(cur.length, nxt.length).filter(([i, j]) => nodes[cur[i]].kind === perm[j]).length;
      if (same < bestSame || (same === bestSame && rand() < 0.5)) {
        best = perm;
        bestSame = same;
      }
    }
    nxt.forEach((id, j) => (nodes[id].kind = best[j]));
  }

  // 길 잇기: 길목(1개)은 전부와, 갈림길끼리는 위아래 순서대로 (길이 서로 엇갈리지 않게)
  for (let l = 0; l < layers.length - 1; l++) {
    const cur = layers[l];
    const nxt = layers[l + 1];
    if (cur.length === 1 || nxt.length === 1) {
      for (const a of cur) nodes[a].next = [...nxt];
      continue;
    }
    const links = baseLinks(cur.length, nxt.length);
    // 가끔 옆 칸으로 가는 샛길을 하나 더 (엇갈리지 않고 같은 종류가 아닐 때만, 한 노드에서 최대 2갈래)
    const crosses = (i: number, j: number) => links.some(([a, b]) => (a < i && b > j) || (a > i && b < j));
    for (let i = 0; i < cur.length; i++) {
      for (const j of [i - 1, i + 1]) {
        if (j < 0 || j >= nxt.length || rand() > 0.35) continue;
        if (links.some(([a, b]) => a === i && b === j) || crosses(i, j)) continue;
        if (nodes[cur[i]].kind === nodes[nxt[j]].kind) continue;
        if (links.filter(([a]) => a === i).length >= 2) continue;
        links.push([i, j]);
      }
    }
    for (const [i, j] of links) nodes[cur[i]].next.push(nxt[j]);
  }
  return nodes;
}

/** 위아래 순서대로 잇는 기본 길 (모든 노드가 들어오고 나가며, 서로 엇갈리지 않는다) */
function baseLinks(m: number, n: number): [number, number][] {
  const links: [number, number][] = [];
  for (let i = 0; i < m; i++) links.push([i, Math.round((i * (n - 1)) / (m - 1))]);
  for (let j = 0; j < n; j++) {
    if (links.some(([, b]) => b === j)) continue;
    links.push([Math.round((j * (m - 1)) / (n - 1)), j]);
  }
  return links;
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

/** 지도 간판 — 되찾은 글자만큼 채워진다 (1챕터 글자로만 된 단어) */
export const CHAPTER1_SIGNS: { word: string; ko: string; x: number; y: number }[] = [
  { word: 'いけ', ko: '연못', x: 268, y: 318 },
  { word: 'おかき', ko: '쌀과자 가게', x: 800, y: 318 },
  { word: 'すし', ko: '초밥집', x: 1016, y: 318 },
  { word: 'うえ', ko: '위 ↑ 산길', x: 1530, y: 318 },
];
