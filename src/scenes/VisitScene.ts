import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { Dialogue } from '../ui/Dialogue';
import { BossQuizPanel } from '../ui/BossQuizPanel';
import { pickCard } from '../ui/Cards';
import { HD, registerHd } from '../art/hd/register';
import { nodeIcon } from '../art/hd/worldMap';
import { visitBackground, VisitKind, STAND_Y, MENU, foxGranny, villager } from '../art/hd/visit';
import { ALLEY } from '../art/hd/alley';
import { softGlow } from '../art/hd/library';
import { journey, finishNode, grantBlessing, gainOrbs } from '../systems/journey';
import { armsOffers } from '../combat/Arsenal';
import { GODS, rollBlessings } from '../data/blessings';
import { makeQuiz, recordAnswer } from '../systems/quiz';
import { tts } from '../systems/tts';

interface MenuItem {
  word: string;
  ko: string;
  meaning: string;
  effect: string;
  price: number;
  buy: () => Promise<boolean>;
}

/** 한글 읽기 보기 만들 때 섞는 비슷한 소리 */
const READ_POOL = ['오카키', '카키', '이카', '아이', '오키카', '카오', '이키', '아카', '에키', '코이', '카사', '사카', '아사', '스시', '이스', '사케', '아시', '우소', '코시', '스이카', '시카', '소코', '세키', '아오'];

/** 이벤트: 목소리를 잃은 아저씨가 땅에 쓰는 단어 (あ·か·さ행으로만) */
const SAND_WORDS: { word: string; ko: string; meaning: string }[] = [
  { word: 'かさ', ko: '카사', meaning: '우산' },
  { word: 'すし', ko: '스시', meaning: '초밥' },
  { word: 'あさ', ko: '아사', meaning: '아침' },
  { word: 'いす', ko: '이스', meaning: '의자' },
  { word: 'さけ', ko: '사케', meaning: '연어 · 술' },
  { word: 'あし', ko: '아시', meaning: '다리' },
  { word: 'すいか', ko: '스이카', meaning: '수박' },
  { word: 'うそ', ko: '우소', meaning: '거짓말' },
];

const TITLES: Record<VisitKind, string> = {
  shop: '🍵 여우 찻집',
  spring: '♨️ 산속 온천',
  shrine: '⛩️ 작은 신사',
  event: '📜 마을 골목',
  rest: '🏕️ 산길 쉼터',
};

function shuffle<T>(a: T[]): T[] {
  return [...a].sort(() => Math.random() - 0.5);
}

/**
 * 비전투 노드 방문 장면 — 찻집 · 온천 · 신사 · 이벤트 · 산길 쉼터.
 * 배경 + 코토하(·콘) + NPC, 대화와 메뉴로 진행하고 '지도로'로 나간다.
 */
export class VisitScene extends Phaser.Scene {
  private kind: VisitKind = 'shop';
  private nodeId: number | null = null;
  private ui!: UILayer;
  private dlg!: Dialogue;
  private quiz!: BossQuizPanel;
  private hud!: HTMLElement;
  private withKon = false;
  private ttsOk = false;

  constructor() {
    super('Visit');
  }

  init(data: { kind?: VisitKind; nodeId?: number }): void {
    this.kind = data.kind ?? 'shop';
    this.nodeId = data.nodeId ?? null;
  }

  create(): void {
    registerHd(this);
    const key = `visit-${this.kind}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, visitBackground(this.kind));
    if (!this.textures.exists('map-icon-fox')) this.textures.addCanvas('map-icon-fox', nodeIcon('fox'));
    if (!this.textures.exists('npc-granny')) this.textures.addCanvas('npc-granny', foxGranny().canvas());
    if (!this.textures.exists('npc-villager')) this.textures.addCanvas('npc-villager', villager().canvas());
    if (!this.textures.exists('lib-glow')) this.textures.addCanvas('lib-glow', softGlow());
    this.add.image(0, 0, key).setOrigin(0);

    // 콘은 1장 이야기에서 만난 뒤부터 함께
    this.withKon = journey.nodes.some((n) => n.kind === 'story' && journey.visited.includes(n.id)) || this.nodeId === null;
    // 서는 자리: 온천은 탕 옆 바위, 쉼터는 통나무 의자 곁
    const px = this.kind === 'shop' ? 250 : this.kind === 'rest' ? 440 : this.kind === 'spring' ? 90 : 230;
    this.add.ellipse(px, STAND_Y, 18, 6, 0x000000, 0.3);
    this.add.sprite(px, STAND_Y, HD.player, 0).setOrigin(0.5, 1).play('p-idle').setFlipX(this.kind === 'rest');
    if (this.withKon) this.add.image(px - 24, STAND_Y + 2, 'map-icon-fox').setOrigin(0.5, 1).setFlipX(this.kind === 'rest');
    if (this.kind === 'shop') this.add.image(400, 168, 'npc-granny').setOrigin(0.5, 1);
    if (this.kind === 'event') this.add.image(400, STAND_Y, 'npc-villager').setOrigin(0.5, 1).setFlipX(true);
    if (this.kind === 'spring') this.steam();
    if (this.kind === 'rest') this.campfire();

    this.cameras.main.fadeIn(350, 12, 10, 18);
    this.ui = new UILayer(this);
    this.dlg = new Dialogue(this.ui);
    this.quiz = new BossQuizPanel(this.ui);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dlg.close();
      this.quiz.close();
    });
    this.ui.el('div', 'hud-title story-title', TITLES[this.kind]);
    this.hud = this.ui.el('div', 'visit-hud');
    this.refreshHud();
    void tts.isAvailable().then((ok) => (this.ttsOk = ok));

    this.time.delayedCall(450, () => {
      const run = { shop: () => this.shop(), spring: () => this.spring(), shrine: () => this.shrine(), event: () => this.event(), rest: () => this.rest() }[this.kind];
      void run();
    });
  }

  private refreshHud(): void {
    const b = journey.build;
    this.hud.innerHTML = `<span>❤ ${Math.ceil(b.hp)}/${b.maxHp}</span><span>🔮 ${b.orbs}</span>`;
  }

  private heal(n: number): number {
    const b = journey.build;
    const before = b.hp;
    b.hp = Math.min(b.maxHp, b.hp + n);
    this.refreshHud();
    return Math.round(b.hp - before);
  }

  // ── 공통 ─────────────────────────────────────────────

  /** 지도로 나가기 (노드 완료) */
  private leave(): void {
    this.cameras.main.fadeOut(350, 12, 10, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (this.nodeId !== null) finishNode(this.nodeId);
      this.scene.start('ChapterMap');
    });
  }

  private leaveButton(label = '지도로'): HTMLButtonElement {
    this.ui.root.querySelector('.visit-leave')?.remove();
    return this.ui.button(`${label}<small>Esc</small>`, () => this.leave(), 'primary visit-leave');
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  /**
   * 읽기 문제 한 개 (보기 고르기). 맞혔는지로 끝난다.
   * big = 크게 보여 줄 글자, choices = 보기 HTML, answer = 정답 번호
   */
  private ask(title: string, prompt: string, big: { text: string; jp: boolean } | undefined, choices: string[], answer: number, note?: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.quiz.show({ title, prompt, big, choices: choices.map((html, i) => ({ html, correct: i === answer })) }, (i) => {
        const ok = i === answer;
        this.quiz.feedback(ok, ok ? `정답!${note ? ` ${note}` : ''}` : `정답은 ${choices[answer]}${note ? ` — ${note}` : ''}`, i);
        window.removeEventListener('keydown', onKey);
        this.time.delayedCall(ok ? 900 : 1500, () => {
          this.quiz.close();
          resolve(ok);
        });
      });
      this.quiz.setTime(1);
      const onKey = (e: KeyboardEvent) => {
        const n = Number(e.key);
        if (n >= 1 && n <= choices.length) this.quiz.pick(n - 1);
      };
      window.addEventListener('keydown', onKey);
    });
  }

  /** 단어의 한글 읽기 보기 4개 (정답 포함) */
  private readings(ko: string): [string[], number] {
    const others = shuffle(READ_POOL.filter((r) => r !== ko)).slice(0, 3);
    const all = shuffle([ko, ...others]);
    return [all, all.indexOf(ko)];
  }

  // ── 🍵 찻집 ──────────────────────────────────────────

  private async shop(): Promise<void> {
    const b = journey.build;
    await this.dlg.play([
      { who: 'granny', text: '어서 오렴. 이나리 님을 모시는 찻집이란다.' },
      ...(this.withKon
        ? [
            { who: 'kon' as const, face: 'happy' as const, text: '할멈! 나야, 콘!' },
            { who: 'granny' as const, text: '어머, 콘 아니냐. 심부름은 잘 하고 있니? 후후.' },
          ]
        : []),
      { who: 'granny', text: '메뉴판을 읽고 주문하면 조금 깎아 주마. 언령 구슬로 받는단다.' },
    ]);
    const items: MenuItem[] = [
      { word: 'おかき', ko: '오카키', meaning: '쌀과자', effect: '체력 +40', price: 12, buy: async () => (this.heal(40), true) },
      { word: 'かき', ko: '카키', meaning: '감', effect: '최대 체력 +20', price: 20, buy: async () => ((b.maxHp += 20), this.heal(20), true) },
      { word: 'いか', ko: '이카', meaning: '오징어구이', effect: '무기 강화 1개', price: 25, buy: () => this.pickArms() },
      { word: 'あい', ko: '아이', meaning: '사랑', effect: '가호 1개', price: 35, buy: () => this.pickBlessing('이나리 님의 부적 — 신의 가호를 하나 고르렴') },
    ];
    const sold = new Set<number>();
    const boards: HTMLElement[] = [];
    let busy = false;
    items.forEach((it, i) => {
      const el = this.ui.el('div', 'menu-board clickable', `<span class="jp">${it.word}</span><small>${it.effect}</small><b>🔮 ${it.price}</b>`);
      this.ui.place(el, MENU.xs[i], MENU.y);
      el.addEventListener('click', () => void order(i));
      boards.push(el);
    });
    const hint = this.ui.el('div', 'hint', '메뉴판을 <b>클릭</b>해 주문 — 읽기를 맞히면 <b>20% 할인</b>');
    const order = async (i: number) => {
      if (busy || sold.has(i)) return;
      busy = true;
      hint.style.opacity = '0';
      const it = items[i];
      const [opts, ans] = this.readings(it.ko);
      const ok = await this.ask('🍵 주문', `「<span class="jp">${it.word}</span>」 — 이 메뉴는 어떻게 읽을까?`, { text: it.word, jp: true }, opts, ans, `${it.meaning}`);
      const price = ok ? Math.ceil(it.price * 0.8) : it.price;
      if (b.orbs < price) {
        await this.dlg.play([{ who: 'granny', text: `${it.meaning}${ok ? '라… 잘 읽었구나. 하지만' : '는'} 구슬 ${price}개란다. 조금 모자라는구나.` }]);
      } else {
        const choice = await this.dlg.ask({ who: 'granny', text: `${ok ? '잘 읽었구나! ' : `「${it.ko}」라고 읽는단다. `}${it.meaning}, 구슬 ${price}개${ok ? '(할인)' : ''}. 살 테냐?` }, [`산다 (🔮${price})`, '그만둔다']);
        if (choice === 0 && (await it.buy())) {
          b.orbs -= price;
          sold.add(i);
          boards[i].classList.add('sold');
          boards[i].querySelector('b')!.textContent = '다 팔림';
          this.refreshHud();
        }
      }
      busy = false;
      hint.style.opacity = '1';
    };
    this.leaveButton('나가기');
    this.bindEsc();
  }

  private async pickArms(): Promise<boolean> {
    const b = journey.build;
    const offers = shuffle(armsOffers(b.owned, b.unlocked)).slice(0, 3);
    if (offers.length === 0) {
      await this.dlg.play([{ who: 'granny', text: '무기가 이미 훌륭하구나. 더 손볼 데가 없단다.' }]);
      return false;
    }
    const i = await pickCard(this.ui, '무기 강화', '오징어구이를 먹고 힘이 났다! 하나 고르세요', offers);
    offers[i].apply();
    return true;
  }

  /** 가호 3택 (신사 · 찻집 · 원한 요괴 보상) */
  private async pickBlessing(sub: string): Promise<boolean> {
    const list = rollBlessings(journey.build.blessings);
    if (list.length === 0) return false;
    const i = await pickCard(
      this.ui,
      '신의 가호',
      sub,
      list.map((bl) => ({ icon: GODS[bl.god].icon, name: bl.name, desc: bl.desc, note: GODS[bl.god].name })),
    );
    grantBlessing(list[i].id);
    const god = GODS[list[i].god];
    this.cameras.main.flash(400, 255, 236, 180);
    const voice = this.ui.el('div', 'god-voice', `${god.icon} ${god.name}: 「${god.voice}」`);
    this.time.delayedCall(2600, () => voice.remove());
    return true;
  }

  private bindEsc(): void {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !this.dlg.open && !document.querySelector('.card-pick') && this.leave();
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
  }

  // ── ♨️ 온천 ──────────────────────────────────────────

  private async spring(): Promise<void> {
    await this.dlg.play([
      this.withKon ? { who: 'kon', face: 'happy', text: '온천이다~! 몸도 마음도 풀리겠어!' } : { who: 'kotoha', face: 'happy', text: '온천이다! 잠깐 쉬어 갈까.' },
    ]);
    const c = await this.dlg.ask({ who: 'kotoha', text: '어떻게 할까?' }, ['푹 쉬기 (체력 50% 회복)', '복습하기 (약한 글자 5문제 · 맞힐 때마다 ❤+10)']);
    if (c === 0) {
      const got = this.heal(journey.build.maxHp * 0.5);
      await this.dlg.play([{ who: 'kotoha', face: 'happy', text: `후아… 개운하다. (체력 +${got})` }]);
    } else {
      let right = 0;
      for (let i = 0; i < 5; i++) {
        const q = makeQuiz(this.ttsOk);
        const step = `복습 ${i + 1} / 5`;
        const choices = q.choices.map((k) => (q.kind === 'sound' ? `<span class="jp">${k.kana}</span>` : k.ko));
        if (q.kind === 'sound') void tts.speak(q.answer.kana);
        const ok = await this.ask(
          `♨️ ${step}`,
          q.kind === 'sound' ? '들리는 글자를 고르세요' : '이 글자의 발음은?',
          q.kind === 'sound' ? undefined : { text: q.answer.kana, jp: true },
          choices,
          q.choices.indexOf(q.answer),
          `<span class="jp">${q.answer.kana}</span> [${q.answer.ko}]`,
        );
        recordAnswer(q.answer, ok);
        if (ok) {
          right++;
          this.heal(10);
        }
      }
      await this.dlg.play([
        this.withKon
          ? { who: 'kon', face: right >= 4 ? 'happy' : 'normal', text: `${right} / 5! ${right >= 4 ? '머리까지 맑아졌네!' : '틀린 글자는 또 나올 거야. 그때 꼭 맞히자!'}` }
          : { who: 'kotoha', text: `${right} / 5. 틀린 글자는 꼭 기억해 두자.` },
      ]);
    }
    this.leaveButton();
    this.bindEsc();
  }

  // ── ⛩️ 신사 ──────────────────────────────────────────

  private async shrine(): Promise<void> {
    await this.dlg.play([
      { who: 'kotoha', text: '작은 신사네… 신님, 힘을 빌려주세요.' },
      ...(this.withKon ? [{ who: 'kon' as const, face: 'surprised' as const, text: '앗, 신님들의 기척이 느껴져! 누가 대답해 줄까?' }] : []),
    ]);
    const glow = this.add.image(320, 160, 'lib-glow').setScale(2.5).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.8, duration: 600, yoyo: true, hold: 400 });
    await this.wait(700);
    const ok = await this.pickBlessing('신들이 저마다 가호를 내민다 — 하나를 받으세요');
    if (!ok) {
      const got = this.heal(20);
      await this.dlg.play([{ who: 'kotoha', text: `신들이 조용히 지켜보고 있다… 마음이 놓인다. (체력 +${got})` }]);
    }
    await this.wait(400);
    this.leaveButton();
    this.bindEsc();
  }

  // ── 📜 이벤트: 목소리를 잃은 아저씨 ──────────────────────

  private async event(): Promise<void> {
    // 골목 가게 간판도 글자가 돌아와 있다
    (['kaki', 'okaki', 'ika', 'eki'] as const).forEach((k, i) => {
      const word = { kaki: 'かき', okaki: 'おかき', ika: 'いか', eki: 'えき' }[k];
      this.ui.place(this.ui.el('div', 'alley-sign jp', word), ALLEY.shopXs[i], ALLEY.signY);
    });
    await this.dlg.play([
      { who: 'villager', text: '(…! …!! 입을 뻐끔거리지만 소리가 나지 않는다)' },
      { who: 'kotoha', face: 'surprised', text: '목소리가… 안 나오세요? 산의 메아리 요괴가 마을 사람들 목소리를 훔쳐 갔다더니…' },
      { who: 'villager', text: '(나뭇가지를 주워 땅에 글자를 쓰기 시작한다)' },
      ...(this.withKon ? [{ who: 'kon' as const, text: '글자로 말하려나 봐! 코토하, 대신 읽어 줘!' }] : []),
    ]);
    const words = shuffle(SAND_WORDS).slice(0, 3);
    let right = 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const sand = this.ui.el('div', 'sand-word jp', w.word);
      this.ui.place(sand, 486, 232);
      const [opts, ans] = this.readings(w.ko);
      const ok = await this.ask(`📜 땅에 쓴 글자 ${i + 1} / 3`, '아저씨가 쓴 글자를 소리 내어 읽어 주자', { text: w.word, jp: true }, opts, ans, w.meaning);
      sand.remove();
      if (ok) {
        right++;
        void tts.speak(w.word);
      }
    }
    const orbs = gainOrbs(right * 5);
    const hp = this.heal(right * 5);
    await this.dlg.play([
      { who: 'villager', text: '(고개를 끄덕이며 품에서 무언가를 꺼내 건넨다)' },
      { who: 'kotoha', face: 'happy', text: `${right === 3 ? '다 전해졌어요! ' : ''}목소리, 꼭 되찾아 드릴게요. (🔮 +${orbs} · ❤ +${hp})` },
    ]);
    this.refreshHud();
    this.leaveButton();
    this.bindEsc();
  }

  // ── 🏕️ 산길 쉼터 ─────────────────────────────────────

  private async rest(): Promise<void> {
    const got = this.heal(journey.build.maxHp);
    await this.dlg.play([
      { who: 'kotoha', face: 'happy', text: `모닥불이 따뜻하다… (체력 모두 회복 +${got})` },
      ...(this.withKon
        ? [
            { who: 'kon' as const, text: '저 꼭대기에 야마비코가 있어. 마을 사람들 목소리를 메아리로 되던진대.' },
            { who: 'kon' as const, face: 'happy' as const, text: '들리는 글자를 잘 듣고, 붉게 빛나는 곳은 피하고! 우리라면 할 수 있어.' },
            { who: 'kotoha' as const, text: '응. 목소리를 돌려받으러 가자!' },
          ]
        : []),
    ]);
    this.leaveButton('산 정상으로');
    this.bindEsc();
  }

  // ── 연출 ─────────────────────────────────────────────

  private steam(): void {
    this.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        const x = 160 + Math.random() * 320;
        const s = this.add.ellipse(x, 230 + Math.random() * 30, 10, 6, 0xffffff, 0.35);
        this.tweens.add({ targets: s, y: s.y - 60, scaleX: 2.4, scaleY: 2, alpha: 0, duration: 1800, onComplete: () => s.destroy() });
      },
    });
  }

  private campfire(): void {
    const glow = this.add.image(320, 246, 'lib-glow').setScale(1.6).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.75, scale: 1.75, duration: 300, yoyo: true, repeat: -1 });
    const colors = [0xfff4b0, 0xf8c050, 0xec7a2a];
    this.time.addEvent({
      delay: 70,
      loop: true,
      callback: () => {
        const f = this.add.rectangle(314 + Math.random() * 12, 256, 3, 3, colors[Math.floor(Math.random() * 3)]);
        this.tweens.add({ targets: f, y: 226 - Math.random() * 14, x: f.x + (Math.random() - 0.5) * 8, alpha: 0, duration: 600, onComplete: () => f.destroy() });
      },
    });
  }
}
