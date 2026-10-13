import { Fine } from './fine';

/**
 * 코토하 2세대 32×32 (오른쪽을 보는 3/4 정면, 발끝 y=31).
 * 머리 · 옷은 점을 하나씩 찍은 격자, 포니테일 · 하카마는 자세에 따라 그때그때 그린다.
 * 앞손은 무기를 쥐고 따로 돌기 때문에 몸 그림에는 없다 (던그리드식 떠 있는 손).
 *
 * 프레임: 0~3 대기(숨쉬기) · 4~11 달리기 · 12 대시 · 13 피격 · 14 눈 깜빡임
 */

// 1~4 머리카락 · a~d 피부 · k 먹 · e 눈동자 · h 눈 빛 · p 볼 · q 입
const HEAD = [
  '....3333333.....',
  '..33222222233...',
  '.3222222222223..',
  '322211111122223.',
  '3221222222122223',
  '3222222222222223',
  '3222223222322223',
  '32222232bb32bb23',
  '3232233babbbbc23',
  '3222223bkkkbkk23',
  '3223223bhEEbhE23',
  '3232223bEeEbeE23',
  '3322223bpbbbbp3.',
  '.332223cbbbdbc..',
  '....33..cccc....',
];

/** 머리 묶은 붉은 리본 (뒤통수) */
const BOW = [
  'rR.Rr', //
  'RRqRR',
  '.qYq.',
  '.R.R.',
  '.q.q.',
];

// w W V U 흰 천 · R r q 주홍 깃
const BODY = [
  '......cc..',
  '.wWWRRqWW.',
  'wWWWWRqWWV',
  'wWWWWWRWWV',
  'WWWWWVWWWV',
  'WWWWWWVWWV',
  'VWWWWWWWVV',
  'VVWWWWWWVU',
];

const BACK_SLEEVE = [
  '..UV', //
  '.UVV',
  'UVVU',
  'UVVU',
  'UVUU',
  'UUU.',
  'UqU.',
  '.U..',
];

const FRONT_SLEEVE = [
  'wW..', //
  'wWV.',
  'wWWV',
  'WWWV',
  'WWVV',
  'VWVU',
  'URVU',
  '.UU.',
];

/** 시전: 부적을 쥔 팔을 높이 든다 · 앞으로 내던진다 */
const CAST_UP = [
  '.fF.', //
  '.fR.',
  '.bb.',
  'wWV.',
  'wWWV',
  'WWWV',
  'VWVU',
];
const CAST_FWD = [
  'wWWVbb..', //
  'WWWVbbfF',
  'VVUU..fR',
];

/** 버선 + 짚신 (앞발 · 뒷발) */
const FOOT_FRONT = ['.WW.', 'WWWV', 'OooO'];
const FOOT_BACK = ['.VV.', 'VVVU', 'XOOX'];

export interface KPose {
  /** 몸이 내려앉는 정도 (+1 아래) */
  bob: number;
  /** 몸을 앞으로 숙임 */
  lean: number;
  /** 앞발 · 뒷발 x 오프셋, 들림 */
  front: number;
  back: number;
  liftF: number;
  liftB: number;
  /** 포니테일 휘날림 (음수 = 뒤로) */
  pony: number;
  /** 소매 흔들림 */
  sleeve: number;
  eyes: 'open' | 'closed' | 'hurt';
  /** 0 평소 · 1 팔 들기 · 2 던지기 */
  cast?: 0 | 1 | 2;
}

/** 포니테일: 뒤통수에서 늘어지는 꼬리 — 휘날림만큼 뒤로 눕고 끝이 늦게 따라온다 */
function ponytail(f: Fine, ax: number, ay: number, pony: number): void {
  const pts: [number, number, number][] = [];
  let x = ax;
  let y = ay;
  const n = 11;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // 아래(π/2)에서 뒤쪽(왼쪽)으로 눕는다 — 끝으로 갈수록 더
    const a = Math.PI / 2 - pony * 0.32 * (0.6 + t * 0.9);
    pts.push([x, y, 2.3 - t * 1.5]);
    x += Math.cos(a) * 1.05;
    y += Math.sin(a) * 1.05;
  }
  // 끝에서부터 그려 뿌리가 위로 오게
  for (let i = n - 1; i >= 0; i--) {
    const [cx, cy, r] = pts[i];
    for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++)
      for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
        const dx = xx + 0.5 - cx;
        const dy = yy + 0.5 - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const tip = i >= n - 3;
        const ch = tip ? '3' : dx < -r * 0.35 ? '3' : dx > r * 0.25 && i > 0 && i < 6 ? '1' : '2';
        f.set(xx, yy, ch);
      }
  }
}

/** 하카마: 허리띠 · 주름 · 두 다리 (보폭에 따라 벌어진다). 뒷다리는 한 단계 어둡게 */
function hakama(f: Fine, top: number, lean: number, front: number, back: number): void {
  const darker: Record<string, string> = { r: 'R', R: 'q', q: 'Q', Q: 'Q' };
  const stride = Math.abs(front - back);
  for (let r = 0; r < 7; r++) {
    const y = top + r;
    const xl = 10 + lean - Math.floor(r / 3) + Math.round((back * r) / 6);
    const xr = 21 + lean + Math.floor(r / 3) + Math.round((front * r) / 6);
    // 다리가 갈라지는 줄 · 틈
    const split = stride >= 3 ? 3 : 5;
    const mid = Math.round((xl + xr) / 2 + (front + back) * 0.15);
    const gap = r >= split ? (stride >= 5 ? 2 : 1) : 0;
    for (let x = xl; x <= xr; x++) {
      if (gap && x >= mid && x < mid + gap) continue;
      const backLeg = gap > 0 && x < mid;
      const pieceL = backLeg || !gap ? xl : mid + gap;
      let ch = (x - pieceL) % 3 === 2 ? 'q' : 'R';
      if (x === pieceL) ch = 'r';
      if (x === xr || (backLeg && x === mid - 1)) ch = 'q';
      if (r === 0) ch = x <= xl + 1 ? 'r' : x >= xr - 1 ? 'q' : 'R';
      if (r === 6) ch = ch === 'q' ? 'Q' : 'q';
      if (backLeg) ch = darker[ch];
      f.set(x, y, ch);
    }
  }
  // 앞쪽 허리끈 매듭과 늘어진 끈
  f.set(19 + lean, top, 'r').set(20 + lean, top, 'R').set(19 + lean, top + 1, 'R');
  f.set(20 + lean, top + 1, 'q').set(20 + lean, top + 2, 'q').set(19 + lean, top + 2, 'Q');
}

function eyes(f: Fine, hx: number, hy: number, kind: KPose['eyes']): void {
  if (kind === 'open') return;
  // 눈 자리를 피부로 덮고
  for (let y = 9; y <= 11; y++) {
    for (const x of [8, 9, 10, 12, 13]) f.set(hx + x, hy + y, 'b');
  }
  if (kind === 'closed') {
    for (const x of [8, 9, 10]) f.set(hx + x, hy + 10, 'k');
    f.set(hx + 12, hy + 10, 'k').set(hx + 13, hy + 10, 'k');
  } else {
    // > <  질끈 감은 눈 + 벌린 입
    f.set(hx + 8, hy + 9, 'k').set(hx + 9, hy + 10, 'k').set(hx + 8, hy + 11, 'k');
    f.set(hx + 13, hy + 9, 'k').set(hx + 12, hy + 10, 'k').set(hx + 13, hy + 11, 'k');
    f.set(hx + 11, hy + 13, 'Q').set(hx + 12, hy + 13, 'Q');
  }
}

export function kotohaFrame(p: KPose): HTMLCanvasElement {
  const f = new Fine(32, 32);
  const L = p.lean;
  const hx = 8 + L;
  const hy = 1 + p.bob;
  ponytail(f, hx + 1.5, hy + 6.5, p.pony);
  f.stamp(BACK_SLEEVE, 7 + L + Math.min(0, p.sleeve), 17 + p.bob);
  f.stamp(FOOT_BACK, 11 + p.back, 29 - p.liftB);
  f.stamp(FOOT_FRONT, 16 + p.front, 29 - p.liftF);
  f.stamp(BODY, 10 + L, 16 + p.bob);
  hakama(f, 23 + p.bob, L, p.front, p.back);
  if (p.cast === 1) f.stamp(CAST_UP, 19 + L, 11 + p.bob);
  else if (p.cast === 2) f.stamp(CAST_FWD, 18 + L, 17 + p.bob);
  else f.stamp(FRONT_SLEEVE, 18 + L + Math.min(0, p.sleeve), 17 + p.bob + (p.sleeve < -1 ? -1 : 0));
  f.stamp(HEAD, hx, hy);
  eyes(f, hx, hy, p.eyes);
  f.stamp(BOW, hx - 1, hy + 3);
  return f.canvas();
}

const STAND: KPose = { bob: 0, lean: 0, front: 0, back: 0, liftF: 0, liftB: 0, pony: 0, sleeve: 0, eyes: 'open' };

/** 15프레임 (위 주석 순서) */
export function kotohaFrames(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  // 대기: 숨을 들이쉬고 내쉬며 포니테일이 느리게 따라온다
  const idle = [
    { bob: 0, pony: 0.1, sleeve: 0 },
    { bob: 0, pony: 0.35, sleeve: 0 },
    { bob: 1, pony: 0.5, sleeve: -1 },
    { bob: 1, pony: 0.25, sleeve: 0 },
  ];
  for (const k of idle) out.push(kotohaFrame({ ...STAND, ...k }));
  // 달리기 8프레임: 발이 닿을 때 내려앉고, 지날 때 떠오른다
  for (let i = 0; i < 8; i++) {
    const ph = (i / 8) * Math.PI * 2;
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    out.push(
      kotohaFrame({
        bob: Math.abs(s) > 0.7 ? 1 : Math.abs(s) < 0.3 ? -1 : 0,
        lean: 1,
        front: Math.round(3.5 * s),
        back: -Math.round(3.5 * s),
        liftF: Math.max(0, Math.round(2 * c)),
        liftB: Math.max(0, Math.round(-2 * c)),
        pony: -1.6 + 0.6 * Math.cos(ph - 1.2),
        sleeve: -1 - (c > 0 ? 1 : 0),
        eyes: 'open',
      }),
    );
  }
  // 대시: 크게 숙이고 다리를 벌리고 머리카락이 뒤로 곧게
  out.push(kotohaFrame({ bob: 1, lean: 2, front: 4, back: -4, liftF: 1, liftB: 1, pony: -2.6, sleeve: -2, eyes: 'open' }));
  // 피격: 뒤로 젖히고 > < 눈
  out.push(kotohaFrame({ ...STAND, lean: -1, pony: 0.9, sleeve: 0, eyes: 'hurt' }));
  // 깜빡임
  out.push(kotohaFrame({ ...STAND, eyes: 'closed' }));
  // 시전 (부적 들기 · 던지기)
  out.push(kotohaFrame({ ...STAND, pony: 0.3, cast: 1 }));
  out.push(kotohaFrame({ ...STAND, lean: 1, pony: -0.4, cast: 2 }));
  return out;
}

export const K2 = { idle: [0, 1, 2, 3], run: [4, 5, 6, 7, 8, 9, 10, 11], dash: 12, hurt: 13, blink: 14, cast: [15, 16] } as const;

/** 무기를 쥔 손 (3×3) */
export function handCanvas(): HTMLCanvasElement {
  return new Fine(5, 5).stamp(['bb.', 'bbc', 'cc.'], 1, 1).canvas();
}
