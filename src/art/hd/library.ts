import { Spr, M } from './worldMap';

/**
 * 32px 서고 (리마스터) — 640×360 한 화면.
 * 뒤 벽(나무 판벽 · 서가 · 족자 고리 · 오른쪽 장지문) + 마루 + 받침대 · 봉인 두루마리 · 족자.
 */

export const LIB = {
  /** 벽과 마루가 만나는 높이 */
  floorY: 150,
  /** 족자 고리(상인방 아래) */
  hookY: 28,
  /** 오른쪽 장지문 */
  door: { x: 546, y: 74, w: 56, h: 76 },
};

/** 실내 전용 색 */
const I = {
  board0: '#5e4232',
  board1: '#4c3428',
  board2: '#3a281e',
  seam: '#2a1c16',
  plank0: '#a8743f',
  plank1: '#946236',
  plank2: '#7c502c',
  plankSeam: '#4e321e',
  light: '#fff2c8',
  lightEdge: '#f0d89a',
};

function shade3(x: number, y: number, a: string, b: string, c: string, t: number): string {
  const d = ((x * 7 + y * 13) % 5) / 5;
  return t + d * 0.3 < 0.45 ? a : t + d * 0.3 < 0.85 ? b : c;
}

/** 방 전체 배경 640×360 */
export function libraryRoom(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 360;
  const g = c.getContext('2d')!;
  const px = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  const rect = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  const F = LIB.floorY;

  // 뒤 벽: 세로 판벽
  for (let x = 0; x < 640; x++) {
    const board = Math.floor(x / 22);
    const edge = x % 22;
    for (let y = 0; y < F; y++) {
      let col = (board * 37 + Math.floor(y / 9) * 3) % 7 < 3 ? I.board0 : I.board1;
      if ((x * 3 + y * 5 + board * 11) % 23 === 0) col = I.board2;
      if (edge === 0) col = I.seam;
      else if (edge === 1) col = I.board0;
      px(x, y, col);
    }
  }
  // 천장 보 + 상인방(족자 걸이)
  rect(0, 0, 640, 12, M.wd2);
  rect(0, 10, 640, 2, I.seam);
  rect(0, 2, 640, 1, M.wd1);
  rect(0, 18, 640, 7, M.wd1);
  rect(0, 18, 640, 1, M.wd0);
  rect(0, 24, 640, 1, I.seam);
  // 아래 판벽 (징두리)
  rect(0, F - 26, 640, 26, I.board2);
  rect(0, F - 26, 640, 2, M.wd1);
  for (let x = 0; x < 640; x += 44) rect(x, F - 24, 1, 24, I.seam);
  // 걸레받이
  rect(0, F - 3, 640, 3, M.wd2);

  // 기둥
  for (const x of [18, 606]) {
    rect(x, 0, 16, F + 4, M.wd1);
    rect(x, 0, 3, F + 4, M.wd0);
    rect(x + 13, 0, 3, F + 4, M.wd2);
    rect(x - 1, F, 18, 5, M.wd2);
  }

  // 왼쪽 서가 (두루마리 · 책)
  const sx = 44;
  const sw = 84;
  rect(sx, 30, sw, F - 30, M.wd2);
  rect(sx + 3, 33, sw - 6, F - 36, I.seam);
  for (let k = 0; k < 4; k++) {
    const y = 33 + k * 28;
    rect(sx + 3, y + 24, sw - 6, 3, M.wd1);
    rect(sx + 3, y + 24, sw - 6, 1, M.wd0);
    for (let i = 0; i < 9; i++) {
      const bx = sx + 6 + i * 8;
      if ((i + k) % 4 === 3) {
        // 쌓인 두루마리 (둥근 단면)
        for (const yy of [y + 18, y + 12]) {
          rect(bx, yy, 6, 6, M.wall1);
          rect(bx + 2, yy + 2, 2, 2, M.wd1);
        }
      } else {
        const h = 16 + ((i * 5 + k * 3) % 6);
        const cols = [M.rf1, M.red2, M.cu2, M.gold2, M.rf2];
        rect(bx, y + 24 - h, 6, h, cols[(i * 3 + k) % 5]);
        rect(bx, y + 24 - h, 1, h, M.wall2);
        rect(bx + 1, y + 28 - h, 4, 1, M.wall1);
      }
    }
  }

  // 오른쪽 장지문 자리: 문 너머의 빛 (문짝이 덮고 있다가 열리면 보인다)
  const d = LIB.door;
  rect(d.x - 4, d.y - 4, d.w + 8, d.h + 4, M.wd2);
  rect(d.x - 3, d.y - 3, d.w + 6, 2, M.wd0);
  rect(d.x, d.y, d.w, d.h, I.lightEdge);
  rect(d.x + 4, d.y + 4, d.w - 8, d.h - 4, I.light);

  // 마루: 가로 널판 (이음매 엇갈림) + 등불 빛 웅덩이 + 가장자리 어둡게
  for (let y = F; y < 360; y++) {
    const row = Math.floor((y - F) / 12);
    const iy = (y - F) % 12;
    for (let x = 0; x < 640; x++) {
      const off = (row * 53) % 96;
      const joint = (x + off) % 96 === 0;
      let col: string;
      if (iy === 0 || joint) col = I.plankSeam;
      else {
        const grain = ((x + row * 17) % 31 < 2 ? 0.7 : 0) + (iy === 1 ? -0.4 : 0);
        const lamp = Math.max(0, 1 - Math.hypot((x - 320) / 300, (y - 250) / 140));
        col = shade3(x, y, I.plank0, I.plank1, I.plank2, 0.75 - lamp * 0.6 + grain * 0.4);
      }
      // 가장자리 그늘
      const edge = Math.min(x, 639 - x, 359 - y);
      if (edge < 18 && (x + y) % (edge < 8 ? 2 : 3) === 0) col = I.plankSeam;
      px(x, y, col);
    }
  }
  return c;
}

/** 받침대 (낮은 경상) 40×22 — 발 위치 = 아래 가운데 */
export function libStand(): HTMLCanvasElement {
  const s = new Spr(40, 22);
  s.rect(2, 4, 36, 6, M.wd1);
  s.rect(2, 4, 36, 2, M.wd0);
  s.rect(2, 9, 36, 2, M.wd2);
  s.rect(5, 11, 4, 10, M.wd2).rect(31, 11, 4, 10, M.wd2);
  s.rect(6, 11, 1, 10, M.wd1).rect(32, 11, 1, 10, M.wd1);
  s.rect(9, 13, 22, 2, M.wd2);
  s.outline();
  return s.canvas();
}

/** 봉인된 두루마리 28×14 */
export function sealedScroll(): HTMLCanvasElement {
  const s = new Spr(28, 14);
  s.rect(4, 3, 20, 9, M.wall1);
  s.rect(4, 3, 20, 2, M.wall0);
  s.rect(4, 10, 20, 2, M.wall2);
  // 양 끝 축
  s.ellipse(3, 7.5, 2.5, 5, M.wd1).ellipse(25, 7.5, 2.5, 5, M.wd1);
  s.set(2, 5, M.wd0).set(24, 5, M.wd0);
  // 붉은 끈 + 봉인 부적
  s.rect(13, 3, 2, 9, M.red1);
  s.rect(9, 4, 4, 7, M.wall0);
  s.rect(10, 5, 2, 1, M.red1).rect(10, 7, 2, 2, M.red1);
  s.outline();
  return s.canvas();
}

export const HANG_W = 40;
export const HANG_H = 66;
/** 족자 종이 가운데 (글자 자리) */
export const HANG_PAPER = { x: 20, y: 34 };
export const HANG_FRAMES = 7;

/** 족자 — 펼침 단계 frame(0 = 말린 상태 … HANG_FRAMES-1 = 다 펼침) */
export function hangingScroll(frame: number): HTMLCanvasElement {
  const s = new Spr(HANG_W, HANG_H);
  const full = HANG_H - 4;
  const h = Math.round(8 + ((full - 8) * frame) / (HANG_FRAMES - 1));
  // 걸이 끈
  s.line(20, 0, 10, 4, M.wd2).line(20, 0, 30, 4, M.wd2);
  // 표구 (남색 비단) + 종이
  s.rect(4, 4, 32, h, M.rf1);
  s.rect(4, 4, 32, 1, M.rf0);
  if (h > 14) {
    s.rect(8, 10, 24, h - 18, M.wall0);
    s.rect(8, 10, 1, h - 18, M.wall1);
    s.rect(8, 10 + h - 19, 24, 1, M.wall1);
  }
  // 위 · 아래 축
  s.rect(3, 3, 34, 3, M.wd2);
  s.rect(2, 4 + h - 2, 36, 4, M.wd2);
  s.rect(2, 4 + h - 2, 36, 1, M.wd1);
  s.rect(0, 4 + h - 1, 3, 3, M.gold2).rect(37, 4 + h - 1, 3, 3, M.gold2);
  s.outline();
  return s.canvas();
}

/** 장지문 한 짝 28×76 */
export function doorPanel(): HTMLCanvasElement {
  const s = new Spr(28, 76);
  s.rect(0, 0, 28, 76, M.wd1);
  s.rect(2, 2, 24, 72, M.wall0);
  for (const x of [9, 17]) s.rect(x, 2, 2, 72, M.wd1);
  for (let y = 14; y < 74; y += 14) s.rect(2, y, 24, 2, M.wd1);
  s.over((x, y, k) => (k === M.wall0 && (x + y * 2) % 11 === 0 ? M.wall1 : undefined));
  s.rect(22, 36, 3, 6, M.wd2);
  return s.canvas();
}

/** 문에 친 금줄 (봉인) 60×20 */
export function doorSeal(): HTMLCanvasElement {
  const s = new Spr(60, 20);
  for (let x = 2; x < 58; x++) {
    const y = 3 + Math.round(Math.sin((x / 56) * Math.PI) * 4);
    s.rect(x, y, 1, 3, (x >> 1) % 2 ? M.th0 : M.th1);
  }
  for (const x of [14, 30, 46]) {
    const y = 8 + Math.round(Math.sin(((x - 2) / 56) * Math.PI) * 4);
    s.rect(x, y, 4, 3, M.wall0).rect(x + 1, y + 3, 4, 3, M.wall0).rect(x, y + 6, 4, 3, M.wall0);
  }
  s.outline();
  return s.canvas();
}

/** 행등 (바닥 등불) 18×30 */
export function andon(): HTMLCanvasElement {
  const s = new Spr(18, 30);
  s.rect(3, 4, 12, 20, I.light);
  s.rect(3, 4, 12, 2, I.lightEdge);
  s.rect(3, 22, 12, 2, I.lightEdge);
  s.rect(2, 2, 14, 3, M.wd2).rect(2, 23, 14, 3, M.wd2);
  s.rect(3, 26, 2, 4, M.wd2).rect(13, 26, 2, 4, M.wd2);
  s.rect(8, 5, 2, 18, M.wd1);
  s.outline();
  return s.canvas();
}

/** 부드러운 금빛 (펼침 · 문빛) */
export function softGlow(size = 96, rgb = '255,220,140'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb},0.9)`);
  grad.addColorStop(0.45, `rgba(${rgb},0.35)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** 반짝이 5×5 */
export function sparkle(): HTMLCanvasElement {
  const s = new Spr(5, 5);
  s.rect(2, 0, 1, 5, M.gold0).rect(0, 2, 5, 1, M.gold0).set(2, 2, M.wall0);
  return s.canvas();
}
