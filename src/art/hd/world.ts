import { PixelGrid } from './grid';
import { canvas, rect, px, PalKey } from '../pixel';

// ── 히토다마 24×24 (2프레임, 꼬리가 흔들림) ───────────────────
function hitodama(sway: number): PixelGrid {
  const g = new PixelGrid(24, 24);
  g.poly([[5, 14], [12 + sway, 1], [19, 14]], 'P');
  g.ellipse(12, 15.5, 8, 7, 'P');
  g.poly([[8, 13], [12 + sway, 5], [16, 13]], 'L');
  g.ellipse(12, 15.5, 5.5, 5, 'L');
  g.ellipse(11, 14, 2.5, 2, 'W');
  // 얼굴
  g.rect(8, 15, 2, 3, 'K').rect(14, 15, 2, 3, 'K');
  g.set(9, 15, 'L').set(15, 15, 'L');
  g.rect(11, 19, 2, 1, 'p');
  g.outline('p');
  return g;
}
export const hitodamaFrames = (): PixelGrid[] => [hitodama(-1), hitodama(1)];

// ── 카사오바케 28×32 (외눈 우산 요괴, 2프레임: 웅크림 · 도약) ───────
function kasa(jump: boolean): PixelGrid {
  const g = new PixelGrid(28, 32);
  const lift = jump ? 3 : 0;
  // 외다리 + 게타
  if (jump) g.rect(13, 21, 2, 8, 'S');
  else g.rect(13, 22, 2, 4, 'S').rect(12, 26, 2, 3, 'S');
  g.rect(10, 29, 8, 2, 'B').rect(11, 31, 2, 1, 'd').rect(15, 31, 2, 1, 'd');
  // 우산 (남색 기름종이 + 살)
  const top = 1 + (jump ? 0 : lift);
  g.poly([[1, 21 - lift], [14, top], [27, 21 - lift]], 'N');
  for (const x of [5, 10, 18, 23]) g.line(14, top + 1, x, 20 - lift, 'n');
  g.paintOver((x, y, k) => (k === 'N' && x < 9 && y > 10 && (x + y) % 3 === 0 ? 'E' : k === 'N' && x > 18 ? 'n' : null));
  g.rect(1, 20 - lift, 26, 2, 'n');
  g.rect(13, top - 1, 2, 2, 'B');
  // 외눈 · 혀
  g.ellipse(14, 12 - lift / 2, 4, 3.5, 'L');
  g.rect(13, 11 - lift / 2, 3, 3, 'K');
  g.set(14, 11 - lift / 2, 'W');
  g.rect(12, 17 - lift, 4, 2, 'K');
  g.rect(13, 19 - lift, 3, jump ? 2 : 4, 'R');
  g.outline('K');
  return g;
}
export const kasaFrames = (): PixelGrid[] => [kasa(false), kasa(true)];

// ── 짚 허수아비 32×32 (전투 샘플 과녁) ─────────────────────────
export function makiwara(): PixelGrid {
  const g = new PixelGrid(32, 32);
  g.rect(14, 22, 4, 8, 'B');
  g.rect(15, 22, 1, 8, 'b');
  g.rect(10, 29, 12, 2, 'd');
  g.ellipse(16, 13, 6, 10, 'G');
  g.paintOver((x, y, k) => (k === 'G' && (x + y) % 3 === 0 ? 'g' : null));
  g.rect(10, 9, 12, 2, 'r').rect(10, 17, 12, 2, 'r');
  g.outline('K');
  return g;
}

// ── 부적 투사체 8×12 ─────────────────────────────────────
export function ofudaShot(): PixelGrid {
  const g = new PixelGrid(8, 12);
  g.rect(1, 1, 6, 10, 'W');
  g.rect(1, 1, 6, 1, 'L');
  g.rect(3, 3, 2, 2, 'R').rect(3, 6, 2, 1, 'R').rect(3, 8, 2, 2, 'R');
  g.outline('K');
  return g;
}

// ── 여우불 12×14 ─────────────────────────────────────
export function foxfire(): PixelGrid {
  const g = new PixelGrid(12, 14);
  g.poly([[2, 9], [6, 0], [10, 9]], 'C');
  g.ellipse(6, 9, 4.5, 4, 'C');
  g.poly([[4, 9], [6, 4], [8, 9]], 'L');
  g.ellipse(6, 9.5, 2.5, 2.5, 'L');
  g.set(6, 9, 'W');
  g.outline('c');
  return g;
}

// ── 장애물 ─────────────────────────────────────────────
export function stoneLantern(): PixelGrid {
  const g = new PixelGrid(24, 40);
  g.poly([[2, 9], [12, 2], [22, 9]], 'Y');
  g.rect(3, 9, 18, 2, 'y');
  g.rect(5, 11, 14, 9, 'Y');
  g.rect(8, 13, 8, 5, 'G');
  g.rect(9, 14, 6, 3, 'L');
  g.rect(3, 20, 18, 2, 'y');
  g.rect(9, 22, 6, 11, 'Y');
  g.rect(9, 22, 2, 11, 'w');
  g.rect(5, 33, 14, 4, 'y');
  g.outline('K');
  return g;
}

export function rock(): PixelGrid {
  const g = new PixelGrid(32, 22);
  g.ellipse(16, 13, 14, 8.5, 'Y');
  g.ellipse(13, 10, 8, 5, 'W');
  g.ellipse(13, 10, 7, 4, 'Y');
  g.ellipse(19, 16, 9, 4, 'y');
  g.set(9, 8, 'L').set(10, 8, 'L');
  g.outline('K');
  return g;
}

export function pine(): PixelGrid {
  const g = new PixelGrid(48, 64);
  g.rect(21, 44, 6, 18, 'B');
  g.rect(22, 44, 2, 18, 'b');
  for (const [cy, rx] of [[42, 20], [32, 17], [22, 13], [13, 9]] as const) {
    g.ellipse(24, cy, rx, 7, 'e');
    g.ellipse(22, cy - 2, rx - 4, 4, 'E');
  }
  g.outline('K');
  return g;
}

/** 먼지·파편 한 점 (넉백 이펙트) */
export function dust(k: PalKey): HTMLCanvasElement {
  const [c, g] = canvas(2, 2);
  rect(g, 0, 0, 2, 2, k);
  return c;
}

// ── 아레나 바닥: 신사 경내 (화면 3배, 1920×1080) ───────────────
export const SANDBOX_W = 1920;
export const SANDBOX_H = 1080;

export function sandboxGround(): HTMLCanvasElement {
  const [c, g] = canvas(SANDBOX_W, SANDBOX_H);
  rect(g, 0, 0, SANDBOX_W, SANDBOX_H, 'v');
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // 자갈 알갱이
  for (let i = 0; i < 26000; i++) {
    const x = Math.floor(rnd() * SANDBOX_W);
    const y = Math.floor(rnd() * SANDBOX_H);
    const r = rnd();
    px(g, x, y, r < 0.45 ? 'w' : r < 0.75 ? 'W' : 'g');
    if (r < 0.2) px(g, x + 1, y, 'w');
  }
  // 갈퀴 무늬
  for (let y = 40; y < SANDBOX_H; y += 10) {
    for (let x = 0; x < SANDBOX_W; x++) {
      const wy = y + Math.round(Math.sin(x / 40) * 2);
      if (x % 4 !== 0) px(g, x, wy, 'w');
    }
  }
  // 디딤돌 길
  for (let i = 0; i < 30; i++) {
    const x = 940 + Math.round(Math.sin(i / 3) * 40);
    const y = 1040 - i * 34;
    g.fillStyle = '#1b1626';
    g.beginPath();
    g.ellipse(x, y + 1, 15, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#a3a1b5';
    g.beginPath();
    g.ellipse(x, y, 14, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c4c2d4';
    g.fillRect(x - 6, y - 4, 6, 2);
  }
  // 가장자리 어둡게
  const edge = g.createRadialGradient(SANDBOX_W / 2, SANDBOX_H / 2, 300, SANDBOX_W / 2, SANDBOX_H / 2, 1150);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(12,10,18,0.55)');
  g.fillStyle = edge;
  g.fillRect(0, 0, SANDBOX_W, SANDBOX_H);
  return c;
}
