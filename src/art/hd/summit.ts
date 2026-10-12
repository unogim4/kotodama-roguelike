import { Spr, M, torii, lantern, pine, rock, hokoraArt } from './worldMap';

/**
 * 야마비코 산 정상 싸움터 1280×720 (저녁노을 · 바위 땅 · 눈 덩어리 · 무너진 토리이 · 사당).
 * 가장자리는 낭떠러지(어둡게)라 그 안에서만 싸운다.
 */
export const SUMMIT_W = 1280;
export const SUMMIT_H = 720;
/** 싸울 수 있는 범위 (낭떠러지 안쪽) */
export const ARENA = { x: 56, y: 150, w: SUMMIT_W - 112, h: SUMMIT_H - 196 };

function hash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(x: number, y: number, s: number): number {
  const fx = x / s;
  const fy = y / s;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const u = fx - x0;
  const v = fy - y0;
  const a = hash(x0, y0);
  const b = hash(x0 + 1, y0);
  const c = hash(x0, y0 + 1);
  const d = hash(x0 + 1, y0 + 1);
  const sm = (t: number) => t * t * (3 - 2 * t);
  return a + (b - a) * sm(u) + (c - a) * sm(v) + (a - b - c + d) * sm(u) * sm(v);
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export function summitGround(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SUMMIT_W;
  c.height = SUMMIT_H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(SUMMIT_W, SUMMIT_H);
  const d = img.data;
  const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const rock3 = ['#a39784', '#92877a', '#82786c'].map(rgb);
  const sky = M.dusk.map(rgb);
  const cliff = [rgb('#3a2a50'), rgb('#2a1e3c')];
  for (let y = 0; y < SUMMIT_H; y++) {
    for (let x = 0; x < SUMMIT_W; x++) {
      const i = (y * SUMMIT_W + x) * 4;
      const dith = BAYER[(y & 3) * 4 + (x & 3)];
      // 위쪽은 노을 하늘 (봉우리 너머)
      const ridge = 92 + Math.round(smooth(x, 0, 90) * 40 + smooth(x, 3, 23) * 10);
      let col: number[];
      if (y < ridge) {
        const t = Math.max(0, Math.min(4, Math.floor((y / ridge) * 5 + (dith - 0.5))));
        col = sky[t];
      } else {
        // 가장자리 낭떠러지 (어둡게)
        const edge = Math.min(x - 20, SUMMIT_W - 20 - x, SUMMIT_H - 16 - y) + (smooth(x, y, 30) - 0.5) * 30;
        if (edge < 14) col = cliff[edge < 4 ? 1 : 0];
        else if (y < ridge + 6) col = rock3[2];
        else {
          // 넓고 차분한 결 (대비를 낮춰 얼룩지지 않게)
          const t = smooth(x, y, 130) * 0.8 + smooth(x, y, 31) * 0.2;
          col = rock3[Math.max(0, Math.min(2, Math.floor(t * 3 + (dith - 0.5) * 0.6)))];
        }
      }
      d[i] = col[0];
      d[i + 1] = col[1];
      d[i + 2] = col[2];
      d[i + 3] = 255;
    }
  }
  // 자갈 · 균열
  let seed = 17;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const px = (x: number, y: number, c: number[]) => {
    if (x < 0 || y < 0 || x >= SUMMIT_W || y >= SUMMIT_H) return;
    const i = (y * SUMMIT_W + x) * 4;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
  };
  const dark = rgb('#6c6458');
  const light = rgb('#c4b8a4');
  for (let k = 0; k < 2200; k++) {
    const x = Math.floor(ARENA.x + rnd() * ARENA.w);
    const y = Math.floor(ARENA.y + rnd() * ARENA.h);
    px(x, y, dark);
    px(x + 1, y, dark);
    px(x, y - 1, light);
  }
  for (let k = 0; k < 70; k++) {
    let x = ARENA.x + rnd() * ARENA.w;
    let y = ARENA.y + rnd() * ARENA.h;
    const len = 8 + Math.floor(rnd() * 16);
    for (let j = 0; j < len; j++) {
      px(Math.round(x), Math.round(y), dark);
      x += rnd() < 0.6 ? 1 : 0;
      y += rnd() < 0.5 ? 1 : rnd() < 0.5 ? -1 : 0;
    }
  }
  g.putImageData(img, 0, 0);
  const put = (s: Spr, x: number, y: number) => {
    const a = s.canvas();
    g.drawImage(a, Math.round(x - a.width / 2), Math.round(y - a.height));
  };
  // 정상의 사당 · 기울어진 토리이 · 석등 · 금줄
  put(hokoraArt(), 640, 140);
  const t = torii(64, 66).canvas();
  g.save();
  g.translate(420, 150);
  g.rotate(-0.12);
  g.drawImage(t, -32, -66);
  g.restore();
  put(lantern(), 580, 150);
  put(lantern(), 700, 150);
  for (const [x, y] of [[160, 170], [1110, 180], [90, 640], [1190, 650]]) put(pine(), x, y);
  for (const [x, y, w] of [[260, 260, 44], [930, 300, 36], [1040, 560, 52], [220, 520, 30], [700, 640, 40], [480, 420, 26], [860, 200, 30]]) {
    const sn = new Spr(w + 4, Math.round(w / 3) + 4);
    sn.ellipse((w + 4) / 2, (w / 3 + 4) / 2, w / 2, w / 6, M.snow);
    sn.over((xx, yy, k) => (k === M.snow && (yy > w / 5 || xx > w * 0.7) ? M.snowShade : undefined));
    sn.outline('#8a8aa0');
    put(sn, x, y);
  }
  for (const [x, y, w, h] of [[300, 690, 30, 16], [980, 700, 26, 14], [1100, 420, 22, 12], [140, 400, 24, 14]]) put(rock(w, h), x, y);
  return c;
}

/** 메아리 바닥 돌판 52×28 (2페이즈 퀴즈) */
export function echoTile(): HTMLCanvasElement {
  const s = new Spr(52, 28);
  s.ellipse(26, 15, 25, 12, M.st2);
  s.ellipse(26, 13, 24, 11, M.st1);
  s.ellipse(24, 11, 18, 7, M.st0);
  s.outline();
  return s.canvas();
}
