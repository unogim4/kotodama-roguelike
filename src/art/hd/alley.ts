import { Spr, M } from './worldMap';

/**
 * 콘과의 만남 — 마을 골목 640×360.
 * 뒤쪽에 가게 4채(간판 글자는 화면 층에서 올린다), 앞쪽은 돌길.
 */
export type ShopKind = 'kaki' | 'okaki' | 'eki' | 'ika';

export const ALLEY = {
  /** 돌길이 시작되는 높이 (가게 앞) */
  streetY: 214,
  /** 가게 가운데 x */
  shopXs: [92, 244, 396, 548],
  shopW: 136,
  /** 간판 판자 가운데 y */
  signY: 93,
};

function facade(kind: ShopKind): Spr {
  const W = ALLEY.shopW;
  const H = 186;
  const s = new Spr(W, H);
  // 벽 · 기둥
  s.rect(4, 34, W - 8, H - 36, M.wall1);
  s.rect(4, 34, W - 8, 3, M.wall2);
  s.rect(4, 34, 5, H - 36, M.wd1).rect(W - 9, 34, 5, H - 36, M.wd1);
  s.rect(4, H - 30, W - 8, 28, M.wd2);
  for (let x = 8; x < W - 8; x += 9) s.rect(x, H - 30, 1, 28, M.wd1);
  // 기와지붕
  s.poly([[0, 38], [10, 6], [W - 10, 6], [W, 38]], M.rf1);
  s.over((x, y, k) => (k === M.rf1 ? (y === 7 ? M.rf0 : y % 5 === 0 || (y > 30 && (x + y) % 3 === 0) ? M.rf2 : undefined) : undefined));
  s.rect(8, 3, W - 16, 4, M.rf2);
  s.rect(0, 36, W, 3, M.rf2);
  // 간판 판자 (글자는 DOM)
  s.rect(W / 2 - 34, 46, 68, 26, M.wd2);
  s.rect(W / 2 - 32, 48, 64, 22, M.wd0);
  s.rect(W / 2 - 32, 48, 64, 1, M.th0);

  if (kind === 'eki') {
    // 역: 창구 · 시계 · 긴 의자
    s.rect(20, 86, 40, 34, M.wd2);
    s.rect(23, 89, 34, 22, M.wa1);
    s.rect(23, 89, 34, 3, M.wa0);
    s.rect(23, 111, 34, 6, M.wd0);
    s.ellipse(98, 98, 13, 13, M.wd2).ellipse(98, 98, 11, 11, M.wall0);
    s.line(98, 98, 98, 90, M.ink).line(98, 98, 104, 98, M.ink);
    s.rect(70, 140, 56, 5, M.wd0).rect(74, 145, 3, 10, M.wd2).rect(119, 145, 3, 10, M.wd2);
    s.rect(70, 140, 56, 1, M.th0);
    s.outline();
    return s;
  }

  // 가게 입구 (어두운 안쪽) + 노렌 + 진열대
  const noren = kind === 'kaki' ? M.cu1 : kind === 'okaki' ? M.red1 : M.rf1;
  s.rect(16, 80, W - 32, H - 112, M.inkSoft);
  s.rect(16, 80, W - 32, 22, noren);
  for (let x = 16 + (W - 32) / 3; x < W - 17; x += (W - 32) / 3) s.rect(Math.round(x), 80, 2, 22, M.ink);
  s.rect(16, 80, W - 32, 2, M.wall2);
  // 진열대
  s.rect(10, H - 54, W - 20, 8, M.wd1);
  s.rect(10, H - 54, W - 20, 2, M.wd0);
  s.rect(14, H - 46, 4, 14, M.wd2).rect(W - 18, H - 46, 4, 14, M.wd2);
  const shelfY = H - 54;
  if (kind === 'kaki') {
    // 감 더미
    for (let i = 0; i < 9; i++) {
      const x = 22 + (i % 5) * 20 + (i >= 5 ? 10 : 0);
      const y = shelfY - (i >= 5 ? 14 : 5);
      s.ellipse(x, y, 6, 5, M.fox1).set(x - 2, y - 2, M.fox0).set(x - 1, y - 2, M.fox0);
      s.rect(x - 1, y - 6, 3, 2, M.tree0);
    }
  } else if (kind === 'okaki') {
    // 쌀과자 바구니
    for (const bx of [32, 68, 104]) {
      s.ellipse(bx, shelfY - 5, 15, 6, M.th1);
      s.ellipse(bx, shelfY - 7, 13, 4, M.th2);
      for (let i = 0; i < 6; i++) s.ellipse(bx - 8 + (i % 3) * 8, shelfY - 9 - Math.floor(i / 3) * 3, 3, 2, i % 2 ? M.wd0 : M.th0);
    }
  } else {
    // 오징어 말리기 (줄에 매단 흰 오징어)
    s.rect(18, 106, W - 36, 1, M.wd0);
    for (let x = 28; x < W - 24; x += 20) {
      s.poly([[x - 5, 108], [x, 104], [x + 5, 108], [x + 4, 122], [x - 4, 122]], M.wall0);
      for (let t = -3; t <= 3; t += 2) s.rect(x + t, 122, 1, 6, M.pk0);
      s.set(x - 1, 112, M.ink).set(x + 1, 112, M.ink);
    }
    for (let i = 0; i < 4; i++) s.ellipse(30 + i * 24, shelfY - 4, 8, 3, M.pk0);
  }
  s.outline();
  return s;
}

/** 골목 배경 640×360 */
export function alleyBackground(order: ShopKind[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 360;
  const g = c.getContext('2d')!;
  const rect = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  // 하늘 · 먼 지붕
  for (let y = 0; y < 60; y++) rect(0, y, 640, 1, M.day[Math.min(4, Math.floor(y / 12))]);
  // 가게 사이 담장
  rect(0, 40, 640, ALLEY.streetY - 40, M.wall2);
  for (let x = 0; x < 640; x += 16) rect(x, 40, 1, ALLEY.streetY - 40, M.wd1);
  rect(0, ALLEY.streetY - 8, 640, 8, M.wd2);
  // 돌길 (엇갈린 판석)
  for (let y = ALLEY.streetY; y < 360; y++) {
    const row = Math.floor((y - ALLEY.streetY) / 14);
    const iy = (y - ALLEY.streetY) % 14;
    for (let x = 0; x < 640; x++) {
      const off = row % 2 ? 14 : 0;
      const ix = (x + off) % 28;
      let col = (row * 7 + Math.floor((x + off) / 28) * 3) % 5 === 0 ? M.st0 : M.st1;
      if (iy === 0 || ix === 0) col = M.st2;
      else if (iy === 1 || ix === 1) col = M.st0;
      if ((x * 7 + y * 13) % 97 === 0) col = M.leaf1;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  // 가게 앞 그늘
  g.fillStyle = 'rgba(27,22,38,0.18)';
  g.fillRect(0, ALLEY.streetY, 640, 8);
  // 가게
  order.forEach((kind, i) => {
    const art = facade(kind).canvas();
    g.drawImage(art, ALLEY.shopXs[i] - ALLEY.shopW / 2, ALLEY.streetY - art.height + 6);
  });
  // 앞쪽 가장자리 (화분 · 그늘)
  g.fillStyle = 'rgba(27,22,38,0.25)';
  g.fillRect(0, 352, 640, 8);
  return c;
}

/** 대나무 덫 36×30 (콘이 갇혀 있다) */
export function bambooTrap(): HTMLCanvasElement {
  const s = new Spr(36, 30);
  s.rect(1, 2, 34, 3, M.th1);
  s.rect(1, 26, 34, 3, M.th1);
  for (let x = 2; x < 35; x += 5) s.rect(x, 4, 2, 23, M.th0).set(x, 10, M.th2).set(x, 18, M.th2);
  s.rect(1, 2, 34, 1, M.th0);
  s.outline();
  return s.canvas();
}
