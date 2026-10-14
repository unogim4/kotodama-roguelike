/**
 * 세밀 도트 도구 (2세대).
 * - 점을 한 칸씩 찍는 문자 격자 + 재질마다 4단계 명암 (빛은 왼쪽 위, 그림자는 보랏빛으로 기운다)
 * - 외곽선은 검은 한 색이 아니라 맞닿은 재질의 가장 어두운 색 (sel-out)
 */

/** 문자 → [색, 재질] */
const LEGEND: Record<string, [string, string]> = {
  // 머리카락 (먹보라)
  '1': ['#6f63a6', 'hair'],
  '2': ['#4a4178', 'hair'],
  '3': ['#322a58', 'hair'],
  '4': ['#1f1a3a', 'hair'],
  // 피부
  a: ['#fff1de', 'skin'],
  b: ['#fbd2ab', 'skin'],
  c: ['#e8a682', 'skin'],
  d: ['#bd7466', 'skin'],
  // 흰 천 (그림자는 라벤더)
  w: ['#ffffff', 'cloth'],
  W: ['#f1ebe2', 'cloth'],
  V: ['#cdc3dc', 'cloth'],
  U: ['#988db4', 'cloth'],
  // 주홍 (하카마 · 리본)
  r: ['#ff8264', 'red'],
  R: ['#e0413a', 'red'],
  q: ['#a92739', 'red'],
  Q: ['#6c1833', 'red'],
  // 금
  y: ['#fff2a6', 'gold'],
  Y: ['#f4c24e', 'gold'],
  z: ['#c5802e', 'gold'],
  Z: ['#7c4826', 'gold'],
  // 나무 · 짚신
  o: ['#d0915a', 'wood'],
  O: ['#935a36', 'wood'],
  X: ['#5c3424', 'wood'],
  // 강철
  s: ['#ffffff', 'steel'],
  S: ['#d4e0f2', 'steel'],
  t: ['#91a4c8', 'steel'],
  T: ['#55628c', 'steel'],
  // 한지 (부적)
  f: ['#fffbe9', 'paper'],
  F: ['#efe0b6', 'paper'],
  g: ['#cdb688', 'paper'],
  // 혼불 (보랏빛 불꽃)
  i: ['#ffffff', 'flame'],
  j: ['#ece2ff', 'flame'],
  l: ['#c0a8f6', 'flame'],
  n: ['#9070dc', 'flame'],
  N: ['#5f43ab', 'flame'],
  // 우산 종이 (카사오바케)
  u: ['#9db4ee', 'umbrella'],
  v: ['#6680d0', 'umbrella'],
  m: ['#43559f', 'umbrella'],
  M: ['#2b326e', 'umbrella'],
  // 여우불 (푸른 불꽃)
  A: ['#f2ffff', 'fox'],
  B: ['#a6eaff', 'fox'],
  C: ['#52a8ff', 'fox'],
  D: ['#2b5fcf', 'fox'],
  // 갓파 초록
  '5': ['#bfe68a', 'kappa'],
  '6': ['#72bd52', 'kappa'],
  '7': ['#3e8443', 'kappa'],
  '8': ['#255232', 'kappa'],
  // 짐승 털 (수달 · 족제비)
  H: ['#f0cc96', 'fur'],
  I: ['#c08b56', 'fur'],
  J: ['#855a35', 'fur'],
  K: ['#51331f', 'fur'],
  // 먹 덩어리 (글자 요괴)
  L: ['#4a3f66', 'blob'],
  P: ['#2c2442', 'blob'],
  x: ['#17112a', 'blob'],
  // 벚꽃
  '9': ['#ffe6f0', 'pink'],
  '0': ['#f8b8d0', 'pink'],
  '!': ['#e28aae', 'pink'],
  '?': ['#b25c86', 'pink'],
  // 돌
  '%': ['#e8e4ee', 'stone'],
  '&': ['#bab5c8', 'stone'],
  '*': ['#8c869c', 'stone'],
  '+': ['#5e5970', 'stone'],
  // 얼굴 · 기타
  k: ['#1d1630', 'ink'],
  e: ['#7a62d0', 'ink'],
  E: ['#2c2058', 'ink'],
  h: ['#ffffff', 'ink'],
  p: ['#f49a9e', 'skin'],
  G: ['#7bc46a', 'leaf'],
};

/** 재질별 외곽선 색 */
const OUTLINE: Record<string, string | null> = {
  hair: '#120c22',
  skin: '#6e3a44',
  cloth: '#4c4270',
  red: '#40102a',
  gold: '#4e2a18',
  wood: '#34190f',
  steel: '#262c48',
  paper: '#6a5634',
  flame: '#2c1a5e',
  umbrella: '#161838',
  ink: '#120c22',
  leaf: '#1f3f28',
  fox: '#10245e',
  kappa: '#14301c',
  fur: '#2c1a10',
  blob: '#07040e',
  pink: '#5e2440',
  stone: '#2c2838',
};

export function inkOf(ch: string): string | undefined {
  return LEGEND[ch]?.[0];
}

/** 문자 격자 한 장 */
export class Fine {
  private readonly px: (string | null)[];

  constructor(readonly w: number, readonly h: number) {
    this.px = Array<string | null>(w * h).fill(null);
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x];
  }

  set(x: number, y: number, ch: string | null): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = ch;
    return this;
  }

  /** 문자 격자를 찍는다 ('.'은 건너뜀). flip이면 좌우 반전 */
  stamp(rows: readonly string[], ox: number, oy: number, flip = false): this {
    const w = rows[0].length;
    rows.forEach((row, y) => {
      if (import.meta.env.DEV && row.length !== w) console.warn('Fine.stamp: 줄 길이가 다름', rows);
      [...row].forEach((ch, x) => {
        if (ch !== '.') this.set(ox + (flip ? w - 1 - x : x), oy + y, ch);
      });
    });
    return this;
  }

  /** 문자 바꾸기 (명암 한 단계 어둡게 등) */
  map(fn: (ch: string, x: number, y: number) => string | null): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const ch = this.px[y * this.w + x];
        if (ch) this.px[y * this.w + x] = fn(ch, x, y);
      }
    return this;
  }

  /** 캔버스로. outline이면 재질별 sel-out 외곽선을 두른다 */
  canvas(outline = true): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext('2d')!;
    const img = g.createImageData(this.w, this.h);
    const put = (x: number, y: number, hex: string) => {
      const i = (y * this.w + x) * 4;
      img.data[i] = parseInt(hex.slice(1, 3), 16);
      img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
      img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
      img.data[i + 3] = 255;
    };
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const ch = this.get(x, y);
        if (ch && LEGEND[ch]) put(x, y, LEGEND[ch][0]);
        else if (outline) {
          // 아래 · 오른쪽 · 왼쪽 · 위 순으로 맞닿은 재질의 외곽선 색
          for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
            const n = this.get(x + dx, y + dy);
            const col = n && LEGEND[n] ? OUTLINE[LEGEND[n][1]] : null;
            if (col) {
              put(x, y, col);
              break;
            }
          }
        }
      }
    g.putImageData(img, 0, 0);
    return c;
  }
}

/** 프레임들을 가로로 이어 붙인 시트 */
export function strip(frames: HTMLCanvasElement[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = frames.reduce((s, f) => s + f.width, 0);
  c.height = Math.max(...frames.map((f) => f.height));
  const g = c.getContext('2d')!;
  let x = 0;
  for (const f of frames) {
    g.drawImage(f, x, 0);
    x += f.width;
  }
  return c;
}

/** 4×4 베이어 디더 문턱값 (0~1) */
export function bayer(x: number, y: number): number {
  return ([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/** 0~1 해시 */
export function hash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
