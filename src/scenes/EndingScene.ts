import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { Dialogue } from '../ui/Dialogue';
import { HD, registerHd } from '../art/hd/register';
import { summitGround, SUMMIT_W } from '../art/hd/summit';
import { nodeIcon } from '../art/hd/worldMap';
import { alleyBackground, ALLEY } from '../art/hd/alley';
import { villager } from '../art/hd/visit';
import { softGlow } from '../art/hd/library';
import { journey } from '../systems/journey';
import { run } from '../systems/run';
import { learnedKana } from '../systems/quiz';
import { clearSave } from '../systems/save';
import { markSeen } from '../systems/profile';
import { BLESSINGS, GODS } from '../data/blessings';
import { HangulSyllableTyper } from '../util/hangulKeys';
import { tts } from '../systems/tts';

/** 마지막 언령 こえ (목소리) — 코 · 에 */
const WORD = [
  { kana: 'こ', ko: '코' },
  { kana: 'え', ko: '에' },
];

/**
 * 🌄 1장 엔딩 — 산 정상에서 야마비코와 대화 → 마지막 언령 こえ를 직접 외친다(한글 입력)
 * → 메아리가 대답하고 목소리가 돌아온다 → 마을 골목 → 1장 완료 카드 → 결과 요약 → 타이틀.
 */
export class EndingScene extends Phaser.Scene {
  private ui!: UILayer;
  private dlg!: Dialogue;
  private boss = { correct: 0, total: 0 };
  private onKey: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    super('Ending');
  }

  init(data: { correct?: number; total?: number }): void {
    this.boss = { correct: data.correct ?? 0, total: data.total ?? 0 };
  }

  create(): void {
    registerHd(this);
    const tex = (key: string, make: () => HTMLCanvasElement) => !this.textures.exists(key) && this.textures.addCanvas(key, make());
    tex('summit', summitGround);
    tex('map-icon-fox', () => nodeIcon('fox'));
    tex('npc-villager', () => villager().canvas());
    tex('lib-glow', () => softGlow());
    this.add.image(0, 0, 'summit').setOrigin(0);
    // 정상의 한 장면만 보여 준다 (보스가 섰던 자리)
    this.cameras.main.setScroll(SUMMIT_W / 2 - 320, 40);

    const cx = SUMMIT_W / 2;
    this.add.ellipse(cx, 300, 64, 18, 0x000000, 0.35);
    this.add.sprite(cx, 300, HD.yamabiko, 0).setOrigin(0.5, 1).setName('yama');
    this.add.ellipse(cx - 30, 352, 18, 6, 0x000000, 0.3);
    this.add.sprite(cx - 30, 352, HD.player, 0).setOrigin(0.5, 1).play('p-idle');
    this.add.image(cx - 54, 354, 'map-icon-fox').setOrigin(0.5, 1);

    this.cameras.main.fadeIn(800, 12, 10, 18);
    this.ui = new UILayer(this);
    this.dlg = new Dialogue(this.ui);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dlg.close();
      if (this.onKey) window.removeEventListener('keydown', this.onKey);
    });
    this.time.delayedCall(900, () => void this.summit());
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  // ── 산 정상 ──────────────────────────────────────────

  private async summit(): Promise<void> {
    await this.dlg.play([
      { who: 'yamabiko', text: '……왜 막았어. 이 소리들은… 내 거야.' },
      { who: 'kotoha', text: '마을 사람들 목소리잖아. 다들 말을 못 해서 곤란해하고 있어.' },
      { who: 'yamabiko', text: '…산에 대고 아무리 외쳐도, 아무도 대답해 주지 않았어.' },
      { who: 'yamabiko', text: '사람들 소리를 모으면… 메아리라도 돌아오니까. 혼자가 아니니까.' },
      { who: 'kon', face: 'sad', text: '…외로웠구나.' },
      { who: 'kotoha', face: 'normal', text: '그럼 내가 대답할게. 잘 들어!' },
    ]);
    await this.ritual();
    await this.echo();
    await this.dlg.play([
      { who: 'yamabiko', face: 'surprised', text: '……こ、え…! 대답이… 돌아왔어!' },
      { who: 'yamabiko', face: 'happy', text: '산이… 나한테 대답했어.' },
    ]);
    this.releaseVoices();
    await this.wait(1200);
    await this.dlg.play([
      { who: 'fumi', text: '(두루마리 속에서) …잘했다, 코토하. 그것이 언령이다.' },
      { who: 'kotoha', face: 'happy', text: '스승님…!' },
      { who: 'yamabiko', text: '목소리, 돌려줄게. …가끔, 산에 대고 불러 줄래?' },
      { who: 'kotoha', face: 'happy', text: '응! 약속할게.' },
    ]);
    await this.village();
  }

  /** 마지막 언령 こえ — 한글로 한 음절씩 입력해 외친다 */
  private ritual(): Promise<void> {
    return new Promise((resolve) => {
      const box = this.ui.el('div', 'ritual fade-in');
      this.ui.el('div', 'ritual-head', '산을 향해 외치자 — <b>마지막 언령</b>', box);
      const row = this.ui.el('div', 'ritual-word', '', box);
      const cells = WORD.map((w) => this.ui.el('span', 'jp', w.kana, row));
      const typed = this.ui.el('div', 'ritual-typed', '<span class="caret">_</span>', box);
      const hint = this.ui.el('div', 'ritual-hint', '두 글자를 차례로 <b>한글로 입력</b> (한/영 상관없이)', box);
      let i = 0;
      let wrong = 0;
      const typer = new HangulSyllableTyper();
      cells[0].classList.add('now');
      this.onKey = (e: KeyboardEvent) => {
        if (document.querySelector('.settings-panel')) return;
        const handled = typer.handle(
          e,
          (p) => (typed.innerHTML = p ? `<b>${p}</b>` : '<span class="caret">_</span>'),
          (syl) => {
            if (syl === WORD[i].ko) {
              cells[i].classList.remove('now');
              cells[i].classList.add('done');
              void tts.speak(WORD[i].kana);
              i++;
              typed.innerHTML = '<span class="caret">_</span>';
              if (i >= WORD.length) {
                window.removeEventListener('keydown', this.onKey!);
                this.onKey = null;
                this.time.delayedCall(500, () => {
                  box.remove();
                  resolve();
                });
                return;
              }
              cells[i].classList.add('now');
            } else {
              wrong++;
              box.classList.remove('shake');
              void box.offsetWidth;
              box.classList.add('shake');
              typed.innerHTML = `<i>${syl}</i>`;
              if (wrong >= 2) hint.innerHTML = `힌트: <b>${WORD.map((w) => w.ko).join(' · ')}</b>`;
            }
          },
        );
        if (handled) e.preventDefault();
      };
      window.addEventListener('keydown', this.onKey);
    });
  }

  /** こえ — 메아리가 산을 돌아 되돌아온다 */
  private async echo(): Promise<void> {
    void tts.speak('こえ!');
    this.cameras.main.shake(400, 0.005);
    for (let k = 0; k < 4; k++) {
      const el = this.ui.el('div', 'echo-word jp', 'こえ');
      el.style.setProperty('--k', String(k));
      this.ui.place(el, 320 + (k % 2 ? 1 : -1) * k * 60, 120 - k * 14);
      this.time.delayedCall(1800, () => el.remove());
      await this.wait(380);
    }
    const yama = this.children.getByName('yama') as Phaser.GameObjects.Sprite;
    yama.setTexture(HD.yamabiko, 1);
    await this.wait(700);
  }

  /** 모였던 목소리가 빛이 되어 산 아래로 */
  private releaseVoices(): void {
    const yama = this.children.getByName('yama') as Phaser.GameObjects.Sprite;
    yama.setTexture(HD.yamabiko, 0);
    const glow = this.add.image(yama.x, yama.y - 40, 'lib-glow').setScale(2.6).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.9, duration: 500, yoyo: true, hold: 600 });
    for (let i = 0; i < 40; i++) {
      const d = this.add.circle(yama.x + (Math.random() - 0.5) * 40, yama.y - 40, 2, i % 3 ? 0xffe39a : 0xffffff).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: d,
        x: yama.x - 300 + Math.random() * 600,
        y: yama.y + 260 + Math.random() * 80,
        alpha: 0,
        delay: i * 40,
        duration: 1400,
        ease: 'Sine.easeIn',
        onComplete: () => d.destroy(),
      });
    }
  }

  // ── 마을 ─────────────────────────────────────────────

  private async village(): Promise<void> {
    const cam = this.cameras.main;
    cam.fadeOut(600, 12, 10, 18);
    await this.wait(700);
    this.children.removeAll(true);
    cam.setScroll(0, 0);
    const key = 'alley-ending';
    if (!this.textures.exists(key)) this.textures.addCanvas(key, alleyBackground(['kaki', 'okaki', 'ika', 'eki']));
    this.add.image(0, 0, key).setOrigin(0);
    const words = ['かき', 'おかき', 'いか', 'えき'];
    const signs = words.map((w, i) => {
      const el = this.ui.el('div', 'alley-sign jp', w);
      this.ui.place(el, ALLEY.shopXs[i], ALLEY.signY);
      return el;
    });
    this.add.sprite(240, 254, HD.player, 0).setOrigin(0.5, 1).play('p-idle');
    this.add.image(216, 256, 'map-icon-fox').setOrigin(0.5, 1);
    this.add.image(400, 254, 'npc-villager').setOrigin(0.5, 1).setFlipX(true);
    this.add.image(470, 254, 'npc-villager').setOrigin(0.5, 1).setTint(0xd8c8f0);
    cam.fadeIn(600, 12, 10, 18);
    await this.wait(700);
    await this.dlg.play([
      { who: 'villager', text: '아… 아아! 목소리가… 돌아왔다!' },
      { who: 'villager', text: '고맙다, 꼬마 무녀님! 간판도 다시 읽을 수 있게 됐어.' },
      { who: 'kon', face: 'happy', text: '히히, 우리 덕분이지!' },
      { who: 'kotoha', face: 'happy', text: '다음 마을에도… 사라진 글자를 찾으러 가자!' },
    ]);
    signs.forEach((s) => s.remove());
    this.titleCard();
  }

  private titleCard(): void {
    const card = this.ui.el('div', 'title-card');
    card.innerHTML = '<b>마지막 언령</b><span class="jp">こえ</span><small>목소리 — 마을 사람들의 목소리가 돌아왔다</small><b class="done">1장 · 산기슭 신사 마을 완료</b>';
    this.time.delayedCall(3600, () => {
      card.remove();
      this.summary();
    });
  }

  // ── 결과 요약 ─────────────────────────────────────────

  private summary(): void {
    markSeen('ch1-clear');
    const b = journey.build;
    const kana = learnedKana();
    const wrong = kana.filter((k) => run.wrong[k.kana]).sort((x, y) => run.wrong[y.kana] - run.wrong[x.kana]).slice(0, 3);
    const mins = Math.max(1, Math.round((Date.now() - (journey.startedAt || Date.now())) / 60000));
    const time = mins >= 60 ? `${Math.floor(mins / 60)}시간 ${mins % 60}분` : `${mins}분`;
    const bless = b.blessings
      .map((id) => BLESSINGS.find((x) => x.id === id))
      .filter((x) => x)
      .map((x) => `${GODS[x!.god].icon} ${x!.name}`)
      .join(' · ');
    this.ui.root.classList.add('dimmed');
    const panel = this.ui.el('div', 'panel fade-in result-panel');
    this.ui.el('h2', '', '🌄 1장 결과', panel);
    this.ui.el('p', '', `되찾은 글자 <b>${kana.length}</b>자`, panel);
    const grid = this.ui.el('div', 'row result-kana', '', panel);
    kana.forEach((k) => this.ui.el('div', 'kana', k.kana, grid));
    this.ui.el(
      'p',
      'result-lines',
      [
        `보스 퀴즈 <b>${this.boss.correct} / ${this.boss.total}</b> 정답`,
        wrong.length ? `가장 많이 틀린 글자 ${wrong.map((k) => `<span class="jp">${k.kana}</span>[${k.ko}]×${run.wrong[k.kana]}`).join(' · ')}` : '틀린 글자 없음 — 완벽해요!',
        `받은 가호 ${bless || '없음'}`,
        `레벨 <b>${b.level}</b> · 언령 구슬 <b>${b.orbs}</b> · 플레이 시간 <b>${time}</b>`,
      ].join('<br>'),
      panel,
    );
    this.ui.el('p', 'result-next', '다음 — <b>2장 · 강가 마을</b> <span class="jp">た · な · は</span> · 제작 중이에요', panel);
    const btns = this.ui.el('div', 'row', '', panel);
    btns.style.marginBottom = '0';
    this.ui.button('타이틀로', () => {
      clearSave();
      this.scene.start('Title');
    }, 'primary', btns);
  }
}
