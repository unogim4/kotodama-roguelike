import { ROWS } from './kana';

/**
 * 언령술 — 단어를 읽어야 발동하는 액티브 (Q · E).
 * 단어에 쓰인 글자를 모두 되찾으면 열린다. 빨리 정확히 읽을수록 강해진다 (최대 1.5배).
 */
export type SpellId = 'ishi' | 'kasa';

export interface SpellDef {
  id: SpellId;
  /** 단어 (배운 글자로만) */
  word: string;
  /** 한 음절씩 입력할 한글 */
  ko: string[];
  meaning: string;
  icon: string;
  key: 'Q' | 'E';
  cooldownMs: number;
  desc: string;
}

export const SPELLS: SpellDef[] = [
  { id: 'ishi', word: 'いし', ko: ['이', '시'], meaning: '돌', icon: '⛰️', key: 'Q', cooldownMs: 14000, desc: '큰 바위가 떨어져 주변 요괴에게 큰 피해 + 넉백' },
  { id: 'kasa', word: 'かさ', ko: ['카', '사'], meaning: '우산', icon: '☂️', key: 'E', cooldownMs: 18000, desc: '우산 방패 — 3초 동안 피해를 받지 않는다' },
];

/** 이 행들을 되찾았을 때 쓸 수 있는 언령술 */
export function spellsFor(learnedRows: number[]): SpellDef[] {
  const known = new Set(learnedRows.flatMap((r) => ROWS[r]?.kana.map((k) => k.kana) ?? []));
  return SPELLS.filter((s) => [...s.word].every((ch) => known.has(ch)));
}
