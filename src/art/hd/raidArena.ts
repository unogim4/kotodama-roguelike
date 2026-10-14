import Phaser from 'phaser';
import { Fine, bayer } from '../fine/fine';
import { settings } from '../../systems/settings';
import { packReady } from '../pack/tiles';
import { buildPackArena } from '../pack/packArena';

/**
 * 🗺️ 장별 습격 싸움터 1920×1080.
 * 바닥은 코드로 그리고(풀밭 · 흙길 / 강가 연못 / 숲 바닥 / 도성 판석), 그 위에 Ninja Adventure(CC0) 16px 잔디 · 꽃 · 낙엽 · 자갈을 구워 넣는다.
 * 큰 소품(벚나무 · 삼나무 · 석등 · 붉은 기둥 · 무너진 담 …)은 전투 크기로 새로 그린 2세대 도트.
 */
export const RA_W = 1920;
export const RA_H = 1080;
/** 시작 자리 (요괴 · 소품이 비켜 간다) */
export const RA_SPAWN = { x: RA_W / 2, y: RA_H / 2 + 120 };

export type AmbientKind = 'petal' | 'leaf' | 'firefly' | 'ember' | 'fog' | 'rays' | 'mote';

export interface ArenaProp {
  key: string;
  x: number;
  y: number;
  /** 발밑 충돌 타원 */
  col?: { rx: number; ry: number };
  /** 빛을 내는 소품 (석등) */
  light?: { r: number; color: number };
}

export interface ArenaInfo {
  ground: string;
  props: ArenaProp[];
  /** 연못 (못 들어간다) */
  ponds: { x: number; y: number; rx: number; ry: number }[];
  /** 어둠 (0 = 낮) */
  dark: { color: number; alpha: number };
  ambient: AmbientKind[];
}

// ── 값 잡음 ─────────────────────────────────────────

function h2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x + s * 7919, 374761393) + Math.imul(y - s * 104729, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x: number, y: number, sc: number, s = 0): number {
  const fx = x / sc;
  const fy = y / sc;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const u = fx - x0;
  const v = fy - y0;
  const q = (t: number) => t * t * (3 - 2 * t);
  const a = h2(x0, y0, s);
  const b = h2(x0 + 1, y0, s);
  const c = h2(x0, y0 + 1, s);
  const d = h2(x0 + 1, y0 + 1, s);
  return a + (b - a) * q(u) + (c - a) * q(v) + (a - b - c + d) * q(u) * q(v);
}
const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const pal = (...hex: string[]) => hex.map(rgb);
/** 0~1 값을 디더해 팔레트에서 고른다 */
const pick = (p: [number, number, number][], t: number, x: number, y: number, spread = 0.7) =>
  p[Math.max(0, Math.min(p.length - 1, Math.floor(t * p.length + (bayer(x, y) - 0.5) * spread)))];

// ── 전투 크기 소품 (2세대 도트) ─────────────────────────

const ellF = (f: Fine, cx: number, cy: number, rx: number, ry: number, ch: (nx: number, ny: number, x: number, y: number) => string | null) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const c = ch(nx, ny, x, y);
      if (c) f.set(x, y, c);
    }
};
const ramp = (r: string, nx: number, ny: number, x: number, y: number, bias = 0) => {
  const v = (nx * 0.65 + ny * 0.85) * 0.5 + 0.5 + bias + (bayer(x, y) - 0.5) * 0.2;
  return r[v < 0.3 ? 0 : v < 0.56 ? 1 : v < 0.8 ? 2 : 3];
};

/** 큰 벚나무 64×70 */
function bigSakura(): HTMLCanvasElement {
  const f = new Fine(64, 70);
  // 줄기 · 가지
  for (let y = 40; y < 69; y++) for (let x = 29; x < 35; x++) f.set(x + (y < 50 ? 0 : 0), y, x < 31 ? 'o' : x > 33 ? 'X' : 'O');
  for (let i = 0; i < 14; i++) f.set(30 - i, 44 - Math.round(i * 0.7), 'O').set(34 + i, 44 - Math.round(i * 0.8), 'O');
  // 꽃 구름
  for (const [cx, cy, r] of [[32, 22, 17], [16, 30, 12], [48, 29, 13], [24, 14, 11], [42, 14, 11], [32, 34, 12]] as const)
    ellF(f, cx, cy, r, r * 0.86, (nx, ny, x, y) => ramp('90!?', nx, ny, x, y, -0.05));
  // 흩날리는 꽃잎 몇 장
  for (const [x, y] of [[6, 46], [56, 50], [12, 56], [50, 40]]) f.set(x, y, '0');
  return f.canvas();
}

/** 큰 삼나무 44×86 */
function bigCedar(): HTMLCanvasElement {
  const f = new Fine(44, 86);
  for (let y = 66; y < 85; y++) for (let x = 19; x < 25; x++) f.set(x, y, x < 21 ? 'o' : x > 23 ? 'X' : 'O');
  for (let i = 0; i < 5; i++) {
    const top = 2 + i * 13;
    const bot = top + 24;
    const half = 7 + i * 3.4;
    for (let y = top; y <= bot; y++) {
      const t = (y - top) / (bot - top);
      const w = half * Math.pow(t, 0.8);
      for (let x = Math.floor(22 - w); x <= Math.ceil(22 + w); x++) {
        const nx = (x + 0.5 - 22) / Math.max(w, 1);
        f.set(x, y, ramp('5678', nx, t * 1.2 - 0.6, x, y, 0.12));
      }
    }
  }
  return f.canvas();
}

/** 둥근 활엽수 (강가 버드나무 느낌) 54×60 */
function bigBroadleaf(): HTMLCanvasElement {
  const f = new Fine(54, 60);
  for (let y = 36; y < 59; y++) for (let x = 24; x < 30; x++) f.set(x, y, x < 26 ? 'o' : x > 28 ? 'X' : 'O');
  for (const [cx, cy, r] of [[27, 20, 16], [14, 28, 11], [40, 27, 12], [27, 32, 11]] as const)
    ellF(f, cx, cy, r, r * 0.86, (nx, ny, x, y) => ramp('5678', nx, ny, x, y));
  // 늘어진 가지 (버드나무)
  for (let k = 0; k < 7; k++) for (let i = 0; i < 9; i++) f.set(10 + k * 6 + (i % 2), 34 + i, i > 6 ? '7' : '6');
  return f.canvas();
}

/** 석등 18×38 (불 켜진 창) */
function stoneLanternBig(): HTMLCanvasElement {
  const f = new Fine(20, 40);
  f.stamp(['..&&&&&&&&&&&&..', '.&&&&&&&&&&&&&*.', '&&&&&&&&&&&&&&**'], 2, 35);
  for (let y = 22; y < 35; y++) for (let x = 7; x < 13; x++) f.set(x, y, x < 9 ? '%' : x > 11 ? '*' : '&');
  f.stamp(['.&&&&&&&&&&.', '&&&&&&&&&&&*'], 4, 20);
  // 불 넣는 칸 (빛나는 창)
  f.stamp(['&&&&&&&&&&', '&yyYYYYyy*', '&yYYzzYYy*', '&yYzzzzYy*', '&yyYYYYyy*', '&&&&&&&&&*'], 5, 13);
  // 지붕
  f.stamp(['.....+.....', '....&&&....', '..&&&&&&&..', '%&&&&&&&&**', '*+++++++++*'], 4, 8);
  f.set(9, 6, '&').set(9, 5, '*');
  return f.canvas();
}

/** 붉은 기둥 18×64 (도성) */
function redPillar(): HTMLCanvasElement {
  const f = new Fine(18, 66);
  f.stamp(['xxxxxxxxxxxxxx', 'PPPPPPPPPPPPPP'], 2, 0);
  for (let y = 2; y < 60; y++) for (let x = 4; x < 14; x++) f.set(x, y, x < 6 ? 'r' : x > 11 ? 'q' : y % 14 === 0 ? 'Q' : 'R');
  f.stamp(['..&&&&&&&&&&..', '%&&&&&&&&&&&&*', '&&&&&&&&&&&&**'], 2, 60);
  return f.canvas();
}

/** 무너진 담 56×34 (회벽 + 기와) */
function wallSeg(): HTMLCanvasElement {
  const f = new Fine(58, 36);
  for (let y = 10; y < 34; y++)
    for (let x = 2; x < 56; x++) {
      const broken = y < 10 + Math.max(0, Math.round(Math.sin(x * 0.35) * 3 + (x > 38 ? (x - 38) * 0.9 : 0)));
      if (broken) continue;
      f.set(x, y, y > 28 ? '*' : x > 50 ? 'V' : (x * 7 + y * 3) % 23 === 0 ? 'V' : 'W');
    }
  // 기와 지붕 (왼쪽만 남음)
  for (let x = 0; x < 40; x++) f.set(x, 7 + (x > 30 ? 1 : 0), 'm').set(x, 8 + (x > 30 ? 1 : 0), x % 4 === 0 ? 'M' : 'm').set(x, 9 + (x > 30 ? 1 : 0), 'M');
  // 금 · 벗겨진 자리
  for (let i = 0; i < 9; i++) f.set(20 + i, 16 + Math.round(i * 0.8), '*');
  return f.canvas();
}

/** 쓰러진 통나무 52×18 (이끼) */
function fallenLog(): HTMLCanvasElement {
  const f = new Fine(54, 20);
  for (let x = 4; x < 48; x++)
    for (let y = 4; y < 16; y++) {
      const ny = (y - 10) / 6;
      f.set(x, y, ny < -0.5 ? (x % 5 === 0 ? '5' : '6') : ramp('ooOX', 0, ny, x, y, 0.1));
    }
  ellF(f, 48, 10, 4, 6, (nx, ny) => (Math.hypot(nx, ny) < 0.45 ? 'O' : 'o'));
  ellF(f, 48, 10, 2, 3, () => 'H');
  return f.canvas();
}

/** 지장보살 16×24 (붉은 턱받이) */
function jizoBig(): HTMLCanvasElement {
  const f = new Fine(18, 26);
  ellF(f, 9, 7, 5, 5, (nx, ny, x, y) => ramp('%&*+', nx, ny, x, y));
  for (let y = 11; y < 24; y++) for (let x = 4; x < 14; x++) f.set(x, y, ramp('%&*+', (x - 9) / 5, (y - 17) / 8, x, y));
  f.stamp(['rRRRRRRq', '.RRRRRq.', '..qqqq..'], 5, 12);
  f.set(7, 7, '+').set(10, 7, '+');
  f.stamp(['&&&&&&&&&&&&', '************'], 3, 24);
  return f.canvas();
}

/** 큰 바위 40×28 */
function boulder(): HTMLCanvasElement {
  const f = new Fine(42, 30);
  ellF(f, 21, 16, 19, 12, (nx, ny, x, y) => (ny < -0.6 && h2(x, y) < 0.4 ? '6' : ramp('%&*+', nx, ny, x, y)));
  return f.canvas();
}

/** 갈대 덤불 18×24 */
function reeds(): HTMLCanvasElement {
  const f = new Fine(20, 26);
  for (let i = 0; i < 6; i++) {
    const x0 = 3 + i * 2.6;
    for (let y = 0; y < 18 - (i % 3) * 3; y++) f.set(Math.round(x0 + (y / 18) * (i % 2 ? 1 : -1)), 24 - y, y > 12 ? '5' : '6');
    f.set(Math.round(x0), 24 - (18 - (i % 3) * 3), 'J').set(Math.round(x0), 23 - (18 - (i % 3) * 3), 'J');
  }
  return f.canvas();
}

/** 붉은 토리이 74×64 */
function toriiBig(): HTMLCanvasElement {
  const f = new Fine(76, 66);
  for (let x = 0; x < 76; x++) f.set(x, 4, 'x').set(x, 5, 'P').set(x, 6, x % 6 === 0 ? 'Q' : 'q');
  for (let x = 4; x < 72; x++) f.set(x, 7, 'R').set(x, 8, 'R').set(x, 9, 'q');
  for (let x = 8; x < 68; x++) f.set(x, 17, 'R').set(x, 18, 'q');
  f.set(0, 3, 'x').set(75, 3, 'x');
  for (const px of [14, 56])
    for (let y = 9; y < 62; y++) for (let x = px; x < px + 6; x++) f.set(x, y, x === px ? 'r' : x === px + 5 ? 'Q' : 'R');
  for (const px of [12, 54]) f.stamp(['xxxxxxxxxx', 'PPPPPPPPPP'], px, 62);
  return f.canvas();
}

const PROP_ART: Record<string, () => HTMLCanvasElement> = {
  'rp-sakura': bigSakura,
  'rp-cedar': bigCedar,
  'rp-broadleaf': bigBroadleaf,
  'rp-lantern': stoneLanternBig,
  'rp-pillar': redPillar,
  'rp-wall': wallSeg,
  'rp-log': fallenLog,
  'rp-jizo': jizoBig,
  'rp-boulder': boulder,
  'rp-reeds': reeds,
  'rp-torii': toriiBig,
};

/** 소품 그림 + 팩의 작은 나무 · 그루터기 (32×32) */
function registerProps(scene: Phaser.Scene): void {
  for (const [key, make] of Object.entries(PROP_ART)) if (!scene.textures.exists(key)) scene.textures.addCanvas(key, make());
  const nat = scene.textures.exists('nj-nature') ? (scene.textures.get('nj-nature').getSourceImage() as HTMLImageElement) : null;
  const crop = (key: string, sx: number, sy: number, w: number, h: number) => {
    if (!nat || scene.textures.exists(key)) return;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(nat, sx, sy, w, h, 0, 0, w, h);
    scene.textures.addCanvas(key, c);
  };
  crop('np-tree', 96, 128, 32, 32);
  crop('np-sakura', 192, 0, 32, 32);
  crop('np-stump', 0, 128, 32, 32);
  crop('np-stump2', 32, 128, 32, 32);
  crop('np-teal', 0, 192, 32, 32);
}

// ── 바닥 장식 (팩에서 16px 칸을 구워 넣는다) ─────────────

type Cell = [string, number, number];
const NAT = 'nj-nature';
const FD = 'nj-floor-detail';
const DECALS: Record<number, { cells: Cell[]; n: number }> = {
  1: {
    cells: [[NAT, 3, 10], [NAT, 4, 10], [NAT, 5, 10], [NAT, 7, 10], [NAT, 0, 11], [NAT, 1, 11], [NAT, 3, 11], [NAT, 6, 11], [NAT, 2, 11], [NAT, 1, 10], [NAT, 2, 10], [FD, 0, 2], [FD, 1, 2], [FD, 2, 2], [FD, 3, 2], [FD, 5, 2], [FD, 7, 2], [FD, 4, 0]],
    n: 340,
  },
  2: {
    cells: [[NAT, 3, 10], [NAT, 4, 10], [NAT, 7, 10], [NAT, 2, 11], [FD, 0, 2], [FD, 1, 2], [FD, 2, 2], [FD, 3, 2], [FD, 6, 2], [NAT, 7, 12], [NAT, 8, 12], [FD, 4, 0]],
    n: 280,
  },
  3: {
    cells: [[NAT, 8, 10], [NAT, 9, 10], [NAT, 8, 11], [NAT, 9, 11], [NAT, 4, 11], [NAT, 5, 11], [FD, 0, 0], [FD, 1, 0], [FD, 5, 0], [FD, 6, 0], [FD, 7, 0], [FD, 0, 1], [NAT, 4, 8], [NAT, 4, 9]],
    n: 320,
  },
  4: {
    cells: [[FD, 0, 3], [FD, 1, 3], [FD, 2, 3], [FD, 3, 3], [FD, 4, 3], [NAT, 11, 12], [NAT, 11, 13], [FD, 4, 0], [FD, 1, 0]],
    n: 200,
  },
};

// ── 장별 바닥 ─────────────────────────────────────────

export const PONDS: Record<number, { x: number; y: number; rx: number; ry: number }[]> = {
  2: [
    { x: 420, y: 300, rx: 150, ry: 78 },
    { x: 1500, y: 270, rx: 175, ry: 86 },
    { x: 340, y: 840, rx: 120, ry: 66 },
    { x: 1470, y: 850, rx: 190, ry: 90 },
  ],
};

function paintGround(ch: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = RA_W;
  c.height = RA_H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(RA_W, RA_H);
  const d = img.data;
  const grass1 = pal('#a4d26c', '#8cc25c', '#76b04f', '#629a45');
  const dirt = pal('#ecd3a0', '#dcbc84', '#c4a068');
  const grass2 = pal('#97c262', '#7fae55', '#6a9a4a', '#58853f');
  const sand = pal('#ead39c', '#d8bd82', '#c0a268');
  const water = pal('#7cc4ec', '#5aaee0', '#4492cc', '#3478b4');
  const moss = pal('#5e8a46', '#4e7a3e', '#426a36', '#365a30');
  const litter = pal('#b07a40', '#8e6034', '#6a4628');
  const stone = pal('#9a958a', '#888378', '#77726a', '#68635c');
  const ponds = PONDS[ch] ?? [];
  for (let y = 0; y < RA_H; y++)
    for (let x = 0; x < RA_W; x++) {
      const i = (y * RA_W + x) * 4;
      let col: [number, number, number];
      const n1 = vn(x, y, 140, ch) * 0.75 + vn(x, y, 36, ch + 9) * 0.25;
      if (ch === 1) {
        // 풀밭 + 엇갈리는 흙길 두 갈래
        const pa = Math.abs(y - (RA_H / 2 + 60 + Math.sin(x / 260) * 90));
        const pb = Math.abs(x - (RA_W / 2 + Math.sin(y / 200) * 70));
        const pd = Math.min(pa, pb) + (vn(x, y, 24, 5) - 0.5) * 10;
        if (pd < 24) col = pick(dirt, pd / 24 * 0.8 + vn(x, y, 30, 2) * 0.3, x, y);
        else if (pd < 30) col = h2(x, y) < 0.5 ? dirt[2] : grass1[3];
        else col = pick(grass1, n1, x, y);
      } else if (ch === 2) {
        // 풀밭 + 모래톱 + 연못
        let inside = Infinity;
        for (const p of ponds) inside = Math.min(inside, Math.hypot((x - p.x) / p.rx, (y - p.y) / p.ry) + (vn(x, y, 30, 7) - 0.5) * 0.12);
        if (inside < 1) col = pick(water, inside * 0.8 + vn(x, y, 50, 3) * 0.25, x, y);
        else if (inside < 1.16) col = pick(sand, (inside - 1) / 0.16, x, y);
        else col = pick(grass2, n1, x, y);
      } else if (ch === 3) {
        // 이끼 낀 숲 바닥 + 낙엽 무더기 + 가운데 빈터
        const leaf = vn(x, y, 60, 11);
        const clearing = Math.hypot((x - RA_SPAWN.x) / 360, (y - RA_SPAWN.y) / 240);
        col = pick(moss, n1 * 0.8 + (clearing < 1 ? -0.15 : 0.1), x, y);
        // 낙엽은 덩어리가 아니라 흩뿌려진 잎 (짙은 곳일수록 촘촘)
        if (leaf > 0.55 && h2(x >> 1, y >> 1, 9) < (leaf - 0.55) * 1.6) col = pick(litter, h2(x >> 1, y >> 1, 2), x, y, 0.5);
        if (h2(x, y, 3) < 0.004) col = rgb('#c88a3a');
      } else {
        // 도성 판석 (줄마다 어긋나게) · 줄눈 이끼 · 금
        const row = Math.floor(y / 26);
        const off = (row % 2) * 26;
        const colI = Math.floor((x + off) / 52);
        const tone = h2(colI, row, 4);
        const gx = (x + off) % 52;
        const gy = y % 26;
        col = pick(stone, tone * 0.85 + vn(x, y, 14, 2) * 0.15, x, y, 0.4);
        if (gx === 0 || gy === 0) col = h2(x, y, 6) < 0.25 ? rgb('#5a6a42') : rgb('#4e4a44');
        else if (gy === 1 || gx === 1) col = rgb('#b0aa9c');
        else if (tone > 0.88 && Math.abs(gx - 8 - gy) < 1) col = rgb('#4e4a44');
      }
      d[i] = col[0];
      d[i + 1] = col[1];
      d[i + 2] = col[2];
      d[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}

/** 팩의 작은 장식을 바닥에 구워 넣는다 (연못 · 흙길 위는 피해서) */
function bakeDecals(scene: Phaser.Scene, c: HTMLCanvasElement, ch: number): void {
  const def = DECALS[ch];
  if (!def) return;
  const g = c.getContext('2d')!;
  let seed = 977 * ch;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ponds = PONDS[ch] ?? [];
  for (let k = 0; k < def.n; k++) {
    const [key, cx, cy] = def.cells[Math.floor(rnd() * def.cells.length)];
    if (!scene.textures.exists(key)) continue;
    const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
    const x = Math.round(20 + rnd() * (RA_W - 40));
    const y = Math.round(20 + rnd() * (RA_H - 40));
    if (ponds.some((p) => Math.hypot((x + 8 - p.x) / p.rx, (y + 8 - p.y) / p.ry) < 1.2)) continue;
    g.drawImage(src, cx * 16, cy * 16, 16, 16, x, y, 16, 16);
  }
  // 강가: 연잎 · 물비늘 (코드 도트)
  for (const p of ponds)
    for (let k = 0; k < 7; k++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.25 + rnd() * 0.55;
      const x = Math.round(p.x + Math.cos(a) * p.rx * r);
      const y = Math.round(p.y + Math.sin(a) * p.ry * r);
      if (k % 2) {
        g.fillStyle = '#4f9a4a';
        g.beginPath();
        g.ellipse(x, y, 6, 3.5, 0, 0.4, Math.PI * 2);
        g.fill();
        g.fillStyle = '#7cc062';
        g.fillRect(x - 3, y - 2, 3, 1);
        if (k === 3) {
          g.fillStyle = '#f6b0cc';
          g.fillRect(x + 1, y - 2, 2, 2);
        }
      } else {
        g.fillStyle = 'rgba(212,242,255,0.7)';
        g.fillRect(x - 5, y, 4, 1);
        g.fillRect(x + 1, y + 2, 5, 1);
      }
    }
}

// ── 장별 구성 ─────────────────────────────────────────

export interface PropRule {
  key: string;
  n: number;
  col?: { rx: number; ry: number };
  light?: { r: number; color: number };
  /** 다른 소품과 떨어질 거리 */
  gap: number;
  /** 연못가에만 (갈대) */
  shore?: boolean;
}

export const RULES: Record<number, { props: PropRule[]; dark: { color: number; alpha: number }; ambient: AmbientKind[] }> = {
  1: {
    props: [
      { key: 'rp-sakura', n: 7, col: { rx: 7, ry: 4 }, gap: 120 },
      { key: 'np-sakura', n: 6, col: { rx: 5, ry: 3 }, gap: 70 },
      { key: 'np-tree', n: 8, col: { rx: 5, ry: 3 }, gap: 70 },
      { key: 'rp-lantern', n: 6, col: { rx: 8, ry: 4 }, light: { r: 70, color: 0xffd27a }, gap: 90 },
      { key: 'rp-jizo', n: 4, col: { rx: 7, ry: 4 }, gap: 80 },
      { key: 'rp-boulder', n: 5, col: { rx: 18, ry: 8 }, gap: 90 },
      { key: 'rp-torii', n: 1, col: { rx: 4, ry: 3 }, gap: 200 },
    ],
    dark: { color: 0x000000, alpha: 0 },
    ambient: ['petal', 'rays', 'mote'],
  },
  2: {
    props: [
      { key: 'rp-broadleaf', n: 8, col: { rx: 7, ry: 4 }, gap: 120 },
      { key: 'rp-reeds', n: 22, gap: 40, shore: true },
      { key: 'np-teal', n: 5, col: { rx: 12, ry: 6 }, gap: 80 },
      { key: 'rp-lantern', n: 5, col: { rx: 8, ry: 4 }, light: { r: 76, color: 0xffc070 }, gap: 100 },
      { key: 'rp-boulder', n: 4, col: { rx: 18, ry: 8 }, gap: 90 },
    ],
    dark: { color: 0x2a1838, alpha: 0.32 },
    ambient: ['firefly', 'fog'],
  },
  3: {
    props: [
      { key: 'rp-cedar', n: 22, col: { rx: 8, ry: 4 }, gap: 80 },
      { key: 'rp-log', n: 6, col: { rx: 22, ry: 6 }, gap: 100 },
      { key: 'np-stump', n: 5, col: { rx: 11, ry: 5 }, gap: 70 },
      { key: 'np-stump2', n: 4, col: { rx: 11, ry: 5 }, gap: 70 },
      { key: 'rp-jizo', n: 3, col: { rx: 7, ry: 4 }, gap: 100 },
      { key: 'rp-lantern', n: 3, col: { rx: 8, ry: 4 }, light: { r: 80, color: 0xffc070 }, gap: 140 },
    ],
    dark: { color: 0x0c1a18, alpha: 0.45 },
    ambient: ['leaf', 'fog', 'firefly'],
  },
  4: {
    props: [
      { key: 'rp-pillar', n: 14, col: { rx: 8, ry: 4 }, gap: 110 },
      { key: 'rp-lantern', n: 12, col: { rx: 8, ry: 4 }, light: { r: 86, color: 0xffb860 }, gap: 110 },
      { key: 'rp-wall', n: 7, col: { rx: 26, ry: 6 }, gap: 130 },
      { key: 'rp-torii', n: 1, col: { rx: 4, ry: 3 }, gap: 220 },
    ],
    dark: { color: 0x080c22, alpha: 0.6 },
    ambient: ['ember', 'mote'],
  },
};

/** 싸움터를 만든다 (바닥은 장마다 한 번만 그려 둔다) — 소품 자리는 seed로. 배경 설정이 '팩'이면 팩 타일 싸움터 */
export function buildArena(scene: Phaser.Scene, ch: number, seed: number): ArenaInfo {
  const chapter = RULES[ch] ? ch : 1;
  if (settings.bg === 'pack' && packReady()) return buildPackArena(scene, chapter, seed);
  registerProps(scene);
  const key = `raid-ground-${chapter}`;
  if (!scene.textures.exists(key)) {
    const c = paintGround(chapter);
    bakeDecals(scene, c, chapter);
    scene.textures.addCanvas(key, c);
  }
  const rule = RULES[chapter];
  const ponds = PONDS[chapter] ?? [];
  return { ground: key, props: layoutProps(rule.props, ponds, seed), ponds, dark: rule.dark, ambient: rule.ambient };
}

/** 소품 자리 잡기 (시작 자리 · 연못 · 서로 비켜서) */
export function layoutProps(rules: PropRule[], ponds: { x: number; y: number; rx: number; ry: number }[], seed: number, fixed: ArenaProp[] = []): ArenaProp[] {
  let s = seed * 31 + 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const props: ArenaProp[] = [...fixed];
  const free = (x: number, y: number, gap: number) =>
    Math.hypot(x - RA_SPAWN.x, (y - RA_SPAWN.y) * 1.4) > 200 &&
    !ponds.some((p) => Math.hypot((x - p.x) / (p.rx + 20), (y - p.y) / (p.ry + 14)) < 1) &&
    props.every((q) => Math.hypot(q.x - x, q.y - y) > gap * 0.6);
  for (const r of rules) {
    let placed = 0;
    for (let tries = 0; placed < r.n && tries < r.n * 40; tries++) {
      let x = 60 + rnd() * (RA_W - 120);
      let y = 110 + rnd() * (RA_H - 150);
      // 갈대는 연못가에
      if (r.shore && ponds.length) {
        const p = ponds[Math.floor(rnd() * ponds.length)];
        const a = rnd() * Math.PI * 2;
        x = p.x + Math.cos(a) * (p.rx + 14);
        y = p.y + Math.sin(a) * (p.ry + 10) + 8;
        if (Math.hypot(x - RA_SPAWN.x, y - RA_SPAWN.y) < 160) continue;
        props.push({ key: r.key, x, y });
        placed++;
        continue;
      }
      if (!free(x, y, r.gap)) continue;
      props.push({ key: r.key, x, y, col: r.col, light: r.light });
      placed++;
    }
  }
  return props;
}
