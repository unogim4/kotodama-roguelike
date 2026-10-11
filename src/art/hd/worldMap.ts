import { rng, MAP_W, MAP_H, layerX, spineY, trailPoint, CHAPTER1_SIGNS } from '../../map/chapter1';
import type { NodeKind } from '../../map/nodes';

/**
 * 1장 지역 지도 (가로 1920×360) — 컬러 풍경 도트.
 * 왼쪽 신사 마을 → 논두렁 → 삼나무 숲 → 오른쪽 야마비코 산.
 * 지형은 픽셀 단위로 칠하고(디더링), 집·나무·노드 그림은 먹선 외곽선 도트로 얹는다.
 */

/** 지도 전용 팔레트 */
export const M = {
  ink: '#1b1626',
  inkSoft: '#2e2640',
  // 하늘 (아침 → 저녁)
  day: ['#6fb0e0', '#8cc4ea', '#a8d6f0', '#c6e6f6', '#e2f3fa'],
  dusk: ['#5a4a8a', '#8a5a9a', '#c4708a', '#ec9c7a', '#f8cc9c'],
  cloud: '#ffffff',
  cloudD: '#d8e6f4',
  cloudDusk: '#fbe0d0',
  // 먼 산 · 가까운 산
  far: '#a9b8dc',
  farDusk: '#9a88b8',
  mid: '#7890b8',
  midShade: '#5a6e98',
  midDusk: '#7a6a9a',
  midDuskShade: '#5a4a7a',
  snow: '#f4f8ff',
  snowShade: '#c8d4ec',
  // 땅
  village: ['#b6dd7c', '#98ca64', '#7cb254'],
  fields: ['#cddc7e', '#b0c862', '#90ac50'],
  forest: ['#76aa58', '#5c9248', '#467a3e', '#33613a'],
  rocky: ['#cbbd9c', '#ad9e80', '#8d806c', '#6e645a'],
  alpine: ['#c6cc86', '#aab470', '#8e9a5c'],
  stoneGround: ['#d6ccae', '#c0b496', '#a89c80'],
  tree0: '#3f7a3a',
  tree1: '#2b5530',
  tree2: '#1f3f28',
  leaf0: '#a8d870',
  leaf1: '#74ae52',
  // 길
  dirt0: '#ecd3a0',
  dirt1: '#d2ad74',
  dirt2: '#94683e',
  // 돌
  st0: '#e4e0ea',
  st1: '#b4b0c2',
  st2: '#7d7990',
  st3: '#56526a',
  // 물
  wa0: '#d4f2ff',
  wa1: '#8fd8ff',
  wa2: '#5aaee8',
  wa3: '#3f7fd0',
  // 나무(목재)
  wd0: '#dca464',
  wd1: '#a86a38',
  wd2: '#6a4024',
  // 기와
  rf0: '#7d8cc4',
  rf1: '#56669e',
  rf2: '#384470',
  // 초가
  th0: '#e0c078',
  th1: '#b8944e',
  th2: '#8a6a34',
  // 주홍
  red0: '#f47a5a',
  red1: '#d8432e',
  red2: '#8f2a20',
  // 금
  gold0: '#ffe39a',
  gold1: '#f0b84a',
  gold2: '#b9802a',
  // 회벽
  wall0: '#fffaf0',
  wall1: '#ece0c4',
  wall2: '#bcae8c',
  // 벚꽃
  pk0: '#ffe0ec',
  pk1: '#f6b0cc',
  pk2: '#d880a6',
  // 논
  paddy0: '#c4ecec',
  paddy1: '#9ccfc8',
  ridge0: '#c4b47a',
  ridge1: '#9a8a58',
  sprout0: '#7cc062',
  sprout1: '#4f9a4a',
  // 요괴
  pu0: '#d8c8f8',
  pu1: '#9a7ad0',
  pu2: '#5a4290',
  pu3: '#3a2a60',
  // 불
  fi0: '#fff4b0',
  fi1: '#f8c050',
  fi2: '#ec7a2a',
  // 여우
  fox0: '#f4a860',
  fox1: '#e07a32',
  fox2: '#a8501e',
  // 동판 지붕
  cu0: '#7cc8b4',
  cu1: '#4e9a8a',
  cu2: '#336a62',
  // 야마비코 털 · 피부
  fur0: '#b9773f',
  fur1: '#8a5530',
  fur2: '#5a3420',
  skin0: '#f6cfa6',
  skin1: '#d9a07a',
};

type Col = string | null;

// ── 도트 도구 ─────────────────────────────────────────

/** 지도용 작은 도트 그림. 색을 직접 칠하고 outline()으로 먹선을 두른다 */
export class Spr {
  private readonly c: Col[][];

  constructor(readonly w: number, readonly h: number) {
    this.c = Array.from({ length: h }, () => Array<Col>(w).fill(null));
  }

  get(x: number, y: number): Col {
    return this.c[y]?.[x] ?? null;
  }

  set(x: number, y: number, k: Col): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y][x] = k;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, k: Col): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, k);
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, k: Col): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, k);
      }
    }
    return this;
  }

  poly(pts: [number, number][], k: Col): this {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      for (let x = 0; x < this.w; x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i];
          const [xj, yj] = pts[j];
          if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.set(x, y, k);
      }
    }
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, k: Col): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, k);
    return this;
  }

  /** 칠해진 칸만 다시 칠한다 (음영·무늬). null/undefined를 돌려주면 그대로 */
  over(fn: (x: number, y: number, k: string) => Col | undefined): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const k = this.c[y][x];
        if (!k) continue;
        const n = fn(x, y, k);
        if (n) this.c[y][x] = n;
      }
    }
    return this;
  }

  /** 바깥 먹선 */
  outline(k = M.ink): this {
    const marks: [number, number][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.c[y][x]) continue;
        const near = [this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)];
        if (near.some((c) => c && c !== k)) marks.push([x, y]);
      }
    }
    marks.forEach(([x, y]) => (this.c[y][x] = k));
    return this;
  }

  /** 픽셀 패턴 찍기 ('#' = 색, 나머지 = 건너뜀) */
  pattern(x: number, y: number, rows: string[], k: Col): this {
    rows.forEach((r, j) => [...r].forEach((ch, i) => ch === '#' && this.set(x + i, y + j, k)));
    return this;
  }

  flipped(): Spr {
    const s = new Spr(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) s.c[y][this.w - 1 - x] = this.c[y][x];
    return s;
  }

  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext('2d')!;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const k = this.c[y][x];
        if (!k) continue;
        g.fillStyle = k;
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }
}

const rgbCache = new Map<string, [number, number, number]>();
function rgb(hex: string): [number, number, number] {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}

/** 두 색 사이를 steps 단계로 끊어 섞는다 (부드러운 띠) */
function mix(a: string, b: string, t: number, steps = 8): string {
  const q = Math.round(Math.max(0, Math.min(1, t)) * steps) / steps;
  if (q === 0) return a;
  if (q === 1) return b;
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(r1 + (r2 - r1) * q)}${h(g1 + (g2 - g1) * q)}${h(b1 + (b2 - b1) * q)}`;
}

/** 지형을 픽셀 단위로 칠하는 버퍼 */
class Buf {
  readonly img: ImageData;
  constructor(readonly w: number, readonly h: number) {
    this.img = new ImageData(w, h);
  }
  put(x: number, y: number, hex: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b] = rgb(hex);
    const i = (y * this.w + x) * 4;
    const d = this.img.data;
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = 255;
  }
  rect(x: number, y: number, w: number, h: number, hex: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, hex);
  }
}

function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 부드러운 값 노이즈 0~1 */
function noise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const sm = (t: number) => t * t * (3 - 2 * t);
  const u = sm(fx - x0);
  const v = sm(fy - y0);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
/** 4×4 바이어 디더 0~1 */
function dith(x: number, y: number): number {
  return BAYER[(y & 3) * 4 + (x & 3)];
}

/** t(0~1)에 맞는 색을 디더링으로 고른다 */
function shade(cols: string[], t: number, x: number, y: number, spread = 0.9): string {
  const i = Math.floor(t * cols.length + (dith(x, y) - 0.5) * spread);
  return cols[Math.max(0, Math.min(cols.length - 1, i))];
}

// ── 지형 ─────────────────────────────────────────────

/** 땅이 시작되는 높이 (그 위는 하늘과 먼 산) */
function horizon(x: number): number {
  return 86 + Math.round((noise(x, 0, 50, 3) - 0.5) * 8);
}

/** 지역 경계 (조금씩 들쭉날쭉) */
type Region = 'village' | 'fields' | 'forest' | 'mountain';
function regionAt(x: number, y: number): Region {
  const rx = x + (noise(x, y, 36, 5) - 0.5) * 70;
  return rx < 500 ? 'village' : rx < 1010 ? 'fields' : rx < 1460 ? 'forest' : 'mountain';
}

/** 지역 이름 — 화면 위 표시용 */
export const REGIONS: { name: string; from: number }[] = [
  { name: '신사 마을', from: 0 },
  { name: '논두렁', from: 500 },
  { name: '삼나무 숲', from: 1010 },
  { name: '야마비코 산', from: 1460 },
];

/** 개울 가운데 x (산에서 내려와 논을 가른다) */
function streamX(y: number): number {
  return 652 + Math.sin(y / 38) * 10 + (y - 84) * 0.12;
}

/** 저녁빛 비율 (오른쪽으로 갈수록 해가 진다) */
function duskAmount(x: number): number {
  return Math.max(0, Math.min(1, (x - 1000) / 760));
}

function paintBackdrop(b: Buf): void {
  // 가까운 산줄기 높이 (오른쪽 끝은 야마비코 산)
  const ridge = (x: number) => 54 + Math.round(noise(x, 0, 60, 21) * 24);
  const bigY = (x: number) => 6 + Math.abs(x - 1850) * 0.42;
  const midAt = (x: number) => Math.min(ridge(x), bigY(x));
  let lit = true;
  for (let x = 0; x < MAP_W; x++) {
    const hz = horizon(x);
    const dusk = duskAmount(x);
    const farY = 30 + Math.round(noise(x, 0, 80, 11) * 26 + noise(x, 0, 23, 12) * 8);
    const midY = Math.round(midAt(x));
    const onBig = bigY(x) <= ridge(x);
    // 왼쪽을 향한 비탈(오른쪽으로 갈수록 높아지는 곳)이 밝다
    if (onBig) lit = x < 1850;
    else if (midAt(x + 5) < midAt(x - 5) - 1) lit = true;
    else if (midAt(x + 5) > midAt(x - 5) + 1) lit = false;
    for (let y = 0; y < hz; y++) {
      let col: string;
      if (y >= midY) {
        const snowLine = 30 + (noise(x, y, 6, 2) - 0.5) * 8;
        if (onBig && y < snowLine) col = lit ? M.snow : M.snowShade;
        else col = lit ? mix(M.mid, M.midDusk, dusk, 32) : mix(M.midShade, M.midDuskShade, dusk, 32);
      } else if (y >= farY) {
        col = y < farY + 2 && farY < 40 ? M.snow : mix(M.far, M.farDusk, dusk, 32);
      } else {
        // 하늘: 위에서 아래로 5단 띠, 띠 경계만 디더링
        const t = y / (hz * 0.8);
        const i = Math.max(0, Math.min(4, Math.floor(t * 5 + (dith(x, y) - 0.5) * 0.8)));
        col = mix(M.day[i], M.dusk[i], dusk, 32);
      }
      b.put(x, y, col);
    }
  }
  // 구름
  const rand = rng(31);
  for (let i = 0; i < 16; i++) {
    const cx = rand() * MAP_W;
    const cy = 10 + rand() * 28;
    const w = 14 + rand() * 22;
    const dusk = duskAmount(cx) > 0.5;
    for (let k = 0; k < 4; k++) {
      const ox = cx + (k - 1.5) * w * 0.35;
      const oy = cy - (k === 1 || k === 2 ? 3 : 0);
      const rx = w * 0.32;
      const ry = 3 + (k === 1 || k === 2 ? 2 : 0);
      for (let y = Math.floor(oy - ry); y <= oy + ry; y++) {
        for (let x = Math.floor(ox - rx); x <= ox + rx; x++) {
          const dx = (x - ox) / rx;
          const dy = (y - oy) / ry;
          if (dx * dx + dy * dy > 1 || y > cy + 2) continue;
          b.put(x, y, y > cy ? M.cloudD : dusk ? M.cloudDusk : M.cloud);
        }
      }
    }
  }
}

function paintGround(b: Buf): void {
  for (let x = 0; x < MAP_W; x++) {
    const hz = horizon(x);
    for (let y = hz; y < MAP_H; y++) {
      const r = regionAt(x, y);
      const t = noise(x, y, 22, 7) * 0.7 + noise(x, y, 7, 8) * 0.3;
      let col: string;
      if (r === 'village') col = shade(M.village, t, x, y);
      else if (r === 'fields') col = shade(M.fields, t, x, y);
      else if (r === 'forest') col = shade(M.forest, t * 0.9 + 0.08, x, y);
      else {
        // 고산 풀밭 + 오른쪽으로 갈수록 넓어지는 바위 지대
        const rocky = noise(x, y, 52, 9) > 0.66 - ((x - 1460) / 460) * 0.18;
        col = rocky ? shade(M.stoneGround, t, x, y, 0.7) : shade(M.alpine, t, x, y, 0.8);
      }
      b.put(x, y, col);
    }
  }
}

/** 땅 위 잔디·꽃·자갈 */
function paintDetails(b: Buf): void {
  const rand = rng(41);
  for (let i = 0; i < 5200; i++) {
    const x = Math.floor(rand() * MAP_W);
    const y = horizon(x) + 6 + Math.floor(rand() * (MAP_H - horizon(x) - 6));
    const r = regionAt(x, y);
    const roll = rand();
    if (r === 'mountain' && roll < 0.55) {
      // 자갈
      b.put(x, y, M.st2);
      b.put(x + 1, y, M.st2);
      b.put(x, y - 1, M.st0);
      continue;
    }
    if ((r === 'village' || r === 'fields') && roll < 0.22) {
      // 꽃
      const petal = [M.wall0, M.gold0, M.pk1, M.wall0][Math.floor(rand() * 4)];
      b.put(x, y, petal);
      b.put(x, y + 1, M.tree0);
      continue;
    }
    // 잔디 포기
    const dark = r === 'forest' ? M.tree1 : r === 'mountain' ? M.rocky[3] : M.tree0;
    const light = r === 'forest' ? M.forest[0] : M.leaf0;
    b.put(x, y, dark);
    b.put(x - 1, y - 1, dark);
    b.put(x + 1, y - 1, dark);
    b.put(x, y - 1, light);
  }
  // 벚꽃 잎 (마을)
  for (let i = 0; i < 500; i++) {
    const x = Math.floor(rand() * 520);
    const y = 90 + Math.floor(rand() * 270);
    if (regionAt(x, y) === 'village') b.put(x, y, rand() < 0.6 ? M.pk1 : M.pk0);
  }
}

/** 지평선의 나무 띠 (먼 숲) */
function paintTreeline(b: Buf): void {
  for (let x = 0; x < MAP_W; x++) {
    const hz = horizon(x);
    const mountain = x > 1480;
    const bump = Math.abs(Math.sin(x * 0.42 + noise(x, 0, 8, 6) * 3));
    const h = mountain ? Math.round(noise(x, 0, 10, 13) * 5) : 4 + Math.round(bump * 5 + noise(x, 0, 9, 4) * 5);
    for (let y = hz - h; y < hz + 3; y++) {
      const top = y === hz - h;
      const col = mountain ? (top ? M.rocky[1] : M.rocky[3]) : top ? M.tree0 : y > hz ? M.tree2 : M.tree1;
      b.put(x, y, col);
    }
  }
}

function paintStream(b: Buf): void {
  for (let y = 70; y < MAP_H; y++) {
    const cx = streamX(y);
    for (let dx = -5; dx <= 5; dx++) {
      const x = Math.round(cx + dx);
      const a = Math.abs(dx);
      if (a === 5) b.put(x, y, M.tree0);
      else if (a === 4) b.put(x, y, M.dirt1);
      else if (hash(x, y, 77) < 0.06) b.put(x, y, M.wa0);
      else b.put(x, y, a <= 1 && dith(x, y) < 0.7 ? M.wa3 : a <= 2 ? M.wa2 : M.wa1);
    }
  }
}

/** 논 한 마지기 */
function paddy(b: Buf, x0: number, y0: number, w: number, h: number): void {
  b.rect(x0, y0, w, h, M.ridge1);
  b.rect(x0, y0, w, 1, M.ridge0);
  b.rect(x0 + 2, y0 + 2, w - 4, h - 4, M.paddy1);
  for (let y = y0 + 2; y < y0 + h - 2; y++) {
    for (let x = x0 + 2; x < x0 + w - 2; x++) {
      if ((y - y0) % 4 === 3 && (x - x0) % 3 === 1) {
        b.put(x, y, M.sprout1);
        b.put(x, y - 1, M.sprout0);
      } else if (hash(x, y, 5) < 0.05) b.put(x, y, M.paddy0);
    }
  }
}

function paintPaddies(b: Buf): void {
  const rows = [
    { y: 92, h: 20 },
    { y: 298, h: 22 },
    { y: 324, h: 22 },
  ];
  for (const r of rows) {
    for (let x = 520; x + 44 <= 1000; x += 48) {
      if (Math.abs(x + 22 - streamX(r.y + 10)) < 36) continue; // 개울 자리
      if (r.y > 200 && x > 700 && x < 830) continue; // 과자 가게 자리
      paddy(b, x, r.y, 44, r.h);
    }
  }
}

function paintPond(b: Buf, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) {
    for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d > 1.18) continue;
      if (d > 1) b.put(x, y, M.st1);
      else if (d > 0.82) b.put(x, y, M.wa2);
      else b.put(x, y, hash(x, y, 9) < 0.05 ? M.wa0 : y < cy - ry * 0.3 ? M.wa1 : M.wa2);
    }
  }
  // 연잎
  const rand = rng(51);
  for (let i = 0; i < 6; i++) {
    const x = cx + (rand() - 0.5) * rx * 1.3;
    const y = cy + (rand() - 0.5) * ry * 1.1;
    b.rect(x - 1, y, 3, 2, M.leaf1);
    b.put(x, y, M.leaf0);
    if (i % 2 === 0) b.put(x + 1, y - 1, M.pk1);
  }
}

// ── 풍경 도트 ─────────────────────────────────────────

function house(roof: 'tile' | 'thatch', lit = false): Spr {
  const s = new Spr(34, 30);
  const [r0, r1, r2] = roof === 'tile' ? [M.rf0, M.rf1, M.rf2] : [M.th0, M.th1, M.th2];
  // 벽 · 기둥
  s.rect(4, 14, 26, 13, M.wall1);
  s.rect(4, 14, 26, 2, M.wall2);
  s.rect(4, 14, 2, 13, M.wd1).rect(28, 14, 2, 13, M.wd1).rect(17, 14, 2, 13, M.wd1);
  // 장지문
  s.rect(7, 17, 8, 10, M.wall0);
  s.rect(10, 17, 1, 10, M.wall2).rect(13, 17, 1, 10, M.wall2).rect(7, 21, 8, 1, M.wall2);
  // 창
  s.rect(21, 18, 5, 5, M.wd2);
  s.rect(22, 19, 3, 3, lit ? M.gold0 : M.wall0);
  s.rect(23, 19, 1, 3, M.wd2);
  // 툇돌
  s.rect(3, 27, 28, 2, M.st1);
  s.rect(3, 27, 28, 1, M.st0);
  // 지붕
  s.poly([[0, 16], [6, 3], [28, 3], [34, 16]], r1);
  s.over((x, y, k) => (k !== r1 ? undefined : y === 4 || (y > 4 && y % 3 === 0 && (x + y) % 4 !== 0) ? r0 : y >= 14 ? r2 : roof === 'thatch' && (x * 3 + y) % 7 === 0 ? r2 : undefined));
  s.rect(6, 2, 22, 2, r2);
  s.outline();
  return s;
}

function sakura(): Spr {
  const s = new Spr(24, 28);
  s.rect(11, 16, 3, 11, M.wd2);
  s.line(12, 18, 6, 12, M.wd2).line(13, 17, 18, 11, M.wd2);
  for (const [x, y, r] of [[8, 10, 6], [16, 9, 6], [12, 6, 6], [6, 15, 4], [18, 14, 4]] as const) s.ellipse(x, y, r, r * 0.85, M.pk1);
  s.over((x, y, k) => (k === M.pk1 ? (x + y < 16 && (x + y * 2) % 3 !== 0 ? M.pk0 : x + y > 26 || y > 16 ? M.pk2 : undefined) : undefined));
  s.outline();
  return s;
}

function broadleaf(): Spr {
  const s = new Spr(22, 24);
  s.rect(10, 15, 3, 8, M.wd2);
  for (const [x, y, r] of [[7, 10, 6], [15, 10, 6], [11, 6, 6], [11, 13, 6]] as const) s.ellipse(x, y, r, r * 0.8, M.leaf1);
  s.over((x, y, k) => (k === M.leaf1 ? (x + y < 14 && (x * 2 + y) % 3 !== 0 ? M.leaf0 : x + y > 24 || y > 15 ? M.tree0 : undefined) : undefined));
  s.outline();
  return s;
}

function cedar(h = 32): Spr {
  const s = new Spr(16, h + 2);
  s.rect(7, h - 6, 2, 7, M.wd2);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const top = Math.round((i * (h - 8)) / tiers);
    const bot = top + Math.round((h - 6) / 2.2);
    const half = 3 + i * 1.6;
    s.poly([[8, top], [8 + half + 0.5, bot], [8 - half - 0.5, bot]], M.tree0);
  }
  s.over((x, _y, k) => (k === M.tree0 ? (x >= 9 ? M.tree1 : x <= 5 && x % 2 === 0 ? M.leaf1 : undefined) : undefined));
  s.outline();
  return s;
}

function pine(): Spr {
  const s = new Spr(18, 22);
  s.rect(8, 14, 2, 7, M.wd2);
  s.ellipse(9, 6, 6, 3, M.tree0).ellipse(5, 11, 5, 2.6, M.tree0).ellipse(13, 12, 5, 2.6, M.tree0).ellipse(9, 15, 7, 2.4, M.tree0);
  s.over((x, y, k) => (k === M.tree0 ? ((x + y) % 5 === 0 ? M.leaf1 : y % 4 === 3 ? M.tree1 : undefined) : undefined));
  s.outline();
  return s;
}

function bush(): Spr {
  const s = new Spr(14, 9);
  s.ellipse(4, 5, 4, 3.5, M.leaf1).ellipse(9, 4.5, 4.5, 4, M.leaf1);
  s.over((x, y, k) => (k === M.leaf1 ? (y < 3 && x % 2 === 0 ? M.leaf0 : y > 5 ? M.tree0 : undefined) : undefined));
  s.outline();
  return s;
}

function rock(w: number, h: number): Spr {
  const s = new Spr(w + 2, h + 2);
  s.ellipse((w + 2) / 2, h / 2 + 1.5, w / 2, h / 2, M.st1);
  s.over((x, y, k) => (k === M.st1 ? (y < h * 0.4 && x < w * 0.6 ? M.st0 : x > w * 0.6 || y > h * 0.75 ? M.st2 : undefined) : undefined));
  s.outline();
  return s;
}

function lantern(): Spr {
  const s = new Spr(10, 16);
  s.rect(2, 13, 6, 2, M.st1);
  s.rect(4, 8, 2, 5, M.st1);
  s.rect(2, 5, 6, 3, M.st1);
  s.rect(4, 6, 2, 1, M.gold1);
  s.poly([[0, 5], [5, 1], [10, 5]], M.st2);
  s.rect(4, 0, 2, 1, M.st2);
  s.over((x, _y, k) => (k === M.st1 && x >= 6 ? M.st2 : undefined));
  s.outline();
  return s;
}

function torii(w = 30, h = 30): Spr {
  const s = new Spr(w, h);
  s.rect(0, 1, w, 2, M.inkSoft);
  s.set(0, 0, M.inkSoft).set(w - 1, 0, M.inkSoft);
  s.rect(1, 3, w - 2, 2, M.red1);
  s.rect(3, 8, w - 6, 2, M.red1);
  s.rect(w / 2 - 2, 5, 4, 3, M.inkSoft);
  s.set(w / 2 - 1, 6, M.gold1).set(w / 2, 6, M.gold1);
  const px = Math.round(w * 0.2);
  for (const x of [px, w - px - 3]) {
    s.rect(x, 5, 3, h - 7, M.red1);
    s.rect(x + 2, 5, 1, h - 7, M.red2);
    s.rect(x - 1, h - 3, 5, 2, M.inkSoft);
  }
  s.outline();
  return s;
}

function scarecrow(): Spr {
  const s = new Spr(14, 18);
  s.rect(6, 6, 2, 12, M.wd1);
  s.rect(1, 8, 12, 2, M.wd1);
  s.rect(4, 9, 6, 5, M.rf1);
  s.ellipse(7, 4, 3, 3, M.wall0);
  s.poly([[1, 3], [7, -1], [13, 3]], M.th0);
  s.outline();
  return s;
}

function jizo(): Spr {
  const s = new Spr(10, 12);
  s.ellipse(5, 3.5, 2.6, 2.8, M.st1);
  s.ellipse(5, 8.5, 3.5, 3, M.st1);
  s.rect(3, 6, 5, 2, M.red1);
  s.rect(1, 10, 8, 2, M.st2);
  s.over((x, _y, k) => (k === M.st1 && x >= 6 ? M.st2 : undefined));
  s.outline();
  return s;
}

function mushroom(): Spr {
  const s = new Spr(7, 6);
  s.rect(3, 3, 1, 3, M.wall0);
  s.ellipse(3.5, 2.2, 3, 2, M.red1);
  s.set(2, 1, M.wall0).set(4, 2, M.wall0);
  s.outline();
  return s;
}

function fence(): Spr {
  const s = new Spr(26, 8);
  s.rect(0, 2, 26, 2, M.wd0).rect(0, 5, 26, 1, M.wd1);
  for (const x of [1, 9, 17, 24]) s.rect(x, 0, 2, 8, M.wd1);
  s.outline();
  return s;
}

function well(): Spr {
  const s = new Spr(18, 20);
  s.rect(3, 13, 12, 6, M.st1);
  s.rect(3, 13, 12, 1, M.st0);
  s.rect(5, 12, 8, 2, M.wa3);
  s.rect(3, 4, 2, 9, M.wd1).rect(13, 4, 2, 9, M.wd1);
  s.poly([[0, 5], [9, 0], [18, 5]], M.th1);
  s.rect(8, 5, 2, 4, M.wd2);
  s.over((x, y, k) => (k === M.st1 && (x + y) % 3 === 0 ? M.st2 : undefined));
  s.outline();
  return s;
}

/** 과자 가게 (붉은 노렌) */
function sweetShop(): Spr {
  const s = house('tile', true);
  s.rect(6, 16, 11, 5, M.red1);
  s.rect(9, 16, 1, 5, M.red2).rect(13, 16, 1, 5, M.red2);
  s.set(11, 18, M.wall0);
  return s;
}

/** 포장마차 */
function stall(): Spr {
  const s = new Spr(26, 22);
  s.rect(2, 13, 22, 6, M.wd1);
  s.rect(2, 13, 22, 1, M.wd0);
  s.ellipse(6, 19, 2.5, 2.5, M.wd2).ellipse(20, 19, 2.5, 2.5, M.wd2);
  s.rect(3, 4, 2, 9, M.wd2).rect(21, 4, 2, 9, M.wd2);
  s.rect(4, 6, 18, 4, M.rf1);
  s.rect(8, 6, 1, 4, M.rf2).rect(13, 6, 1, 4, M.rf2).rect(18, 6, 1, 4, M.rf2);
  s.poly([[0, 5], [3, 1], [23, 1], [26, 5]], M.red1);
  s.rect(0, 4, 26, 1, M.red2);
  s.ellipse(12, 11.5, 2, 1.5, M.gold1);
  s.outline();
  return s;
}

function hokora(): Spr {
  const s = new Spr(24, 22);
  s.rect(4, 10, 16, 9, M.wd1);
  s.rect(9, 12, 6, 7, M.wd2);
  s.set(11, 14, M.gold1).set(12, 14, M.gold1);
  s.poly([[0, 11], [12, 1], [24, 11]], M.red1);
  s.over((x, y, k) => (k === M.red1 && (x > 12 || y === 10) ? M.red2 : undefined));
  s.rect(2, 19, 20, 3, M.st1);
  s.rect(2, 19, 20, 1, M.st0);
  s.outline();
  return s;
}

function bridge(): Spr {
  const s = new Spr(26, 12);
  s.rect(1, 3, 24, 7, M.wd0);
  for (let x = 1; x < 25; x += 3) s.rect(x, 3, 1, 7, M.wd1);
  s.rect(0, 1, 26, 2, M.red1).rect(0, 10, 26, 2, M.red1);
  s.rect(0, 2, 26, 1, M.red2).rect(0, 11, 26, 1, M.red2);
  for (const x of [0, 12, 24]) s.rect(x, 0, 2, 3, M.red2).rect(x, 9, 2, 3, M.red2);
  s.outline();
  return s;
}

function signPosts(): Spr {
  const s = new Spr(22, 12);
  s.rect(4, 0, 2, 11, M.wd1).rect(16, 0, 2, 11, M.wd1);
  s.rect(5, 0, 1, 11, M.wd2).rect(17, 0, 1, 11, M.wd2);
  s.outline();
  return s;
}

/** 1장 두루마리 지도 1920×360 */
export function chapter1World(): HTMLCanvasElement {
  const b = new Buf(MAP_W, MAP_H);
  paintBackdrop(b);
  paintGround(b);
  paintDetails(b);
  paintStream(b);
  paintPaddies(b);
  paintPond(b, 300, 330, 32, 12);
  paintTreeline(b);

  const c = document.createElement('canvas');
  c.width = MAP_W;
  c.height = MAP_H;
  const g = c.getContext('2d')!;
  g.putImageData(b.img, 0, 0);

  // 풍경 도트 — 아래(앞)에 있는 것일수록 나중에 찍는다
  const props: { art: HTMLCanvasElement; x: number; y: number }[] = [];
  const cache = new Map<string, HTMLCanvasElement>();
  const art = (key: string, make: () => Spr) => {
    let a = cache.get(key);
    if (!a) cache.set(key, (a = make().canvas()));
    return a;
  };
  const put = (key: string, make: () => Spr, x: number, y: number) => props.push({ art: art(key, make), x, y });
  const rand = rng(61);
  const r = (a: number, z: number) => a + rand() * (z - a);
  /** 노드 기둥(층 위치)과 겹치지 않는 가로 위치인지 */
  const clearOfNodes = (x: number, pad = 34) => {
    for (let l = 0; l < 15; l++) if (Math.abs(x - layerX(l)) < pad) return false;
    return true;
  };

  // 신사 마을 — 위·아래 띠에 집과 벚꽃, 입구 토리이
  put('torii-big', () => torii(36, 36), 26, 222);
  put('lantern', lantern, 12, 236);
  put('lantern', lantern, 46, 236);
  for (const [x, y, k] of [[44, 116, 'tile'], [140, 112, 'thatch'], [262, 118, 'tile'], [392, 114, 'thatch'], [470, 120, 'tile']] as const) {
    put(`house-${k}`, () => house(k), x, y);
  }
  for (const [x, y, k] of [[150, 352, 'tile'], [420, 350, 'thatch']] as const) put(`house-${k}-lit`, () => house(k, true), x, y);
  for (const [x, y] of [[96, 106], [196, 110], [330, 104], [438, 108], [70, 338], [236, 312], [366, 330], [486, 344]]) put('sakura', sakura, x, y);
  // 마을 안쪽 (노드 사이 빈 자리)
  put('house-tile', () => house('tile'), 143, 168);
  put('house-thatch', () => house('thatch'), 269, 166);
  put('house-tile-lit', () => house('tile', true), 395, 292);
  put('well', well, 143, 292);
  for (const [x, y] of [[143, 178], [269, 176], [395, 302], [270, 262]]) put('fence', fence, x, y);
  for (const [x, y] of [[120, 250], [282, 290], [410, 160]]) put('bush', bush, x, y);

  // 논두렁 — 논, 개울, 다리, 허수아비, 과자 가게
  put('house-thatch', () => house('thatch'), 560, 116);
  put('house-thatch', () => house('thatch'), 930, 118);
  for (const [x, y] of [[548, 312], [870, 104], [610, 338], [960, 340]]) put('scarecrow', scarecrow, x, y);
  put('sweet-shop', sweetShop, 742, 352);
  for (const [x, y] of [[772, 160], [900, 258], [520, 260]]) put('bush', bush, x, y);
  for (const [x, y] of [[700, 120], [820, 122], [1000, 110]]) put('broadleaf', broadleaf, x, y);

  // 삼나무 숲 — 위·아래 띠는 빽빽하게, 가운데는 듬성듬성
  for (let x = 1012; x < 1470; x += 13) {
    put('cedar', () => cedar(32), x + r(-4, 4), r(100, 124));
    if (rand() < 0.6) put('cedar-s', () => cedar(24), x + r(-4, 4), r(110, 128));
    if (Math.abs(x - 1016) > 26) put('cedar', () => cedar(32), x + r(-4, 4), r(318, 360));
    if (rand() < 0.5 && Math.abs(x - 1016) > 26) put('cedar-s', () => cedar(24), x + r(-4, 4), r(300, 330));
  }
  for (let i = 0; i < 9; i++) {
    const x = r(1030, 1440);
    if (clearOfNodes(x)) put(rand() < 0.5 ? 'cedar' : 'broadleaf', rand() < 0.5 ? () => cedar(32) : broadleaf, x, r(160, 280));
  }
  put('stall', stall, 1074, 300);
  for (const [x, y] of [[1150, 214], [1280, 176]]) put('jizo', jizo, x, y);
  for (let i = 0; i < 14; i++) {
    const x = r(1020, 1450);
    if (clearOfNodes(x, 22)) put('mushroom', mushroom, x, r(140, 296));
  }

  // 야마비코 산 — 바위, 소나무, 정상 사당
  for (let i = 0; i < 18; i++) {
    const x = r(1470, 1910);
    const top = rand() < 0.5;
    const y = top ? r(98, 124) : r(300, 360);
    if (rand() < 0.45) put('pine', pine, x, y);
    else put(`rock-${i % 3}`, () => rock(10 + (i % 3) * 5, 6 + (i % 3) * 3), x, y);
  }
  for (let i = 0; i < 6; i++) {
    const x = r(1480, 1900);
    if (clearOfNodes(x)) put('rock-1', () => rock(15, 9), x, r(160, 270));
  }
  put('torii-peak', () => torii(30, 30), 1844, 150);
  put('hokora', hokora, 1894, 122);
  put('lantern', lantern, 1820, 150);
  put('lantern', lantern, 1868, 150);

  // 간판 기둥 (간판 글자는 화면 층에서 올린다)
  for (const s of CHAPTER1_SIGNS) put('sign-posts', signPosts, s.x, s.y + 11);

  props.sort((p, q) => p.y - q.y);
  for (const p of props) g.drawImage(p.art, Math.round(p.x - p.art.width / 2), Math.round(p.y - p.art.height));
  return c;
}

/** 개울 다리 — 길(4층 → 5층)이 개울을 건너는 자리 */
export function streamBridge(): { art: HTMLCanvasElement; x: number; y: number } {
  const a = { x: layerX(4), y: spineY(4) };
  const z = { x: layerX(5), y: spineY(5) };
  let best: [number, number] = [0, 0];
  let gap = Infinity;
  for (let t = 0; t <= 1; t += 0.005) {
    const [x, y] = trailPoint(a, z, t);
    const d = Math.abs(x - streamX(y));
    if (d < gap) {
      gap = d;
      best = [x, y];
    }
  }
  return { art: bridge().canvas(), x: Math.round(best[0]), y: Math.round(best[1]) };
}

/** 좌우 두루마리 축 12×360 */
export function scrollRollerV(): HTMLCanvasElement {
  const s = new Spr(12, MAP_H);
  s.rect(0, 0, 12, MAP_H, M.ink);
  s.rect(2, 0, 8, MAP_H, M.wd1);
  s.rect(3, 0, 2, MAP_H, M.wd0);
  s.rect(8, 0, 1, MAP_H, M.wd2);
  for (const y of [0, MAP_H - 14]) {
    s.rect(0, y, 12, 14, M.ink);
    s.rect(1, y + 1, 10, 12, M.wd2);
    s.rect(3, y + 3, 2, 8, M.gold1);
  }
  return s.canvas();
}

// ── 노드 그림 ─────────────────────────────────────────

/** 노드 받침돌 */
export function nodePedestal(): HTMLCanvasElement {
  const s = new Spr(30, 11);
  s.ellipse(15, 5.5, 13.5, 4.5, M.st2);
  s.ellipse(15, 4.5, 13, 3.8, M.st1);
  s.ellipse(13, 4, 9, 2.4, M.st0);
  s.outline();
  return s.canvas();
}

/** 갈 수 있는 노드 아래 금빛 고리 */
export function nodeRing(): HTMLCanvasElement {
  const s = new Spr(44, 18);
  s.ellipse(22, 9, 20, 8, M.gold1);
  s.ellipse(22, 9, 15.5, 4.8, null);
  s.over((_x, y, k) => (k === M.gold1 && y < 6 ? M.gold0 : k === M.gold1 && y > 12 ? M.gold2 : undefined));
  s.outline(M.gold2);
  return s.canvas();
}

function kura(ruined: boolean): Spr {
  const s = new Spr(26, 26);
  const wall = ruined ? M.st0 : M.wall0;
  // 벽 + 아래 나마코벽(격자 무늬)
  s.rect(4, 10, 18, 14, wall);
  s.rect(4, 10, 18, 1, M.wall2);
  s.rect(4, 18, 18, 6, M.st1);
  s.over((x, y, k) => (k === M.st1 && y >= 18 && ((x + y) % 4 === 0 || (x - y + 40) % 4 === 0) ? wall : undefined));
  // 문
  s.rect(10, 13, 6, 11, M.wd1);
  s.rect(10, 13, 6, 1, M.wd2).rect(12, 14, 2, 10, M.wd2);
  if (!ruined) s.rect(12, 16, 2, 2, M.gold1).set(12, 16, M.gold0);
  // 지붕
  const r1 = ruined ? M.st2 : M.rf1;
  s.poly([[1, 11], [5, 4], [21, 4], [25, 11]], r1);
  s.over((_x, y, k) => (k === r1 ? (y === 5 ? (ruined ? M.st1 : M.rf0) : y === 8 || y === 10 ? (ruined ? M.st3 : M.rf2) : undefined) : undefined));
  s.rect(4, 2, 18, 2, ruined ? M.st3 : M.rf2);
  s.rect(3, 1, 2, 2, ruined ? M.st3 : M.rf2).rect(21, 1, 2, 2, ruined ? M.st3 : M.rf2);
  if (ruined) {
    // 무너진 지붕과 벽 금
    s.poly([[13, 1], [24, 1], [24, 9], [17, 6]], null);
    s.line(6, 12, 8, 16, M.st3).line(19, 11, 18, 15, M.st3);
    s.ellipse(22, 23.5, 3, 2, M.st1).ellipse(4, 24, 2.5, 1.6, M.st2);
  } else {
    // 지붕 위 두루마리 표식
    s.rect(11, 0, 4, 2, M.gold1).set(11, 0, M.gold0);
  }
  s.outline();
  return s;
}

function iconRaid(): Spr {
  const s = new Spr(24, 26);
  s.ellipse(12, 17, 8.5, 7.5, M.red1);
  s.poly([[4, 15], [9, 6], [12, 1], [14, 7], [17, 4], [20, 15]], M.red1);
  s.ellipse(11, 16, 5.5, 5, M.red0);
  s.poly([[7, 15], [11, 6], [14, 15]], M.red0);
  s.ellipse(10, 17, 2.5, 2.5, M.fi1);
  s.over((x, y, k) => (k === M.red1 && x > 16 && y > 10 ? M.red2 : undefined));
  // 성난 눈 · 입
  s.rect(8, 15, 2, 3, M.ink).rect(14, 15, 2, 3, M.ink);
  s.set(7, 14, M.ink).set(16, 14, M.ink);
  s.set(8, 15, M.wall0).set(15, 15, M.wall0);
  s.rect(10, 20, 4, 1, M.ink);
  s.set(10, 21, M.wall0).set(13, 21, M.wall0);
  s.outline();
  return s;
}

function iconTrial(): Spr {
  const s = torii(26, 26);
  // 금줄
  s.rect(7, 11, 12, 1, M.wall1);
  s.set(9, 12, M.wall0).set(9, 13, M.wall0).set(13, 12, M.wall0).set(13, 13, M.wall0).set(17, 12, M.wall0).set(17, 13, M.wall0);
  return s;
}

function iconFox(): Spr {
  const s = new Spr(24, 24);
  // 꼬리
  s.ellipse(18, 17, 4.5, 5.5, M.fox1);
  s.ellipse(19, 12.5, 2.5, 2.5, M.wall0);
  // 몸 · 머리 · 귀
  s.ellipse(10, 17, 6, 6, M.fox1);
  s.ellipse(10, 16, 3, 3.5, M.wall0);
  s.ellipse(11, 9, 5.5, 4.5, M.fox1);
  s.poly([[6, 7], [6, 1], [10, 5]], M.fox1).poly([[12, 5], [16, 1], [16, 7]], M.fox1);
  s.set(7, 4, M.fox2).set(7, 5, M.fox2).set(15, 4, M.fox2).set(15, 5, M.fox2);
  s.ellipse(12.5, 11, 3, 2, M.wall0);
  s.over((x, y, k) => (k === M.fox1 && (x + y) % 9 === 0 && x < 9 ? M.fox0 : k === M.fox1 && x > 14 && y < 11 ? M.fox2 : undefined));
  s.set(9, 9, M.ink).set(14, 9, M.ink).set(13, 11, M.ink);
  s.rect(6, 22, 3, 1, M.fox2).rect(11, 22, 3, 1, M.fox2);
  s.outline();
  // 여우불 (외곽선 없이 빛나게)
  s.ellipse(21, 4, 2, 2.5, M.wa1).set(21, 1, M.wa1).set(21, 4, M.wa0);
  return s;
}

function iconEvent(): Spr {
  const s = new Spr(24, 26);
  s.rect(5, 10, 2, 15, M.wd1).rect(17, 10, 2, 15, M.wd1);
  s.rect(2, 6, 20, 12, M.wd0);
  s.rect(2, 6, 20, 1, M.wd1).rect(2, 17, 20, 1, M.wd1);
  s.rect(4, 8, 5, 7, M.wall0).rect(15, 9, 5, 6, M.wall0);
  s.pattern(9, 7, ['.###.', '##.##', '...##', '..##.', '..#..', '.....', '..#..'], M.red1);
  s.poly([[0, 7], [4, 2], [20, 2], [24, 7]], M.wd2);
  s.outline();
  return s;
}

function iconShop(): Spr {
  const s = new Spr(26, 26);
  // 붉은 우산
  s.poly([[1, 10], [13, 1], [25, 10]], M.red1);
  s.over((x, y, k) => (k === M.red1 ? (x > 14 ? M.red2 : x < 8 && y > 5 ? M.red0 : undefined) : undefined));
  for (const x of [5, 9, 17, 21]) s.line(13, 2, x, 10, M.red2);
  s.rect(13, 10, 1, 8, M.wd1);
  // 붉은 천 깐 평상 + 찻잔 + 경단
  s.rect(2, 18, 22, 3, M.red1);
  s.rect(2, 18, 22, 1, M.red0);
  s.rect(4, 21, 2, 4, M.wd2).rect(20, 21, 2, 4, M.wd2);
  s.rect(6, 15, 3, 3, M.cu1).rect(6, 15, 3, 1, M.cu0);
  s.line(16, 17, 21, 13, M.wd0);
  s.set(17, 15, M.pk1).set(18, 15, M.pk1).set(19, 14, M.wall0).set(20, 13, M.sprout0);
  s.outline();
  return s;
}

function iconSpring(): Spr {
  const s = new Spr(26, 22);
  s.ellipse(13, 15, 12, 5.5, M.st1);
  s.over((x, y, k) => (k === M.st1 && (x > 18 || y > 17) ? M.st2 : k === M.st1 && y < 12 ? M.st0 : undefined));
  s.ellipse(13, 15, 9, 3.6, M.wa1);
  s.ellipse(11, 14, 4, 1.4, M.wa0);
  s.outline();
  // 김
  for (const sx of [8, 13, 18]) for (let y = 2; y < 11; y++) if (y % 4 !== 0) s.set(sx + Math.round(Math.sin(y * 0.9 + sx) * 1.2), y, M.wall0);
  return s;
}

function iconShrine(): Spr {
  const s = new Spr(26, 26);
  // 동판 지붕
  s.poly([[0, 11], [5, 4], [21, 4], [26, 11]], M.cu1);
  s.over((x, y, k) => (k === M.cu1 ? (y === 5 ? M.cu0 : y >= 10 || (y === 8 && x % 2 === 0) ? M.cu2 : undefined) : undefined));
  s.rect(4, 3, 18, 1, M.cu2);
  s.line(3, 0, 6, 3, M.cu2).line(22, 0, 19, 3, M.cu2);
  s.set(13, 2, M.gold1);
  // 붉은 기둥 · 안 · 방울
  s.rect(5, 11, 16, 8, M.wall0);
  s.rect(9, 13, 8, 6, M.inkSoft);
  s.rect(4, 11, 2, 10, M.red1).rect(20, 11, 2, 10, M.red1);
  s.rect(6, 11, 14, 1, M.wall1);
  s.ellipse(13, 13, 1.6, 1.6, M.gold1);
  s.rect(13, 14, 1, 4, M.red0);
  // 계단
  s.rect(3, 21, 20, 2, M.st1).rect(5, 19, 16, 2, M.st0);
  s.outline();
  return s;
}

function iconGrudge(): Spr {
  const s = new Spr(24, 26);
  s.ellipse(12, 16, 9, 8.5, M.pu2);
  s.poly([[3, 14], [7, 4], [11, 8], [13, 0], [16, 7], [21, 14]], M.pu2);
  s.over((x, y, k) => (k === M.pu2 && x < 10 && y > 6 && y < 14 && (x + y) % 3 === 0 ? M.pu1 : undefined));
  // 해골 얼굴
  s.ellipse(12, 16, 5.5, 5, M.pu0);
  s.rect(9, 20, 6, 2, M.pu0);
  s.rect(8, 14, 3, 3, M.ink).rect(13, 14, 3, 3, M.ink);
  s.set(9, 15, M.red0).set(14, 15, M.red0);
  s.set(12, 18, M.ink);
  s.set(10, 21, M.ink).set(12, 21, M.ink);
  s.outline();
  for (const [x, y] of [[1, 6], [22, 9], [20, 2]]) s.set(x, y, M.pu1);
  return s;
}

function iconRest(): Spr {
  const s = new Spr(26, 20);
  s.ellipse(13, 15.5, 10, 3.6, M.st1);
  s.ellipse(13, 15.5, 7, 2.2, M.inkSoft);
  s.line(7, 17, 18, 13, M.wd1).line(7, 13, 19, 17, M.wd1);
  s.poly([[8, 15], [11, 7], [13, 1], [15, 6], [18, 15]], M.fi2);
  s.poly([[10, 15], [13, 6], [16, 15]], M.fi1);
  s.rect(12, 11, 2, 4, M.fi0);
  s.outline();
  return s;
}

/** 야마비코 얼굴 (보스) */
function iconBoss(): Spr {
  const s = new Spr(32, 30);
  // 귀
  s.ellipse(5, 10, 4.5, 5, M.fur1).ellipse(5, 10.5, 2.4, 3, M.skin1);
  s.ellipse(27, 10, 4.5, 5, M.fur1).ellipse(27, 10.5, 2.4, 3, M.skin1);
  // 털 머리
  s.ellipse(16, 15, 12, 12, M.fur1);
  s.over((x, y, k) => (k === M.fur1 ? ((x * 3 + y * 2) % 7 === 0 ? M.fur0 : (x + y * 3) % 11 === 0 ? M.fur2 : undefined) : undefined));
  // 얼굴
  s.ellipse(16, 17, 8, 7, M.skin0);
  s.ellipse(16, 21, 5, 3.5, M.skin1);
  s.rect(9, 11, 5, 2, M.fur2).rect(18, 11, 5, 2, M.fur2);
  s.rect(10, 13, 3, 4, M.ink).rect(19, 13, 3, 4, M.ink);
  s.set(11, 14, M.gold1).set(20, 14, M.gold1).set(11, 13, M.wall0).set(20, 13, M.wall0);
  // 외치는 입
  s.ellipse(16, 22, 3.2, 2.6, M.red2);
  s.rect(14, 20, 1, 1, M.wall0).rect(18, 20, 1, 1, M.wall0);
  s.outline();
  return s;
}

/** 노드 종류별 그림 (콘을 만나는 이야기 노드는 여우) */
export function nodeIcon(kind: NodeKind | 'fox'): HTMLCanvasElement {
  const make: Record<NodeKind | 'fox', () => Spr> = {
    prologue: () => kura(true),
    library: () => kura(false),
    raid: iconRaid,
    trial: iconTrial,
    story: iconEvent,
    fox: iconFox,
    event: iconEvent,
    shop: iconShop,
    spring: iconSpring,
    shrine: iconShrine,
    grudge: iconGrudge,
    rest: iconRest,
    boss: iconBoss,
  };
  return make[kind]().canvas();
}
