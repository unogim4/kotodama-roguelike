import type { ChapterDef } from '../../data/chapters';
import { MAP_W, MAP_H, layerX, CHAPTER1_SIGNS } from '../../map/chapter1';
import { streamBridge } from '../hd/worldMap';
import { PackCanvas, P, TER, U, Terrain, piece, Piece, BUSHES, FLOWERS, FERNS, PEBBLES } from './tiles';

/**
 * 🗾 팩 장 지도 (가로 두루마리 · 높이 360) — 코드 지도와 같은 짜임:
 * 위는 하늘, 위 띠(98~130) · 아래 띠(290~)에 풍경을 빽빽하게, 가운데 띠는 노드가 다니도록 비운다.
 * 1장: 신사 마을 → 논밭 → 삼나무 숲 → 산길과 산꼭대기 사당 · 2장 강가 마을 · 3장 숲과 고개 · 4장 옛 도성
 */
const H = MAP_H;

const SKY = {
  day: ['#7cc0ec', '#98d0f0', '#b4def4', '#cfeaf8', '#e8f6fc'],
  river: ['#7cc0ec', '#98d0f0', '#b4def4', '#cfeaf8', '#e8f6fc'],
  forest: ['#4a3a6a', '#6a4a7a', '#9a5a7a', '#c87a72', '#e8a07a'],
  capital: ['#141a3a', '#1e2650', '#2a3466', '#36427a', '#4a5690'],
};

const K = {
  houseA: piece('house', 0, 0, 64, 48),
  houseB: piece('house', 64, 0, 64, 48),
  houseC: piece('house', 128, 0, 64, 48),
  shop: piece('house', 192, 0, 64, 48),
  market: piece('house', 288, 0, 64, 48),
  torii: piece('house', 7, 82, 34, 29),
  buddha: piece('house', 49, 242, 30, 30),
  buddhaMoss: piece('house', 49, 306, 30, 30),
  lantern: piece('towers', 322, 0, 28, 32),
  pillar: piece('house', 0, 248, 16, 56),
  sign: piece('element', 17, 84, 14, 27),
  fence: piece('house', 144, 64, 32, 16),
};

const PLANK: Terrain = { sheet: 'water', ox: 0, oy: 12 };
const YELLOW: Terrain = { sheet: 'interior-floor', ox: 0, oy: 12 };
const DARK: Terrain = { sheet: 'interior-floor', ox: 11, oy: 12 };

/** 하늘 띠 + 지평선의 먼 숲 줄 */
function backdrop(pc: PackCanvas, sky: string[], h = 76, line: Piece[] = [P.roundGrove, P.limeGrove], x0 = 0, x1 = pc.w): void {
  pc.g.save();
  pc.g.beginPath();
  pc.g.rect(x0, 0, x1 - x0, h);
  pc.g.clip();
  pc.sky(sky, h);
  pc.g.restore();
  for (let x = x0 - 20; x < x1 + 40; x += 56 + pc.rnd() * 20) pc.put(line[Math.floor(pc.rnd() * line.length)], x, h + 22 + pc.rnd() * 6, 0.5, 1, pc.rnd() < 0.5);
}

/** 노드 기둥(층 위치)과 겹치지 않는 가로 위치인지 */
const clearOf = (layers: number) => (x: number, pad = 34) => {
  for (let l = 0; l < layers; l++) if (Math.abs(x - layerX(l)) < pad) return false;
  return true;
};

/** 띠에 늘어놓기: 그림 · y 범위 · 간격 */
function band(pc: PackCanvas, list: Piece[], x0: number, x1: number, y0: number, y1: number, step: number, keep?: (x: number) => boolean): void {
  for (let x = x0; x < x1; x += step * (0.7 + pc.rnd() * 0.6)) {
    if (keep && !keep(x)) continue;
    pc.put(list[Math.floor(pc.rnd() * list.length)], x, y0 + pc.rnd() * (y1 - y0), 0.5, 1, pc.rnd() < 0.5);
  }
}

// ── 1장 ─────────────────────────────────────────────

export function packChapter1World(): HTMLCanvasElement {
  const W = MAP_W;
  const pc = new PackCanvas(W, H, 101);
  const clear = clearOf(15);
  // 땅: 마을 · 논밭은 풀밭, 숲은 짙은 풀, 산길은 마른 흙
  pc.fill(TER.grassDirt, 0.1, 0, 0, Math.ceil(1000 / U), pc.rows);
  pc.fill(TER.darkDirt, 0.14, Math.ceil(1000 / U), 0, Math.ceil(1470 / U), pc.rows);
  pc.fill(TER.brown, 0.12, Math.ceil(1470 / U), 0, pc.cols, pc.rows);
  // 논밭 (마른 흙 네모들)
  for (const [x, y, w, h] of [[17, 4, 4, 2], [22, 4, 5, 2], [18, 9, 5, 2], [24, 9, 4, 2], [28, 5, 3, 2]]) pc.patch(TER.brown, x, y, w, h);
  // 마을 흙마당 · 산길 흙
  pc.region(TER.grassDirt, pc.mask().ellipse(8.5, 6.5, 4.5, 2.2, 0.2, () => pc.rnd()));
  // 개울 (다리 자리로 곧게) + 판자 다리
  const br = streamBridge();
  const sx = Math.round(br.x / U);
  for (let y = 2; y < pc.rows; y++) pc.tile(TER.pondGrass, 3, y === 2 ? 0 : 1, sx, y);
  const by = Math.round(br.y / U);
  for (let x = sx - 1; x <= sx + 1; x++) pc.tileAt(PLANK, 5, 1, x * U, by * U - 6);
  // 연못
  pc.patch(TER.pondGrass, 8, 9, 4, 2, 0);
  backdrop(pc, SKY.day, 76, [P.roundGrove, P.sakuraGrove, P.limeGrove], 0, 1000);
  backdrop(pc, SKY.day, 76, [P.pineGrove, P.pine], 1000, 1470);
  backdrop(pc, SKY.day, 76, [P.pineGrove, P.deadGrove], 1470, W);
  // 마을 (0~500): 집 · 벚나무 · 토리이 · 석등
  for (const [x, y, k] of [[44, 120, K.houseA], [150, 116, K.houseC], [262, 122, K.houseA], [392, 118, K.houseB], [470, 124, K.houseC]] as const) pc.put(k, x, y);
  for (const [x, y] of [[96, 110], [330, 108], [70, 342], [236, 316], [366, 334], [486, 348]]) pc.put(P.sakura, x, y);
  pc.put(K.houseB, 150, 356);
  pc.put(K.houseA, 420, 352);
  pc.put(K.torii, 26, 226);
  pc.put(K.lantern, 10, 240);
  pc.put(K.lantern, 48, 240);
  // 논밭 (500~1000): 집 · 가게 · 나무
  pc.put(K.houseA, 560, 120);
  pc.put(K.houseC, 930, 122);
  pc.put(K.market, 742, 356);
  for (const [x, y] of [[700, 124], [820, 126], [1000, 114]]) pc.put(P.treeRound, x, y);
  // 숲 (1000~1470): 위 · 아래 띠에 소나무가 빽빽이
  band(pc, [P.pine, P.pineGrove], 1012, 1470, 104, 128, 34);
  band(pc, [P.pine, P.pineGrove], 1012, 1470, 330, 362, 34, (x) => Math.abs(x - 1016) > 30);
  band(pc, [P.pine], 1030, 1440, 170, 280, 70, (x) => clear(x));
  pc.put(K.buddhaMoss, 1150, 218);
  pc.put(K.buddhaMoss, 1280, 180);
  // 산길 (1470~1920): 소나무 · 바위 · 산꼭대기 토리이와 석불
  band(pc, [P.pine, P.rockBrown], 1480, W - 20, 100, 128, 60);
  band(pc, [P.pine, P.rockBrown, P.mossRocks], 1480, W - 20, 318, 362, 60);
  band(pc, [P.rockBrown], 1490, 1900, 170, 270, 110, (x) => clear(x));
  pc.put(K.torii, 1844, 154);
  pc.put(K.buddha, 1894, 126);
  pc.put(K.lantern, 1820, 154);
  pc.put(K.lantern, 1868, 154);
  // 길 안내 팻말 (글자는 화면 층)
  for (const s of CHAPTER1_SIGNS) pc.put(K.sign, s.x, s.y + 14);
  // 꽃 · 풀포기
  band(pc, [...FLOWERS, ...BUSHES.slice(0, 4)], 20, 1000, 140, 290, 46, (x) => clear(x, 20));
  band(pc, [...FERNS], 1020, 1460, 140, 296, 40, (x) => clear(x, 20));
  return pc.c;
}

// ── 2~4장 ────────────────────────────────────────────

export function packThemedWorld(def: ChapterDef, W: number): HTMLCanvasElement {
  const pc = new PackCanvas(W, H, 200 + def.num);
  const clear = clearOf(def.layers.length);
  if (def.theme === 'river') {
    pc.fill(TER.grassDirt, 0.1);
    for (let i = 0; i < Math.round(W / 300); i++) pc.region(TER.grassDirt, pc.mask().ellipse(4 + pc.rnd() * (pc.cols - 8), 5 + pc.rnd() * 3, 2 + pc.rnd() * 2, 1.4, 0.3, () => pc.rnd()));
    // 아래 띠를 가로지르는 큰 강 · 오른쪽 위 갓파 연못
    pc.patch(TER.pondGrass, -2, 9, pc.cols + 4, 4, 0);
    pc.patch(TER.pondGrass, Math.round((W * 0.86) / U) - 3, 3, 6, 2, 0);
    backdrop(pc, SKY.river, 70, [P.roundGrove, P.limeGrove, P.limeGrove2]);
    // 위 띠: 마을(앞쪽) → 나무 → 갈대
    for (let x = 20; x < W; x += 60) {
      const f = x / W;
      const y = 104 + pc.rnd() * 22;
      if (f < 0.53) pc.put([K.houseA, K.houseB, K.houseC, P.treeRoots][Math.floor(pc.rnd() * 4)], x + pc.rnd() * 10, y);
      else if (f < 0.8) pc.put(piece('nature', 80, 160, 16, 16), x, y);
    }
    // 강가 갈대
    band(pc, [piece('nature', 80, 160, 16, 16), BUSHES[3]], 10, W, 288, 300, 30);
    band(pc, [P.treeRoots, BUSHES[1]], 40, W - 40, 160, 270, 160, (x) => clear(x));
  } else if (def.theme === 'forest') {
    pc.fill(TER.darkDirt, 0.15);
    for (let i = 0; i < Math.round(W / 260); i++) pc.region(TER.darkDirt, pc.mask().ellipse(4 + pc.rnd() * (pc.cols - 8), 5 + pc.rnd() * 4, 1.6 + pc.rnd() * 2, 1.2, 0.3, () => pc.rnd()));
    backdrop(pc, SKY.forest, 70, [P.pineGrove, P.pine, P.deadGrove]);
    band(pc, [P.pine, P.pineGrove], 10, W, 104, 130, 30);
    band(pc, [P.pine, P.pineGrove, P.deadTree], 10, W, 320, 362, 30);
    band(pc, [P.pine, P.deadTree], 40, W - 40, 160, 280, 90, (x) => clear(x));
    band(pc, [...FERNS, PEBBLES[2]], 20, W - 20, 140, 296, 36, (x) => clear(x, 22));
    for (const f of [0.3, 0.55]) pc.put(K.buddhaMoss, W * f + 30, 154);
    // 고개의 토리이 길
    for (let k = 0; k < 4; k++) pc.put(K.torii, W * 0.6 + k * 60, 132);
    pc.put(P.rockBrown, W * 0.6 + 260, 136);
  } else {
    // 옛 도성: 누런 돌 바탕 · 가운데 넓은 큰길(짙은 돌) · 위아래 띠에 집 · 석등 · 기둥
    for (let y = 0; y < pc.rows; y++) for (let x = 0; x < pc.cols; x++) pc.tile(YELLOW, 1, 1, x, y);
    pc.region(DARK, pc.mask().rect(0, 5, pc.cols, 3), 0);
    backdrop(pc, SKY.capital, 70, [P.pineGrove, P.roundGrove]);
    const houses = [K.shop, K.houseA, K.houseC, K.houseB, K.market];
    for (let x = 40; x < W; x += 140) pc.put(houses[Math.floor(pc.rnd() * houses.length)], x, 132);
    for (let x = 100; x < W; x += 140) pc.put(houses[Math.floor(pc.rnd() * houses.length)], x, 362);
    band(pc, [K.lantern, K.pillar], 70, W, 160, 172, 140, (x) => clear(x, 24));
    band(pc, [K.lantern, K.pillar], 30, W, 262, 276, 140, (x) => clear(x, 24));
    pc.put(K.torii, W * 0.5, 172);
  }
  return pc.c;
}
