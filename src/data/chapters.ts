import { CHAPTER1, LayerSpec, mapWidth } from '../map/chapter1';
import { ROWS } from './kana';
import type { NodeKind } from '../map/nodes';

/**
 * 히라가나 4장 설정 — 지도 층 · 지역 · 간판 · 보스 · 마지막 언령.
 * 장 하나 = 한 판. 장을 깨면 다음 장 지도로 (빌드는 새로, 되찾은 글자는 이어진다).
 */
export type ThemeId = 'ch1' | 'river' | 'forest' | 'capital';
export type BossId = 'yamabiko' | 'kappa' | 'tengu' | 'oni';

export interface ChapterDef {
  num: number;
  /** 지역 이름 (예: 산기슭 신사 마을) */
  title: string;
  /** 이 장에서 되찾는 행 (ROWS 번호) */
  rows: number[];
  layers: LayerSpec[];
  theme: ThemeId;
  /** 지도 위 지역 이름 (너비 비율에서 시작) */
  regions: { name: string; from: number }[];
  /** 간판 — 되찾은 글자만큼 채워진다 (x는 너비 비율) */
  signs: { word: string; ko: string; at: number }[];
  boss: { id: BossId; name: string; jp: string; text: string };
  /** 마지막 언령: 한 글자씩 한글로 외친다 (null = 자동으로 채움, 예: ん) */
  final: { word: string; kana: string[]; ko: (string | null)[]; meaning: string; note: string };
}

const P1: NodeKind[] = ['raid', 'shop', 'spring'];
const P2: NodeKind[] = ['raid', 'shrine', 'grudge', 'event'];
/** 갈림길 층 (후보 중 2~3개) */
const pool = (row: number, kinds: NodeKind[]): LayerSpec => ({ pool: kinds, row, min: 2, max: 3 });

export const CHAPTERS: Record<number, ChapterDef> = {
  1: {
    num: 1,
    title: '산기슭 신사 마을',
    rows: [0, 1, 2],
    layers: CHAPTER1,
    theme: 'ch1',
    regions: [
      { name: '신사 마을', from: 0 },
      { name: '논두렁', from: 500 / 1920 },
      { name: '삼나무 숲', from: 1010 / 1920 },
      { name: '야마비코 산', from: 1460 / 1920 },
    ],
    signs: [
      { word: 'いけ', ko: '연못', at: 268 / 1920 },
      { word: 'おかき', ko: '쌀과자 가게', at: 800 / 1920 },
      { word: 'すし', ko: '초밥집', at: 1016 / 1920 },
      { word: 'うえ', ko: '위 ↑ 산길', at: 1530 / 1920 },
    ],
    boss: { id: 'yamabiko', name: '야마비코', jp: '山彦', text: '산 정상의 메아리 요괴. 훔친 마을 사람들의 목소리를 되던진다' },
    final: { word: 'こえ', kana: ['こ', 'え'], ko: ['코', '에'], meaning: '목소리', note: '마을 사람들의 목소리가 돌아왔다' },
  },
  2: {
    num: 2,
    title: '강가 마을',
    rows: [3, 4, 5],
    layers: [
      { fixed: 'arrive', row: 3 },
      { fixed: 'library', row: 3 },
      { fixed: 'raid', row: 3 },
      { fixed: 'trial', row: 3 },
      { fixed: 'library', row: 4 },
      { fixed: 'story', row: 4, story: 'suzu', title: '스승의 방울', text: '강가 작은 사당에 후미가 젊을 때 쓰던 방울이 잠들어 있다 — 🔔 방울' },
      pool(4, P1),
      pool(4, ['raid', 'shrine', 'event']),
      { fixed: 'trial', row: 4 },
      { fixed: 'library', row: 5 },
      pool(5, P2),
      pool(5, ['raid', 'shop', 'grudge', 'spring']),
      { fixed: 'trial', row: 5 },
      { fixed: 'rest', row: 5 },
      { fixed: 'boss', row: 5, title: '갓파', text: '강바닥의 갓파. 가라앉은 글자들 위에 버티고 있다' },
    ],
    theme: 'river',
    regions: [
      { name: '강 나루', from: 0 },
      { name: '물레방아 마을', from: 0.27 },
      { name: '갈대밭', from: 0.53 },
      { name: '갓파 연못', from: 0.77 },
    ],
    signs: [
      { word: 'はし', ko: '다리', at: 0.14 },
      { word: 'ねこ', ko: '고양이', at: 0.4 },
      { word: 'さかな', ko: '생선 가게', at: 0.56 },
      { word: 'ふね', ko: '배 나루', at: 0.8 },
    ],
    boss: { id: 'kappa', name: '갓파', jp: '河童', text: '강바닥의 갓파. 가라앉은 글자들 위에 버티고 있다' },
    final: { word: 'たいせつ', kana: ['た', 'い', 'せ', 'つ'], ko: ['타', '이', '세', '츠'], meaning: '소중함', note: '강바닥의 글자들이 떠올랐다' },
  },
  3: {
    num: 3,
    title: '깊은 숲과 산길',
    rows: [6, 7, 8, 9],
    layers: [
      { fixed: 'arrive', row: 6 },
      { fixed: 'library', row: 6 },
      pool(6, P1),
      { fixed: 'trial', row: 6 },
      { fixed: 'library', row: 7 },
      pool(7, ['raid', 'shrine', 'event']),
      { fixed: 'trial', row: 7 },
      { fixed: 'library', row: 8 },
      { fixed: 'story', row: 8, story: 'tengu', title: '텐구의 시험', text: '"언령을 다룰 자격이 있는지 보겠다." 연속 시험을 통과하라 — ⚔️ 신검' },
      pool(8, ['raid', 'grudge', 'spring', 'shop']),
      { fixed: 'trial', row: 8 },
      { fixed: 'library', row: 9 },
      pool(9, P2),
      { fixed: 'trial', row: 9 },
      { fixed: 'rest', row: 9 },
      { fixed: 'boss', row: 9, title: '텐구', text: '숲의 텐구. 깃털 회오리와 순간이동으로 시험한다' },
    ],
    theme: 'forest',
    regions: [
      { name: '숲 어귀', from: 0 },
      { name: '삼나무 길', from: 0.27 },
      { name: '안개 고개', from: 0.52 },
      { name: '텐구 바위', from: 0.78 },
    ],
    signs: [
      { word: 'もり', ko: '숲', at: 0.13 },
      { word: 'みち', ko: '길', at: 0.37 },
      { word: 'やま', ko: '산', at: 0.6 },
      { word: 'ゆめ', ko: '꿈', at: 0.83 },
    ],
    boss: { id: 'tengu', name: '텐구', jp: '天狗', text: '숲의 텐구. 깃털 회오리와 순간이동으로 시험한다' },
    final: { word: 'わたし', kana: ['わ', 'た', 'し'], ko: ['와', '타', '시'], meaning: '나', note: '코토하가 처음으로 자기 이름을 글자로 썼다' },
  },
  4: {
    num: 4,
    title: '옛 도성',
    rows: [10, 11, 12, 13],
    layers: [
      { fixed: 'arrive', row: 10 },
      { fixed: 'library', row: 10 },
      pool(10, P1),
      pool(10, ['raid', 'shrine', 'event']),
      { fixed: 'trial', row: 10 },
      { fixed: 'library', row: 11 },
      pool(11, ['raid', 'spring', 'shop']),
      { fixed: 'trial', row: 11 },
      { fixed: 'library', row: 12 },
      { fixed: 'story', row: 12, story: 'small', title: '숨은 작은 글자', text: '겁에 질려 숨은 작은 글자 ゃ · ゅ · ょ · っ 를 찾아 데려오자' },
      pool(12, P2),
      pool(12, ['raid', 'shop', 'grudge', 'spring']),
      { fixed: 'trial', row: 12 },
      { fixed: 'library', row: 13 },
      pool(13, ['raid', 'shrine', 'grudge']),
      { fixed: 'trial', row: 13 },
      { fixed: 'rest', row: 13 },
      { fixed: 'boss', row: 13, title: '오니', text: '도성의 문을 지키는 오니. 쇠몽둥이를 휘두른다' },
    ],
    theme: 'capital',
    regions: [
      { name: '성문 밖', from: 0 },
      { name: '저잣거리', from: 0.25 },
      { name: '무너진 궁궐', from: 0.52 },
      { name: '오니의 문', from: 0.78 },
    ],
    signs: [
      { word: 'ごはん', ko: '밥집', at: 0.14 },
      { word: 'ぱん', ko: '빵 가게', at: 0.36 },
      { word: 'おちゃ', ko: '찻집', at: 0.58 },
      { word: 'きっぷ', ko: '표 파는 곳', at: 0.81 },
    ],
    boss: { id: 'oni', name: '오니', jp: '鬼', text: '도성의 문을 지키는 오니. 쇠몽둥이를 휘두른다' },
    final: { word: 'ごめんなさい', kana: ['ご', 'め', 'ん', 'な', 'さ', 'い'], ko: ['고', '메', null, '나', '사', '이'], meaning: '미안합니다', note: '오니가 오래 삼켜 온 사과를 대신 말해 주었다' },
  },
};

export const LAST_CHAPTER = 4;

export function chapterDef(n: number): ChapterDef {
  return CHAPTERS[n] ?? CHAPTERS[1];
}

export function chapterWidth(def: ChapterDef): number {
  return mapWidth(def.layers.length);
}

/** 앞 장들에서 이미 되찾은 행 */
export function rowsBefore(n: number): number[] {
  return Object.values(CHAPTERS)
    .filter((c) => c.num < n)
    .flatMap((c) => c.rows);
}

/** 행 짧은 이름 (あ · が …) */
export function rowShort(row: number): string {
  const r = ROWS[row];
  return r?.short ?? r?.kana[0]?.kana ?? '?';
}

/** 작은 글자(ゃゅょっ)는 요음 · 촉음 구간을 되찾으면 읽을 수 있다 */
export function charKnown(ch: string, knownKana: Set<string>, rows: number[]): boolean {
  if ('ゃゅょ'.includes(ch)) return rows.includes(12);
  if (ch === 'っ') return rows.includes(13);
  return knownKana.has(ch);
}
