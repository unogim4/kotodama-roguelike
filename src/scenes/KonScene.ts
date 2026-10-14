import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { Dialogue } from '../ui/Dialogue';
import { HD, registerHd } from '../art/hd/register';
import { nodeIcon } from '../art/hd/worldMap';
import { bambooTrap, ALLEY, ShopKind } from '../art/hd/alley';
import { bgKey, alleyBg } from '../art/sceneBg';
import { createMoveKeys, readMove, MoveKeys } from '../systems/movement';
import { finishNode, unlockArms } from '../systems/journey';
import { rng } from '../map/chapter1';
import { profile, markSeen } from '../systems/profile';
import { tts } from '../systems/tts';

const SHOPS: Record<ShopKind, { word: string; ko: string; what: string }> = {
  kaki: { word: 'かき', ko: '카키', what: '감' },
  okaki: { word: 'おかき', ko: '오카키', what: '쌀과자' },
  eki: { word: 'えき', ko: '에키', what: '역' },
  ika: { word: 'いか', ko: '이카', what: '오징어' },
};
const WALK = 120;
const FLOOR = { minX: 16, maxX: 624, minY: ALLEY.streetY + 22, maxY: 346 };
const TRAP = { x: 64, y: 254 };
/** 가게 앞에서 Space로 고를 수 있는 거리 */
const NEAR_X = 50;
const NEAR_Y = ALLEY.streetY + 42;

type Phase = 'talk' | 'search' | 'done';

/**
 * 📜 콘과의 만남 (1장 か행 구간 · 필수 이야기 노드).
 * 덫에 걸린 아기 여우 콘을 풀어 주고, 골목 간판을 읽어 おかき(쌀과자) 가게를 찾아 준다 → 🦊 여우불.
 */
export class KonScene extends Phaser.Scene {
  private nodeId: number | null = null;
  private ui!: UILayer;
  private dlg!: Dialogue;
  private keys!: MoveKeys;
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private kon!: Phaser.GameObjects.Image;
  private trap!: Phaser.GameObjects.Image;
  private order: ShopKind[] = [];
  private signs: HTMLElement[] = [];
  private hint!: HTMLElement;
  private phase: Phase = 'talk';
  private joined = false;
  private facing = 1;

  constructor() {
    super('StoryKon');
  }

  init(data: { nodeId?: number }): void {
    this.nodeId = data.nodeId ?? null;
  }

  create(): void {
    registerHd(this);
    this.phase = 'talk';
    this.joined = false;
    this.signs = [];
    const rand = rng(7919 + (this.nodeId ?? 0));
    this.order = (['kaki', 'okaki', 'eki', 'ika'] as ShopKind[]).sort(() => rand() - 0.5);

    const key = bgKey(`alley-${this.order.join('-')}`);
    if (!this.textures.exists(key)) this.textures.addCanvas(key, alleyBg(this.order));
    if (!this.textures.exists('alley-trap')) this.textures.addCanvas('alley-trap', bambooTrap());
    if (!this.textures.exists('map-icon-fox')) this.textures.addCanvas('map-icon-fox', nodeIcon('fox'));
    this.add.image(0, 0, key).setOrigin(0);

    this.kon = this.add.image(TRAP.x, TRAP.y - 2, 'map-icon-fox').setOrigin(0.5, 1).setDepth(TRAP.y);
    this.trap = this.add.image(TRAP.x, TRAP.y + 2, 'alley-trap').setOrigin(0.5, 1).setDepth(TRAP.y + 1);
    this.tweens.add({ targets: this.kon, angle: { from: -4, to: 4 }, duration: 260, yoyo: true, repeat: 3, repeatDelay: 900, loop: -1 });

    this.shadow = this.add.ellipse(150, 254, 18, 6, 0x000000, 0.3);
    this.player = this.add.sprite(150, 254, HD.player, 0).setOrigin(0.5, 1);
    this.player.play('p-idle');
    this.syncPlayer();

    this.cameras.main.fadeIn(400, 12, 10, 18);
    this.ui = new UILayer(this);
    this.dlg = new Dialogue(this.ui);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dlg.close();
      window.removeEventListener('keydown', onKey);
    });
    this.ui.el('div', 'hud-title story-title', '📜 콘과의 만남');
    this.hint = this.ui.el('div', 'hint', '');
    this.hint.style.opacity = '0';

    // 가게 간판 (글자는 선명하게 DOM으로)
    this.order.forEach((kind, i) => {
      const el = this.ui.el('div', 'alley-sign clickable jp', SHOPS[kind].word);
      this.ui.place(el, ALLEY.shopXs[i], ALLEY.signY);
      el.addEventListener('click', () => this.phase === 'search' && void this.choose(i));
      this.signs.push(el);
    });

    this.keys = createMoveKeys(this);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && this.phase === 'search' && !this.dlg.open) {
        const i = this.nearShop();
        if (i >= 0) {
          e.preventDefault();
          void this.choose(i);
        }
      }
    };
    window.addEventListener('keydown', onKey);

    if (profile.seen.includes('kon')) {
      const skip = this.ui.button('건너뛰기<small>이미 본 이야기</small>', () => this.finish(), 'small story-skip');
      skip.title = '바로 콘이 동료가 된다';
    }
    this.time.delayedCall(600, () => void this.intro());
  }

  // ── 이야기 ───────────────────────────────────────────

  private async intro(): Promise<void> {
    await this.dlg.play([
      { who: 'kon', face: 'sad', text: '끄응… 거기 누구 있어? 덫에 걸렸어…' },
      { who: 'kotoha', face: 'surprised', text: '여, 여우가 말을 하네?!' },
      { who: 'kon', face: 'normal', text: '난 콘! 이나리 님의 심부름꾼… 이 될 예정인 여우야. 배가 고파서 미끼를 물었다가 그만…' },
      { who: 'kotoha', face: 'normal', text: '잠깐만, 풀어 줄게!' },
    ]);
    // 덫이 열린다
    this.tweens.add({ targets: this.trap, y: this.trap.y - 26, alpha: 0, duration: 450, ease: 'Cubic.easeIn' });
    this.tweens.killTweensOf(this.kon);
    this.kon.setAngle(0);
    this.tweens.add({ targets: this.kon, y: this.kon.y - 8, duration: 160, yoyo: true });
    await this.wait(600);
    await this.dlg.play([
      { who: 'kon', face: 'sad', text: '고마워… 그런데 배가 너무 고파서 한 발짝도 못 걷겠어.' },
      { who: 'kon', face: 'normal', text: '이 골목 어딘가에 {おかき}(오카키) 가게가 있어. 쌀과자 하나만 사다 줄래?', say: 'おかき' },
      { who: 'kotoha', face: 'normal', text: '오카키… 어느 가게인지 모르겠는걸.' },
      { who: 'kon', face: 'happy', text: '간판을 읽으면 되지! 오·카·키. 글자가 돌아온 간판 중에서 찾아 줘!', say: 'おかき' },
    ]);
    this.phase = 'search';
    this.hint.innerHTML = '<b>WASD</b>로 걸어 가게 앞에서 <b>Space</b> · 간판 <b>클릭</b> — <b>오카키</b> 가게를 찾자';
    this.hint.style.opacity = '1';
  }

  private async choose(i: number): Promise<void> {
    if (this.phase !== 'search' || this.dlg.open) return;
    const kind = this.order[i];
    const shop = SHOPS[kind];
    this.hint.style.opacity = '0';
    if (kind !== 'okaki') {
      this.signs[i].classList.add('wrong');
      await this.dlg.play([
        { who: 'kon', face: 'sad', text: `으응, 거긴 {${shop.word}}(${shop.ko})… ${shop.what}${kind === 'eki' ? '이' : ' 가게'}야!`, say: shop.word },
        { who: 'kon', face: 'normal', text: '내가 찾는 건 오·카·키! {お} {か} {き} 세 글자야.', say: 'おかき' },
      ]);
      this.hint.style.opacity = '1';
      return;
    }
    // 정답 — 가게에 들어갔다 나온다
    this.phase = 'done';
    this.signs[i].classList.add('right');
    void tts.speak('おかき');
    const cam = this.cameras.main;
    cam.fadeOut(300, 12, 10, 18);
    await this.wait(700);
    this.player.setPosition(ALLEY.shopXs[i], ALLEY.streetY + 40);
    this.kon.setPosition(ALLEY.shopXs[i] - 26, ALLEY.streetY + 42).setDepth(ALLEY.streetY + 42);
    this.syncPlayer();
    cam.fadeIn(300, 12, 10, 18);
    await this.wait(400);
    await this.dlg.play([
      { who: 'kotoha', face: 'happy', text: '찾았다! {おかき}, 쌀과자야!', say: 'おかき' },
      { who: 'kon', face: 'happy', text: '와아—! (와작와작) …살았다! 너, 글자를 읽을 줄 아는구나?' },
      { who: 'kotoha', face: 'normal', text: '응. 서고에서 되찾았어. 세상에서 글자가 사라졌거든.' },
      { who: 'kon', face: 'surprised', text: '그래서 간판이 다 비어 있었구나…!' },
      { who: 'kon', face: 'happy', text: '좋아, 은혜는 꼭 갚는 게 여우의 도리! 내가 같이 가 줄게. 내 여우불, 꽤 뜨겁다고?' },
    ]);
    this.finish();
  }

  /** 콘 합류 → 여우불 → 지도로 */
  private finish(): void {
    if (this.joined) return;
    this.joined = true;
    this.phase = 'done';
    this.dlg.close();
    this.ui.root.querySelector('.story-skip')?.remove();
    this.hint.style.opacity = '0';
    markSeen('kon');
    this.trap.setVisible(false);
    const equipped = unlockArms('kitsunebi');
    this.cameras.main.flash(400, 143, 216, 255);

    this.ui.root.classList.add('dimmed');
    const panel = this.ui.el('div', 'panel fade-in');
    this.ui.el('h2', '', '🦊 콘이 동료가 되었다!', panel);
    this.ui.el(
      'p',
      '',
      equipped
        ? '새 무기 <b>여우불 Lv1</b> — 언령사 주위를 도는 푸른 불꽃.<br><small>이제 레벨업 선택지에 여우불 강화가 나온다 · 다음 판부터는 \'새 무기\'로</small>'
        : '<b>여우불</b>을 해금했다.<br><small>무기 칸이 가득 차 있어 장착은 못 했다 · 레벨업 선택지에 나온다</small>',
      panel,
    );
    const btns = this.ui.el('div', 'row', '', panel);
    btns.style.marginBottom = '0';
    const go = () => {
      window.removeEventListener('keydown', onEnter);
      this.cameras.main.fadeOut(400, 12, 10, 18);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        if (this.nodeId !== null) finishNode(this.nodeId);
        this.scene.start('ChapterMap');
      });
    };
    const onEnter = (e: KeyboardEvent) => e.key === 'Enter' && go();
    window.addEventListener('keydown', onEnter);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onEnter));
    this.ui.button('지도로<small>Enter</small>', go, 'primary', btns);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  // ── 이동 ─────────────────────────────────────────────

  update(_t: number, delta: number): void {
    const p = this.player;
    const free = this.phase === 'search' && !this.dlg.open;
    const dir = free ? readMove(this.keys) : { x: 0, y: 0 };
    const moving = dir.x !== 0 || dir.y !== 0;
    p.play(moving ? 'p-walk' : 'p-idle', true);
    if (moving) {
      const step = (WALK * Math.min(delta, 50)) / 1000;
      p.x = Phaser.Math.Clamp(p.x + dir.x * step, FLOOR.minX, FLOOR.maxX);
      p.y = Phaser.Math.Clamp(p.y + dir.y * step, FLOOR.minY, FLOOR.maxY);
      if (dir.x !== 0) this.facing = Math.sign(dir.x);
      p.setFlipX(this.facing < 0);
      this.syncPlayer();
    }
    // 가까운 가게 간판을 밝힌다
    const near = free ? this.nearShop() : -1;
    this.signs.forEach((s, i) => s.classList.toggle('near', i === near));
    // 동료가 된 콘은 뒤를 따라온다
    if (this.joined || this.phase === 'done') {
      const tx = p.x - this.facing * 22;
      this.kon.x = Phaser.Math.Linear(this.kon.x, tx, 0.08);
      this.kon.y = Phaser.Math.Linear(this.kon.y, p.y + 2, 0.08);
      this.kon.setFlipX(this.facing < 0).setDepth(this.kon.y);
    }
  }

  private nearShop(): number {
    const p = this.player;
    if (p.y > NEAR_Y) return -1;
    return ALLEY.shopXs.findIndex((x) => Math.abs(p.x - x) < NEAR_X);
  }

  private syncPlayer(): void {
    this.player.setDepth(this.player.y);
    this.shadow.setPosition(this.player.x, this.player.y).setDepth(this.player.y - 0.5);
  }
}
