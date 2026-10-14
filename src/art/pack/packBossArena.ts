import type { BossId } from '../../data/chapters';
import { PackCanvas, P, TER, Terrain, piece, BUSHES, FLOWERS, FERNS } from './tiles';

/**
 * 👺 팩 보스 싸움터 1280×720 — 코드 싸움터와 같은 짜임(위는 하늘 · 둘레는 나무 · 바위 벽 · 가운데가 싸우는 땅).
 * 🏔️ 산 정상(눈 덮인 잿빛 땅 · 눈 소나무 · 토리이 · 석불) · 🐢 강가(냇물 · 갈대 · 풀밭) · 👺 숲(짙은 풀 · 소나무 숲 · 그루터기) · 👹 도성(돌 광장 · 집 · 기둥 · 석등)
 */
const W = 1280;
const H = 720;

const SKY: Record<BossId, string[]> = {
  yamabiko: ['#5a4a8a', '#8a5a9a', '#c4708a', '#ec9c7a', '#f8cc9c'],
  kappa: ['#7cc0ec', '#98d0f0', '#b4def4', '#cfeaf8', '#e8f6fc'],
  tengu: ['#4a3a6a', '#6a4a7a', '#9a5a7a', '#c87a72', '#e8a07a'],
  oni: ['#141a3a', '#1e2650', '#2a3466', '#36427a', '#4a5690'],
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** 위쪽 하늘 (띠 다섯 · 디더) */
function sky(pc: PackCanvas, cols: string[], h: number): void {
  const g = pc.g;
  const img = g.getImageData(0, 0, W, h);
  const d = img.data;
  const rgb = cols.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < W; x++) {
      const t = Math.max(0, Math.min(4, Math.floor((y / h) * 5 + (BAYER[(y & 3) * 4 + (x & 3)] - 0.5))));
      const i = (y * W + x) * 4;
      [d[i], d[i + 1], d[i + 2]] = rgb[t];
      d[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
}

/** 둘레 벽: 위쪽 줄 · 왼쪽 · 오른쪽 · 아래쪽에 나무(바위)를 겹겹이 */
function walls(pc: PackCanvas, top: (typeof P)[keyof typeof P][], side: (typeof P)[keyof typeof P][], topY = 160): void {
  const pickOf = (list: (typeof P)[keyof typeof P][]) => list[Math.floor(pc.rnd() * list.length)];
  // 뒷줄 → 앞줄 순서로 (아래로 갈수록 앞)
  for (const y of [topY - 26, topY]) for (let x = -20 + (y % 2) * 40; x < W + 60; x += 70 + pc.rnd() * 30) pc.put(pickOf(top), x, y + pc.rnd() * 8, 0.5, 1, pc.rnd() < 0.5);
  for (let y = topY + 40; y < H + 60; y += 56 + pc.rnd() * 20) {
    pc.put(pickOf(side), 8 + pc.rnd() * 20, y, 0.5, 1, pc.rnd() < 0.5);
    pc.put(pickOf(side), W - 8 - pc.rnd() * 20, y, 0.5, 1, pc.rnd() < 0.5);
  }
  for (let x = 60; x < W - 40; x += 80 + pc.rnd() * 40) pc.put(pickOf(side), x, H + 40 + pc.rnd() * 10, 0.5, 1, pc.rnd() < 0.5);
}

function scatter(pc: PackCanvas, list: (typeof P)[keyof typeof P][], n: number, x0 = 70, y0 = 190, x1 = W - 70, y1 = H - 50): void {
  for (let i = 0; i < n; i++) pc.put(list[Math.floor(pc.rnd() * list.length)], x0 + pc.rnd() * (x1 - x0), y0 + pc.rnd() * (y1 - y0), 0.5, 1, pc.rnd() < 0.5);
}

export function packBossGround(id: BossId): HTMLCanvasElement {
  const pc = new PackCanvas(W, H, id.length * 37 + 5);
  const rnd = () => pc.rnd();
  const cols = pc.cols;
  const rows = pc.rows;
  if (id === 'yamabiko') {
    // 산 정상: 잿빛 바위 땅 · 흰 눈 무더기
    // 바탕은 눈 타일을 잿빛으로 눌러 바위 땅처럼 · 그 위에 흰 눈 무더기
    pc.fill(TER.snow, 0.16, 0, 2);
    pc.tint('#7a7088', 0.55, 'multiply');
    const snow = pc.mask();
    for (let i = 0; i < 8; i++) snow.ellipse(3 + rnd() * (cols - 6), 6 + rnd() * (rows - 8), 1.6 + rnd() * 2.2, 1.1 + rnd() * 1.2, 0.3, rnd);
    pc.region(TER.snow, snow);
    sky(pc, SKY.yamabiko, 110);
    walls(pc, [P.snowPineGrove, P.snowPine, P.whiteGrove], [P.snowPine, P.snowBush, P.rockSnow]);
    // 정상의 토리이 · 석불 · 석등
    pc.put(piece('house', 7, 82, 34, 29), 450, 196);
    pc.put(piece('house', 49, 242, 30, 30), 640, 190);
    pc.put(piece('towers', 322, 0, 28, 32), 570, 196);
    pc.put(piece('towers', 322, 0, 28, 32), 710, 196);
    scatter(pc, [P.rockSnow], 3, 120, 260, W - 120, H - 80);
  } else if (id === 'kappa') {
    // 강가: 위쪽에 냇물 · 풀밭 · 흙 마당
    pc.fill(TER.grassDirt, 0.1);
    sky(pc, SKY.kappa, 80);
    pc.patch(TER.pondGrass, -2, 2, cols + 4, 4, 0);
    const dirt = pc.mask().ellipse(cols / 2, rows * 0.62, 8, 4.5, 0.15, rnd);
    pc.region(TER.grassDirt, dirt);
    for (let x = 20; x < W; x += 34 + rnd() * 20) pc.put(piece('nature', 80, 160, 16, 16), x, 200 + rnd() * 10);
    walls(pc, [P.treeRoots, P.limeTree], [P.treeRoots, P.limeTree, P.rockTeal], 70);
    scatter(pc, [...BUSHES.slice(0, 5), FLOWERS[2], FLOWERS[4]], 26, 80, 240);
  } else if (id === 'tengu') {
    // 숲: 짙은 풀 · 흙 마당 · 소나무 숲에 둘러싸인 공터
    pc.fill(TER.darkDirt, 0.14);
    const dirt = pc.mask().ellipse(cols / 2, rows * 0.6, 11, 6, 0.2, rnd);
    for (let i = 0; i < 5; i++) dirt.ellipse(3 + rnd() * (cols - 6), 7 + rnd() * (rows - 9), 1.5 + rnd() * 2, 1.2 + rnd() * 1.2, 0.3, rnd);
    pc.region(TER.darkDirt, dirt);
    sky(pc, SKY.tengu, 100);
    walls(pc, [P.pineGrove, P.pine, P.deadGrove], [P.pine, P.pineGrove, P.deadTree]);
    pc.put(P.rockBrown, 640, 210);
    // 그루터기 · 바위는 가장자리 쪽에만 (싸우는 가운데는 비운다)
    for (const [x, y] of [[150, 300], [1120, 330], [180, 620], [1100, 640]]) pc.put([P.stumpBig, P.stumpBig2, P.mossRocks][Math.floor(rnd() * 3)], x, y);
    scatter(pc, [...FERNS, ...BUSHES.slice(5)], 30);
  } else {
    // 도성: 누런 돌길 · 짙은 돌 광장 · 위쪽에 집 · 기둥 · 석등
    const yellow: Terrain = { sheet: 'interior-floor', ox: 0, oy: 12 };
    const dark: Terrain = { sheet: 'interior-floor', ox: 11, oy: 12 };
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) pc.tile(yellow, 1, 1, x, y);
    pc.region(dark, pc.mask().rect(3, 7, cols - 6, rows - 9), 0);
    sky(pc, SKY.oni, 70);
    const houses = [piece('house', 192, 0, 64, 48), piece('house', 0, 0, 64, 48), piece('house', 128, 0, 64, 48), piece('house', 64, 0, 64, 48)];
    for (let i = 0; i < 9; i++) pc.put(houses[i % houses.length], 70 + i * 142, 176);
    pc.put(piece('house', 7, 82, 34, 29), 640, 212);
    for (const x of [140, 360, 920, 1140]) pc.put(piece('house', 0, 248, 16, 56), x, 250);
    for (const x of [250, 520, 760, 1030]) pc.put(piece('towers', 322, 0, 28, 32), x, 236);
    for (let y = 300; y < H + 40; y += 90) {
      pc.put(piece('house', 0, 248, 16, 56), 22, y);
      pc.put(piece('house', 0, 248, 16, 56), W - 22, y);
    }
  }
  // 싸움터 바깥 가장자리를 살짝 어둡게 (안쪽으로 시선이 모이게)
  const g = pc.g;
  const grad = g.createRadialGradient(W / 2, H * 0.6, H * 0.35, W / 2, H * 0.6, W * 0.62);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(10,8,24,0.35)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  return pc.c;
}
