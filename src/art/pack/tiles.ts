import Phaser from 'phaser';

/**
 * 🧱 팩 타일 도구 — Ninja Adventure(CC0) 16px 타일셋으로 배경 캔버스를 짠다.
 * 우리 캐릭터(32px)가 팩 캐릭터(16px)의 2배라 타일도 **2배(한 칸 32px)** 로 깐다.
 * 바닥 타일셋은 지형마다 같은 짜임: 섬(3×3 · 둥근 모서리) · 세로 길 · 가로 길 · 점 · 장식 줄 · 바탕 칸.
 */

/** 화면에서 타일 한 칸 */
export const U = 32;
const T = 16;

/** BootScene이 불러 두는 타일셋 (public/assets/ninja/<이름>.png → 'nj-<이름>') */
export const PACK_TILE_FILES = ['floor', 'nature', 'water', 'house', 'element', 'relief', 'towers', 'village-abandoned', 'floor-detail', 'floor-b', 'interior-floor', 'interior', 'wall-simple'];

const imgs = new Map<string, CanvasImageSource>();

/** 불러 둔 타일셋 그림을 꺼내 둔다 (BootScene.create) */
export function registerPackTiles(scene: Phaser.Scene): void {
  for (const k of PACK_TILE_FILES) if (scene.textures.exists(`nj-${k}`)) imgs.set(k, scene.textures.get(`nj-${k}`).getSourceImage() as CanvasImageSource);
  packDebug();
}

/** 개발 중 확인용: 콘솔에서 조각 · 캔버스를 바로 써 본다 */
export function packDebug(): void {
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__pack = { PackCanvas, P, TER, imgs, BUSHES, FLOWERS, FERNS, PEBBLES };
}

export function packReady(): boolean {
  return imgs.has('floor') && imgs.has('nature');
}

/** 지형 한 벌: 타일셋 · 짜임이 시작하는 칸 */
export interface Terrain {
  sheet: string;
  ox: number;
  oy: number;
}

/** 바닥 지형 (섬 = 앞 이름 · 바탕 = 뒤 이름) */
export const TER = {
  /** 풀밭 위 흙 */
  grassDirt: { sheet: 'floor', ox: 0, oy: 7 },
  /** 짙은 풀밭 위 흙 (숲) */
  darkDirt: { sheet: 'floor', ox: 11, oy: 7 },
  /** 모래 위 고운 모래 */
  sand: { sheet: 'floor', ox: 0, oy: 0 },
  /** 분홍 모래 (벚꽃 길) */
  pink: { sheet: 'floor', ox: 11, oy: 0 },
  /** 눈 (잿빛 땅 위 흰 눈) */
  snow: { sheet: 'floor', ox: 0, oy: 14 },
  /** 마른 흙 */
  brown: { sheet: 'floor', ox: 11, oy: 14 },
  /** 풀밭의 연못 */
  pondGrass: { sheet: 'water', ox: 0, oy: 6 },
  /** 모래밭의 연못 */
  pondSand: { sheet: 'water', ox: 0, oy: 0 },
} satisfies Record<string, Terrain>;

/** 짜임 안의 자리 */
const ISL = [
  [0, 0], [1, 0], [2, 0],
  [0, 1], [1, 1], [2, 1],
  [0, 2], [1, 2], [2, 2],
] as const;
const BASE: [number, number] = [0, 5];
const BASE_DECO: [number, number][] = [[1, 5], [2, 5], [3, 5], [4, 5]];
const ISLE_DECO: [number, number][] = [[0, 4], [1, 4]];

/** 그림 조각 (타일셋 안의 픽셀 사각형) */
export interface Piece {
  sheet: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export const piece = (sheet: string, x: number, y: number, w: number, h: number): Piece => ({ sheet, x, y, w, h });

export class PackCanvas {
  readonly c: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  readonly cols: number;
  readonly rows: number;
  private s: number;

  constructor(readonly w: number, readonly h: number, seed = 1) {
    this.c = document.createElement('canvas');
    this.c.width = w;
    this.c.height = h;
    this.g = this.c.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.cols = Math.ceil(w / U);
    this.rows = Math.ceil(h / U);
    this.s = seed * 7919 + 13;
  }

  /** 씨앗 고정 난수 */
  rnd(): number {
    this.s = (this.s * 16807) % 2147483647;
    return this.s / 2147483647;
  }

  /** 타일 한 칸 (지형 짜임 안의 tx, ty) */
  tile(t: Terrain, tx: number, ty: number, gx: number, gy: number): void {
    const im = imgs.get(t.sheet);
    if (!im) return;
    this.g.drawImage(im, (t.ox + tx) * T, (t.oy + ty) * T, T, T, gx * U, gy * U, U, U);
  }

  /** 바탕을 깔고 장식 칸을 흩뿌린다 */
  fill(t: Terrain, deco = 0.1, gx0 = 0, gy0 = 0, gx1 = this.cols, gy1 = this.rows): void {
    for (let y = gy0; y < gy1; y++)
      for (let x = gx0; x < gx1; x++) {
        const d = this.rnd() < deco ? BASE_DECO[Math.floor(this.rnd() * BASE_DECO.length)] : BASE;
        this.tile(t, d[0], d[1], x, y);
      }
  }

  /** 섬 (흙 · 연못 …) — 2×2 이상 */
  patch(t: Terrain, gx: number, gy: number, gw: number, gh: number, deco = 0.08): void {
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        const cx = x === 0 ? 0 : x === gw - 1 ? 2 : 1;
        const cy = y === 0 ? 0 : y === gh - 1 ? 2 : 1;
        let [tx, ty]: readonly number[] = ISL[cy * 3 + cx];
        if (cx === 1 && cy === 1 && this.rnd() < deco) [tx, ty] = ISLE_DECO[Math.floor(this.rnd() * ISLE_DECO.length)];
        this.tile(t, tx, ty, gx + x, gy + y);
      }
  }

  /** 가로 길 (한 칸 너비) */
  pathH(t: Terrain, gx0: number, gx1: number, gy: number): void {
    for (let x = gx0; x <= gx1; x++) this.tile(t, x === gx0 ? 0 : x === gx1 ? 2 : 1, 3, x, gy);
  }

  /** 세로 길 (한 칸 너비) */
  pathV(t: Terrain, gx: number, gy0: number, gy1: number): void {
    for (let y = gy0; y <= gy1; y++) this.tile(t, 3, y === gy0 ? 0 : y === gy1 ? 2 : 1, gx, y);
  }

  /** 칸 지도 (영역을 그려 region으로 칠한다) */
  mask(): Mask {
    return new Mask(this.cols, this.rows);
  }

  /**
   * 영역 칠하기 — 칸마다 이웃을 보고 가장자리 · 바깥 모서리 · 안쪽 모서리를 고른다 (짜임의 4~7열 네모 세트).
   * 먼저 두 칸보다 가는 곳은 지워서(2×2 열기) 어색한 한 칸짜리가 생기지 않게.
   */
  region(t: Terrain, m: Mask, deco = 0.06): void {
    const k = m.open2();
    const on = (x: number, y: number) => k.get(x, y, true);
    const pick = <A>(a: A, b: A) => (this.rnd() < 0.5 ? a : b);
    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < this.cols; x++) {
        if (!k.get(x, y)) continue;
        const n = on(x, y - 1);
        const s = on(x, y + 1);
        const w = on(x - 1, y);
        const e = on(x + 1, y);
        let tx = 1;
        let ty = 1;
        if (!n && !w) [tx, ty] = [4, 0];
        else if (!n && !e) [tx, ty] = [7, 0];
        else if (!s && !w) [tx, ty] = [4, 3];
        else if (!s && !e) [tx, ty] = [7, 3];
        else if (!n) [tx, ty] = [pick(5, 6), 0];
        else if (!s) [tx, ty] = [pick(5, 6), 3];
        else if (!w) [tx, ty] = [4, pick(1, 2)];
        else if (!e) [tx, ty] = [7, pick(1, 2)];
        else if (!on(x + 1, y + 1)) [tx, ty] = [5, 1];
        else if (!on(x - 1, y + 1)) [tx, ty] = [6, 1];
        else if (!on(x + 1, y - 1)) [tx, ty] = [5, 2];
        else if (!on(x - 1, y - 1)) [tx, ty] = [6, 2];
        else if (this.rnd() < deco) [tx, ty] = ISLE_DECO[Math.floor(this.rnd() * ISLE_DECO.length)];
        this.tile(t, tx, ty, x, y);
      }
  }

  /** 점 하나 (작은 웅덩이 · 흙 자국) */
  spot(t: Terrain, gx: number, gy: number): void {
    this.tile(t, 3, 3, gx, gy);
  }

  /** 그림 조각을 2배로 — (x, y)는 기준점 (기본: 아래 가운데) */
  put(p: Piece, x: number, y: number, ax = 0.5, ay = 1, flip = false): void {
    const im = imgs.get(p.sheet);
    if (!im) return;
    const dx = Math.round(x - p.w * 2 * ax);
    const dy = Math.round(y - p.h * 2 * ay);
    if (flip) {
      this.g.save();
      this.g.translate(dx + p.w * 2, dy);
      this.g.scale(-1, 1);
      this.g.drawImage(im, p.x, p.y, p.w, p.h, 0, 0, p.w * 2, p.h * 2);
      this.g.restore();
    } else this.g.drawImage(im, p.x, p.y, p.w, p.h, dx, dy, p.w * 2, p.h * 2);
  }

  /** 전체에 색을 얹는다 (시간대 · 분위기) */
  tint(color: string, alpha: number, mode: GlobalCompositeOperation = 'source-over'): void {
    this.g.save();
    this.g.globalAlpha = alpha;
    this.g.globalCompositeOperation = mode;
    this.g.fillStyle = color;
    this.g.fillRect(0, 0, this.w, this.h);
    this.g.restore();
  }
}

/** 팩 그림 조각 모음 (타일셋 안의 픽셀 사각형) */
export const P = {
  // ── 나무 (nature) ──
  treeRound: piece('nature', 0, 0, 32, 32),
  pine: piece('nature', 32, 0, 32, 32),
  deadTree: piece('nature', 64, 0, 32, 32),
  treeRoots: piece('nature', 96, 0, 32, 32),
  snowBush: piece('nature', 128, 0, 32, 32),
  snowPine: piece('nature', 160, 0, 32, 32),
  whiteTree: piece('nature', 192, 0, 32, 32),
  sakura: piece('nature', 224, 0, 32, 32),
  limeTree: piece('nature', 256, 0, 32, 32),
  limeTree2: piece('nature', 288, 0, 32, 32),
  pineGrove: piece('nature', 0, 32, 64, 48),
  roundGrove: piece('nature', 64, 32, 64, 48),
  whiteGrove: piece('nature', 128, 32, 64, 48),
  sakuraGrove: piece('nature', 192, 32, 64, 48),
  limeGrove: piece('nature', 256, 32, 64, 48),
  limeGrove2: piece('nature', 320, 32, 64, 48),
  deadGrove: piece('nature', 0, 80, 64, 48),
  snowPineGreenGrove: piece('nature', 64, 80, 64, 48),
  snowPineGrove: piece('nature', 128, 80, 64, 48),
  stumpGrove: piece('nature', 192, 80, 64, 48),
  mossRocks: piece('nature', 256, 80, 64, 48),
  bigTreeSakura: piece('nature', 0, 272, 48, 64),
  bigTreeGreen: piece('nature', 48, 272, 48, 64),
  bigTreeWhite: piece('nature', 96, 272, 48, 64),
  bigTreeOrange: piece('nature', 144, 272, 48, 64),
  // ── 그루터기 · 바위 · 풀 ──
  stumpBig: piece('nature', 0, 128, 32, 32),
  stumpBig2: piece('nature', 32, 128, 32, 32),
  stump: piece('nature', 64, 128, 16, 16),
  log: piece('nature', 80, 128, 16, 16),
  bigOak: piece('nature', 96, 128, 32, 32),
  bamboo: piece('nature', 176, 128, 16, 32),
  rockBrown: piece('nature', 208, 128, 32, 32),
  rockTeal: piece('nature', 0, 192, 32, 32),
  rockSnow: piece('nature', 32, 192, 32, 32),
  boulderMoss: piece('nature', 240, 256, 32, 32),
  tallTrunk: piece('nature', 192, 208, 16, 48),
  mossTrunk: piece('nature', 208, 208, 16, 48),
} satisfies Record<string, Piece>;

/** 작은 장식 (16×16) — nature 시트의 칸 */
export const smallNature = (tx: number, ty: number): Piece => piece('nature', tx * 16, ty * 16, 16, 16);
/** 풀포기 · 덤불 (10줄) · 꽃 (11줄) */
export const BUSHES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => smallNature(x, 10));
export const FLOWERS = [0, 1, 2, 3, 6].map((x) => smallNature(x, 11));
export const FERNS = [4, 5, 7, 8, 9].map((x) => smallNature(x, 11));
/** 작은 돌 (12줄 4~11) */
export const PEBBLES = [4, 5, 6, 7, 8, 9, 10, 11].map((x) => smallNature(x, 12));

/** 칸 지도 — 영역(흙 · 연못 · 길)을 그려 둔다 */
export class Mask {
  private readonly m: Uint8Array;

  constructor(readonly cols: number, readonly rows: number) {
    this.m = new Uint8Array(cols * rows);
  }

  /** 칸 값 (바깥은 edge) */
  get(x: number, y: number, edge = false): boolean {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return edge;
    return this.m[y * this.cols + x] === 1;
  }

  set(x: number, y: number, v = true): this {
    if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) this.m[y * this.cols + x] = v ? 1 : 0;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, v = true): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v);
    return this;
  }

  /** 타원 (칸 단위 가운데 · 반지름) — 가장자리를 조금 흔든다 */
  ellipse(cx: number, cy: number, rx: number, ry: number, wobble = 0, rnd = Math.random, v = true): this {
    for (let j = Math.floor(cy - ry - 1); j <= Math.ceil(cy + ry + 1); j++)
      for (let i = Math.floor(cx - rx - 1); i <= Math.ceil(cx + rx + 1); i++) {
        const d = Math.hypot((i + 0.5 - cx) / rx, (j + 0.5 - cy) / ry);
        if (d <= 1 + (rnd() - 0.5) * wobble) this.set(i, j, v);
      }
    return this;
  }

  /** 굵은 선 (길) */
  line(x0: number, y0: number, x1: number, y1: number, width = 2, v = true): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n);
      const y = Math.round(y0 + ((y1 - y0) * k) / n);
      this.rect(x - Math.floor((width - 1) / 2), y - Math.floor((width - 1) / 2), width, width, v);
    }
    return this;
  }

  /** 2×2보다 가는 곳을 지운다 (한 칸짜리 돌기 · 가는 줄) */
  open2(): Mask {
    const out = new Mask(this.cols, this.rows);
    const full = (x: number, y: number) => this.get(x, y, true) && this.get(x + 1, y, true) && this.get(x, y + 1, true) && this.get(x + 1, y + 1, true);
    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < this.cols; x++) if (this.get(x, y) && (full(x, y) || full(x - 1, y) || full(x, y - 1) || full(x - 1, y - 1))) out.set(x, y);
    return out;
  }
}
