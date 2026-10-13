/**
 * 두벌식 자판 위치(KeyboardEvent.code)로 한글을 조합한다.
 * 한/영 상태와 상관없이 같은 키를 누르면 같은 글자가 된다 (영문 상태 dn = 우).
 * 입력란에 포커스를 두지 않으므로 운영체제 입력기(IME)를 거치지 않는다.
 */

const KEY_TO_JAMO: Record<string, string> = {
  KeyQ: 'ㅂ', KeyW: 'ㅈ', KeyE: 'ㄷ', KeyR: 'ㄱ', KeyT: 'ㅅ', KeyY: 'ㅛ', KeyU: 'ㅕ', KeyI: 'ㅑ', KeyO: 'ㅐ', KeyP: 'ㅔ',
  KeyA: 'ㅁ', KeyS: 'ㄴ', KeyD: 'ㅇ', KeyF: 'ㄹ', KeyG: 'ㅎ', KeyH: 'ㅗ', KeyJ: 'ㅓ', KeyK: 'ㅏ', KeyL: 'ㅣ',
  KeyZ: 'ㅋ', KeyX: 'ㅌ', KeyC: 'ㅊ', KeyV: 'ㅍ', KeyB: 'ㅠ', KeyN: 'ㅜ', KeyM: 'ㅡ',
};

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';

/** 겹모음: 앞 모음 + 뒤 모음 → 합친 모음 (와 · 워 · 위 · 의 …) */
const COMBINE: Record<string, Record<string, string>> = {
  ㅗ: { ㅏ: 'ㅘ', ㅐ: 'ㅙ', ㅣ: 'ㅚ' },
  ㅜ: { ㅓ: 'ㅝ', ㅔ: 'ㅞ', ㅣ: 'ㅟ' },
  ㅡ: { ㅣ: 'ㅢ' },
};
/** 겹모음이 될 수 있는 모음(ㅗ · ㅜ · ㅡ)은 이만큼 기다렸다가 확정 */
const WAIT_MS = 450;

const compose = (cho: string, jung: string) => String.fromCharCode(0xac00 + (CHO.indexOf(cho) * 21 + JUNG.indexOf(jung)) * 28);

/**
 * 초성 + 중성 한 글자를 받는 조합기 (가나 발음은 모두 받침 없는 한 음절).
 * ㅗ · ㅜ · ㅡ 다음에 이어지는 모음이 오면 겹모음으로 합친다 (わ = 와, 요음은 그대로 ㅑ · ㅠ · ㅛ).
 */
export class HangulSyllableTyper {
  private cho: string | null = null;
  /** 겹모음을 기다리는 중인 글자 */
  private pending: { cho: string; jung: string; done: (s: string) => void; timer: number } | null = null;

  private flush(): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    window.clearTimeout(p.timer);
    p.done(compose(p.cho, p.jung));
  }

  /** 처리한 키면 true. 음절이 완성되면 onSyllable 호출 */
  handle(e: KeyboardEvent, onChange: (preview: string) => void, onSyllable: (syllable: string) => void): boolean {
    if (e.code === 'Backspace') {
      if (this.pending) window.clearTimeout(this.pending.timer);
      this.pending = null;
      this.cho = null;
      onChange('');
      return true;
    }
    const jamo = KEY_TO_JAMO[e.code];
    if (!jamo) return false;
    // Shift로 된소리 (ㄲ ㄸ ㅃ ㅆ ㅉ)
    const shifted = e.shiftKey ? ({ ㄱ: 'ㄲ', ㄷ: 'ㄸ', ㅂ: 'ㅃ', ㅅ: 'ㅆ', ㅈ: 'ㅉ' } as Record<string, string>)[jamo] ?? jamo : jamo;

    // 기다리던 모음과 합쳐지면 겹모음으로 확정
    if (this.pending) {
      const merged = COMBINE[this.pending.jung]?.[shifted];
      if (merged) {
        const p = this.pending;
        this.pending = null;
        window.clearTimeout(p.timer);
        const syl = compose(p.cho, merged);
        onChange(syl);
        p.done(syl);
        return true;
      }
      this.flush();
    }

    if (CHO.includes(shifted)) {
      this.cho = shifted;
      onChange(shifted);
      return true;
    }
    // 모음: 초성이 없으면 'ㅇ'으로 본다 (아·이·우·에·오)
    const cho = this.cho ?? 'ㅇ';
    this.cho = null;
    const syllable = compose(cho, shifted);
    onChange(syllable);
    if (COMBINE[shifted]) {
      this.pending = { cho, jung: shifted, done: onSyllable, timer: window.setTimeout(() => this.flush(), WAIT_MS) };
      return true;
    }
    onSyllable(syllable);
    return true;
  }

  reset(): void {
    if (this.pending) window.clearTimeout(this.pending.timer);
    this.pending = null;
    this.cho = null;
  }
}
