import { Spr, M, Buf, noise, hash, dith, shade, cedar, broadleaf, bush, pine, rock, house, lantern, torii, signPosts, stall, mushroom, jizo, sakura } from './worldMap';
import { rng, MAP_H, layerX } from '../../map/chapter1';
import type { ChapterDef } from '../../data/chapters';

/**
 * 2~4장 지역 지도 (가로 두루마리 · 컬러 풍경 도트) — 1장 지도와 같은 도구로 장마다 다른 테마.
 * river 강가 마을 · forest 깊은 숲과 산길 · capital 옛 도성.
 * 가운데 띠(노드가 다니는 곳)는 비워 두고, 위 · 아래 띠에 풍경을 빽빽하게 놓는다.
 */

const H = MAP_H;

interface Theme {
  sky: string[];
  far: string;
  ridge: string;
  ridgeShade: string;
  /** 지역 4구간의 땅 색 (각 3~4단) */
  grounds: string[][];
  tree: [string, string];
  /** 땅 위 잔무늬 (잔디 · 자갈) */
  speck: [string, string];
  stars?: boolean;
}

const THEMES: Record<'river' | 'forest' | 'capital', Theme> = {
  river: {
    sky: ['#7cc0ec', '#98d0f0', '#b4def4', '#cfeaf8', '#e8f6fc'],
    far: '#a9c4e0',
    ridge: '#86a8c8',
    ridgeShade: '#6a8cb0',
    grounds: [
      ['#e4d4a0', '#d2c088', '#bca870'],
      ['#b6dd7c', '#98ca64', '#7cb254'],
      ['#c8d070', '#aab45c', '#8c984c'],
      ['#7aa860', '#5e8e4e', '#4a7442'],
    ],
    tree: [M.tree0, M.tree1],
    speck: [M.tree0, M.leaf0],
  },
  forest: {
    sky: ['#4a3a6a', '#6a4a7a', '#9a5a7a', '#c87a72', '#e8a07a'],
    far: '#6a5a8a',
    ridge: '#4a4070',
    ridgeShade: '#3a3058',
    grounds: [
      ['#76aa58', '#5c9248', '#467a3e'],
      ['#5c9248', '#467a3e', '#33613a'],
      ['#6a8a6a', '#567660', '#425e52'],
      ['#8a8070', '#6e665c', '#56504a'],
    ],
    tree: [M.tree1, M.tree2],
    speck: [M.tree2, M.forest[0]],
  },
  capital: {
    sky: ['#141a3a', '#1e2650', '#2a3466', '#36427a', '#4a5690'],
    far: '#2e3460',
    ridge: '#262a50',
    ridgeShade: '#1c2040',
    grounds: [
      ['#9a9488', '#88827a', '#76706a'],
      ['#b4ac9c', '#a0988a', '#8c8478'],
      ['#8a8478', '#767066', '#625c56'],
      ['#7a5a5a', '#664a4c', '#523c40'],
    ],
    tree: ['#2a3a2e', '#1c2a22'],
    speck: ['#5c5650', '#c8c0b0'],
    stars: true,
  },
};

function horizon(x: number): number {
  return 86 + Math.round((noise(x, 0, 50, 3) - 0.5) * 8);
}

// ── 테마 소품 ──────────────────────────────────────────

/** 물레방아 집 (초가집 + 바퀴) */
function watermill(): HTMLCanvasElement {
  const s = new Spr(20, 20);
  s.ellipse(10, 10, 9, 9, M.wd1);
  s.ellipse(10, 10, 6, 6, null);
  for (let a = 0; a < 8; a++) s.line(10, 10, 10 + Math.cos((a / 8) * Math.PI * 2) * 8, 10 + Math.sin((a / 8) * Math.PI * 2) * 8, M.wd2);
  s.ellipse(10, 10, 2, 2, M.wd2);
  s.outline();
  return merge(s.canvas(), house('thatch').canvas(), 8);
}

/** 두 그림을 겹친다 (b를 오른쪽 아래에) */
function merge(a: HTMLCanvasElement, b: HTMLCanvasElement, dx: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(a.width, b.width + dx);
  c.height = Math.max(a.height, b.height);
  const g = c.getContext('2d')!;
  g.drawImage(b, dx, c.height - b.height);
  g.drawImage(a, 0, c.height - a.height);
  return c;
}

function boat(): Spr {
  const s = new Spr(36, 14);
  s.poly([[0, 6], [36, 6], [30, 13], [6, 13]], M.wd1);
  s.rect(2, 6, 32, 2, M.wd0);
  s.rect(16, 0, 2, 6, M.wd2);
  s.rect(18, 1, 8, 4, M.wall1);
  s.outline();
  return s;
}

function reeds(): Spr {
  const s = new Spr(18, 18);
  for (let i = 0; i < 6; i++) {
    const x = 2 + i * 3;
    const h = 10 + ((i * 5) % 7);
    s.line(x, 17, x + (i % 2 ? 1 : -1), 17 - h, M.th1);
    s.rect(x - 1 + (i % 2 ? 1 : -1), 17 - h - 1, 2, 3, M.wd1);
  }
  s.outline(M.tree1);
  return s;
}

function willow(): Spr {
  const s = new Spr(30, 34);
  s.rect(14, 18, 3, 15, M.wd2);
  s.ellipse(15, 12, 12, 9, M.leaf1);
  for (let x = 4; x < 27; x += 3) s.line(x, 12, x + (x % 2 ? 1 : -1), 26 + (x % 5), M.leaf1);
  s.over((x, y, k) => (k === M.leaf1 && (x + y) % 4 === 0 ? M.leaf0 : k === M.leaf1 && y > 20 ? M.tree0 : undefined));
  s.outline();
  return s;
}

function bigRock(): Spr {
  const s = new Spr(70, 60);
  s.poly([[4, 59], [10, 20], [26, 4], [44, 2], [60, 18], [68, 59]], M.st1);
  s.over((x, y, k) => (k === M.st1 ? (x > 44 ? M.st2 : x < 22 && y < 40 ? M.st0 : (x * 3 + y) % 13 === 0 ? M.st2 : undefined) : undefined));
  s.rect(30, 6, 14, 3, M.th0);
  s.outline();
  return s;
}

function wallSeg(): Spr {
  const s = new Spr(48, 30);
  s.rect(0, 10, 48, 20, M.wall1);
  s.rect(0, 26, 48, 4, M.st2);
  s.poly([[-2, 12], [4, 2], [44, 2], [50, 12]], M.rf2);
  s.over((_x, y, k) => (k === M.rf2 && y % 3 === 0 ? M.rf1 : undefined));
  s.outline();
  return s;
}

function gate(red = false): Spr {
  const s = new Spr(84, 70);
  const pil = red ? M.red1 : M.wd1;
  s.rect(8, 22, 8, 46, pil).rect(68, 22, 8, 46, pil).rect(30, 22, 6, 46, pil).rect(48, 22, 6, 46, pil);
  s.rect(4, 18, 76, 6, red ? M.red2 : M.wd2);
  s.poly([[0, 20], [10, 4], [74, 4], [84, 20]], red ? M.inkSoft : M.rf1);
  s.over((_x, y, k) => (k === M.rf1 && y % 3 === 0 ? M.rf2 : undefined));
  s.rect(36, 8, 12, 8, M.wd2).rect(38, 10, 8, 4, M.gold1);
  s.outline();
  return s;
}

function brokenPillar(h: number): Spr {
  const s = new Spr(12, h + 4);
  s.rect(3, 4, 6, h, M.red2);
  s.rect(3, 4, 2, h, M.red1);
  s.poly([[3, 4], [6, 0], [9, 5]], M.red2);
  s.rect(1, h + 1, 10, 3, M.st2);
  s.outline();
  return s;
}

// ── 그리기 ────────────────────────────────────────────

/** 2~4장 지도 한 장 (너비는 장의 층 수에 맞춘다) */
export function themedWorld(def: ChapterDef, W: number): HTMLCanvasElement {
  const theme = THEMES[def.theme as 'river' | 'forest' | 'capital'];
  const b = new Buf(W, H);
  const regionAt = (x: number, y: number) => {
    const f = (x + (noise(x, y, 36, 5) - 0.5) * 70) / W;
    let r = 0;
    def.regions.forEach((g, i) => f >= g.from && (r = i));
    return r;
  };

  // 하늘 · 먼 산
  for (let x = 0; x < W; x++) {
    const hz = horizon(x);
    const farY = 34 + Math.round(noise(x, 0, 80, 11 + def.num) * 26);
    const ridgeY = 56 + Math.round(noise(x, 0, 60, 21 + def.num) * 22);
    const lit = noise(x + 6, 0, 60, 21 + def.num) < noise(x - 6, 0, 60, 21 + def.num);
    for (let y = 0; y < hz; y++) {
      let col: string;
      if (y >= ridgeY) col = lit ? theme.ridge : theme.ridgeShade;
      else if (y >= farY) col = theme.far;
      else {
        const i = Math.max(0, Math.min(4, Math.floor((y / (hz * 0.8)) * 5 + (dith(x, y) - 0.5) * 0.8)));
        col = theme.sky[i];
        if (theme.stars && hash(x, y, 3) < 0.004) col = '#fffaf0';
      }
      b.put(x, y, col);
    }
  }
  // 달 (밤 하늘)
  if (theme.stars) {
    const mx = Math.round(W * 0.82);
    for (let y = 8; y < 40; y++) for (let x = mx - 16; x < mx + 16; x++) {
      const d = Math.hypot(x - mx, y - 24);
      if (d < 13) b.put(x, y, d < 11 ? '#fff4c8' : '#e8d8a0');
    }
  }
  // 땅
  for (let x = 0; x < W; x++) {
    for (let y = horizon(x); y < H; y++) {
      const t = noise(x, y, 22, 7) * 0.7 + noise(x, y, 7, 8) * 0.3;
      b.put(x, y, shade(theme.grounds[regionAt(x, y)], t, x, y));
    }
  }
  // 잔무늬
  const rand = rng(41 + def.num);
  for (let i = 0; i < W * 2.6; i++) {
    const x = Math.floor(rand() * W);
    const y = horizon(x) + 6 + Math.floor(rand() * (H - horizon(x) - 6));
    b.put(x, y, theme.speck[0]);
    b.put(x - 1, y - 1, theme.speck[0]);
    b.put(x + 1, y - 1, theme.speck[0]);
    b.put(x, y - 1, theme.speck[1]);
  }

  // 테마 지형: 강(2장) · 안개(3장) · 돌길(4장)
  if (def.theme === 'river') {
    // 아래 띠를 가로지르는 큰 강
    for (let x = 0; x < W; x++) {
      const top = 300 + Math.round(Math.sin(x / 90) * 6);
      for (let y = top - 3; y < H; y++) {
        const k = y - top;
        b.put(x, y, k < 0 ? M.dirt0 : k < 2 ? M.wa1 : hash(x, y, 7) < 0.05 ? M.wa0 : y > 336 ? M.wa3 : M.wa2);
      }
    }
    // 갓파 연못 (오른쪽 위)
    const px = W * 0.86;
    for (let y = 92; y < 140; y++) for (let x = px - 90; x < px + 90; x++) {
      const d = ((x - px) / 90) ** 2 + ((y - 116) / 22) ** 2;
      if (d < 1) b.put(x, y, d > 0.85 ? M.tree0 : hash(x, y, 9) < 0.05 ? M.wa0 : '#4a8a8a');
    }
  } else if (def.theme === 'forest') {
    // 안개: 가운데 고개 쪽에 흰 안개
    for (let x = 0; x < W; x++) for (let y = 120; y < H; y++) {
      const m = noise(x, y, 70, 77) - 0.62 + (Math.abs(x / W - 0.62) < 0.18 ? 0.12 : 0);
      if (m > 0 && dith(x, y) < m * 2.4) b.put(x, y, '#c8c4d8');
    }
  } else {
    // 도성: 가운데 넓은 돌길(판석)
    for (let x = 0; x < W; x++) for (let y = 176; y < 236; y++) {
      const ix = (x + (Math.floor(y / 12) % 2 ? 12 : 0)) % 24;
      b.put(x, y, (y - 176) % 12 === 0 || ix === 0 ? M.st2 : hash(x, y, 5) < 0.04 ? M.st0 : M.st1);
    }
  }

  // 지평선 나무 띠
  for (let x = 0; x < W; x++) {
    const hz = horizon(x);
    const h = 4 + Math.round(Math.abs(Math.sin(x * 0.42)) * 5 + noise(x, 0, 9, 4) * 5);
    for (let y = hz - h; y < hz + 3; y++) b.put(x, y, y === hz - h ? theme.tree[0] : theme.tree[1]);
  }

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.putImageData(b.img, 0, 0);

  // 풍경 도트 — 위 · 아래 띠 (가운데는 노드가 다니도록 비움)
  const props: { art: HTMLCanvasElement; x: number; y: number }[] = [];
  const cache = new Map<string, HTMLCanvasElement>();
  const put = (key: string, make: () => Spr | HTMLCanvasElement, x: number, y: number) => {
    let a = cache.get(key);
    if (!a) {
      const m = make();
      cache.set(key, (a = m instanceof Spr ? m.canvas() : m));
    }
    props.push({ art: a, x, y });
  };
  const r = rng(61 + def.num);
  const rr = (a: number, z: number) => a + r() * (z - a);
  const layers = def.layers.length;
  const clear = (x: number, pad = 34) => {
    for (let l = 0; l < layers; l++) if (Math.abs(x - layerX(l)) < pad) return false;
    return true;
  };

  if (def.theme === 'river') {
    for (let x = 20; x < W; x += 38) {
      const f = x / W;
      const top = rr(98, 124);
      if (f < 0.27) put(r() < 0.5 ? 'house-t' : 'willow', r() < 0.5 ? () => house('tile') : willow, x + rr(-6, 6), top);
      else if (f < 0.53) {
        const roll = r();
        if (roll < 0.35) put('mill', watermill, x, top);
        else if (roll < 0.65) put('house-th', () => house('thatch'), x, top);
        else put('willow', willow, x, top);
      } else if (f < 0.77) put('reeds', reeds, x + rr(-8, 8), top);
      else if (x > W * 0.96) put('willow', willow, x, top);
      // 강가 (아래 띠): 갈대 · 배
      if (r() < 0.55) put('reeds', reeds, x + rr(-10, 10), rr(296, 304));
      if (r() < 0.18) put('boat', boat, x + rr(-10, 10), rr(330, 352));
    }
    for (let i = 0; i < 10; i++) {
      const x = rr(40, W - 40);
      if (clear(x)) put('bush', bush, x, rr(150, 270));
    }
  } else if (def.theme === 'forest') {
    for (let x = 10; x < W; x += 12) {
      put('cedar', () => cedar(32), x + rr(-4, 4), rr(100, 126));
      if (r() < 0.6) put('cedar-s', () => cedar(24), x + rr(-4, 4), rr(112, 130));
      put('cedar', () => cedar(32), x + rr(-4, 4), rr(320, 360));
      if (r() < 0.5) put('cedar-s', () => cedar(24), x + rr(-4, 4), rr(296, 326));
    }
    for (let i = 0; i < Math.round(W / 90); i++) {
      const x = rr(40, W - 40);
      if (!clear(x)) continue;
      put(r() < 0.6 ? 'cedar' : 'broadleaf', r() < 0.6 ? () => cedar(32) : broadleaf, x, rr(160, 280));
    }
    for (let i = 0; i < 24; i++) {
      const x = rr(20, W - 20);
      if (clear(x, 22)) put('mush', mushroom, x, rr(140, 296));
    }
    for (const f of [0.3, 0.55]) put('jizo', jizo, W * f + 30, 150);
    // 고개의 토리이 길 · 텐구 바위
    for (let k = 0; k < 4; k++) put('torii-f', () => torii(30, 32), W * 0.6 + k * 26, 128);
    put('bigrock', bigRock, W * 0.9, 126);
  } else {
    // 옛 도성: 위 띠는 기와 담장, 성문 · 장터 · 궁궐 기둥 · 붉은 오니 문
    for (let x = 24; x < W; x += 46) put('wall', wallSeg, x, 128);
    put('gate', () => gate(false), 60, 150);
    put('oni-gate', () => gate(true), W * 0.9, 150);
    for (let x = 20; x < W; x += 34) {
      const f = x / W;
      if (f > 0.25 && f < 0.52 && r() < 0.6) put('stall', stall, x + rr(-6, 6), rr(312, 336));
      else if (f > 0.52 && f < 0.78) put(`pillar-${Math.floor(r() * 3)}`, () => brokenPillar(18 + Math.floor(r() * 3) * 10), x + rr(-8, 8), rr(300, 350));
      else if (r() < 0.5) put('house-t', () => house('tile', true), x + rr(-6, 6), rr(330, 356));
      if (r() < 0.3) put('lantern', lantern, x + rr(-10, 10), rr(246, 262));
    }
    for (let i = 0; i < 8; i++) {
      const x = rr(40, W - 40);
      if (clear(x)) put('pine', pine, x, rr(150, 170));
    }
    for (const x of [W * 0.1, W * 0.44]) put('sakura', sakura, x, 340);
  }
  for (let i = 0; i < 8; i++) put(`rock-${i % 3}`, () => rock(10 + (i % 3) * 5, 6 + (i % 3) * 3), rr(20, W - 20), rr(330, 358));

  // 간판 기둥 (글자는 화면 층에서)
  for (const s of def.signs) put('sign-posts', signPosts, Math.round(s.at * W), 318 + 11);

  props.sort((p, q) => p.y - q.y);
  for (const p of props) g.drawImage(p.art, Math.round(p.x - p.art.width / 2), Math.round(p.y - p.art.height));
  return c;
}
