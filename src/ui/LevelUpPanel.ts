import type { UILayer } from './UILayer';
import type { Quiz } from '../systems/quiz';
import { recordAnswer } from '../systems/quiz';
import type { ChoiceDef } from '../data/choices';
import { tts } from '../systems/tts';

export interface LevelUpResult {
  correct: boolean;
  upgrade: ChoiceDef;
}

/**
 * 레벨업 = 언령 집중. 시간이 멈춘 상태에서
 * ① 퀴즈 → ② 정답이면 업그레이드 3택 / 오답이면 정답 확인 + 무작위 1개.
 * 마우스 클릭과 숫자키(1~5) 모두 지원.
 */
export class LevelUpPanel {
  private root!: HTMLElement;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(private readonly ui: UILayer) {}

  open(quiz: Quiz, level: number, offers: ChoiceDef[]): Promise<LevelUpResult> {
    return new Promise((resolve) => {
      this.root = this.ui.el('div', 'lvl-panel fade-in');
      this.ui.el('div', 'lvl-head', `레벨 업! <b>Lv ${level}</b><small>언령 집중 — 시간이 멈췄다</small>`, this.root);

      const q = this.ui.el('div', 'lvl-question', '', this.root);
      if (quiz.kind === 'sound') {
        const play = this.ui.button('🔊', () => void tts.speak(quiz.answer.kana), 'lvl-sound', q);
        play.title = '다시 듣기 (Space)';
        this.ui.el('div', 'lvl-ask', '들리는 글자를 고르세요 <small>Space 다시 듣기</small>', q);
        void tts.speak(quiz.answer.kana);
      } else {
        this.ui.el('div', 'lvl-kana', quiz.answer.kana, q);
        this.ui.el('div', 'lvl-ask', '이 글자의 발음은?', q);
      }

      const row = this.ui.el('div', 'lvl-choices', '', this.root);
      const buttons = quiz.choices.map((k, i) => {
        const label = quiz.kind === 'sound' ? `<span class="jp">${k.kana}</span>` : k.ko;
        return this.ui.button(`${label}<small>${i + 1}</small>`, () => answer(i), `qchoice ${quiz.kind}`, row);
      });
      const result = this.ui.el('div', 'lvl-result', '', this.root);

      let answered = false;
      const answer = (i: number) => {
        if (answered) return;
        answered = true;
        const picked = quiz.choices[i];
        const correct = picked === quiz.answer;
        recordAnswer(quiz.answer, correct);
        buttons.forEach((b, j) => {
          b.disabled = true;
          if (quiz.choices[j] === quiz.answer) b.classList.add('correct');
          else if (j === i) b.classList.add('wrong');
        });
        if (!correct && quiz.kind === 'sound') void tts.speak(quiz.answer.kana);
        result.innerHTML = correct
          ? '정답! 강화를 하나 고르세요'
          : `아쉬워요 — 정답은 <span class="jp">${quiz.answer.kana}</span> <b>[${quiz.answer.ko}]</b>`;
        result.classList.add(correct ? 'ok' : 'ng');
        setTimeout(() => this.showUpgrades(correct, offers, resolve), correct ? 350 : 900);
      };

      this.bindKeys((key) => {
        if (key === ' ' && quiz.kind === 'sound') void tts.speak(quiz.answer.kana);
        const n = Number(key);
        if (n >= 1 && n <= quiz.choices.length) answer(n - 1);
      });
    });
  }

  private showUpgrades(correct: boolean, offers: ChoiceDef[], resolve: (r: LevelUpResult) => void): void {
    // 문제 칸은 접고 (정답은 보기 색과 결과 줄에 남아 있다) 강화 선택을 보여준다
    this.root.classList.add('picking');
    const wrap = this.ui.el('div', 'lvl-upgrades', '', this.root);
    const done = (u: ChoiceDef) => {
      this.close();
      resolve({ correct, upgrade: u });
    };

    if (correct) {
      offers.forEach((u, i) => {
        const card = this.ui.el('button', `ucard clickable${u.special === 'evo' ? ' evo' : ''}`, '', wrap);
        card.innerHTML = `<span class="uicon">${u.icon}</span><b>${u.name}</b><span>${u.desc}</span><small>${i + 1}</small>`;
        card.addEventListener('click', () => done(u));
      });
      this.bindKeys((key) => {
        const n = Number(key);
        if (n >= 1 && n <= offers.length) done(offers[n - 1]);
      });
    } else {
      // 틀리면 진화가 아닌 강화를 하나 (진화는 맞혀야 고를 수 있다)
      const u = offers.find((o) => o.special !== 'evo') ?? offers[0];
      const card = this.ui.el('div', 'ucard given', '', wrap);
      card.innerHTML = `<span class="uicon">${u.icon}</span><b>${u.name}</b><span>${u.desc}</span><small>받은 강화</small>`;
      const cont = this.ui.button('계속<small>Enter</small>', () => done(u), 'primary', this.root);
      cont.classList.add('lvl-continue');
      this.bindKeys((key) => key === 'Enter' && done(u));
    }
  }

  private bindKeys(fn: (key: string) => void): void {
    this.unbindKeys();
    // 사용자 설정 창이 열려 있으면 퀴즈 키를 받지 않는다
    this.keyHandler = (e: KeyboardEvent) => !document.querySelector('.settings-panel') && fn(e.key);
    window.addEventListener('keydown', this.keyHandler);
  }

  private unbindKeys(): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
  }

  close(): void {
    this.unbindKeys();
    speechSynthesis.cancel();
    this.root?.remove();
  }
}
