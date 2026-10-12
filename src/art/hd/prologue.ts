import { Spr, M, torii, lantern, sakura } from './worldMap';

/**
 * 프롤로그 · 하얀 아침 — 신사 경내 · 후미 · 모지쿠이(하얀 입) · 무너진 서고 소품.
 */

/** 경내에서 서고(곳간)로 들어가는 문 */
export const YARD = {
  groundY: 176,
  kuraDoor: { x: 548, y: 188 },
  /** 빈 고찰(알림판) */
  board: { x: 176, y: 262 },
};

// ── 후미 32×32 (노무녀: 흰 쪽머리 · 흰 옷 · 보라 하카마) ───────
export function fumiSprite(raise: boolean): HTMLCanvasElement {
  const s = new Spr(32, 32);
  const hak = '#5a4290';
  const hak2 = '#3a2a60';
  // 하카마
  s.poly([[9, 19], [23, 19], [25, 31], [7, 31]], hak);
  s.rect(15, 21, 2, 10, hak2);
  s.over((x, _y, k) => (k === hak && x > 19 ? hak2 : undefined));
  // 흰 옷 (상의 + 소매)
  s.rect(10, 11, 12, 9, M.wall0);
  s.rect(10, 11, 12, 1, M.wall1);
  s.poly([[14, 11], [16, 15], [18, 11]], M.red1);
  if (raise) {
    // 두루마리를 머리 위로
    s.rect(21, 3, 4, 10, M.wall0).rect(7, 3, 4, 10, M.wall0);
    s.rect(6, 1, 20, 3, M.wall1);
    s.rect(5, 0, 2, 5, M.wd1).rect(25, 0, 2, 5, M.wd1);
  } else {
    s.rect(7, 12, 4, 9, M.wall0).rect(21, 12, 4, 9, M.wall0);
    s.rect(7, 19, 4, 2, M.skin1).rect(21, 19, 4, 2, M.skin1);
  }
  // 머리 (흰 쪽머리)
  s.ellipse(16, 7, 5, 5, M.st0);
  s.ellipse(16, 2.5, 3, 2.5, M.st0);
  s.rect(14, 3, 5, 1, M.red1);
  s.ellipse(16, 8, 3.5, 3.5, M.skin0);
  s.set(14, 8, M.ink).set(18, 8, M.ink).set(16, 10, M.skin1);
  s.over((x, y, k) => (k === M.st0 && (x + y) % 4 === 0 ? M.st1 : undefined));
  s.outline();
  return s.canvas();
}

// ── 모지쿠이: 벽을 찢고 나온 거대한 하얀 입 180×124 (frame 0 = 다문, 1 = 벌림) ──
export function mojikuiMouth(open: boolean): HTMLCanvasElement {
  const W = 180;
  const H = 124;
  const s = new Spr(W, H);
  const paper = '#f4f2f8';
  const paper2 = '#d8d4e4';
  const void0 = '#1b1626';
  const cx = W / 2;
  const cy = 62;
  // 찢어진 종이 테두리 (들쭉날쭉)
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const r = 1 + Math.sin(a * 13) * 0.06 + Math.sin(a * 29) * 0.04;
    const x = cx + Math.cos(a) * 86 * r;
    const y = cy + Math.sin(a) * 58 * r;
    s.line(cx, cy, x, y, paper);
  }
  s.over((x, y, k) => (k === paper && (x * 3 + y * 5) % 11 === 0 ? paper2 : undefined));
  // 입 안 (어둠) — 벌리면 크게
  const gap = open ? 30 : 10;
  s.ellipse(cx, cy, 64, gap, void0);
  // 이빨 (종이를 접은 세모)
  for (let x = cx - 56; x <= cx + 56; x += 14) {
    s.poly([[x - 6, cy - gap], [x + 6, cy - gap], [x, cy - gap + 9]], paper);
    s.poly([[x + 1, cy + gap], [x + 13, cy + gap], [x + 7, cy + gap - 9]], paper);
  }
  // 입 안에서 소용돌이치는 글자 조각
  if (open) {
    for (let i = 0; i < 26; i++) {
      const a = i * 0.9;
      const r = 6 + i * 2.1;
      s.rect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.35, 2, 1, i % 3 ? '#66637a' : '#a3a1b5');
    }
  }
  // 위쪽 눈 하나 (텅 빈 둥근 구멍)
  s.ellipse(cx, cy - 40, 9, 6, void0);
  s.ellipse(cx + 2, cy - 41, 2, 2, '#d8432e');
  s.outline('#a3a1b5');
  return s.canvas();
}

/** 날아가는 책 한 권 8×10 */
export function flyingBook(col: string): HTMLCanvasElement {
  const s = new Spr(8, 10);
  s.rect(1, 1, 6, 8, col);
  s.rect(1, 1, 1, 8, M.wall2);
  s.rect(2, 2, 4, 1, M.wall1);
  s.outline();
  return s.canvas();
}

/** 무너진 서고 잔해 (판자 · 기와 조각) 40×16 */
export function rubble(seed: number): HTMLCanvasElement {
  const s = new Spr(40, 16);
  s.poly([[2, 14], [10, 6], [22, 8], [30, 14]], M.wd2);
  s.poly([[14, 15], [24, 4], [38, 9], [34, 15]], M.wd1);
  if (seed % 2) s.poly([[4, 15], [8, 9], [14, 12], [12, 15]], M.rf1);
  s.rect(20 + (seed % 5), 10, 6, 3, M.st1);
  s.outline();
  return s.canvas();
}

/** 바닥에 떨어진 두루마리 20×10 */
export function floorScroll(): HTMLCanvasElement {
  const s = new Spr(20, 10);
  s.rect(3, 2, 14, 6, M.wall0);
  s.ellipse(2.5, 5, 2, 3.5, M.wd1).ellipse(17.5, 5, 2, 3.5, M.wd1);
  s.rect(9, 2, 2, 6, M.red1);
  s.outline();
  return s.canvas();
}

// ── 신사 경내 640×360 (아침 · 글자가 사라진 현판과 고찰) ───────────
export function shrineYard(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 360;
  const g = c.getContext('2d')!;
  const rect = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  const G = YARD.groundY;
  // 아침 하늘 · 먼 숲
  for (let y = 0; y < G; y++) rect(0, y, 640, 1, M.day[Math.min(4, Math.floor((y / G) * 5))]);
  for (let x = 0; x < 640; x++) {
    const h = 18 + Math.round(Math.abs(Math.sin(x * 0.05)) * 10 + Math.sin(x * 0.17) * 3);
    rect(x, G - 50 - h, 1, h + 50, x % 3 ? M.tree1 : M.tree0);
  }
  // 자갈 마당 (디더링) + 돌길
  for (let y = G; y < 360; y++) {
    for (let x = 0; x < 640; x++) {
      const v = (x * 7 + y * 13 + ((x * y) % 7)) % 9;
      g.fillStyle = v < 5 ? M.wall1 : v < 8 ? M.wall2 : M.st1;
      g.fillRect(x, y, 1, 1);
    }
  }
  const stone = (x: number, y: number, w: number) => {
    rect(x - 1, y - 1, w + 2, 9, M.st2);
    rect(x, y, w, 7, M.st1);
    rect(x, y, w, 2, M.st0);
  };
  for (let y = 350; y > G + 10; y -= 12) stone(300 + Math.round(Math.sin(y / 30) * 4), y - 8, 40);
  for (let x = 340; x < 540; x += 26) stone(x, G + 24 + Math.round((x - 340) * 0.02), 22);

  // 배전 (가운데) — 동판 지붕 · 붉은 기둥 · 글자 없는 현판
  const hall = new Spr(220, 150);
  hall.poly([[0, 52], [26, 10], [194, 10], [220, 52]], M.cu1);
  hall.over((_x, y, k) => (k === M.cu1 ? (y === 11 ? M.cu0 : y % 6 === 0 ? M.cu2 : undefined) : undefined));
  hall.rect(22, 6, 176, 5, M.cu2);
  hall.rect(18, 52, 184, 6, M.red2);
  hall.rect(24, 58, 172, 80, M.wall0);
  for (const x of [24, 66, 150, 192]) hall.rect(x, 58, 6, 86, M.red1).rect(x + 4, 58, 2, 86, M.red2);
  hall.rect(84, 86, 52, 52, M.inkSoft);
  hall.rect(86, 120, 48, 14, M.wd1);
  hall.rect(86, 120, 48, 2, M.wd0);
  for (let x = 90; x < 132; x += 6) hall.rect(x, 124, 3, 8, M.wd2);
  // 방울 줄
  hall.ellipse(110, 66, 5, 5, M.gold1).rect(108, 70, 4, 18, M.red1);
  // 현판 (텅 빈)
  hall.rect(90, 26, 40, 22, M.wd2).rect(92, 28, 36, 18, M.wall1);
  hall.rect(0, 142, 220, 8, M.st1).rect(0, 142, 220, 2, M.st0);
  hall.outline();
  g.drawImage(hall.canvas(), 210, G - 136);

  // 서고 (오른쪽 곳간) — 문으로 들어가면 서고 안
  const kura = new Spr(110, 130);
  kura.poly([[0, 34], [14, 6], [96, 6], [110, 34]], M.rf1);
  kura.over((_x, y, k) => (k === M.rf1 ? (y === 7 ? M.rf0 : y % 5 === 0 ? M.rf2 : undefined) : undefined));
  kura.rect(10, 34, 90, 92, M.wall0);
  kura.rect(10, 96, 90, 30, M.st1);
  kura.over((x, y, k) => (k === M.st1 && ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0) ? M.wall0 : undefined));
  kura.rect(36, 70, 38, 56, M.wd2).rect(39, 73, 32, 53, M.inkSoft);
  kura.rect(41, 40, 28, 14, M.wd2).rect(43, 42, 24, 10, M.wall1);
  kura.outline();
  g.drawImage(kura.canvas(), YARD.kuraDoor.x - 55, G - 112);

  // 토리이 · 석등 · 벚꽃 · 빈 고찰
  const draw = (sp: Spr, x: number, y: number) => {
    const a = sp.canvas();
    g.drawImage(a, Math.round(x - a.width / 2), Math.round(y - a.height));
  };
  draw(torii(64, 70), 70, G + 50);
  draw(lantern(), 150, G + 30);
  draw(lantern(), 450, G + 30);
  for (const [x, y] of [[30, 330], [610, 340], [490, 300], [120, 200]]) draw(sakura(), x, y);
  const board = new Spr(56, 44);
  board.rect(8, 14, 4, 30, M.wd1).rect(44, 14, 4, 30, M.wd1);
  board.rect(2, 8, 52, 24, M.wd0);
  board.rect(2, 8, 52, 2, M.wd1);
  for (const [x, w] of [[6, 12], [21, 14], [38, 12]]) board.rect(x, 12, w, 16, M.wall0);
  board.poly([[0, 9], [6, 2], [50, 2], [56, 9]], M.wd2);
  board.outline();
  draw(board, YARD.board.x, YARD.board.y);
  return c;
}
