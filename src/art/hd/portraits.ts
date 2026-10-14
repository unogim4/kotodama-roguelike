import { Spr, M } from './worldMap';
import { foxGranny, villager, tenguNpc } from './visit';
import { yamabikoHd } from './bossHd';
import { settings } from '../../systems/settings';

/**
 * 대화창 초상화 64×64 (표정별).
 * 코토하 — 견습 무녀 (검은 머리 · 붉은 리본 · 흰 옷깃) / 콘 — 아기 여우 (주황 털 · 흰 볼 · 여우불)
 */
export type Face = 'normal' | 'happy' | 'surprised' | 'sad';
export type Who = 'kotoha' | 'kon' | 'fumi' | 'granny' | 'villager' | 'yamabiko' | 'tengu' | 'kappa' | 'oni';

const S = 64;
const iris = '#4a3a7a';

/** 큰 눈 하나 (x, y = 왼쪽 위) */
function eye(s: Spr, x: number, y: number, face: Face, col = iris): void {
  if (face === 'happy') {
    // ^ 모양으로 웃는 눈
    s.set(x, y + 3, M.ink).set(x + 1, y + 2, M.ink).set(x + 2, y + 1, M.ink).set(x + 3, y + 2, M.ink).set(x + 4, y + 3, M.ink);
    return;
  }
  const h = face === 'surprised' ? 7 : face === 'sad' ? 5 : 6;
  const top = y + (face === 'sad' ? 1 : 0);
  s.rect(x, top, 5, h, col);
  s.rect(x, top, 5, 1, M.ink);
  s.rect(x, top + 1, 1, h - 1, M.ink);
  s.set(x + 1, top + 1, M.wall0).set(x + 2, top + 1, M.wall0).set(x + 1, top + 2, M.wall0);
  s.set(x + 3, top + h - 2, '#8a7ad0');
  if (face === 'sad') s.line(x - 1, y - 2, x + 4, y - 1, M.ink);
}

function mouth(s: Spr, cx: number, y: number, face: Face): void {
  if (face === 'happy') {
    s.rect(cx - 3, y, 7, 2, M.ink);
    s.rect(cx - 2, y + 2, 5, 2, M.red1);
    s.rect(cx - 1, y + 3, 3, 1, M.pk1);
  } else if (face === 'surprised') {
    s.ellipse(cx + 0.5, y + 2, 2, 2.5, M.ink);
    s.set(cx, y + 2, M.red2);
  } else if (face === 'sad') {
    s.rect(cx - 2, y + 1, 5, 1, M.ink);
    s.set(cx - 3, y + 2, M.ink).set(cx + 3, y + 2, M.ink);
  } else {
    s.rect(cx - 2, y + 1, 5, 1, M.ink);
    s.set(cx - 3, y, M.ink).set(cx + 3, y, M.ink);
  }
}

export function kotohaFace(face: Face): HTMLCanvasElement {
  const s = new Spr(S, S);
  const hair = M.inkSoft;
  const hairHi = '#4a3e60';
  // 뒷머리 · 옆머리
  s.ellipse(32, 30, 23, 24, hair);
  s.rect(10, 30, 9, 28, hair).rect(45, 30, 9, 28, hair);
  // 옷: 흰 옷깃 + 붉은 속깃
  s.poly([[6, 64], [14, 52], [50, 52], [58, 64]], M.wall0);
  s.poly([[24, 52], [32, 64], [40, 52]], M.red1);
  s.poly([[27, 52], [32, 60], [37, 52]], M.skin1);
  s.line(14, 52, 26, 64, M.wall2).line(50, 52, 38, 64, M.wall2);
  // 목 · 얼굴
  s.rect(27, 46, 10, 8, M.skin1);
  s.ellipse(32, 36, 15, 16, M.skin0);
  s.over((x, y, k) => (k === M.skin0 && (x > 42 || y > 47) ? M.skin1 : undefined));
  // 앞머리 (들쭉날쭉)
  s.poly([[16, 30], [18, 16], [32, 10], [46, 16], [48, 30], [44, 24], [40, 29], [36, 22], [32, 28], [27, 22], [23, 29], [20, 24]], hair);
  s.over((x, y, k) => (k === hair && y < 20 && (x + y) % 5 === 0 ? hairHi : undefined));
  // 붉은 리본
  s.poly([[44, 8], [54, 3], [52, 14]], M.red1).poly([[44, 8], [40, 0], [50, 2]], M.red1);
  s.rect(43, 6, 3, 4, M.red2);
  // 눈 · 볼 · 입
  eye(s, 23, 33, face);
  eye(s, 36, 33, face);
  s.rect(21, 41, 3, 1, M.pk1).rect(41, 41, 3, 1, M.pk1);
  mouth(s, 32, 44, face);
  s.outline();
  return s.canvas();
}

export function konFace(face: Face): HTMLCanvasElement {
  const s = new Spr(S, S);
  // 몸 (흰 가슴털)
  s.ellipse(32, 62, 20, 10, M.fox1);
  s.ellipse(32, 62, 10, 8, M.wall0);
  // 귀
  s.poly([[12, 30], [14, 6], [28, 22]], M.fox1).poly([[52, 30], [50, 6], [36, 22]], M.fox1);
  s.poly([[16, 26], [16, 12], [25, 22]], M.fox2).poly([[48, 26], [48, 12], [39, 22]], M.fox2);
  s.set(14, 7, M.inkSoft).set(15, 7, M.inkSoft).set(50, 7, M.inkSoft).set(49, 7, M.inkSoft);
  // 머리
  s.ellipse(32, 36, 19, 16, M.fox1);
  s.over((x, y, k) => (k === M.fox1 && y < 30 && (x * 2 + y) % 7 === 0 ? M.fox0 : k === M.fox1 && x > 44 ? M.fox2 : undefined));
  // 흰 볼털 · 주둥이
  s.poly([[13, 40], [22, 36], [26, 50], [16, 48]], M.wall0).poly([[51, 40], [42, 36], [38, 50], [48, 48]], M.wall0);
  s.ellipse(32, 46, 8, 6, M.wall0);
  // 눈 (아몬드)
  const fe = face;
  if (fe === 'happy') {
    eye(s, 21, 34, 'happy');
    eye(s, 38, 34, 'happy');
  } else {
    const h = fe === 'surprised' ? 6 : 5;
    for (const ex of [21, 38]) {
      s.rect(ex, 33, 5, h, M.ink);
      s.set(ex + 1, 34, M.wall0).set(ex + 2, 34, M.wall0);
      s.set(ex + 3, 33 + h - 2, M.gold1);
      if (fe === 'sad') s.line(ex - 1, 30, ex + 4, ex < 30 ? 32 : 30, M.fox2).line(ex - 1, ex < 30 ? 32 : 30, ex + 4, 30, M.fox2);
    }
    if (fe === 'sad') s.rect(22, 40, 1, 3, M.wa1).rect(43, 40, 1, 3, M.wa1);
  }
  // 코 · 입
  s.rect(31, 42, 3, 2, M.ink);
  if (fe === 'happy') {
    s.rect(29, 46, 7, 2, M.ink);
    s.rect(30, 48, 5, 2, M.red1);
  } else if (fe === 'surprised') {
    s.ellipse(32.5, 48, 2, 2, M.ink);
  } else {
    s.set(32, 44, M.ink).set(31, 45, M.ink).set(30, 45, M.ink).set(33, 45, M.ink).set(34, 45, M.ink);
  }
  s.outline();
  // 떠다니는 여우불 (외곽선 없이)
  s.ellipse(56, 10, 3, 4, M.wa1).set(56, 5, M.wa1).set(56, 10, M.wa0).set(55, 11, M.wa0);
  return s.canvas();
}


/** 후미 — 엄한 노무녀 (흰 쪽머리 · 가는 눈 · 주름 · 보라 옷깃) */
export function fumiFace(face: Face): HTMLCanvasElement {
  const s = new Spr(S, S);
  const hair = M.st0;
  const hair2 = M.st1;
  const robe = '#5a4290';
  // 옷깃
  s.poly([[6, 64], [14, 52], [50, 52], [58, 64]], M.wall0);
  s.poly([[22, 52], [32, 64], [42, 52]], robe);
  s.poly([[26, 52], [32, 60], [38, 52]], M.skin1);
  s.line(14, 52, 26, 64, M.wall2).line(50, 52, 38, 64, M.wall2);
  // 머리 (뒤로 넘긴 흰 머리 + 쪽)
  s.ellipse(32, 30, 21, 22, hair);
  s.ellipse(32, 8, 9, 6, hair);
  s.rect(26, 11, 12, 2, M.red1);
  s.over((x, y, k) => (k === hair && (x * 2 + y) % 6 === 0 ? hair2 : undefined));
  // 얼굴
  s.rect(27, 46, 10, 8, M.skin1);
  s.ellipse(32, 37, 14, 15, M.skin0);
  s.over((x, y, k) => (k === M.skin0 && (x > 41 || y > 48) ? M.skin1 : undefined));
  // 이마 머리선
  s.poly([[18, 30], [22, 20], [32, 17], [42, 20], [46, 30], [40, 24], [32, 22], [24, 24]], hair);
  // 눈썹 · 눈 (가늘고 매섭게)
  const brow = face === 'sad' ? 1 : 0;
  s.line(22, 31 + brow, 28, 30 - brow, M.st2).line(36, 30 - brow, 42, 31 + brow, M.st2);
  if (face === 'happy') {
    s.line(23, 35, 27, 34, M.ink).line(37, 34, 41, 35, M.ink);
  } else {
    const h = face === 'surprised' ? 3 : 2;
    s.rect(23, 34, 5, h, M.ink).rect(36, 34, 5, h, M.ink);
    s.set(24, 34, iris).set(37, 34, iris);
  }
  // 주름 · 입
  s.set(21, 38, M.skin1).set(22, 39, M.skin1).set(42, 38, M.skin1).set(41, 39, M.skin1);
  s.line(27, 46, 29, 46, M.skin1).line(35, 46, 37, 46, M.skin1);
  if (face === 'happy') s.rect(29, 45, 7, 1, M.ink).set(28, 44, M.ink).set(36, 44, M.ink);
  else if (face === 'surprised') s.rect(30, 44, 5, 3, M.ink);
  else if (face === 'sad') s.rect(29, 45, 7, 1, M.ink).set(28, 46, M.ink).set(36, 46, M.ink);
  else s.rect(29, 45, 7, 1, M.ink);
  s.outline();
  return s.canvas();
}

/** NPC는 32px 도트의 윗부분을 2배로 (표정 없음) */
function npcFace(art: Spr): HTMLCanvasElement {
  const src = art.canvas();
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, 32, 32, 0, 6, S, S);
  return c;
}

/** 야마비코 — 80px 보스 도트의 머리 부분 (놀람/외침이면 입을 벌린 자세) */
function yamabikoFace(face: Face): HTMLCanvasElement {
  const src = yamabikoHd(face === 'surprised' || face === 'happy' ? 'shout' : 'idle').toCanvas();
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  c.getContext('2d')!.drawImage(src, 8, 2, S, S, 0, 0, S, S);
  return c;
}

/** 40px NPC를 32px 창으로 잘라 초상화에 */
function cropTo32(art: Spr, dx: number, dy: number): Spr {
  const out = new Spr(32, 32);
  const src = art.canvas().getContext('2d')!.getImageData(dx, dy, 32, 32).data;
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const i = (y * 32 + x) * 4;
      if (src[i + 3] > 0) out.set(x, y, `#${[src[i], src[i + 1], src[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    }
  return out;
}

const cache = new Map<string, string>();

/** 보스 초상화: 코드 도트(2 · 4장은 bossArt가 등록) · 팩 얼굴(packRig가 등록) — 보스 그림 설정이 '팩'이면 팩 얼굴 */
type BossWho = 'kappa' | 'oni' | 'tengu' | 'yamabiko';
const bossFaces: Partial<Record<BossWho, (face: Face) => HTMLCanvasElement>> = {};
const packFaces: Partial<Record<BossWho, (face: Face) => HTMLCanvasElement>> = {};
export function registerBossFace(id: BossWho, make: (face: Face) => HTMLCanvasElement): void {
  bossFaces[id] = make;
}
export function registerPackFace(id: BossWho, make: (face: Face) => HTMLCanvasElement): void {
  packFaces[id] = make;
}
const usePack = (id: BossWho) => settings.boss === 'pack' && !!packFaces[id];
function bossFace(id: BossWho, face: Face, fallback?: () => HTMLCanvasElement): HTMLCanvasElement {
  const make = usePack(id) ? packFaces[id] : bossFaces[id];
  return make?.(face) ?? fallback?.() ?? document.createElement('canvas');
}

/** 초상화 이미지 주소 (data URL, 표정별로 한 번만 만든다) */
export function portraitUrl(who: Who, face: Face = 'normal'): string {
  const key = `${who}-${face}-${(who === 'kappa' || who === 'oni' || who === 'tengu' || who === 'yamabiko') && usePack(who) ? 'pack' : 'code'}`;
  let url = cache.get(key);
  if (!url) {
    const make: Record<Who, () => HTMLCanvasElement> = {
      kotoha: () => kotohaFace(face),
      kon: () => konFace(face),
      fumi: () => fumiFace(face),
      granny: () => npcFace(foxGranny()),
      villager: () => npcFace(villager()),
      yamabiko: () => bossFace('yamabiko', face, () => yamabikoFace(face)),
      tengu: () => bossFace('tengu', face, () => npcFace(cropTo32(tenguNpc(), 4, 0))),
      kappa: () => bossFace('kappa', face),
      oni: () => bossFace('oni', face),
    };
    url = make[who]().toDataURL();
    cache.set(key, url);
  }
  return url;
}
