import { ROWS, Kana } from '../data/kana';
import { run } from './run';

/**
 * sound: 소리를 듣고 글자 고르기 / read: 글자를 보고 한글 발음 고르기
 */
export type QuizKind = 'sound' | 'read';

export interface Quiz {
  kind: QuizKind;
  answer: Kana;
  /** 보기 (정답 포함, 섞임). 발음이 같은 글자(お·を)는 함께 나오지 않는다 */
  choices: Kana[];
}

/** 이번 챕터의 글자 */
export function currentKana(): Kana[] {
  return ROWS[run.chapter]?.kana ?? ROWS[0].kana;
}

/** 이전 챕터까지 배운 글자 */
export function previousKana(): Kana[] {
  return ROWS.slice(0, run.chapter).flatMap((r) => r.kana);
}

/** 이번 챕터 + 이전 챕터 글자 전부 (틀린 글자 정리 등에 사용) */
export function learnedKana(): Kana[] {
  return [...previousKana(), ...currentKana()];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 틀린 글자일수록 더 자주 나온다 (가중치 1 + 틀린 횟수 × 2) */
function weighted(kanas: Kana[]): Kana {
  const weights = kanas.map((k) => 1 + (run.wrong[k.kana] ?? 0) * 2);
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < kanas.length; i++) {
    r -= weights[i];
    if (r <= 0) return kanas[i];
  }
  return kanas[kanas.length - 1];
}

/** 이번 챕터 70% · 이전 챕터 30% */
function pickAnswer(filter: (k: Kana) => boolean): Kana {
  const cur = currentKana().filter(filter);
  const prev = previousKana().filter(filter);
  const fromPrev = prev.length > 0 && Math.random() < 0.3;
  return weighted(fromPrev || cur.length === 0 ? prev : cur);
}

/** 정답 + 보기 n개. 보기는 같은 챕터 글자를 우선해 헷갈리게 만든다 */
export function makeChoices(answer: Kana, n = 5): Kana[] {
  const sameSound = (k: Kana) => k.ko === answer.ko;
  const near = shuffle(currentKana().filter((k) => k !== answer && !sameSound(k)));
  const far = shuffle(previousKana().filter((k) => k !== answer && !sameSound(k)));
  const others: Kana[] = [];
  for (const k of [...near, ...far]) {
    if (others.length >= n - 1) break;
    if (!others.some((o) => o.ko === k.ko)) others.push(k);
  }
  return shuffle([answer, ...others]);
}

/**
 * soundAvailable이 false면(일본어 음성 없음) 글자→발음 문제만 낸다.
 * typeable이면 한글 한 음절로 입력할 수 있는 글자만 (ん 제외).
 */
export function makeQuiz(soundAvailable: boolean, typeable = false): Quiz {
  const answer = pickAnswer((k) => !typeable || !k.noType);
  const kind: QuizKind = soundAvailable && Math.random() < 0.5 ? 'sound' : 'read';
  return { kind, answer, choices: makeChoices(answer) };
}

export function recordAnswer(kana: Kana, correct: boolean): void {
  if (!correct) run.wrong[kana.kana] = (run.wrong[kana.kana] ?? 0) + 1;
}

/**
 * 시련 연속 퀴즈 순서: 이번 행 글자 전부(섞어서) + 앞 행 복습 2자(틀렸던 글자 우선).
 * 앞 행이 없으면(あ행) 이번 행만.
 */
export function trialQueue(review = 2): Kana[] {
  const rest = previousKana();
  const picked: Kana[] = [];
  const pool = [...rest];
  while (picked.length < review && pool.length > 0) {
    const k = weighted(pool);
    picked.push(k);
    pool.splice(pool.indexOf(k), 1);
  }
  return [...shuffle(currentKana()), ...picked];
}
