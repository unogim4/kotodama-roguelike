import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { Dialogue } from '../ui/Dialogue';
import { HD, registerHd } from '../art/hd/register';
import { libStand, softGlow, sparkle, LIB } from '../art/hd/library';
import { bgKey, libraryBg, yardBg } from '../art/sceneBg';
import { YARD, fumiSprite, mojikuiMouth, flyingBook, rubble, floorScroll } from '../art/hd/prologue';
import { M } from '../art/hd/worldMap';
import { createMoveKeys, readMove, MoveKeys } from '../systems/movement';
import { profile, markSeen } from '../systems/profile';

const WALK = 120;
type Part = 'yard' | 'library';

/**
 * 🏚️ 프롤로그 · 하얀 아침 (새 이야기를 시작하면 자동 재생, 다음부터 건너뛰기).
 * ① 경내: 고찰·현판의 글자가 비었다 → ② 서고: 모지쿠이(하얀 입)와 후미의 봉인
 * → ③ 무너진 서고에서 두루마리·부적 줍기 → 1장 제목 카드 → 지도.
 */
export class PrologueScene extends Phaser.Scene {
  private ui!: UILayer;
  private dlg!: Dialogue;
  private keys!: MoveKeys;
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private hint!: HTMLElement;
  private part: Part = 'yard';
  /** 걸을 수 있는지 (대화 · 연출 중엔 멈춤) */
  private free = false;
  private sawBoard = false;
  private leaving = false;
  private facing = 1;
  private bounds = { minX: 16, maxX: 624, minY: YARD.groundY + 20, maxY: 346 };
  private items: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; name: string; text: string }[] = [];
  private bookTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Prologue');
  }

  create(): void {
    registerHd(this);
    this.part = 'yard';
    this.free = false;
    this.sawBoard = false;
    this.leaving = false;
    this.items = [];
    const tex = (key: string, make: () => HTMLCanvasElement) => !this.textures.exists(key) && this.textures.addCanvas(key, make());
    tex(bgKey('pro-yard'), yardBg);
    tex(bgKey('lib-room'), libraryBg);
    tex('lib-stand', libStand);
    tex('lib-glow', () => softGlow());
    tex('lib-spark', sparkle);
    tex('pro-fumi', () => fumiSprite(false));
    tex('pro-fumi-raise', () => fumiSprite(true));
    tex('pro-mouth-0', () => mojikuiMouth(false));
    tex('pro-mouth-1', () => mojikuiMouth(true));
    tex('pro-scroll', floorScroll);
    [M.rf1, M.red2, M.cu2, M.gold2].forEach((c, i) => tex(`pro-book-${i}`, () => flyingBook(c)));
    for (let i = 0; i < 4; i++) tex(`pro-rubble-${i}`, () => rubble(i));

    this.add.image(0, 0, bgKey('pro-yard')).setOrigin(0).setName('bg');
    this.shadow = this.add.ellipse(96, 320, 18, 6, 0x000000, 0.3);
    this.player = this.add.sprite(96, 320, HD.player, 0).setOrigin(0.5, 1);
    this.player.play('p-idle');
    this.syncPlayer();

    this.cameras.main.fadeIn(800, 255, 255, 255);
    this.ui = new UILayer(this);
    this.dlg = new Dialogue(this.ui);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dlg.close());
    this.ui.el('div', 'hud-title story-title', '🏚️ 프롤로그 · 하얀 아침');
    this.hint = this.ui.el('div', 'hint', '');
    this.hint.style.opacity = '0';
    this.keys = createMoveKeys(this);
    this.input.keyboard!.on('keydown-SPACE', () => this.free && this.part === 'library' && this.tryPickup(true));

    if (profile.seen.includes('prologue')) this.ui.button('건너뛰기<small>이미 본 이야기</small>', () => this.titleCard(), 'small story-skip');
    this.time.delayedCall(900, () => void this.opening());
  }

  private say(text: string): void {
    this.hint.innerHTML = text;
    this.hint.style.opacity = '1';
  }

  // ── ① 경내 ───────────────────────────────────────────

  /** 코토하가 화면 아래쪽이면 대화창을 위로 */
  private dlgSide(): void {
    this.dlg.top = this.player.y > 236;
  }

  private async opening(): Promise<void> {
    this.dlgSide();
    await this.dlg.play([
      { who: 'kotoha', face: 'happy', text: '으음… 잘 잤다! 오늘은 스승님이 부적 쓰는 법을 가르쳐 주신다고 했지.' },
      { who: 'kotoha', face: 'normal', text: '스승님은 아침마다 서고에 계시니까… 오른쪽 곳간으로 가 보자!' },
    ]);
    this.free = true;
    this.say('<b>WASD</b>로 걸어 오른쪽 <b>서고</b>(곳간)로');
  }

  private async readBoard(): Promise<void> {
    this.sawBoard = true;
    this.free = false;
    this.hint.style.opacity = '0';
    this.dlgSide();
    await this.dlg.play([
      { who: 'kotoha', face: 'surprised', text: '어…? 고찰에 붙은 종이가… 다 하얘?' },
      { who: 'kotoha', face: 'surprised', text: '배전 현판도 텅 비었어. 어제까지 분명히 글자가 있었는데!' },
    ]);
    this.cameras.main.shake(500, 0.006);
    await this.wait(500);
    await this.dlg.play([{ who: 'kotoha', face: 'surprised', text: '방금 그 소리… 서고 쪽이야! 스승님!' }]);
    this.free = true;
    this.say('서둘러 <b>서고</b>로!');
  }

  // ── ② 서고: 모지쿠이 · 후미의 봉인 ─────────────────────

  private async library(): Promise<void> {
    this.free = false;
    this.leaving = true;
    this.hint.style.opacity = '0';
    const cam = this.cameras.main;
    cam.fadeOut(350, 12, 10, 18);
    await this.wait(400);
    this.part = 'library';
    this.leaving = false;
    this.children.getByName('bg')?.destroy();
    this.add.image(0, 0, bgKey('lib-room')).setOrigin(0).setDepth(-10);
    for (const x of [152, 236, 404, 488]) this.add.image(x, 238, 'lib-stand').setOrigin(0.5, 1).setDepth(238);
    this.bounds = { minX: 42, maxX: 598, minY: LIB.floorY + 12, maxY: 346 };

    // 벽을 찢고 나온 하얀 입
    const mouth = this.add.image(320, 82, 'pro-mouth-0').setDepth(5).setAlpha(0).setScale(0.6);
    const fumi = this.add.image(320, 246, 'pro-fumi').setOrigin(0.5, 1).setDepth(246);
    const door = LIB.door;
    this.player.setPosition(door.x + door.w / 2, door.y + door.h + 4).setFlipX(true);
    this.facing = -1;
    this.syncPlayer();
    cam.fadeIn(350, 12, 10, 18);
    this.tweens.add({ targets: mouth, alpha: 1, scale: 1, duration: 600, ease: 'Back.easeOut' });
    cam.shake(600, 0.008);
    // 서가의 책이 입으로 빨려 든다
    this.bookTimer = this.time.addEvent({
      delay: 160,
      loop: true,
      callback: () => {
        const b = this.add.image(50 + Math.random() * 74, 50 + Math.random() * 90, `pro-book-${Math.floor(Math.random() * 4)}`).setDepth(6);
        this.tweens.add({ targets: b, x: 320, y: 82, scale: 0.3, angle: 360, duration: 700, ease: 'Cubic.easeIn', onComplete: () => b.destroy() });
      },
    });
    const chomp = this.time.addEvent({ delay: 420, loop: true, callback: () => mouth.setTexture(mouth.texture.key === 'pro-mouth-0' ? 'pro-mouth-1' : 'pro-mouth-0') });

    // 코토하가 뛰어 들어온다
    this.player.play('p-walk');
    await this.tween({ targets: [this.player, this.shadow], x: 420, y: 262, duration: 700 });
    this.player.play('p-idle');
    this.syncPlayer();
    this.dlg.top = false;

    await this.dlg.play([
      { who: 'fumi', face: 'normal', text: '코토하, 뒤로 물러나라.' },
      { who: 'kotoha', face: 'surprised', text: '스승님! 저것도 요괴예요? 서고의 글자를… 먹고 있어요!' },
      { who: 'fumi', face: 'sad', text: '……말을 먹는 놈이다. 이 서고가 무너지면, 이 세상 누구도 다시 읽지 못한다.' },
    ]);
    chomp.remove();
    mouth.setTexture('pro-mouth-1');
    this.tweens.add({ targets: mouth, scale: 1.25, duration: 500, ease: 'Sine.easeInOut' });
    cam.shake(700, 0.01);
    await this.wait(600);
    fumi.setTexture('pro-fumi-raise');
    const glow = this.add.image(320, 214, 'lib-glow').setDepth(247).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.9, scale: 2.2, duration: 900 });
    await this.dlg.play([
      { who: 'fumi', face: 'normal', text: '코토하. 잘 들어라.' },
      { who: 'fumi', face: 'normal', text: '첫 소리부터 되찾아라. {あ}, {い}, {う}, {え}, {お}.', say: 'あ、い、う、え、お' },
      { who: 'kotoha', face: 'surprised', text: '스승님!' },
    ]);

    // 빛 — 후미가 두루마리 속으로, 입은 물러가고 서고가 무너진다
    this.bookTimer.remove();
    cam.flash(900, 255, 255, 255);
    cam.shake(900, 0.014);
    this.tweens.add({ targets: fumi, scaleX: 0.1, scaleY: 0.1, alpha: 0, y: 236, duration: 700, ease: 'Cubic.easeIn' });
    this.tweens.add({ targets: mouth, scale: 0.2, alpha: 0, duration: 900, ease: 'Cubic.easeIn' });
    this.tweens.add({ targets: glow, alpha: 0, duration: 1400 });
    for (let i = 0; i < 16; i++) this.spark(320, 220);
    await this.wait(1100);
    // 무너진 서고: 바닥·벽만 어둡게, 벽엔 찢긴 흔적
    this.add.rectangle(0, 0, 640, 360, 0x0c0a12, 0.45).setOrigin(0).setDepth(-5);
    this.add.image(320, 82, 'pro-mouth-0').setDepth(-4).setScale(0.75).setAlpha(0.28).setTint(0x8a86a0);
    this.children.list.forEach((o) => o instanceof Phaser.GameObjects.Image && o.texture.key === 'lib-stand' && o.setTint(0x8a86a0));
    const spots: [number, number][] = [[90, 210], [180, 300], [470, 220], [560, 300], [250, 196], [400, 330]];
    spots.forEach(([x, y], i) => this.add.image(x, y, `pro-rubble-${i % 4}`).setOrigin(0.5, 1).setDepth(y).setTint(0xa09cb4));
    // 남은 두루마리와 부적 (빛난다)
    this.addItem(306, 254, 'pro-scroll', '두루마리', '두루마리를 주웠다 — 다섯 글자가 희미하게 남아 있다');
    this.addItem(340, 266, HD.ofuda, '부적', '부적 한 장을 주웠다 — 스승님이 쓰던 부적');
    await this.wait(500);
    await this.dlg.play([{ who: 'kotoha', face: 'sad', text: '스승님…? 스승님!! …바닥에, 두루마리랑 부적이…' }]);
    this.free = true;
    this.say('<b>WASD</b>로 걸어 빛나는 <b>두루마리</b>와 <b>부적</b>을 줍자');
  }

  private addItem(x: number, y: number, key: string, name: string, text: string): void {
    const glow = this.add.image(x, y - 4, 'lib-glow').setScale(0.5).setAlpha(0.7).setDepth(450).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, scale: 0.65, alpha: 0.45, duration: 700, yoyo: true, repeat: -1 });
    const img = this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(451);
    this.items.push({ img, glow, name, text });
  }

  /** 가까이 가면(또는 Space) 줍는다 */
  private tryPickup(byKey = false): void {
    const p = this.player;
    for (const it of [...this.items]) {
      const d = Phaser.Math.Distance.Between(p.x, p.y, it.img.x, it.img.y);
      if (d > (byKey ? 34 : 18)) continue;
      this.items = this.items.filter((x) => x !== it);
      this.spark(it.img.x, it.img.y - 6);
      it.glow.destroy();
      this.tweens.add({ targets: it.img, y: it.img.y - 20, alpha: 0, duration: 400, onComplete: () => it.img.destroy() });
      const toast = this.ui.el('div', 'pickup', it.text);
      this.ui.place(toast, Phaser.Math.Clamp(it.img.x, 140, 500), it.img.y - 30);
      this.time.delayedCall(1800, () => toast.remove());
      if (this.items.length === 0) void this.ending();
    }
  }

  private async ending(): Promise<void> {
    this.free = false;
    this.hint.style.opacity = '0';
    this.dlg.top = false;
    await this.wait(900);
    await this.dlg.play([
      { who: 'kotoha', face: 'sad', text: '스승님… 이 안에 계신 거죠?' },
      { who: 'fumi', face: 'normal', text: '……첫 소리부터다, 코토하.' },
      { who: 'kotoha', face: 'normal', text: '…네. 사라진 글자, 전부 되찾을게요. 그리고 스승님도!' },
    ]);
    this.titleCard();
  }

  /** 1장 제목 카드 → 지도 */
  private titleCard(): void {
    if (this.ui.root.querySelector('.title-card')) return;
    this.leaving = true;
    this.free = false;
    this.dlg.close();
    this.ui.root.querySelector('.story-skip')?.remove();
    markSeen('prologue');
    const card = this.ui.el('div', 'title-card');
    card.innerHTML = '<b>1장 · 산기슭 신사 마을</b><span class="jp">あ か さ</span><small>사라진 글자를 되찾는 여정이 시작된다</small>';
    this.time.delayedCall(2800, () => this.scene.start('ChapterMap'));
  }

  // ── 공통 ─────────────────────────────────────────────

  update(_t: number, delta: number): void {
    const p = this.player;
    const dir = this.free && !this.dlg.open ? readMove(this.keys) : { x: 0, y: 0 };
    const moving = dir.x !== 0 || dir.y !== 0;
    if (!this.leaving && (this.free || !this.tweens.isTweening(p))) p.play(moving ? 'p-walk' : 'p-idle', true);
    if (!moving) return;
    const step = (WALK * Math.min(delta, 50)) / 1000;
    const b = this.bounds;
    // 경내: 서고 문 앞은 조금 더 올라갈 수 있다
    const atDoor = this.part === 'yard' && Math.abs(p.x - YARD.kuraDoor.x) < 18;
    p.x = Phaser.Math.Clamp(p.x + dir.x * step, b.minX, b.maxX);
    p.y = Phaser.Math.Clamp(p.y + dir.y * step, atDoor ? YARD.kuraDoor.y : b.minY, b.maxY);
    if (dir.x !== 0) this.facing = Math.sign(dir.x);
    p.setFlipX(this.facing < 0);
    this.syncPlayer();

    if (this.part === 'yard') {
      if (!this.sawBoard && Phaser.Math.Distance.Between(p.x, p.y, YARD.board.x, YARD.board.y + 20) < 56) void this.readBoard();
      else if (atDoor && p.y <= YARD.kuraDoor.y + 6) {
        if (!this.sawBoard) void this.readBoard();
        else void this.library();
      }
    } else {
      this.tryPickup();
    }
  }

  private syncPlayer(): void {
    this.player.setDepth(this.player.y);
    this.shadow.setPosition(this.player.x, this.player.y).setDepth(this.player.y - 0.5);
  }

  private spark(x: number, y: number): void {
    const a = Math.random() * Math.PI * 2;
    const d = 30 + Math.random() * 40;
    const s = this.add.image(x, y, 'lib-spark').setDepth(500);
    this.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 700, onComplete: () => s.destroy() });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((r) => this.tweens.add({ ...cfg, onComplete: () => r() }));
  }
}
