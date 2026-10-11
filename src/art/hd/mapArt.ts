import { PixelGrid } from './grid';
import { canvas, rect, px, PalKey } from '../pixel';
import { rng, MAP_W, MAP_H } from '../../map/chapter1';

// ── 지도에 찍는 작은 그림들 (먹선 외곽) ────────────────────────

function house(): PixelGrid {
  const g = new PixelGrid(30, 24);
  g.rect(4, 11, 22, 11, 'W');
  g.rect(4, 11, 22, 2, 'w');
  g.rect(13, 15, 5, 7, 'd');
  g.rect(6, 14, 4, 3, 'B').rect(20, 14, 4, 3, 'B');
  g.poly([[0, 12], [6, 2], [24, 2], [30, 12]], 'n');
  g.poly([[3, 10], [8, 4], [22, 4], [27, 10]], 'N');
  g.outline('K');
  return g;
}

function torii(): PixelGrid {
  const g = new PixelGrid(30, 26);
  g.rect(0, 1, 30, 3, 'R');
  g.rect(3, 4, 24, 2, 'r');
  g.rect(4, 9, 22, 2, 'R');
  g.rect(6, 4, 3, 21, 'R').rect(21, 4, 3, 21, 'R');
  g.rect(8, 4, 1, 21, 'r').rect(23, 4, 1, 21, 'r');
  g.outline('K');
  return g;
}

function pine(): PixelGrid {
  const g = new PixelGrid(14, 20);
  g.rect(6, 14, 2, 5, 'B');
  g.poly([[7, 0], [13, 9], [1, 9]], 'e');
  g.poly([[7, 4], [14, 15], [0, 15]], 'e');
  g.poly([[6, 2], [9, 7], [4, 7]], 'E');
  g.poly([[6, 7], [10, 12], [3, 12]], 'E');
  g.outline('K');
  return g;
}

function mountain(w: number, h: number, snow: boolean): PixelGrid {
  const g = new PixelGrid(w, h);
  const peak = Math.floor(w * 0.48);
  g.poly([[0, h - 1], [peak, 0], [w - 1, h - 1]], 'Y');
  g.poly([[peak, 0], [w - 1, h - 1], [peak + Math.floor(w * 0.1), h - 1]], 'y');
  if (snow) g.poly([[peak - Math.floor(w * 0.13), Math.floor(h * 0.24)], [peak, 0], [peak + Math.floor(w * 0.14), Math.floor(h * 0.26)], [peak + 2, Math.floor(h * 0.2)]], 'L');
  g.paintOver((x, y, k) => (k === 'Y' && (x * 2 + y) % 17 === 0 ? 'w' : null));
  g.outline('K');
  return g;
}

function rock(): PixelGrid {
  const g = new PixelGrid(14, 10);
  g.ellipse(7, 6, 6.5, 4, 'Y');
  g.ellipse(6, 5, 3.5, 2, 'W');
  g.outline('K');
  return g;
}

/** 산 정상의 작은 사당 (보스 자리) */
function hokora(): PixelGrid {
  const g = new PixelGrid(22, 20);
  g.rect(4, 9, 14, 9, 'B');
  g.rect(8, 11, 6, 7, 'd');
  g.poly([[0, 10], [11, 1], [22, 10]], 'r');
  g.rect(9, 3, 4, 2, 'G');
  g.outline('K');
  return g;
}

function stamp(g: CanvasRenderingContext2D, art: PixelGrid, x: number, y: number): void {
  g.drawImage(art.toCanvas(), Math.round(x - art.w / 2), Math.round(y - art.h));
}

/** 굵은 붓 점선처럼 1px씩 찍는 선 */
function inkLine(g: CanvasRenderingContext2D, pts: [number, number][], width: number, key: PalKey, edge?: PalKey): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s <= n; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / n);
      const y = Math.round(y0 + ((y1 - y0) * s) / n);
      if (edge) rect(g, x - width / 2 - 1, y - 1, width + 2, 3, edge);
      rect(g, x - width / 2, y, width, 1, key);
    }
  }
}

/**
 * 1챕터 두루마리 지도 640×1520 (아래 = 신사 마을, 위 = 산 정상).
 * 한지 바탕 위에 마을 · 논 · 숲 · 개울 · 산을 도트로 찍는다.
 */
export function chapter1MapArt(): HTMLCanvasElement {
  const [c, g] = canvas(MAP_W, MAP_H);
  const rand = rng(7);

  // 한지 바탕 + 얼룩
  rect(g, 0, 0, MAP_W, MAP_H, 'W');
  for (let i = 0; i < 14000; i++) px(g, Math.floor(rand() * MAP_W), Math.floor(rand() * MAP_H), rand() < 0.7 ? 'w' : 'L');
  // 위로 갈수록 산의 기운 (희미한 회색 안개 줄)
  for (let y = 0; y < 520; y += 3) {
    for (let x = 0; x < MAP_W; x++) if ((x + y * 3) % (7 + Math.floor(y / 80)) === 0) px(g, x, y, 'w');
  }

  // 개울: 산에서 내려와 마을 옆을 지나간다
  const river: [number, number][] = [];
  for (let y = 420; y <= MAP_H; y += 20) river.push([Math.round(90 + Math.sin(y / 140) * 50 + (y > 1100 ? (y - 1100) * 0.08 : 0)), y]);
  inkLine(g, river, 9, 'C', 'c');
  for (const [x, y] of river) if (rand() < 0.5) px(g, x - 1, y, 'L');
  // 다리
  rect(g, 70, 900, 50, 6, 'K');
  rect(g, 71, 901, 48, 4, 'B');

  // 연못 (いけ 간판 옆)
  for (let y = -10; y <= 10; y++) {
    for (let x = -26; x <= 26; x++) {
      const d = (x * x) / (26 * 26) + (y * y) / (10 * 10);
      if (d <= 1) px(g, 190 + x, 1250 + y, d > 0.8 ? 'c' : 'C');
    }
  }

  // 논 (중간 지대)
  for (let i = 0; i < 9; i++) {
    const fx = 300 + (i % 3) * 64 + Math.floor(rand() * 8);
    const fy = 1080 + Math.floor(i / 3) * 34;
    rect(g, fx - 1, fy - 1, 54, 26, 'g');
    rect(g, fx, fy, 52, 24, 'E');
    for (let r = 3; r < 24; r += 4) rect(g, fx + 2, fy + r, 48, 1, 'e');
  }

  // 산 (위쪽) — 뒤에서 앞으로
  stamp(g, mountain(260, 170, true), 330, 230);
  stamp(g, mountain(180, 120, true), 130, 300);
  stamp(g, mountain(200, 130, true), 520, 320);
  stamp(g, mountain(150, 90, false), 230, 430);
  stamp(g, mountain(170, 100, false), 450, 470);
  // 정상 사당
  stamp(g, hokora(), 320, 90);

  // 숲 (중간~위)
  for (let i = 0; i < 70; i++) {
    const x = 40 + rand() * 560;
    const y = 470 + rand() * 380;
    if (Math.abs(x - 320) < 70) continue; // 가운데 길은 비워 둠
    stamp(g, pine(), x, y);
  }
  for (let i = 0; i < 26; i++) stamp(g, pine(), 40 + rand() * 560, 880 + rand() * 520);
  for (let i = 0; i < 18; i++) stamp(g, rock(), 40 + rand() * 560, 150 + rand() * 1300);

  // 마을 (아래)
  for (const [x, y] of [[110, 1380], [180, 1430], [470, 1390], [540, 1440], [500, 1010], [140, 880], [520, 1200], [430, 1250]]) stamp(g, house(), x, y);
  // 신사 토리이 (출발점)
  stamp(g, torii(), 320, 1500);

  // 두루마리 가장자리 (좌우 어둡게 + 테두리)
  for (let x = 0; x < 26; x++) {
    const k: PalKey = x < 8 ? 'v' : x < 16 ? 'w' : 'W';
    if (k !== 'W') {
      rect(g, x, 0, 1, MAP_H, k);
      rect(g, MAP_W - 1 - x, 0, 1, MAP_H, k);
    }
  }
  rect(g, 26, 0, 1, MAP_H, 'd');
  rect(g, MAP_W - 27, 0, 1, MAP_H, 'd');
  return c;
}

/** 지도 위아래에 고정되는 두루마리 축 640×14 */
export function scrollRoller(): HTMLCanvasElement {
  const [c, g] = canvas(MAP_W, 14);
  rect(g, 0, 0, MAP_W, 14, 'K');
  rect(g, 0, 2, MAP_W, 10, 'B');
  rect(g, 0, 3, MAP_W, 2, 'b');
  rect(g, 0, 10, MAP_W, 1, 'd');
  for (const x of [0, MAP_W - 16]) {
    rect(g, x, 0, 16, 14, 'K');
    rect(g, x + 1, 1, 14, 12, 'd');
    rect(g, x + 3, 3, 10, 2, 'G');
  }
  return c;
}
