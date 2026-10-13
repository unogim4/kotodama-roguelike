import { Fine, bayer, hash } from './fine';

/**
 * 손에 드는 무기 (오른쪽을 가리키는 그림, pivot = 손잡이) · 2세대 요괴.
 */

export interface GearArt {
  canvas: HTMLCanvasElement;
  /** 손잡이 위치 (회전 중심) */
  px: number;
  py: number;
}

/** ⚔️ 신검 — 붉은 손잡이 · 금빛 코등이 · 양날 */
export function swordArt(): GearArt {
  const f = new Fine(24, 7).stamp(
    [
      '.....z................',
      '.....YsssssssssssssS..',
      'RqRqRYSSSSSSSSSSSSSSt.',
      '.....YtttttttttttttT..',
      '.....z................',
    ],
    1,
    1,
  );
  return { canvas: f.canvas(), px: 3, py: 3 };
}

/** 📜 부적 다발 — 붉은 글씨가 쓰인 종이 두 장 */
export function ofudaArt(): GearArt {
  const f = new Fine(12, 10).stamp(
    [
      'gggggggg...',
      'fRFfRFfFg..',
      'fFFfFFfRFg.',
      'gggggggggg.',
      '.fFRfFfRFFg',
      '.ggggggggg.',
    ],
    1,
    2,
  );
  return { canvas: f.canvas(), px: 2, py: 5 };
}

/** 📜 날아가는 부적 한 장 */
export function ofudaShotArt(): HTMLCanvasElement {
  return new Fine(12, 6).stamp(['ffFFFFFFFg', 'fRFRRFRFFg', 'gggggggggg'], 1, 1).canvas();
}

/** 🔱 나기나타 — 긴 나무 자루 끝에 휜 칼날 */
export function naginataArt(): GearArt {
  const f = new Fine(36, 7).stamp(
    [
      '.............................sSS..',
      '......................Yz.sSSSSt...',
      'ooooooooooooooooooooooYzSSSSSSt...',
      'OOOOOOOOOOOOOOOOOOOOOOYzttttT.....',
      '......................z...........',
    ],
    1,
    1,
  );
  return { canvas: f.canvas(), px: 9, py: 3 };
}

// ── 히토다마 24×24 · 6프레임: 꼬리가 일렁이고 불씨가 떨어져 나간다 ─────────

export function hitodamaFrame(fi: number): HTMLCanvasElement {
  const f = new Fine(24, 24);
  const ph = (fi / 6) * Math.PI * 2;
  const cx = 12;
  const cy = 15 + Math.round(Math.sin(ph) * 0.8);
  const rx = 6.4;
  const ry = 6;
  const top = 2 + (fi % 3 === 1 ? 1 : 0);
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 24; x++) {
      const X = x + 0.5;
      const Y = y + 0.5;
      let d: number;
      if (Y >= cy) {
        d = Math.hypot((X - cx + 1) / rx, (Y - cy + 1) / ry);
        if (Math.hypot((X - cx) / rx, (Y - cy) / ry) > 1) continue;
      } else {
        const t = (Y - top) / (cy - top);
        if (t < 0) continue;
        const half = rx * Math.pow(t, 0.85) + (hash(x, y + fi * 13) - 0.5) * 0.9;
        const mid = cx + 2.4 * Math.sin(ph + Y * 0.42) * (1 - t);
        if (Math.abs(X - mid) > half) continue;
        d = (Math.abs(X - mid + 0.8) / Math.max(half, 0.6)) * 0.8 + (1 - t) * 0.45;
      }
      const v = d + (bayer(x, y) - 0.5) * 0.14;
      f.set(x, y, v < 0.3 ? 'i' : v < 0.52 ? 'j' : v < 0.72 ? 'l' : v < 0.9 ? 'n' : 'N');
    }
  // 얼굴: 동그란 눈 + 작은 입
  f.set(9, cy, 'k').set(9, cy + 1, 'k').set(14, cy, 'k').set(14, cy + 1, 'k');
  f.set(11, cy + 3, 'N').set(12, cy + 3, 'N');
  // 떨어져 나가는 불씨
  const ex = cx + Math.round(Math.sin(ph * 2) * 3);
  f.set(ex, top - 1 - (fi % 2), 'l');
  if (fi % 3 === 0) f.set(cx - 5, cy - 6, 'n');
  return f.canvas();
}

export const hitodamaFrames2 = (): HTMLCanvasElement[] => [0, 1, 2, 3, 4, 5].map(hitodamaFrame);

// ── 카사오바케 28×32 · 6프레임: 서기 → 웅크림 → 박차기 → 공중 → 떨어짐 → 착지 ─────

interface KasaPose {
  /** 우산이 위아래로 눌린 정도 (1 = 보통) */
  sq: number;
  /** 우산 반폭 */
  w: number;
  /** 공중 높이 (음수 = 위) */
  lift: number;
  /** 다리 길이 */
  leg: number;
  /** 혀 휘날림 (-1 위 ~ 1 아래) */
  tongue: number;
}

const KASA_POSES: KasaPose[] = [
  { sq: 1, w: 12, lift: 0, leg: 8, tongue: 0.6 },
  { sq: 0.8, w: 13, lift: 0, leg: 5, tongue: 1 },
  { sq: 1.18, w: 10.5, lift: -2, leg: 10, tongue: 0.2 },
  { sq: 1.05, w: 11.5, lift: -6, leg: 7, tongue: -0.8 },
  { sq: 1, w: 12, lift: -3, leg: 9, tongue: -0.2 },
  { sq: 0.72, w: 13.5, lift: 0, leg: 4, tongue: 1 },
];

export function kasaFrame(fi: number): HTMLCanvasElement {
  const p = KASA_POSES[fi];
  const f = new Fine(30, 32);
  const cx = 15;
  const ground = 31 + p.lift;
  const rim = ground - 2 - p.leg;
  const height = Math.round(13 * p.sq);
  const apex = rim - height;
  // 외다리 (우산대) + 게타
  for (let y = rim + 1; y <= ground - 2; y++) f.set(cx, y, 'o').set(cx + 1, y, 'O');
  f.stamp(['oooooo', '.X..X.'], cx - 2, ground - 1);
  // 우산 종이: 왼쪽 위가 밝고 오른쪽이 어둡다 · 우산살 4줄 · 가장자리 물결
  for (let y = apex; y <= rim; y++) {
    const t = (y - apex) / Math.max(1, rim - apex);
    const half = p.w * Math.pow(t, 0.72);
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const s = (x + 0.5 - cx) / Math.max(half, 0.5);
      if (Math.abs(s) > 1) continue;
      if (y === rim && Math.abs(Math.round(x - cx)) % 4 === 2) continue;
      const v = s + (1 - t) * 0.25 + (bayer(x, y) - 0.5) * 0.25;
      let ch = v < -0.45 ? 'u' : v < 0.15 ? 'v' : v < 0.65 ? 'm' : 'M';
      for (const rib of [-0.68, -0.22, 0.26, 0.7]) if (Math.abs(s - rib) < 0.07 && t > 0.15) ch = 'M';
      f.set(x, y, ch);
    }
  }
  // 꼭지 · 찢어진 자리 덧댄 종이
  f.set(cx, apex - 1, 'O').set(cx + 1, apex - 1, 'O').set(cx, apex - 2, 'X');
  f.set(cx - 6, rim - 3, 'F').set(cx - 5, rim - 3, 'F').set(cx - 6, rim - 2, 'g');
  // 외눈 (흰자 · 큰 눈동자 · 빛)
  const ey = rim - Math.max(4, Math.round(height * 0.45));
  for (let y = -2; y <= 2; y++)
    for (let x = -3; x <= 3; x++) if ((x / 3.4) ** 2 + (y / 2.5) ** 2 <= 1) f.set(cx + x, ey + y, 'W');
  f.set(cx - 3, ey - 2, 'M').set(cx - 2, ey - 3, 'M').set(cx - 1, ey - 3, 'M').set(cx, ey - 3, 'M').set(cx + 1, ey - 3, 'M').set(cx + 2, ey - 3, 'M');
  for (let y = -1; y <= 1; y++) for (let x = 0; x <= 1; x++) f.set(cx + x, ey + y, 'k');
  f.set(cx, ey - 1, 'h').set(cx - 1, ey, 'e');
  // 입 · 늘어진 혀
  f.set(cx - 1, rim - 1, 'Q').set(cx, rim - 1, 'Q').set(cx + 1, rim - 1, 'Q').set(cx + 2, rim - 1, 'Q');
  for (let i = 0; i < 6; i++) {
    const tx = cx + 1 + Math.round(i * (0.35 + (1 - Math.abs(p.tongue)) * 0.5));
    const ty = rim + Math.round(i * 0.9 * p.tongue);
    f.set(tx, ty, i === 5 ? 'q' : 'R').set(tx + 1, ty, i > 3 ? 'q' : 'r');
  }
  return f.canvas();
}

export const kasaFrames2 = (): HTMLCanvasElement[] => [0, 1, 2, 3, 4, 5].map(kasaFrame);
