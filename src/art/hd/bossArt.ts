import Phaser from 'phaser';
import { Spr, M, cedar, lantern, rock, pine } from './worldMap';
import { registerBossFace, Face } from './portraits';
import { SUMMIT_W, SUMMIT_H, ARENA } from './summit';
import type { BossId } from '../../data/chapters';

/**
 * 2~4장 보스 (80×80, 3자세: 0 대기 · 1 외침 · 2 공격 준비) + 싸움터 1280×720.
 * 갓파(강가 연못) · 텐구(숲속 공터) · 오니(도성 광장)
 */
export type Pose = 0 | 1 | 2;

// ── 갓파 ────────────────────────────────────────────────
function kappa(pose: Pose): Spr {
  const s = new Spr(80, 80);
  const skin = M.leaf1;
  const skinD = M.tree0;
  // 다리 · 물갈퀴
  s.ellipse(28, 72, 9, 6, skinD).ellipse(52, 72, 9, 6, skinD);
  s.rect(18, 76, 20, 3, M.tree1).rect(42, 76, 20, 3, M.tree1);
  // 등껍질 (뒤)
  s.ellipse(40, 50, 26, 22, M.wd1);
  s.over((x, y, k) => (k === M.wd1 && ((x + y) % 9 === 0 || (x - y + 90) % 9 === 0) ? M.wd2 : undefined));
  // 몸 · 배
  s.ellipse(40, 54, 19, 18, skin);
  s.ellipse(40, 58, 12, 12, M.th0);
  s.over((_x, y, k) => (k === M.th0 && y % 5 === 0 ? M.th1 : undefined));
  // 팔
  const arm = (sx: number, hx: number, hy: number) => {
    s.poly([[sx - 4, 44], [sx + 4, 44], [hx + 4, hy], [hx - 4, hy]], skin);
    s.ellipse(hx, hy, 6, 5, skinD);
  };
  if (pose === 0) arm(22, 16, 64), arm(58, 64, 64);
  else if (pose === 1) arm(22, 26, 40), arm(58, 54, 40);
  else arm(22, 12, 20), arm(58, 68, 20);
  // 머리 · 머리카락 · 접시
  s.ellipse(40, 26, 18, 16, skin);
  s.over((x, y, k) => (k === skin && (x * 3 + y) % 11 === 0 ? M.leaf0 : k === skin && x > 50 ? skinD : undefined));
  for (let x = 23; x < 58; x += 3) s.rect(x, 12 + (x % 2), 2, 6, M.tree1);
  s.ellipse(40, 11, 13, 4, M.wa1).ellipse(40, 10, 9, 2.5, M.wa0);
  // 눈 · 부리
  for (const ex of [32, 46]) s.rect(ex, 24, 4, 5, M.wall0).rect(ex + 1, 25, 2, 4, M.ink);
  if (pose === 1) s.poly([[33, 33], [47, 33], [40, 44]], M.gold1).rect(36, 36, 8, 3, M.red2);
  else s.poly([[33, 33], [47, 33], [40, 40]], M.gold1);
  s.rect(33, 33, 14, 1, M.gold2);
  s.outline();
  return s;
}

// ── 텐구 ────────────────────────────────────────────────
function tengu(pose: Pose): Spr {
  const s = new Spr(80, 80);
  const wing = M.inkSoft;
  const lift = pose === 2 ? -8 : 0;
  // 날개 (펼침)
  s.poly([[6, 18 + lift], [30, 30], [30, 60], [10, 52]], wing).poly([[74, 18 + lift], [50, 30], [50, 60], [70, 52]], wing);
  s.over((x, y, k) => (k === wing && (x + y * 2) % 7 === 0 ? '#4a3e60' : undefined));
  // 다리 · 게타
  s.rect(32, 64, 5, 10, M.wd2).rect(43, 64, 5, 10, M.wd2);
  s.rect(28, 74, 12, 3, M.wd1).rect(40, 74, 12, 3, M.wd1);
  // 흰 수도자 옷 · 술
  s.poly([[26, 66], [28, 34], [52, 34], [54, 66]], M.wall0);
  s.over((x, _y, k) => (k === M.wall0 && x > 46 ? M.wall1 : undefined));
  s.rect(39, 34, 2, 32, M.wall2);
  for (const x of [32, 48]) s.ellipse(x, 40, 2.5, 2.5, M.red1);
  // 깃털 부채 (자세마다)
  const fan = (fx: number, fy: number) => {
    s.ellipse(fx, fy, 8, 10, M.wall0);
    s.over((x, y, k) => (k === M.wall0 && Math.hypot(x - fx, y - fy) < 10 && (x + y) % 3 === 0 ? M.st1 : undefined));
    s.rect(fx - 1, fy + 8, 2, 8, M.wd2);
  };
  if (pose === 0) fan(60, 50);
  else if (pose === 1) fan(58, 36);
  else fan(62, 14);
  // 얼굴 · 긴 코 · 모자
  s.ellipse(40, 22, 11, 11, M.red1);
  s.over((x, y, k) => (k === M.red1 && (x > 46 || y > 28) ? M.red2 : k === M.red1 && x < 35 && y < 20 ? M.red0 : undefined));
  s.poly([[41, 20], [62, 16], [62, 20], [41, 26]], M.red0);
  s.rect(32, 17, 5, 2, M.ink).rect(43, 16, 4, 2, M.ink);
  s.rect(31, 14, 6, 2, M.wall0).rect(42, 13, 6, 2, M.wall0);
  if (pose === 1) s.rect(34, 28, 8, 3, M.ink);
  else s.rect(35, 28, 7, 1, M.ink);
  s.rect(32, 6, 16, 5, M.inkSoft).rect(37, 2, 6, 5, M.inkSoft);
  s.outline();
  return s;
}

// ── 오니 ────────────────────────────────────────────────
function oni(pose: Pose): Spr {
  const s = new Spr(80, 80);
  const skin = M.red1;
  // 다리
  s.rect(26, 60, 10, 14, skin).rect(44, 60, 10, 14, skin);
  s.rect(24, 74, 14, 4, M.red2).rect(42, 74, 14, 4, M.red2);
  // 호피 허리감개
  s.rect(22, 54, 36, 10, M.gold1);
  for (let x = 24; x < 56; x += 5) s.rect(x, 55, 2, 8, M.ink);
  // 몸통 (근육)
  s.ellipse(40, 42, 20, 16, skin);
  s.over((x, y, k) => (k === skin ? (x > 50 || y > 52 ? M.red2 : x < 32 && y < 40 ? M.red0 : undefined) : undefined));
  s.rect(39, 34, 2, 14, M.red2);
  // 쇠몽둥이 (자세마다)
  const club = (x0: number, y0: number, x1: number, y1: number) => {
    for (let t = 0; t <= 1; t += 0.02) {
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const w = 2 + t * 4;
      s.ellipse(x, y, w, w, M.st2);
    }
    for (let t = 0.4; t <= 1; t += 0.15) s.set(x0 + (x1 - x0) * t + 3, y0 + (y1 - y0) * t, M.st0);
  };
  if (pose === 2) {
    club(58, 30, 70, 2);
    s.ellipse(60, 30, 6, 6, skin);
  } else if (pose === 1) {
    club(62, 46, 74, 22);
    s.ellipse(62, 46, 6, 6, skin);
  } else {
    club(62, 52, 72, 76);
    s.ellipse(62, 52, 6, 6, skin);
  }
  s.ellipse(18, 50, 6, 6, skin);
  // 머리 · 뿔 · 곱슬머리
  s.ellipse(40, 20, 14, 13, skin);
  s.poly([[28, 12], [24, 0], [33, 9]], M.gold1).poly([[47, 9], [56, 0], [52, 12]], M.gold1);
  for (let x = 27; x < 54; x += 4) s.ellipse(x, 9, 3, 3, M.inkSoft);
  s.rect(31, 17, 7, 2, M.ink).rect(42, 17, 7, 2, M.ink);
  s.rect(32, 19, 4, 3, M.gold0).rect(43, 19, 4, 3, M.gold0);
  s.set(33, 20, M.ink).set(44, 20, M.ink);
  if (pose === 1) s.rect(33, 26, 14, 5, M.ink).rect(34, 26, 2, 2, M.wall0).rect(44, 26, 2, 2, M.wall0);
  else s.rect(33, 27, 14, 3, M.ink).rect(34, 27, 2, 2, M.wall0).rect(44, 27, 2, 2, M.wall0);
  s.outline();
  return s;
}

const MAKERS: Record<Exclude<BossId, 'yamabiko'>, (p: Pose) => Spr> = { kappa, tengu, oni };

/** 보스 탄 그림 (물방울 · 깃털 · 불씨) */
function bullet(id: Exclude<BossId, 'yamabiko'>): HTMLCanvasElement {
  const s = new Spr(12, 12);
  if (id === 'kappa') s.ellipse(6, 7, 4, 4, M.wa1).poly([[3, 6], [6, 1], [9, 6]], M.wa1).set(5, 6, M.wa0);
  else if (id === 'tengu') s.poly([[6, 0], [9, 8], [6, 11], [3, 8]], M.wall0).line(6, 1, 6, 11, M.st2);
  else s.ellipse(6, 6, 4, 4, M.fi2).ellipse(6, 6, 2, 2, M.fi0);
  s.outline();
  return s.canvas();
}

/** 텍스처 등록 (보스 시트 · 탄 · 초상화) */
export function registerBosses(scene: Phaser.Scene): void {
  for (const id of ['kappa', 'tengu', 'oni'] as const) {
    const key = `boss-${id}`;
    if (!scene.textures.exists(key)) {
      const c = document.createElement('canvas');
      c.width = 240;
      c.height = 80;
      const g = c.getContext('2d')!;
      ([0, 1, 2] as Pose[]).forEach((p) => g.drawImage(MAKERS[id](p).canvas(), p * 80, 0));
      const tex = scene.textures.addCanvas(key, c)!;
      for (let i = 0; i < 3; i++) tex.add(i, 0, i * 80, 0, 80, 80);
    }
    if (!scene.textures.exists(`bullet-${id}`)) scene.textures.addCanvas(`bullet-${id}`, bullet(id));
  }
}

/** 초상화: 보스 머리 부분 64×64 */
function face(id: 'kappa' | 'oni') {
  return (f: Face) => {
    const src = MAKERS[id](f === 'surprised' || f === 'happy' ? 1 : 0).canvas();
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    c.getContext('2d')!.drawImage(src, 8, 0, 64, 64, 0, 0, 64, 64);
    return c;
  };
}
registerBossFace('kappa', face('kappa'));
registerBossFace('oni', face('oni'));

// ── 싸움터 1280×720 ─────────────────────────────────────

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
function h2(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function sm(x: number, y: number, s: number): number {
  const fx = x / s;
  const fy = y / s;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const u = fx - x0;
  const v = fy - y0;
  const q = (t: number) => t * t * (3 - 2 * t);
  const a = h2(x0, y0);
  const b = h2(x0 + 1, y0);
  const c = h2(x0, y0 + 1);
  const d = h2(x0 + 1, y0 + 1);
  return a + (b - a) * q(u) + (c - a) * q(v) + (a - b - c + d) * q(u) * q(v);
}
const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

interface ArenaTheme {
  sky: string[];
  ground: string[];
  edge: string[];
  /** 위쪽 띠 (물 · 숲 · 담) */
  top: (x: number, y: number) => string | null;
}

const ARENAS: Record<Exclude<BossId, 'yamabiko'>, ArenaTheme> = {
  kappa: {
    sky: ['#7cc0ec', '#98d0f0', '#b4def4', '#cfeaf8', '#e8f6fc'],
    ground: ['#98ca64', '#7cb254', '#68a04a'],
    edge: ['#3f7fd0', '#2a5aa0'],
    top: (x, y) => (y < 150 + Math.sin(x / 60) * 8 ? (h2(x, y) < 0.04 ? '#d4f2ff' : y < 120 ? '#3f7fd0' : '#5aaee8') : null),
  },
  tengu: {
    sky: ['#4a3a6a', '#6a4a7a', '#9a5a7a', '#c87a72', '#e8a07a'],
    ground: ['#5c9248', '#467a3e', '#3a6838'],
    edge: ['#1f3f28', '#16301e'],
    top: () => null,
  },
  oni: {
    sky: ['#141a3a', '#1e2650', '#2a3466', '#36427a', '#4a5690'],
    ground: ['#a0988a', '#8c8478', '#787066'],
    edge: ['#2a2230', '#1c1620'],
    top: () => null,
  },
};

export function arenaGround(id: Exclude<BossId, 'yamabiko'>): HTMLCanvasElement {
  const th = ARENAS[id];
  const c = document.createElement('canvas');
  c.width = SUMMIT_W;
  c.height = SUMMIT_H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(SUMMIT_W, SUMMIT_H);
  const d = img.data;
  const sky = th.sky.map(rgb);
  const ground = th.ground.map(rgb);
  const edge = th.edge.map(rgb);
  for (let y = 0; y < SUMMIT_H; y++) {
    for (let x = 0; x < SUMMIT_W; x++) {
      const i = (y * SUMMIT_W + x) * 4;
      const dith = BAYER[(y & 3) * 4 + (x & 3)];
      const ridge = 92 + Math.round(sm(x, 0, 90) * 40);
      let col: number[];
      const top = th.top(x, y);
      if (y < ridge) col = sky[Math.max(0, Math.min(4, Math.floor((y / ridge) * 5 + (dith - 0.5))))];
      else if (top) col = rgb(top);
      else {
        const e = Math.min(x - 20, SUMMIT_W - 20 - x, SUMMIT_H - 16 - y) + (sm(x, y, 30) - 0.5) * 30;
        if (e < 14) col = edge[e < 4 ? 1 : 0];
        // 강가: 물과 풀 사이 모래톱
        else if (id === 'kappa' && e < 30) col = rgb(e < 18 ? '#c8b07a' : (x + y) % 3 === 0 ? '#b49a64' : '#dcc48a');
        else {
          const t = sm(x, y, 120) * 0.8 + sm(x, y, 28) * 0.2;
          col = ground[Math.max(0, Math.min(2, Math.floor(t * 3 + (dith - 0.5) * 0.6)))];
          // 도성: 판석 줄눈
          const r = h2(x, y);
          if (id === 'oni') {
            // 도성: 판석 줄눈 · 판석마다 다른 밝기 · 금
            const row = Math.floor(y / 24);
            const colI = Math.floor((x + (row % 2) * 24) / 48);
            const tone = h2(colI, row);
            col = ground[tone < 0.33 ? 0 : tone < 0.7 ? 1 : 2];
            if (y % 24 === 0 || (x + (row % 2) * 24) % 48 === 0) col = rgb('#5e5850');
            else if (y % 24 === 1) col = rgb('#b4ac9e');
            else if (tone > 0.9 && Math.abs(((x + (row % 2) * 24) % 48) - 10 - (y % 24)) < 1) col = rgb('#5e5850');
            else if (r < 0.01) col = rgb('#6a8a4a');
          } else if (id === 'kappa') {
            // 풀잎 결 · 들꽃
            if (r < 0.05 && (y & 1) === 0) col = rgb('#5a8e3e');
            else if (r > 0.985) col = rgb('#c8e68a');
            else if (r > 0.9975) col = rgb('#f4f0e0');
          } else {
            // 숲: 낙엽 · 이끼
            if (r < 0.05) col = rgb('#2e5230');
            else if (r > 0.992) col = rgb(h2(y, x) < 0.5 ? '#c88a3a' : '#a85a2a');
            else if (sm(x, y, 46) > 0.78) col = rgb((x + y) % 2 ? '#6c5434' : '#5a4630');
          }
        }
      }
      d[i] = col[0];
      d[i + 1] = col[1];
      d[i + 2] = col[2];
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const put = (s: Spr, x: number, y: number) => {
    const a = s.canvas();
    g.drawImage(a, Math.round(x - a.width / 2), Math.round(y - a.height));
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (id === 'kappa') {
    // 연못가 갈대 · 연잎
    for (let x = 30; x < SUMMIT_W; x += 26) put(reedClump(), x + rnd() * 10, 162 + rnd() * 10);
    for (let k = 0; k < 14; k++) {
      const s = new Spr(14, 8);
      s.ellipse(7, 4, 6, 3, M.leaf1).set(7, 4, M.wa2);
      s.outline();
      put(s, 60 + rnd() * 1160, 100 + rnd() * 40);
    }
    for (const [x, y] of [[140, 640], [1140, 660], [300, 300], [980, 320]]) put(rock(22, 12), x, y);
    for (let k = 0; k < 90; k++) put(tuft(k % 3 === 0 ? M.th1 : M.leaf0), 70 + rnd() * 1140, 210 + rnd() * 470);
    for (const [x, y] of [[420, 520], [860, 460]]) put(lilyPond(), x, y);
  } else if (id === 'tengu') {
    // 둘레의 삼나무 · 안개
    for (let x = 10; x < SUMMIT_W; x += 16) put(cedar(32), x + rnd() * 6, 150 + rnd() * 16);
    for (let x = 10; x < SUMMIT_W; x += 18) put(cedar(32), x + rnd() * 6, 712);
    for (const [x, y] of [[120, 420], [1160, 440], [400, 640], [880, 620]]) put(cedar(32), x, y);
    for (const [x, y] of [[640, 160]]) put(bigBoulder(), x, y);
    for (let k = 0; k < 70; k++) put(k % 4 === 0 ? mushroomTiny() : tuft('#2e6a34'), 70 + rnd() * 1140, 210 + rnd() * 470);
  } else {
    // 도성 광장: 붉은 기둥 · 석등 · 담
    for (let x = 40; x < SUMMIT_W; x += 120) {
      const p = new Spr(14, 64);
      p.rect(3, 4, 8, 58, M.red1).rect(9, 4, 2, 58, M.red2).rect(1, 60, 12, 4, M.st2).rect(1, 0, 12, 5, M.inkSoft);
      p.outline();
      put(p, x, 170);
    }
    for (const [x, y] of [[200, 400], [1080, 400], [200, 640], [1080, 640]]) put(lantern(), x, y);
    for (const [x, y] of [[640, 700]]) put(pine(), x, y);
    // 흩어진 부적 종이 · 깨진 기와
    for (let k = 0; k < 26; k++) {
      const p = new Spr(8, 6);
      if (k % 2) p.rect(1, 1, 6, 4, M.wall0).rect(3, 2, 2, 2, M.red1);
      else p.poly([[0, 5], [4, 0], [8, 5]], M.inkSoft);
      p.outline();
      put(p, 80 + rnd() * 1120, 220 + rnd() * 460);
    }
  }
  return c;
}

function tuft(c: string): Spr {
  const s = new Spr(9, 7);
  s.line(2, 6, 1, 2, c).line(4, 6, 4, 0, c).line(6, 6, 7, 2, c);
  return s;
}

function mushroomTiny(): Spr {
  const s = new Spr(8, 8);
  s.rect(3, 4, 2, 4, M.wall0).ellipse(4, 3, 3.5, 2.5, M.red1).set(3, 2, M.wall0);
  s.outline();
  return s;
}

function lilyPond(): Spr {
  const s = new Spr(70, 30);
  s.ellipse(35, 15, 34, 14, '#c8b07a');
  s.ellipse(35, 15, 31, 12, M.wa1);
  s.over((_x, y, k) => (k === M.wa1 && y < 10 ? M.wa0 : undefined));
  s.ellipse(24, 16, 6, 3, M.leaf1).ellipse(44, 12, 5, 2.5, M.leaf1).set(44, 11, '#f4b8c8');
  s.outline();
  return s;
}

function reedClump(): Spr {
  const s = new Spr(16, 22);
  for (let i = 0; i < 5; i++) {
    const x = 2 + i * 3;
    s.line(x, 21, x + (i % 2 ? 1 : -1), 6 + (i % 3) * 2, M.th1);
    s.rect(x - 1, 4 + (i % 3) * 2, 2, 3, M.wd1);
  }
  s.outline(M.tree1);
  return s;
}

function bigBoulder(): Spr {
  const s = new Spr(90, 70);
  s.poly([[4, 69], [14, 24], [34, 6], [58, 4], [78, 22], [86, 69]], M.st1);
  s.over((x, y, k) => (k === M.st1 ? (x > 58 ? M.st2 : x < 30 && y < 46 ? M.st0 : undefined) : undefined));
  s.rect(36, 10, 18, 3, M.th0);
  s.outline();
  return s;
}

export { ARENA };
