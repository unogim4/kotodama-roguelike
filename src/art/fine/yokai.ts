import { Fine, bayer } from './fine';

/**
 * 장별 새 요괴 (2세대 세밀 도트, 4프레임씩).
 * 1장 초칭오바케 · 2장 코갓파 · 카와우소 · 3장 코다마 · 카마이타치 · 4장 꼬마 오니 · 잇탄모멘 · 그리고 글자 요괴
 */

const ell = (f: Fine, cx: number, cy: number, rx: number, ry: number, pick: (nx: number, ny: number, x: number, y: number) => string | null) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const ch = pick(nx, ny, x, y);
      if (ch) f.set(x, y, ch);
    }
};

/** 빛은 왼쪽 위 — 4단계 램프에서 고른다 */
const shade4 = (ramp: string, nx: number, ny: number, x: number, y: number, bias = 0) => {
  const v = (nx * 0.7 + ny * 0.8) * 0.5 + 0.5 + bias + (bayer(x, y) - 0.5) * 0.18;
  return ramp[v < 0.3 ? 0 : v < 0.58 ? 1 : v < 0.82 ? 2 : 3];
};

// ── 1장 · 초칭오바케 (등불 요괴) 22×30 — 멀리서 불씨를 쏜다 ─────────

function chochin(fi: number): HTMLCanvasElement {
  const f = new Fine(22, 30);
  const bob = [0, -1, 0, 1][fi];
  const cy = 15 + bob;
  // 손잡이 고리
  f.set(11, 1 + bob, 'X').set(10, 2 + bob, 'X').set(12, 2 + bob, 'X');
  // 등 몸통: 종이 + 대나무 살 + 안쪽 불빛
  ell(f, 11, cy, 8.5, 10, (nx, ny, _x, y) => {
    const glow = 1 - Math.hypot(nx, ny);
    if ((y - cy + 30) % 3 === 0) return 'g';
    if (glow > 0.62 - (fi % 2) * 0.08) return 'y';
    if (glow > 0.35) return 'f';
    return nx > 0.35 ? 'g' : 'F';
  });
  f.stamp(['XXXXXXXX', 'OOOOOOOO'], 7, cy - 11);
  f.stamp(['OOOOOOOO', 'XXXXXXXX'], 7, cy + 10);
  // 외눈 · 찢어진 입 · 혀
  f.stamp(['kkk', 'khk', 'kkk'], 7, cy - 5);
  for (let x = 5; x <= 16; x++) f.set(x, cy + 3 + (x % 3 === 0 ? 1 : 0), 'Q');
  const tx = [0, 1, 0, -1][fi];
  for (let i = 0; i < 6; i++) f.set(13 + Math.round((tx * i) / 3), cy + 4 + i, i > 3 ? 'q' : 'R').set(14 + Math.round((tx * i) / 3), cy + 4 + i, 'r');
  return f.canvas();
}

// ── 2장 · 코갓파 18×18 — 떼로 몰려온다 ──────────────────────────

function kogappa(fi: number): HTMLCanvasElement {
  const f = new Fine(18, 18);
  const step = fi % 2;
  const bob = fi === 1 || fi === 3 ? -1 : 0;
  // 다리
  f.set(6 - step, 16, '7').set(7 - step, 16, '7').set(11 + step, 16, '7').set(12 + step, 16, '7');
  // 등껍질 (뒤) · 몸
  ell(f, 9, 11 + bob, 6.5, 5, (nx, ny, x, y) => shade4('HIJK', nx, ny, x, y, 0.15));
  ell(f, 9, 11 + bob, 4.8, 4.2, (nx, ny, x, y) => shade4('5678', nx, ny, x, y));
  // 머리 · 접시 · 부리 · 눈
  ell(f, 9, 6 + bob, 4.5, 4, (nx, ny, x, y) => shade4('5678', nx, ny, x, y, -0.1));
  f.stamp(['WWWW', '.VV.'], 7, 2 + bob);
  f.set(7, 6 + bob, 'k').set(11, 6 + bob, 'k').set(7, 5 + bob, 'h');
  f.stamp(['YY', 'zz'], 8, 8 + bob);
  return f.canvas();
}

// ── 2장 · 카와우소 (수달) 28×16 — 몸을 낮췄다가 돌진 ─────────────

function kawauso(fi: number): HTMLCanvasElement {
  const f = new Fine(28, 16);
  // fi 0·1 달리기 · 2 웅크림(예고) · 3 돌진(길게)
  const stretch = fi === 3 ? 3 : fi === 2 ? -2 : 0;
  const low = fi === 2 ? 1 : 0;
  // 꼬리
  for (let i = 0; i < 7; i++) f.set(2 + i - (fi === 3 ? 1 : 0), 10 + low - Math.round(i * 0.4) + (fi % 2), i < 3 ? 'J' : 'I');
  // 몸통
  ell(f, 13 + stretch / 2, 10 + low, 7 + stretch, 3.6, (nx, ny, x, y) => (ny > 0.35 ? 'H' : shade4('HIJK', nx, ny, x, y, 0.1)));
  // 머리 · 흰 얼굴 · 눈 · 코
  const hx = 21 + stretch;
  ell(f, hx, 8 + low, 3.6, 3.2, (nx, ny, x, y) => (nx > 0.1 && ny > -0.2 ? 'H' : shade4('HIJK', nx, ny, x, y)));
  f.set(hx + 1, 7 + low, 'k').set(hx + 3, 9 + low, 'K').set(hx - 1, 5 + low, 'J');
  // 다리
  const legs = fi === 3 ? [[8, 14], [18, 14]] : fi === 2 ? [[10, 14], [16, 14]] : fi === 0 ? [[9, 14], [17, 14]] : [[11, 14], [15, 14]];
  for (const [lx, ly] of legs) f.set(lx, ly, 'J').set(lx + 1, ly, 'K');
  return f.canvas();
}

// ── 3장 · 코다마 (나무 정령) 14×16 — 작고 많다 · 고개를 갸웃 ─────────

function kodama(fi: number): HTMLCanvasElement {
  const f = new Fine(14, 16);
  const tilt = [0, 1, 0, -1][fi];
  const bob = fi === 2 ? -1 : 0;
  // 몸 (작은 흰 몸 + 잎사귀)
  f.stamp(['.VW.', 'VWWV', '.VV.'], 5, 11 + bob);
  f.set(4, 12 + bob, 'G').set(9, 12 + bob, 'G');
  // 머리 (흰 둥근 머리 · 구멍 같은 눈과 입)
  ell(f, 7 + tilt * 0.5, 6 + bob, 5, 4.6, (nx, ny, x, y) => shade4('wWVU', nx, ny, x, y, -0.05));
  f.set(5 + tilt, 5 + bob, 'k').set(5 + tilt, 6 + bob, 'k').set(9 + tilt, 5 + bob, 'k').set(9 + tilt, 6 + bob, 'k');
  f.set(7 + tilt, 8 + bob, 'k');
  return f.canvas();
}

// ── 3장 · 카마이타치 (낫 족제비) 26×18 — 지그재그로 달리다 베고 지나간다 ──

function kamaitachi(fi: number): HTMLCanvasElement {
  const f = new Fine(26, 18);
  const lean = fi === 3 ? 2 : 0;
  // 바람 꼬리
  for (let i = 0; i < 6; i++) f.set(2 + i, 9 - Math.round(Math.sin(i * 0.9 + fi) * 2), i % 2 ? 'W' : 'V');
  // 몸
  ell(f, 12 + lean, 10, 6, 3.2, (nx, ny, x, y) => (ny > 0.3 ? 'H' : shade4('HHIJ', nx, ny, x, y)));
  ell(f, 18 + lean, 7, 3.4, 3, (nx, ny, x, y) => (nx > 0.2 ? 'H' : shade4('HIJK', nx, ny, x, y)));
  f.set(19 + lean, 6, 'k').set(21 + lean, 8, 'K').set(17 + lean, 4, 'I');
  // 낫 팔 (자세마다)
  const arm =
    fi === 2
      ? ['..SS', '.St.', 'St..', 'o...']
      : fi === 3
        ? ['....', 'oStS', '..tS', '...s']
        : ['.SS.', 'S..t', 'o...', '....'];
  f.stamp(arm, 15 + lean, fi === 2 ? 1 : 8);
  // 다리
  const k = fi % 2;
  f.set(9 + k, 13, 'J').set(15 - k, 13, 'J').set(9 + k, 14, 'K').set(15 - k, 14, 'K');
  return f.canvas();
}

// ── 4장 · 꼬마 오니 24×26 — 단단하고 느리다 · 몽둥이 내려치기 ──────────

function kooni(fi: number): HTMLCanvasElement {
  const f = new Fine(26, 26);
  const step = fi % 2;
  // 몽둥이 (fi 2 = 들어 올림 · 3 = 내려침)
  const club = fi === 2 ? ['.OO', '.oO', '.o.', '.o.', 'o..'] : fi === 3 ? ['ooooOOO', '....OOO'] : ['o..', 'o..', 'oO.', 'OO.', 'OO.'];
  if (fi === 2) f.stamp(club, 17, 0);
  // 다리
  f.stamp(['qq', 'QQ'], 8 - step, 22).stamp(['qq', 'QQ'], 14 + step, 22);
  // 호피 허리감개
  f.stamp(['YkYYkYYk', 'zYYkYYkY'], 8, 19);
  // 몸 · 머리
  ell(f, 12, 15, 6, 5, (nx, ny, x, y) => shade4('rRqQ', nx, ny, x, y));
  ell(f, 12, 7, 5.5, 5, (nx, ny, x, y) => shade4('rRqQ', nx, ny, x, y, -0.05));
  // 뿔 · 곱슬머리 · 눈 · 송곳니
  f.set(9, 1, 'Y').set(9, 2, 'Y').set(15, 1, 'Y').set(15, 2, 'Y');
  for (const x of [8, 10, 12, 14, 16]) f.set(x, 3, '4');
  f.stamp(['yk.ky'], 9, 6);
  f.stamp(['QQQQQ', 'w...w'], 10, 9);
  // 팔 + 몽둥이
  if (fi === 3) f.stamp(club, 15, 13);
  else if (fi !== 2) f.stamp(club, 18, 11);
  f.set(18, 13, 'R').set(5, 14, 'R').set(6, 15, 'q');
  return f.canvas();
}

// ── 4장 · 잇탄모멘 (한 필 무명) 34×16 — 물결치며 날아와 감는다 ─────────

function ittan(fi: number): HTMLCanvasElement {
  const f = new Fine(34, 16);
  const ph = (fi / 4) * Math.PI * 2;
  for (let x = 2; x < 32; x++) {
    const t = (x - 2) / 30;
    const cy = 8 + Math.sin(ph + x * 0.32) * 3.2 * t;
    const half = 2.6 - t * 1.2;
    for (let y = Math.floor(cy - half); y <= Math.ceil(cy + half); y++) {
      const d = (y + 0.5 - cy) / half;
      if (Math.abs(d) > 1) continue;
      f.set(x, y, d < -0.4 ? 'w' : d < 0.35 ? 'W' : d < 0.8 ? 'V' : 'U');
    }
  }
  // 머리 쪽 (왼쪽 끝) 눈
  const hy = 8;
  f.set(4, hy - 1, 'k').set(7, hy - 1, 'k').set(4, hy - 2, 'h');
  return f.canvas();
}

// ── 글자 요괴 22×24 — 먹물 덩어리 + 이마의 빈 부적 (가나는 DOM으로 그 위에) ──

function moji(fi: number): HTMLCanvasElement {
  const f = new Fine(22, 24);
  const sq = [0, 1, 0, -1][fi];
  // 흘러내리는 먹 방울
  for (const [dx, len] of [[6, 3 + (fi % 2)], [11, 2], [15, 3 - (fi % 2)]]) for (let i = 0; i < len; i++) f.set(dx, 21 + i - 1, i === len - 1 ? 'x' : 'P');
  ell(f, 11, 13, 9 + sq * 0.5, 8.5 - sq * 0.5, (nx, ny, x, y) => {
    if (nx < -0.25 && ny < -0.35 && nx * nx + ny * ny > 0.25) return 'L';
    return shade4('LPPx', nx, ny, x, y, 0.1);
  });
  // 빛나는 눈
  f.set(7, 9, 'y').set(8, 9, 'Y').set(14, 9, 'Y').set(15, 9, 'y');
  // 빈 부적 (글자 자리)
  f.stamp(['ffffffff', 'fFFFFFFf', 'fFFFFFFf', 'fFFFFFFf', 'fFFFFFFf', 'ggggRggg'], 7, 11);
  return f.canvas();
}

export interface YokaiArt {
  key: string;
  frames: () => HTMLCanvasElement[];
  w: number;
  h: number;
}

const four = (fn: (i: number) => HTMLCanvasElement) => () => [0, 1, 2, 3].map(fn);

export const YOKAI_ART: YokaiArt[] = [
  { key: 'y-chochin', frames: four(chochin), w: 22, h: 30 },
  { key: 'y-kogappa', frames: four(kogappa), w: 18, h: 18 },
  { key: 'y-kawauso', frames: four(kawauso), w: 28, h: 16 },
  { key: 'y-kodama', frames: four(kodama), w: 14, h: 16 },
  { key: 'y-kamaitachi', frames: four(kamaitachi), w: 26, h: 18 },
  { key: 'y-kooni', frames: four(kooni), w: 26, h: 26 },
  { key: 'y-ittan', frames: four(ittan), w: 34, h: 16 },
  { key: 'y-moji', frames: four(moji), w: 22, h: 24 },
];

/** 불씨 탄 (초칭오바케) */
export function emberArt(): HTMLCanvasElement {
  return new Fine(8, 8).stamp(['.yY.', 'yyYz', 'YYzZ', '.zZ.'], 2, 2).canvas();
}
