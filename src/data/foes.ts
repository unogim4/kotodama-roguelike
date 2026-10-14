/**
 * 습격 요괴 — 체력은 낮게, 대신 무리로 많이 몰려온다 (뱀서라이크 손맛).
 * ai: chase 추격 · hop 콩콩 · ranged 거리 두고 불씨 · dasher 예고 후 돌진 · tank 몽둥이 내려치기
 *     · wave 물결치며 날아와 감기(느려짐) · moji 글자 요괴(무기로는 안 죽고 읽어야 정화) · elite 원한 혼불
 */
export type FoeKind =
  | 'hitodama'
  | 'kasa'
  | 'chochin'
  | 'kogappa'
  | 'kawauso'
  | 'kodama'
  | 'kamaitachi'
  | 'kooni'
  | 'ittan'
  | 'moji'
  | 'grudge';

export type FoeAi = 'chase' | 'hop' | 'ranged' | 'dasher' | 'tank' | 'wave' | 'moji' | 'elite';

export interface FoeDef {
  name: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  /** 몸통 중심이 발보다 얼마나 위인지 */
  bodyY: number;
  xp: number;
  ai: FoeAi;
  /** 텍스처 · 애니메이션 (없으면 프레임을 직접 고른다) */
  tex: string;
  anim?: string;
  originY: number;
  /** 넉백을 받는 정도 (1 = 그대로) */
  knock: number;
  /** 처치 조각 색 */
  burst: string[];
}

export const FOE_DEFS: Record<FoeKind, FoeDef> = {
  hitodama: { name: '히토다마', hp: 12, speed: 46, damage: 6, radius: 8, bodyY: 8, xp: 1, ai: 'chase', tex: 'hd-hitodama', anim: 'hitodama-float', originY: 0.85, knock: 1, burst: ['P', 'L', 'W'] },
  kasa: { name: '카사오바케', hp: 26, speed: 62, damage: 9, radius: 10, bodyY: 14, xp: 2, ai: 'hop', tex: 'hd-kasa', anim: 'kasa-hop', originY: 1, knock: 0.7, burst: ['N', 'L', 'W'] },
  chochin: { name: '초칭오바케', hp: 22, speed: 42, damage: 6, radius: 9, bodyY: 16, xp: 2, ai: 'ranged', tex: 'y-chochin', anim: 'y-chochin', originY: 1, knock: 0.9, burst: ['G', 'y', 'W'] },
  kogappa: { name: '코갓파', hp: 10, speed: 66, damage: 5, radius: 7, bodyY: 8, xp: 1, ai: 'chase', tex: 'y-kogappa', anim: 'y-kogappa', originY: 1, knock: 1.1, burst: ['G', 'L', 'W'] },
  kawauso: { name: '카와우소', hp: 30, speed: 52, damage: 10, radius: 10, bodyY: 6, xp: 2, ai: 'dasher', tex: 'y-kawauso', originY: 1, knock: 0.8, burst: ['d', 'y', 'W'] },
  kodama: { name: '코다마', hp: 6, speed: 54, damage: 4, radius: 6, bodyY: 7, xp: 1, ai: 'chase', tex: 'y-kodama', anim: 'y-kodama', originY: 1, knock: 1.2, burst: ['W', 'G', 'w'] },
  kamaitachi: { name: '카마이타치', hp: 26, speed: 72, damage: 10, radius: 9, bodyY: 8, xp: 2, ai: 'dasher', tex: 'y-kamaitachi', originY: 1, knock: 0.9, burst: ['y', 'W', 'C'] },
  kooni: { name: '꼬마 오니', hp: 90, speed: 30, damage: 14, radius: 12, bodyY: 12, xp: 5, ai: 'tank', tex: 'y-kooni', originY: 1, knock: 0.3, burst: ['R', 'y', 'd'] },
  ittan: { name: '잇탄모멘', hp: 24, speed: 80, damage: 6, radius: 10, bodyY: 10, xp: 2, ai: 'wave', tex: 'y-ittan', anim: 'y-ittan', originY: 0.9, knock: 1, burst: ['W', 'w', 'v'] },
  moji: { name: '글자 요괴', hp: 99999, speed: 22, damage: 10, radius: 11, bodyY: 12, xp: 0, ai: 'moji', tex: 'y-moji', anim: 'y-moji', originY: 1, knock: 0.15, burst: ['N', 'P', 'y'] },
  grudge: { name: '원한 혼불', hp: 360, speed: 34, damage: 15, radius: 16, bodyY: 22, xp: 0, ai: 'elite', tex: 'hd-hitodama', anim: 'hitodama-float', originY: 0.85, knock: 0.5, burst: ['P', 'L', 'W'] },
};

/** 장마다 나오는 요괴 — 가중치(초반 → 후반)와 한 번에 몰려오는 수 */
export interface SpawnEntry {
  kind: FoeKind;
  w0: number;
  w1: number;
  pack: [number, number];
}

export const SPAWNS: Record<number, SpawnEntry[]> = {
  1: [
    { kind: 'hitodama', w0: 6, w1: 5, pack: [2, 4] },
    { kind: 'kasa', w0: 2, w1: 4, pack: [1, 2] },
    { kind: 'chochin', w0: 1, w1: 2.5, pack: [1, 2] },
  ],
  2: [
    { kind: 'hitodama', w0: 3, w1: 2, pack: [2, 3] },
    { kind: 'kogappa', w0: 4, w1: 4, pack: [4, 6] },
    { kind: 'kasa', w0: 1, w1: 1.5, pack: [1, 2] },
    { kind: 'kawauso', w0: 1, w1: 3, pack: [1, 2] },
    { kind: 'chochin', w0: 0.5, w1: 1, pack: [1, 1] },
  ],
  3: [
    { kind: 'hitodama', w0: 2, w1: 2, pack: [2, 3] },
    { kind: 'kodama', w0: 4, w1: 4, pack: [5, 7] },
    { kind: 'kamaitachi', w0: 1, w1: 3, pack: [1, 2] },
    { kind: 'kasa', w0: 1.5, w1: 2, pack: [1, 2] },
    { kind: 'chochin', w0: 0.5, w1: 1.5, pack: [1, 2] },
  ],
  4: [
    { kind: 'hitodama', w0: 3, w1: 2, pack: [2, 4] },
    { kind: 'kooni', w0: 1, w1: 2.5, pack: [1, 1] },
    { kind: 'ittan', w0: 2, w1: 3, pack: [1, 3] },
    { kind: 'kamaitachi', w0: 1, w1: 1.5, pack: [1, 2] },
    { kind: 'kogappa', w0: 1, w1: 1, pack: [3, 5] },
    { kind: 'kasa', w0: 1, w1: 1.5, pack: [1, 2] },
  ],
};

/** 레벨업에 필요한 혼백 (몹이 많아진 만큼 높게) */
export const xpNeed = (level: number) => 12 + level * 8;
