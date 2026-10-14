import { sfx } from '../systems/sfx';
import type { UILayer } from './UILayer';

export interface Choice {
  html: string;
  /** 정답 여부 (피드백 색 표시용) */
  correct: boolean;
}

export interface BossQuizOptions {
  /** 위쪽 작은 제목 (예: 메아리 외침) */
  title: string;
  /** 질문 문장 (HTML) */
  prompt: string;
  /** 크게 보여줄 글자 (일본어 글자면 jp: true) */
  big?: { text: string; jp: boolean };
  choices?: Choice[];
  /** 한글 발음 입력 칸 */
  typing?: boolean;
  /** 발악 등 진행 표시 (예: 3 / 5) */
  step?: string;
}

/**
 * 보스전 퀴즈 패널 — 화면 아래쪽에 띄워 싸움판이 보이게 한다.
 * 제한시간 막대, 보기 버튼(클릭·숫자키), 한글 입력 칸을 지원.
 */
export class BossQuizPanel {
  private root: HTMLElement | null = null;
  private timer!: HTMLElement;
  private typed!: HTMLElement;
  private buttons: HTMLButtonElement[] = [];
  private choices: Choice[] = [];
  private onPick: ((i: number) => void) | null = null;

  constructor(private readonly ui: UILayer) {}

  get open(): boolean {
    return this.root !== null;
  }

  show(o: BossQuizOptions, onPick?: (i: number) => void): void {
    this.close();
    this.onPick = onPick ?? null;
    this.choices = o.choices ?? [];
    const root = this.ui.el('div', 'bq fade-up');
    this.root = root;
    this.ui.el('div', 'bq-head', `<b>${o.title}</b>${o.step ? `<span>${o.step}</span>` : ''}`, root);
    const bar = this.ui.el('div', 'bq-timer', '', root);
    this.timer = this.ui.el('i', '', '', bar);
    // 한 줄: [큰 글자] 질문 [입력 칸 | 보기들] — 싸움판을 덜 가리도록 낮게
    const main = this.ui.el('div', 'bq-main', '', root);
    if (o.big) this.ui.el('div', `bq-big${o.big.jp ? ' jp' : ''}`, o.big.text, main);
    this.ui.el('div', 'bq-prompt', o.prompt, main);
    if (o.typing) {
      this.typed = this.ui.el('div', 'bq-typed', '<span class="caret">_</span>', main);
    }
    if (this.choices.length > 0) {
      const row = this.ui.el('div', 'bq-choices', '', main);
      this.buttons = this.choices.map((c, i) => this.ui.button(`${c.html}<small>${i + 1}</small>`, () => this.pick(i), 'qchoice bq-choice', row));
    }
  }

  pick(i: number): void {
    if (!this.onPick || i < 0 || i >= this.buttons.length) return;
    const fn = this.onPick;
    this.onPick = null;
    fn(i);
  }

  /** 언령사가 패널 뒤에 있으면 반투명하게 */
  setBehind(behind: boolean): void {
    this.root?.classList.toggle('behind', behind);
  }

  /** 남은 시간 비율 (1 → 0) */
  setTime(frac: number): void {
    if (!this.root) return;
    this.timer.style.width = `${Math.max(0, frac) * 100}%`;
    this.timer.classList.toggle('low', frac < 0.3);
  }

  setTyped(text: string): void {
    if (this.typed) this.typed.innerHTML = text ? `<b>${text}</b>` : '<span class="caret">_</span>';
  }

  /** 정답·오답 표시. picked는 고른 보기 번호 (없으면 -1) */
  feedback(correct: boolean, html: string, picked = -1): void {
    sfx(correct ? 'correct' : 'wrong');
    if (!this.root) return;
    this.onPick = null;
    this.buttons.forEach((b, j) => {
      b.disabled = true;
      if (this.choices[j].correct) b.classList.add('correct');
      else if (j === picked) b.classList.add('wrong');
    });
    this.root.classList.add(correct ? 'ok' : 'ng');
    this.ui.el('div', `bq-result ${correct ? 'ok' : 'ng'}`, html, this.root);
  }

  close(): void {
    this.root?.remove();
    this.root = null;
    this.buttons = [];
    this.onPick = null;
  }
}
