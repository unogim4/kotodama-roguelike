import { Spr, M, pine, rock, lantern, torii } from './worldMap';
import { alleyBackground } from './alley';

/**
 * 방문 장면 배경 640×360 + NPC 32px.
 * 찻집 · 온천 · 신사 · 이벤트(마을 골목) · 산길 쉼터. 캐릭터는 바닥(y 250 근처)에 선다.
 */
export type VisitKind = 'shop' | 'spring' | 'shrine' | 'event' | 'rest' | 'story-suzu' | 'story-tengu' | 'story-small';

/** 캐릭터가 서는 높이 */
export const STAND_Y = 252;
/** 찻집 메뉴판 4장 가운데 x · y (글자는 DOM) */
export const MENU = { xs: [176, 272, 368, 464], y: 92 };

type Ctx = CanvasRenderingContext2D;

function base(): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 360;
  return [c, c.getContext('2d')!];
}

function fill(g: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
}

function put(g: Ctx, s: Spr | HTMLCanvasElement, x: number, y: number): void {
  const a = s instanceof Spr ? s.canvas() : s;
  g.drawImage(a, Math.round(x - a.width / 2), Math.round(y - a.height));
}

/** 디더 바닥 (cols 3색) */
function ground(g: Ctx, y0: number, cols: string[], seed = 1): void {
  for (let y = y0; y < 360; y++) {
    for (let x = 0; x < 640; x++) {
      const v = (x * 7 + y * 13 + ((x * y * seed) % 11)) % 10;
      g.fillStyle = v < 6 ? cols[0] : v < 9 ? cols[1] : cols[2];
      g.fillRect(x, y, 1, 1);
    }
  }
}

function sky(g: Ctx, h: number, cols: string[]): void {
  for (let y = 0; y < h; y++) fill(g, 0, y, 640, 1, cols[Math.min(cols.length - 1, Math.floor((y / h) * cols.length))]);
}

// ── 찻집 (여우 할멈의 가게) ─────────────────────────────

export function teahouse(): HTMLCanvasElement {
  const [c, g] = base();
  // 나무 벽
  for (let x = 0; x < 640; x++) {
    const plank = Math.floor(x / 18);
    for (let y = 0; y < 196; y++) g.fillStyle = x % 18 === 0 ? '#3a281e' : (plank * 7 + Math.floor(y / 11)) % 5 < 2 ? '#6a4a32' : '#5a3e2a', g.fillRect(x, y, 1, 1);
  }
  fill(g, 0, 0, 640, 14, M.wd2);
  fill(g, 0, 44, 640, 6, M.wd1);
  fill(g, 0, 44, 640, 1, M.wd0);
  // 메뉴판 (나무 패 · 붉은 끈)
  for (const x of MENU.xs) {
    fill(g, x - 1, 46, 2, 14, M.red1);
    fill(g, x - 30, 60, 60, 66, M.wd2);
    fill(g, x - 28, 62, 56, 62, M.wall1);
    fill(g, x - 28, 62, 56, 2, M.wall0);
  }
  // 등롱
  for (const x of [60, 580]) {
    const l = new Spr(24, 34);
    l.ellipse(12, 18, 10, 13, M.red1).rect(4, 4, 16, 3, M.ink).rect(4, 30, 16, 3, M.ink);
    l.over((xx, yy, k) => (k === M.red1 && yy % 5 === 0 ? M.red2 : xx > 15 && k === M.red1 ? M.red2 : undefined));
    l.rect(10, 12, 4, 10, M.gold0);
    l.outline();
    put(g, l, x, 110);
  }
  // 계산대
  fill(g, 80, 168, 480, 40, M.wd1);
  fill(g, 80, 168, 480, 4, M.wd0);
  for (let x = 84; x < 556; x += 24) fill(g, x, 176, 2, 30, M.wd2);
  // 찻주전자 · 경단 접시
  const pot = new Spr(26, 20);
  pot.ellipse(13, 12, 10, 7, M.inkSoft).rect(9, 2, 8, 4, M.inkSoft).line(23, 10, 26, 6, M.inkSoft);
  pot.set(10, 9, M.st1).set(11, 9, M.st1);
  pot.outline(M.ink);
  put(g, pot, 130, 168);
  const dango = new Spr(30, 12);
  dango.ellipse(15, 9, 14, 3, M.wall0);
  for (const [x, col] of [[9, M.pk1], [15, M.wall0], [21, M.sprout0]] as const) dango.ellipse(x, 6, 3, 3, col);
  dango.line(4, 7, 27, 4, M.wd0);
  dango.outline();
  put(g, dango, 506, 168);
  // 바닥 (다다미 · 나무)
  ground(g, 208, ['#c8a86a', '#b8985a', '#a8884a'], 3);
  for (let y = 208; y < 360; y += 36) fill(g, 0, y, 640, 2, '#8a6a3a');
  // 붉은 천 깐 평상
  fill(g, 40, 300, 160, 10, M.red1);
  fill(g, 40, 300, 160, 2, M.red0);
  fill(g, 48, 310, 6, 20, M.wd2);
  fill(g, 186, 310, 6, 20, M.wd2);
  return c;
}

// ── 온천 (산의 노천탕, 저녁) ─────────────────────────────

export function hotSpring(): HTMLCanvasElement {
  const [c, g] = base();
  sky(g, 120, M.dusk);
  // 먼 산
  for (let x = 0; x < 640; x++) {
    const h = 40 + Math.round(Math.abs(Math.sin(x * 0.011)) * 40 + Math.sin(x * 0.05) * 6);
    fill(g, x, 120 - h, 1, h, M.midDusk);
  }
  // 대나무 울타리
  fill(g, 0, 96, 640, 80, M.th1);
  for (let x = 0; x < 640; x += 7) fill(g, x, 96, 2, 80, M.th2), fill(g, x + 2, 96, 1, 80, M.th0);
  fill(g, 0, 110, 640, 3, M.wd2);
  fill(g, 0, 150, 640, 3, M.wd2);
  ground(g, 176, [M.st1, M.st2, M.st0], 5);
  // 탕 (바위 테두리 + 물)
  for (let y = 186; y < 300; y++) {
    for (let x = 120; x < 520; x++) {
      const d = ((x - 320) / 190) ** 2 + ((y - 240) / 50) ** 2;
      if (d > 1.12) continue;
      const v = (x * 3 + y * 7) % 13;
      g.fillStyle = d > 0.9 ? (v < 5 ? M.st0 : v < 10 ? M.st1 : M.st2) : (x + y * 2) % 23 === 0 ? M.wa0 : y < 232 ? '#7cc8e0' : M.wa2;
      g.fillRect(x, y, 1, 1);
    }
  }
  for (const [x, y, w, h] of [[110, 240, 26, 16], [520, 250, 30, 18], [200, 300, 22, 12], [440, 300, 26, 14]]) put(g, rock(w, h), x, y);
  // 나무 통 · 수건
  const bucket = new Spr(20, 18);
  bucket.rect(3, 4, 14, 12, M.wd0).rect(3, 7, 14, 1, M.wd2).rect(3, 12, 14, 1, M.wd2).rect(1, 4, 18, 2, M.wd1);
  bucket.outline();
  put(g, bucket, 560, 330);
  put(g, lantern(), 80, 200);
  put(g, lantern(), 560, 200);
  return c;
}

// ── 신사 (작은 본전과 에마) ─────────────────────────────

export function shrineFront(): HTMLCanvasElement {
  const [c, g] = base();
  sky(g, 150, M.day);
  for (let x = 0; x < 640; x++) {
    const h = 30 + Math.round(Math.abs(Math.sin(x * 0.04)) * 16);
    fill(g, x, 150 - h, 1, h, x % 3 ? M.tree1 : M.tree0);
  }
  ground(g, 150, [M.wall1, M.wall2, M.st1], 2);
  // 본전
  const hall = new Spr(240, 170);
  hall.poly([[0, 60], [30, 14], [210, 14], [240, 60]], M.cu1);
  hall.over((_x, y, k) => (k === M.cu1 ? (y === 15 ? M.cu0 : y % 6 === 0 ? M.cu2 : undefined) : undefined));
  hall.rect(26, 8, 188, 6, M.cu2);
  hall.line(20, 0, 34, 14, M.cu2).line(220, 0, 206, 14, M.cu2);
  hall.rect(20, 60, 200, 6, M.red2);
  hall.rect(28, 66, 184, 84, M.wall0);
  for (const x of [28, 74, 160, 206]) hall.rect(x, 66, 6, 90, M.red1).rect(x + 4, 66, 2, 90, M.red2);
  hall.rect(92, 94, 56, 56, M.inkSoft);
  // 방울 · 줄 · 새전함
  hall.ellipse(120, 76, 7, 7, M.gold1).ellipse(118, 74, 2, 2, M.gold0);
  hall.rect(118, 83, 4, 30, M.red1).rect(119, 83, 2, 30, M.wall0);
  hall.rect(94, 128, 52, 22, M.wd1).rect(94, 128, 52, 3, M.wd0);
  for (let x = 98; x < 144; x += 6) hall.rect(x, 133, 3, 15, M.wd2);
  // 금줄 + 종이 술
  hall.rect(28, 68, 184, 3, M.th0);
  for (const x of [50, 90, 150, 190]) hall.rect(x, 71, 4, 6, M.wall0).rect(x + 1, 77, 4, 6, M.wall0);
  hall.rect(0, 156, 240, 14, M.st1).rect(0, 156, 240, 3, M.st0);
  hall.outline();
  put(g, hall, 320, 236);
  // 에마 걸이
  const ema = new Spr(70, 50);
  ema.rect(4, 12, 4, 38, M.wd1).rect(62, 12, 4, 38, M.wd1).rect(0, 10, 70, 4, M.wd2);
  for (let i = 0; i < 6; i++) ema.poly([[6 + i * 10, 18], [10 + i * 10, 14], [14 + i * 10, 18], [14 + i * 10, 28], [6 + i * 10, 28]], i % 2 ? M.wd0 : M.th0);
  ema.outline();
  put(g, ema, 110, 262);
  put(g, torii(56, 64), 560, 286);
  put(g, lantern(), 190, 250);
  put(g, lantern(), 450, 250);
  return c;
}

// ── 산길 쉼터 (모닥불 · 야마비코 산) ──────────────────────

export function mountainRest(): HTMLCanvasElement {
  const [c, g] = base();
  sky(g, 170, M.dusk);
  // 야마비코 산 (가운데 큰 산)
  for (let x = 0; x < 640; x++) {
    const peak = 30 + Math.abs(x - 330) * 0.55;
    const ridge = 120 + Math.round(Math.sin(x * 0.03) * 10);
    const top = Math.min(peak, ridge);
    for (let y = Math.round(top); y < 170; y++) {
      g.fillStyle = top === peak && y < 62 ? (x < 330 ? M.snow : M.snowShade) : x < 330 ? M.midDusk : M.midDuskShade;
      g.fillRect(x, y, 1, 1);
    }
  }
  ground(g, 170, M.rocky, 6);
  for (const [x, y] of [[60, 210], [120, 190], [540, 200], [600, 230]]) put(g, pine(), x, y);
  for (const [x, y, w, h] of [[200, 330, 30, 16], [470, 340, 24, 14], [40, 300, 18, 10]]) put(g, rock(w, h), x, y);
  // 통나무 의자
  const log = new Spr(60, 14);
  log.rect(2, 3, 56, 9, M.wd1).rect(2, 3, 56, 2, M.wd0).ellipse(4, 7.5, 3, 4.5, M.wd0).ellipse(4, 7.5, 1.5, 2, M.wd2);
  log.outline();
  put(g, log, 400, 268);
  // 모닥불 돌 테두리 (불꽃은 장면에서 움직인다)
  const ring = new Spr(48, 16);
  ring.ellipse(24, 9, 22, 6, M.st1).ellipse(24, 9, 16, 3.5, M.inkSoft);
  ring.line(10, 10, 38, 7, M.wd1).line(10, 7, 38, 11, M.wd1);
  ring.outline();
  put(g, ring, 320, 262);
  return c;
}

export function visitBackground(kind: VisitKind): HTMLCanvasElement {
  // 이벤트는 콘을 만났던 마을 골목에서
  const event = () => alleyBackground(['kaki', 'okaki', 'ika', 'eki']);
  return { shop: teahouse, spring: hotSpring, shrine: shrineFront, event, rest: mountainRest, 'story-suzu': shrineFront, 'story-tengu': mountainRest, 'story-small': event }[kind]();
}

// ── NPC 32px ───────────────────────────────────────────

/** 여우 할멈 (찻집 주인 · 이나리 신을 모신다) */
export function foxGranny(): Spr {
  const s = new Spr(32, 32);
  s.poly([[8, 31], [10, 16], [22, 16], [24, 31]], M.cu1);
  s.rect(10, 16, 12, 4, M.wall0);
  s.poly([[13, 16], [16, 21], [19, 16]], M.red1);
  s.ellipse(16, 10, 7, 6, M.fox1);
  s.poly([[9, 8], [9, 1], [13, 5]], M.fox1).poly([[19, 5], [23, 1], [23, 8]], M.fox1);
  s.ellipse(16, 12, 4, 3, M.wall0);
  s.rect(9, 6, 14, 3, M.wall1);
  s.set(13, 10, M.ink).set(19, 10, M.ink).set(16, 12, M.ink);
  s.rect(12, 31, 8, 1, M.wd2);
  s.outline();
  return s;
}

/** 목소리를 잃은 마을 아저씨 (머리띠 · 남색 옷) */
export function villager(): Spr {
  const s = new Spr(32, 32);
  s.poly([[9, 31], [10, 15], [22, 15], [23, 31]], M.rf1);
  s.rect(15, 15, 2, 16, M.rf2);
  s.rect(8, 16, 3, 9, M.rf1).rect(21, 16, 3, 9, M.rf1);
  s.rect(8, 24, 3, 2, M.skin1).rect(21, 24, 3, 2, M.skin1);
  s.ellipse(16, 9, 6, 6, M.skin0);
  s.rect(10, 3, 12, 4, M.inkSoft);
  s.rect(10, 6, 12, 2, M.wall0);
  s.set(13, 9, M.ink).set(19, 9, M.ink);
  s.rect(14, 12, 4, 1, M.skin1);
  s.rect(10, 31, 12, 1, M.wd2);
  s.outline();
  return s;
}

/** 텐구 (3장 시험관) — 붉은 얼굴 · 긴 코 · 검은 날개 · 수도자 옷 */
export function tenguNpc(): Spr {
  const s = new Spr(40, 36);
  // 날개
  s.poly([[2, 10], [14, 14], [14, 28], [4, 24]], M.inkSoft).poly([[38, 10], [26, 14], [26, 28], [36, 24]], M.inkSoft);
  s.over((x, y, k) => (k === M.inkSoft && (x + y) % 4 === 0 ? '#4a3e60' : undefined));
  // 옷 (흰 수도자 옷 · 둥근 술)
  s.poly([[13, 35], [14, 18], [26, 18], [27, 35]], M.wall0);
  s.rect(19, 18, 2, 17, M.wall2);
  for (const x of [15, 23]) s.ellipse(x, 21, 1.6, 1.6, M.red1);
  s.rect(14, 33, 12, 2, M.wd2);
  // 얼굴 · 코 · 모자
  s.ellipse(20, 11, 6, 6, M.red1);
  s.over((x, _y, k) => (k === M.red1 && x > 23 ? M.red2 : undefined));
  s.poly([[21, 10], [31, 8], [31, 10], [21, 13]], M.red0);
  s.rect(16, 9, 3, 1, M.ink).rect(22, 8, 2, 1, M.ink);
  s.rect(15, 3, 10, 3, M.inkSoft).rect(18, 1, 4, 3, M.inkSoft);
  s.outline();
  return s;
}
