import type { UILayer } from './UILayer';
import { portraitUrl, Face, Who } from '../art/hd/portraits';
import { tts } from '../systems/tts';

/** 대사 한 줄. text 안의 {かな}는 일본어 글꼴로 강조된다 */
export interface Line {
  who: Who;
  face?: Face;
  text: string;
  /** 이 줄이 나올 때 읽어 줄 일본어 */
  say?: string;
}

const NAMES: Record<Who, string> = { kotoha: '코토하', kon: '콘', fumi: '후미', granny: '여우 할멈', villager: '마을 아저씨', yamabiko: '야마비코', tengu: '텐구', kappa: '갓파', oni: '오니' };
/** 한 글자 나오는 간격 (ms) */
const TYPE_MS = 24;

interface Token {
  ch: string;
  jp: boolean;
}

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let jp = false;
  for (const ch of text) {
    if (ch === '{') jp = true;
    else if (ch === '}') jp = false;
    else out.push({ ch, jp });
  }
  return out;
}

function esc(ch: string): string {
  return ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch;
}

/** 앞에서 n글자까지만 HTML로 (일본어 구간은 span.jp) */
function render(tokens: Token[], n: number): string {
  let html = '';
  let inJp = false;
  for (let i = 0; i < n && i < tokens.length; i++) {
    const t = tokens[i];
    if (t.jp !== inJp) {
      html += t.jp ? '<span class="jp">' : '</span>';
      inJp = t.jp;
    }
    html += esc(t.ch);
  }
  return inJp ? `${html}</span>` : html;
}

/**
 * 하단 대화창 + 도트 초상화. 클릭 · Enter · Space로 넘긴다 (타자 중이면 한 번에 끝까지).
 * play()는 모든 줄이 끝나면, ask()는 선택지를 고르면 끝난다.
 */
export class Dialogue {
  private root: HTMLElement | null = null;
  private face!: HTMLImageElement;
  private name!: HTMLElement;
  private text!: HTMLElement;
  private next!: HTMLElement;
  private timer = 0;
  private advance: (() => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  /** true면 화면 위쪽에 띄운다 (말하는 캐릭터가 화면 아래쪽에 있을 때) */
  top = false;

  constructor(private readonly ui: UILayer) {}

  get open(): boolean {
    return this.root !== null;
  }

  private ensure(): void {
    if (this.root) return;
    const root = this.ui.el('div', 'dlg fade-up');
    this.root = root;
    const frame = this.ui.el('div', 'dlg-face', '', root);
    this.face = this.ui.el('img', '', '', frame);
    const body = this.ui.el('div', 'dlg-body', '', root);
    this.name = this.ui.el('div', 'dlg-name', '', body);
    this.text = this.ui.el('div', 'dlg-text', '', body);
    this.next = this.ui.el('div', 'dlg-next', '▼', root);
    root.addEventListener('click', () => this.advance?.());
    this.keyHandler = (e: KeyboardEvent) => {
      if (document.querySelector('.settings-panel')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.advance?.();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  /** 한 줄 보여 주기 — 끝까지 다 나온 뒤 넘기면 resolve */
  private show(line: Line): Promise<void> {
    this.ensure();
    const root = this.root!;
    root.classList.toggle('right', line.who !== 'kotoha');
    root.classList.toggle('top', this.top);
    root.dataset.who = line.who;
    this.face.src = portraitUrl(line.who, line.face ?? 'normal');
    this.name.textContent = NAMES[line.who];
    const tokens = tokenize(line.text);
    let n = 0;
    this.text.innerHTML = '';
    this.next.style.visibility = 'hidden';
    if (line.say) void tts.speak(line.say);
    return new Promise((resolve) => {
      const finish = () => {
        window.clearInterval(this.timer);
        n = tokens.length;
        this.text.innerHTML = render(tokens, n);
        this.next.style.visibility = '';
        this.advance = () => {
          this.advance = null;
          resolve();
        };
      };
      this.advance = finish;
      window.clearInterval(this.timer);
      this.timer = window.setInterval(() => {
        n++;
        this.text.innerHTML = render(tokens, n);
        if (n >= tokens.length) finish();
      }, TYPE_MS);
    });
  }

  /** 여러 줄을 차례로 */
  async play(lines: Line[]): Promise<void> {
    for (const line of lines) await this.show(line);
    this.close();
  }

  /** 한 줄을 보여 주고 선택지 (클릭 · 숫자키) — 고른 번호 */
  async ask(line: Line, options: string[]): Promise<number> {
    await new Promise<void>((resolve) => {
      void this.show(line);
      // 타자가 끝나면 바로 선택지를 띄운다
      const wait = window.setInterval(() => {
        if (this.next.style.visibility !== 'hidden') {
          window.clearInterval(wait);
          resolve();
        }
      }, 30);
    });
    this.advance = null;
    this.next.style.visibility = 'hidden';
    return new Promise((resolve) => {
      const box = this.ui.el('div', 'dlg-choices', '', this.root!);
      const pick = (i: number) => {
        window.removeEventListener('keydown', onKey);
        box.remove();
        this.close();
        resolve(i);
      };
      options.forEach((o, i) => this.ui.button(`${o}<small>${i + 1}</small>`, () => pick(i), '', box));
      const onKey = (e: KeyboardEvent) => {
        const k = Number(e.key);
        if (k >= 1 && k <= options.length) pick(k - 1);
      };
      window.addEventListener('keydown', onKey);
    });
  }

  close(): void {
    window.clearInterval(this.timer);
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
    this.advance = null;
    this.root?.remove();
    this.root = null;
  }
}
