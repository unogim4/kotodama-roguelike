import Phaser from 'phaser';
import { ArenaInfo, ArenaProp, PropRule, RA_W, RA_H, RA_SPAWN, PONDS, RULES, layoutProps } from '../hd/raidArena';
import { PackCanvas, Piece, P, TER, U, Terrain, Mask, piece, BUSHES, FLOWERS, FERNS } from './tiles';

/**
 * 🗺️ 팩 습격 싸움터 1920×1080 — Ninja Adventure 타일을 2배로.
 * 연못 자리 · 어둠 · 분위기 입자는 코드 싸움터와 같고(RULES · PONDS), 바닥과 소품만 팩 그림.
 * 1 낮 풀밭(흙길 · 벚나무 · 석등 · 석불) · 2 해 질 녘 연못 · 3 어스름 숲(짙은 풀 · 소나무 · 그루터기) · 4 밤 도성(돌길 · 기둥 · 석등)
 */

/** 팩 소품 (텍스처 키 → 그림 조각) */
const PROP_PIECES: Record<string, Piece> = {
  'pa-sakura': P.sakura,
  'pa-sakura-big': P.bigTreeSakura,
  'pa-tree': P.treeRound,
  'pa-tree-big': P.bigTreeGreen,
  'pa-lime': P.limeTree,
  'pa-roots': P.treeRoots,
  'pa-pine': P.pine,
  'pa-pine-grove': P.pineGrove,
  'pa-dead': P.deadTree,
  'pa-stump': P.stumpBig,
  'pa-stump2': P.stumpBig2,
  'pa-log': P.log,
  'pa-rock': P.rockBrown,
  'pa-teal': P.rockTeal,
  'pa-moss': P.boulderMoss,
  'pa-reeds': piece('nature', 80, 160, 16, 16),
  'pa-torii': piece('house', 7, 82, 34, 29),
  'pa-buddha': piece('house', 49, 242, 30, 30),
  'pa-buddha-moss': piece('house', 49, 306, 30, 30),
  'pa-lantern': piece('towers', 322, 0, 28, 32),
  'pa-lantern-moss': piece('towers', 354, 0, 28, 32),
  'pa-komainu': piece('house', 16, 240, 33, 50),
  'pa-pillar': piece('house', 0, 248, 16, 56),
  'pa-house': piece('house', 0, 0, 64, 48),
  'pa-house2': piece('house', 64, 0, 64, 48),
  'pa-house3': piece('house', 128, 0, 64, 48),
  'pa-shop': piece('house', 192, 0, 64, 48),
};

/** 장별 소품 (코드 싸움터와 같은 짜임 · 개수 · 충돌) */
const PACK_PROPS: Record<number, PropRule[]> = {
  1: [
    { key: 'pa-sakura-big', n: 6, col: { rx: 14, ry: 6 }, gap: 130 },
    { key: 'pa-sakura', n: 7, col: { rx: 12, ry: 5 }, gap: 90 },
    { key: 'pa-tree', n: 7, col: { rx: 12, ry: 5 }, gap: 90 },
    { key: 'pa-lantern', n: 6, col: { rx: 12, ry: 5 }, light: { r: 70, color: 0xffd27a }, gap: 90 },
    { key: 'pa-buddha', n: 4, col: { rx: 12, ry: 5 }, gap: 80 },
    { key: 'pa-rock', n: 5, col: { rx: 22, ry: 9 }, gap: 90 },
    { key: 'pa-torii', n: 1, col: { rx: 6, ry: 4 }, gap: 200 },
  ],
  2: [
    { key: 'pa-roots', n: 8, col: { rx: 14, ry: 6 }, gap: 120 },
    { key: 'pa-reeds', n: 26, gap: 40, shore: true },
    { key: 'pa-teal', n: 5, col: { rx: 22, ry: 9 }, gap: 80 },
    { key: 'pa-lantern', n: 5, col: { rx: 12, ry: 5 }, light: { r: 76, color: 0xffc070 }, gap: 100 },
    { key: 'pa-lime', n: 5, col: { rx: 12, ry: 5 }, gap: 110 },
  ],
  3: [
    { key: 'pa-pine', n: 16, col: { rx: 12, ry: 5 }, gap: 80 },
    { key: 'pa-pine-grove', n: 6, col: { rx: 40, ry: 10 }, gap: 150 },
    { key: 'pa-dead', n: 4, col: { rx: 12, ry: 5 }, gap: 100 },
    { key: 'pa-stump', n: 5, col: { rx: 18, ry: 7 }, gap: 70 },
    { key: 'pa-stump2', n: 4, col: { rx: 18, ry: 7 }, gap: 70 },
    { key: 'pa-buddha-moss', n: 3, col: { rx: 12, ry: 5 }, gap: 100 },
    { key: 'pa-lantern-moss', n: 3, col: { rx: 12, ry: 5 }, light: { r: 80, color: 0xffc070 }, gap: 140 },
    { key: 'pa-moss', n: 3, col: { rx: 22, ry: 9 }, gap: 100 },
  ],
  4: [
    { key: 'pa-pillar', n: 14, col: { rx: 12, ry: 5 }, gap: 110 },
    { key: 'pa-lantern', n: 12, col: { rx: 12, ry: 5 }, light: { r: 86, color: 0xffb860 }, gap: 110 },
    { key: 'pa-komainu', n: 4, col: { rx: 22, ry: 8 }, gap: 160 },
    { key: 'pa-torii', n: 1, col: { rx: 6, ry: 4 }, gap: 220 },
  ],
};

/** 소품 그림을 2배 캔버스 텍스처로 */
function registerPackProps(scene: Phaser.Scene): void {
  for (const [key, p] of Object.entries(PROP_PIECES)) {
    if (scene.textures.exists(key)) continue;
    const pc = new PackCanvas(p.w * 2, p.h * 2);
    pc.put(p, p.w, p.h * 2);
    scene.textures.addCanvas(key, pc.c);
  }
}

/** 땅에 작은 장식을 흩뿌린다 (풀포기 · 꽃 · 돌) */
function scatter(pc: PackCanvas, list: Piece[], n: number, avoid?: (x: number, y: number) => boolean): void {
  for (let i = 0; i < n; i++) {
    const x = 16 + pc.rnd() * (pc.w - 32);
    const y = 24 + pc.rnd() * (pc.h - 32);
    if (avoid?.(x, y)) continue;
    pc.put(list[Math.floor(pc.rnd() * list.length)], x, y, 0.5, 1, pc.rnd() < 0.5);
  }
}

/** 칸 좌표 */
const gx = (x: number) => Math.round(x / U);

function paintPack(ch: number): HTMLCanvasElement {
  const pc = new PackCanvas(RA_W, RA_H, ch * 101);
  const sx = gx(RA_SPAWN.x);
  const sy = gx(RA_SPAWN.y);
  const rnd = () => pc.rnd();
  const ponds = PONDS[ch] ?? [];
  const inPond = (x: number, y: number) => ponds.some((p) => Math.hypot((x - p.x) / (p.rx + 24), (y - p.y) / (p.ry + 24)) < 1);
  /** 흙 웅덩이 몇 개 (둥글게) */
  const blobs = (m: Mask, n: number) => {
    for (let i = 0; i < n; i++) {
      const cx = 3 + rnd() * (pc.cols - 6);
      const cy = 3 + rnd() * (pc.rows - 6);
      if (inPond(cx * U, cy * U)) continue;
      m.ellipse(cx, cy, 1.6 + rnd() * 2.4, 1.3 + rnd() * 1.6, 0.35, rnd);
    }
  };
  if (ch === 4) {
    // 밤 도성: 누런 돌길 바탕 · 짙은 돌 광장과 큰길 (네모 세트로 이어 칠한다)
    const yellow: Terrain = { sheet: 'interior-floor', ox: 0, oy: 12 };
    const dark: Terrain = { sheet: 'interior-floor', ox: 11, oy: 12 };
    for (let y = 0; y < pc.rows; y++) for (let x = 0; x < pc.cols; x++) pc.tile(yellow, 1, 1, x, y);
    const m = pc.mask().rect(sx - 9, sy - 5, 19, 10).rect(sx - 1, 0, 3, pc.rows).rect(0, 7, pc.cols, 3);
    pc.region(dark, m, 0);
    return pc.c;
  }
  const base = ch === 3 ? TER.darkDirt : TER.grassDirt;
  pc.fill(base, ch === 3 ? 0.14 : 0.1);
  const dirt = pc.mask();
  if (ch === 1) {
    // 흙 마당 · 십자 흙길 · 흙 웅덩이
    dirt.ellipse(sx, sy, 7.5, 4.2, 0.12, rnd).rect(0, sy - 1, pc.cols, 2).rect(sx - 1, 0, 2, pc.rows);
    blobs(dirt, 9);
    pc.region(base, dirt);
    scatter(pc, [...FLOWERS, ...BUSHES.slice(0, 4)], 70, (x, y) => dirt.get(Math.floor(x / U), Math.floor(y / U)));
  } else if (ch === 2) {
    // 연못 넷 (코드 싸움터와 같은 자리) · 흙 마당
    dirt.ellipse(sx, sy, 5.5, 3.2, 0.25, rnd);
    blobs(dirt, 5);
    pc.region(base, dirt);
    // 연못은 둥근 네모 (물 타일은 이어 붙이는 방식이 달라 섬 세트로)
    for (const p of ponds) {
      const w = Math.max(3, Math.round((p.rx * 2) / U));
      const h = Math.max(3, Math.round((p.ry * 2) / U));
      pc.patch(TER.pondGrass, Math.round(p.x / U - w / 2), Math.round(p.y / U - h / 2), w, h, 0);
    }
    scatter(pc, [...BUSHES, FLOWERS[2], FLOWERS[4]], 70, (x, y) => inPond(x, y) || dirt.get(Math.floor(x / U), Math.floor(y / U)));
  } else {
    // 숲: 구불구불한 흙길 · 이끼 · 고사리
    dirt.ellipse(sx, sy, 5.5, 3.2, 0.25, rnd);
    let y = 6;
    for (let x = 0; x < pc.cols; x += 5) {
      const ny = Math.max(3, Math.min(pc.rows - 4, y + Math.round((rnd() - 0.5) * 6)));
      dirt.line(x, y, x + 5, ny, 2);
      y = ny;
    }
    blobs(dirt, 8);
    pc.region(base, dirt);
    scatter(pc, [...FERNS, ...BUSHES.slice(4)], 90, (x, y) => dirt.get(Math.floor(x / U), Math.floor(y / U)));
  }
  return pc.c;
}

/** 팩 싸움터 (바닥은 장마다 한 번만) */
export function buildPackArena(scene: Phaser.Scene, ch: number, seed: number): ArenaInfo {
  registerPackProps(scene);
  const key = `raid-ground-pack-${ch}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, paintPack(ch));
  const rule = RULES[ch];
  const ponds = PONDS[ch] ?? [];
  return { ground: key, props: layoutProps(PACK_PROPS[ch], ponds, seed, fixedProps(ch)), ponds, dark: rule.dark, ambient: rule.ambient };
}

/** 정해진 자리의 소품: 도성은 위쪽에 집이 줄지어 · 1장은 마을 집 둘 */
function fixedProps(ch: number): ArenaProp[] {
  const house = (key: string, x: number, y: number): ArenaProp => ({ key, x, y, col: { rx: 60, ry: 14 } });
  if (ch === 4) {
    const keys = ['pa-shop', 'pa-house', 'pa-house2', 'pa-house3'];
    return [140, 420, 700, 1220, 1500, 1780].map((x, i) => house(keys[i % keys.length], x, 196));
  }
  if (ch === 1) return [house('pa-house', 260, 250), house('pa-house3', 1640, 230)];
  return [];
}
