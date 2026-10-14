import { PackCanvas, P, TER, U, Terrain, piece, ITEM, BUSHES, FLOWERS, PEBBLES } from './tiles';
import { LIB } from '../hd/library';
import { MENU, STAND_Y } from '../hd/visit';
import type { VisitKind } from '../hd/visit';
import { ALLEY, ALLEY_PACK_SIGN_Y, ShopKind } from '../hd/alley';
import { YARD } from '../hd/prologue';

/**
 * 🏠 팩 이야기 장면 640×360 — 코드 그림과 같은 짜임(벽 · 마루 높이 · 문 · 메뉴판 · 가게 간판 · 알림판 자리)을 지키고
 * 바닥 · 벽 · 가구 · 건물은 Ninja Adventure 타일(2배)로.
 */
const W = 640;
const H = 360;

/** 나무 판자 (물 타일셋의 다리 판자 — 마루 · 판벽) */
const PLANK: Terrain = { sheet: 'water', ox: 0, oy: 12 };
const YELLOW_STONE: Terrain = { sheet: 'interior-floor', ox: 0, oy: 12 };

const PC = {
  shelfWide: piece('element', 128, 112, 32, 32),
  shelfEmpty: piece('element', 160, 112, 32, 32),
  shelfBooks: piece('element', 48, 112, 16, 32),
  shelfBooks2: piece('element', 64, 112, 16, 32),
  drawers: piece('element', 96, 112, 32, 32),
  dresser: piece('element', 16, 112, 16, 32),
  mat: piece('element', 207, 64, 48, 48),
  plant: piece('element', 0, 120, 15, 24),
  bench: piece('element', 33, 162, 45, 13),
  board: piece('element', 176, 1, 48, 31),
  tallBoard: piece('element', 17, 84, 14, 27),
  redLantern: piece('house', 96, 48, 16, 16),
  torii: piece('house', 7, 82, 34, 29),
  buddha: piece('house', 49, 242, 30, 30),
  lantern: piece('towers', 322, 0, 28, 32),
  campfire: piece('camp', 160, 48, 32, 32),
  shrine: piece('house', 192, 0, 64, 48),
  houseA: piece('house', 0, 0, 64, 48),
  houseB: piece('house', 64, 0, 64, 48),
  houseC: piece('house', 128, 0, 64, 48),
  houseD: piece('house', 192, 0, 64, 48),
  market: piece('house', 288, 0, 64, 48),
  orange: piece('nature', 144, 128, 16, 16),
  orange2: piece('nature', 144, 144, 16, 16),
};

/** 나무 판벽 (판자 타일을 어둡게 눌러) */
function plankWall(pc: PackCanvas, y0: number, y1: number, shade = 0.55): void {
  for (let y = y0; y < y1; y += U) for (let x = 0; x < W; x += U) pc.tileAt(PLANK, 5, 1, x, y);
  pc.tintRect(0, y0, W, y1 - y0, '#3a2030', shade, 'multiply');
}

/** 판자 마루 */
function plankFloor(pc: PackCanvas, y0: number): void {
  for (let y = y0; y < H; y += U) for (let x = 0; x < W; x += U) pc.tileAt(PLANK, 4 + ((x / U + Math.floor(y / U)) % 2), 1, x, y);
}

// ── 서고 ─────────────────────────────────────────────

export function packLibraryRoom(): HTMLCanvasElement {
  const pc = new PackCanvas(W, H, 11);
  const F = LIB.floorY;
  plankFloor(pc, F - 8);
  plankWall(pc, 0, F);
  // 천장 들보 · 족자 고리 가로대 · 마루와 벽 사이 굽도리
  pc.rect(0, 0, W, 10, '#2a1622');
  pc.rect(0, LIB.hookY - 6, W, 4, '#5a3424');
  pc.rect(0, LIB.hookY - 6, W, 1, '#8a5a3a');
  pc.rect(0, F - 4, W, 6, '#3a2018');
  // 서가 (왼쪽 · 문 옆)
  pc.put(PC.shelfWide, 40, F);
  pc.put(PC.shelfBooks, 88, F);
  pc.put(PC.shelfBooks2, 112, F);
  pc.put(PC.shelfWide, 490, F);
  // 오른쪽 장지문 자리 (문짝은 장면이 따로 얹는다) — 어두운 문틀
  const d = LIB.door;
  pc.rect(d.x - 4, d.y - 4, d.w + 8, d.h + 6, '#2a1622');
  pc.rect(d.x, d.y, d.w, d.h, '#1a0e16');
  // 마루 위 돗자리 · 화분
  for (const x of [176, 320, 464]) pc.put(PC.mat, x, 300);
  pc.put(PC.plant, 22, 200);
  pc.put(PC.plant, 618, 200);
  // 아래 가장자리 그늘
  pc.tintRect(0, H - 10, W, 10, '#1a1020', 0.35);
  return pc.c;
}

// ── 들르는 곳 ─────────────────────────────────────────

/** 여우 찻집: 판벽 · 메뉴판 넷 · 붉은 등 · 긴 계산대 · 돗자리 마루 · 긴 의자 */
function packTeahouse(): HTMLCanvasElement {
  const pc = new PackCanvas(W, H, 21);
  const F = 168;
  plankFloor(pc, F - 8);
  plankWall(pc, 0, F, 0.5);
  pc.rect(0, 0, W, 12, '#2a1622');
  pc.rect(0, 26, W, 4, '#5a3424');
  // 메뉴판 (글자는 화면 층) — 한지 판
  for (const x of MENU.xs) {
    pc.rect(x - 30, MENU.y - 34, 60, 68, '#4a2a1a');
    pc.rect(x - 27, MENU.y - 31, 54, 62, '#f4ead0');
    pc.rect(x - 27, MENU.y + 27, 54, 4, '#d8c8a0');
    pc.rect(x - 1, 26, 2, MENU.y - 60, '#4a2a1a');
  }
  pc.put(PC.redLantern, 80, 104);
  pc.put(PC.redLantern, 560, 104);
  // 계산대 (판자 두 줄 · 위에 차 · 꼬치 · 주먹밥)
  for (let x = 96; x < 544; x += U) {
    pc.tileAt(PLANK, 5, 1, x, F - 30);
    pc.tileAt(PLANK, 4, 1, x, F - 6);
  }
  pc.tintRect(96, F - 6, 448, 32, '#40201a', 0.35, 'multiply');
  pc.rect(96, F - 32, 448, 3, '#f0b070');
  pc.put(ITEM.tea, 160, F - 26);
  pc.put(ITEM.yakitori, 470, F - 26);
  pc.put(ITEM.onigiri, 500, F - 26);
  // 손님 자리 돗자리 · 긴 의자
  pc.put(PC.mat, 140, 340);
  pc.put(PC.mat, 500, 340);
  pc.put(PC.bench, 140, 300);
  return pc.c;
}

/** 온천: 저녁 하늘 · 대나무 울타리 · 모래 마당 · 김 오르는 못 · 바위 */
function packSpring(): HTMLCanvasElement {
  const pc = new PackCanvas(W, H, 31);
  pc.fill(TER.sand, 0.1);
  pc.region(TER.sand, pc.mask().rect(1, 4, 18, 8), 0.04);
  pc.patch(TER.pondSand, 7, 6, 7, 4, 0);
  pc.sky(['#5a4a8a', '#8a5a9a', '#c4708a', '#ec9c7a', '#f8cc9c'], 64);
  for (let x = 0; x < W; x += 30) pc.put(P.bamboo, x + 15, 150, 0.5, 1, x % 60 === 0);
  pc.rect(0, 100, W, 4, '#4a6a2a');
  for (const [x, y] of [[200, 230], [440, 238], [240, 312], [430, 318]]) pc.put(PEBBLES[1 + ((x / 10) % 3)], x, y);
  pc.put(P.rockTeal, 140, 280);
  pc.put(P.rockBrown, 520, 290);
  return pc.c;
}

/** 신사 앞: 하늘 · 숲 · 모래 마당 · 신사 · 토리이 · 석등 · 알림판 */
function packShrine(): HTMLCanvasElement {
  const pc = new PackCanvas(W, H, 41);
  pc.fill(TER.sand, 0.08);
  pc.region(TER.sand, pc.mask().rect(0, 5, 20, 7), 0.05);
  pc.sky(['#7cc0ec', '#98d0f0', '#b4def4', '#cfeaf8', '#e8f6fc'], 80);
  for (let x = -20; x < W + 40; x += 80) pc.put(x % 160 === 0 ? P.roundGrove : P.limeGrove, x, 150);
  pc.put(PC.shrine, 320, 236);
  pc.put(PC.lantern, 220, 240);
  pc.put(PC.lantern, 420, 240);
  pc.put(PC.torii, 560, 262);
  pc.put(PC.tallBoard, 100, 250);
  pc.put(FLOWERS[0], 40, 300);
  pc.put(FLOWERS[3], 610, 320);
  return pc.c;
}

/** 산 쉼터: 저녁 하늘 · 먼 산 · 흙 마당 · 모닥불 · 통나무 · 소나무 */
function packRest(): HTMLCanvasElement {
  const pc = new PackCanvas(W, H, 51);
  pc.fill(TER.grassDirt, 0.1);
  pc.region(TER.grassDirt, pc.mask().ellipse(10, 8.5, 8, 3.5, 0.2, () => pc.rnd()));
  pc.sky(['#5a4a8a', '#8a5a9a', '#c4708a', '#ec9c7a', '#f8cc9c'], 150);
  // 먼 산 (팩에 없는 먼 풍경이라 그림자만 — 하늘 색으로 겹쳐)
  const g = pc.g;
  for (const [cx, w, h, col] of [[180, 300, 70, '#6a5a8a'], [470, 420, 110, '#5a4a7a']] as const) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(cx - w / 2, 150);
    g.lineTo(cx, 150 - h);
    g.lineTo(cx + w / 2, 150);
    g.fill();
  }
  pc.rect(0, 146, W, 6, '#4a3a6a');
  for (const x of [40, 110, 560, 610]) pc.put(P.pine, x, 190 + (x % 3) * 6);
  pc.put(PC.campfire, 300, STAND_Y + 30);
  pc.put(P.log, 360, STAND_Y + 34);
  pc.put(P.log, 240, STAND_Y + 36, 0.5, 1, true);
  pc.put(BUSHES[2], 80, 320);
  pc.put(BUSHES[5], 580, 300);
  return pc.c;
}

export function packVisit(kind: VisitKind, alley: () => HTMLCanvasElement): HTMLCanvasElement {
  return { shop: packTeahouse, spring: packSpring, shrine: packShrine, event: alley, rest: packRest, 'story-suzu': packShrine, 'story-tengu': packRest, 'story-small': alley }[kind]();
}

// ── 골목 ─────────────────────────────────────────────

/** 가게마다 집 · 앞에 내놓은 물건 (글자의 힌트) */
const SHOP: Record<ShopKind, { house: (typeof PC)[keyof typeof PC]; goods: (typeof PC)[keyof typeof PC][] }> = {
  kaki: { house: PC.market, goods: [PC.orange, PC.orange2, PC.orange, PC.orange2] },
  ika: { house: PC.houseD, goods: [ITEM.calamari, ITEM.calamari, ITEM.fish] },
  okaki: { house: PC.houseA, goods: [ITEM.cookie, ITEM.nut, ITEM.cookie] },
  eki: { house: PC.houseB, goods: [] },
};

export function packAlley(order: ShopKind[]): HTMLCanvasElement {
  const pc = new PackCanvas(W, H, 61);
  const S = ALLEY.streetY;
  for (let y = S - 8; y < H; y += U) for (let x = 0; x < W; x += U) pc.tileAt(YELLOW_STONE, 1, 1, x, y);
  pc.sky(['#7cc0ec', '#98d0f0', '#b4def4', '#cfeaf8', '#e8f6fc'], 70);
  // 가게 뒤 담장 (판벽)
  plankWall(pc, 70, S - 8, 0.45);
  pc.rect(0, 66, W, 5, '#3a2018');
  order.forEach((kind, i) => {
    const sh = SHOP[kind];
    const x = ALLEY.shopXs[i];
    pc.put(sh.house, x, S + 4);
    // 간판 판자 (글자는 화면 층)
    pc.rect(x - 36, ALLEY_PACK_SIGN_Y - 14, 72, 28, '#4a2a1a');
    pc.rect(x - 33, ALLEY_PACK_SIGN_Y - 11, 66, 22, '#f0dcb0');
    // 내놓은 물건 (작은 좌판 위)
    if (sh.goods.length) {
      pc.rect(x - 34, S + 2, 68, 8, '#7a4a2a');
      pc.rect(x - 34, S + 2, 68, 2, '#b0784a');
      sh.goods.forEach((p, k) => pc.put(p, x - 24 + k * (48 / Math.max(1, sh.goods.length - 1)), S + 4));
    } else {
      // 역: 긴 의자
      pc.put(PC.bench, x, S + 30);
    }
  });
  pc.tintRect(0, S, W, 8, '#1b1626', 0.18);
  pc.tintRect(0, H - 8, W, 8, '#1b1626', 0.25);
  return pc.c;
}

// ── 프롤로그 신사 마당 ─────────────────────────────────

export function packYard(): HTMLCanvasElement {
  const pc = new PackCanvas(W, H, 71);
  const G = YARD.groundY;
  pc.fill(TER.sand, 0.08);
  pc.region(TER.sand, pc.mask().rect(0, Math.floor(G / U) + 1, 20, 8), 0.05);
  // 뒤쪽 숲 (벚나무 섞어)
  for (let x = -30; x < W + 40; x += 64) pc.put(x % 128 === 0 ? P.sakuraGrove : P.roundGrove, x, G - 30);
  for (let x = 0; x < W; x += 90) pc.put(P.sakura, x + 40, G - 6);
  // 신사 · 창고(문 = 창고 문 자리) · 토리이
  pc.put(PC.shrine, 300, G + 6);
  pc.put(PC.houseB, YARD.kuraDoor.x, YARD.kuraDoor.y + 6);
  pc.put(PC.torii, 70, G + 40);
  pc.put(PC.lantern, 200, G + 30);
  pc.put(PC.lantern, 400, G + 30);
  // 돌길 (신사 앞에서 아래로)
  for (let y = G + 10; y < H; y += U) {
    pc.tileAt(YELLOW_STONE, 1, 1, 284, y);
    pc.tileAt(YELLOW_STONE, 1, 1, 316, y);
  }
  // 알림판
  pc.put(PC.board, YARD.board.x, YARD.board.y + 24);
  pc.put(P.sakura, 520, 320);
  pc.put(P.sakura, 120, 340);
  pc.put(FLOWERS[0], 40, 250);
  pc.put(FLOWERS[3], 600, 300);
  return pc.c;
}
