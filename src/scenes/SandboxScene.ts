import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { LevelUpPanel } from '../ui/LevelUpPanel';
import { HD, registerHd } from '../art/hd/register';
import { sandboxGround, SANDBOX_W, SANDBOX_H } from '../art/hd/world';
import { createMoveKeys, readMove, MoveKeys } from '../systems/movement';
import { HitFx } from '../fx/HitFx';
import { settings } from '../systems/settings';
import { Arsenal, ArmsTarget } from '../combat/Arsenal';
import type { ArmsId } from '../data/arsenal';
import { healChoice, ChoiceDef } from '../data/choices';
import { makeQuiz } from '../systems/quiz';
import { tts } from '../systems/tts';

/** 리마스터 규격: 카메라 확대 없이 32px 캐릭터 (도트 밀도 2배) */
const PLAYER_SPEED = 120;
/** 전투 샘플에선 여우불·방울을 스토리로 해금한 상태로 본다 */
const SAMPLE_UNLOCKED: ArmsId[] = ['ofuda', 'tsurugi', 'suzu', 'kitsunebi', 'hamayumi', 'naginata', 'nusa', 'uchiwa'];
const xpNeed = (level: number) => 3 + level * 2;

interface Obstacle {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface Foe extends ArmsTarget {
  kind: 'hitodama' | 'dummy';
  hp: number;
  vx: number;
  vy: number;
}

/**
 * 🧪 전투 샘플 — 본편 전투 리마스터 미리보기.
 * 32px 도트 · 넓은 아레나 + 장애물 · 시전 모션 · 데미지 숫자 · 넉백 먼지 · 타격 정지
 * · 다중 무기 (부적으로 시작 → 레벨업 선택지로 여우불·방울 획득, Lv1~5)
 */
export class SandboxScene extends Phaser.Scene {
  private keys!: MoveKeys;
  private fx!: HitFx;
  private ui!: UILayer;
  private levelPanel!: LevelUpPanel;
  private arsenal!: Arsenal;
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private obstacles: Obstacle[] = [];
  private foes: Foe[] = [];
  private spawnAcc = 0;
  private casting = false;
  private invulnUntil = 0;
  private facing = 1;
  private paused = false;
  private level = 1;
  private xp = 0;
  private pendingLevels = 0;
  private ttsOk = false;
  private hud!: { xp: HTMLElement; lv: HTMLElement; slots: HTMLElement };

  constructor() {
    super('Sandbox');
  }

  create(): void {
    registerHd(this);
    this.fx = new HitFx(this);
    this.obstacles = [];
    this.foes = [];
    this.spawnAcc = 0;
    this.casting = false;
    this.paused = false;
    this.level = 1;
    this.xp = 0;
    this.pendingLevels = 0;

    if (!this.textures.exists('sandbox-ground')) this.textures.addCanvas('sandbox-ground', sandboxGround());
    this.add.image(0, 0, 'sandbox-ground').setOrigin(0);
    this.placeObstacles();

    this.shadow = this.add.ellipse(SANDBOX_W / 2, SANDBOX_H / 2 + 120, 18, 6, 0x000000, 0.3);
    this.player = this.add.sprite(SANDBOX_W / 2, SANDBOX_H / 2 + 120, HD.player, 0).setOrigin(0.5, 1);
    this.player.play('p-idle');
    this.player.on(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + 'p-cast', () => (this.casting = false));

    this.arsenal = new Arsenal(
      this,
      this.player,
      () => this.foes,
      (t, dmg, nx, ny, crit) => this.hit(t as Foe, dmg, nx, ny, crit),
      () => {},
      [{ id: 'ofuda', level: 1 }],
      undefined,
      { blocked: (x, y) => this.blocked(x, y), inputBlocked: () => this.paused },
    );

    // 과녁 허수아비
    for (const [x, y] of [[860, 520], [1060, 520], [960, 420], [800, 660], [1120, 660]]) {
      const img = this.add.image(x, y, HD.makiwara).setOrigin(0.5, 1);
      this.foes.push({ sprite: img, kind: 'dummy', hp: Infinity, vx: 0, vy: 0, radius: 8, bodyY: 12 });
    }

    const cam = this.cameras.main;
    cam.setZoom(1);
    cam.setBounds(0, 0, SANDBOX_W, SANDBOX_H);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.fadeIn(300, 12, 10, 18);

    this.keys = createMoveKeys(this);
    void tts.isAvailable().then((ok) => (this.ttsOk = ok));

    this.ui = new UILayer(this);
    this.levelPanel = new LevelUpPanel(this.ui);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.levelPanel.close());
    this.ui.el('div', 'sb-title', '🧪 전투 샘플 <small>본편 리마스터 미리보기</small>');
    const legend = this.ui.el(
      'div',
      'sb-legend',
      '<b>WASD</b> 이동 · 무기는 자동<br>혼불을 잡아 레벨업 → 퀴즈 → <b>무기 강화 / 새 무기</b><br>흰 숫자 = 일반 · <span class="gold">금색 = 강타</span> (멈칫!)<br><small>샘플에선 여우불·방울이 해금된 상태</small>',
    );
    // 안내는 8초 뒤 흐려진다 (마우스를 올리면 다시 보임)
    this.time.delayedCall(8000, () => legend.classList.add('faded'));
    const back = this.ui.button('챕터 선택으로', () => this.scene.start('Title'), '', this.ui.root);
    back.classList.add('sb-back');
    const xpBar = this.ui.el('div', 'bar xp raid-xp');
    this.hud = { xp: this.ui.el('i', '', '', xpBar), lv: this.ui.el('div', 'raid-lv sb-lv'), slots: this.ui.el('div', 'arms-hands') };
    this.updateHud();
  }

  /** 석등 · 바위 · 소나무를 흩어 놓는다 (발밑 충돌) */
  private placeObstacles(): void {
    const put = (key: string, x: number, y: number, rx: number, ry: number) => {
      this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
      this.obstacles.push({ cx: x, cy: y - ry, rx, ry });
    };
    let seed = 9;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const x = 80 + rnd() * (SANDBOX_W - 160);
      const y = 120 + rnd() * (SANDBOX_H - 200);
      if (Math.abs(x - SANDBOX_W / 2) < 260 && Math.abs(y - SANDBOX_H / 2) < 200) continue;
      const r = rnd();
      if (r < 0.35) put(HD.pine, x, y, 7, 4);
      else if (r < 0.65) put(HD.rock, x, y, 13, 6);
      else put(HD.lantern, x, y, 9, 4);
    }
    for (const y of [300, 560, 820]) {
      put(HD.lantern, 900, y, 9, 4);
      put(HD.lantern, 1020, y, 9, 4);
    }
  }

  private blocked(x: number, y: number, pad = 5): boolean {
    if (x < 12 || y < 24 || x > SANDBOX_W - 12 || y > SANDBOX_H - 6) return true;
    return this.obstacles.some((o) => {
      const dx = (x - o.cx) / (o.rx + pad);
      const dy = (y - o.cy) / (o.ry + pad * 0.6);
      return dx * dx + dy * dy < 1;
    });
  }

  // ── HUD ──────────────────────────────────────────────

  private updateHud(): void {
    this.hud.xp.style.width = `${(this.xp / xpNeed(this.level)) * 100}%`;
    this.hud.lv.textContent = `Lv ${this.level}`;
    this.hud.slots.innerHTML = this.arsenal.hudHtml();
  }

  // ── 매 프레임 ─────────────────────────────────────────

  update(time: number, rawDelta: number): void {
    if (this.paused) return;
    const dt = Math.min(rawDelta, 50);
    if (this.fx.stopped) return; // 타격 정지

    this.movePlayer(time, dt);
    this.arsenal.update(dt, true);
    this.updateHud();
    this.spawn(dt);
    this.updateFoes(time, dt);
    if (this.pendingLevels > 0) this.levelUp();
  }

  private movePlayer(time: number, dt: number): void {
    const dir = readMove(this.keys);
    const p = this.player;
    if (this.arsenal.dashing) {
      // 대시 · 도약 중엔 무기가 몸을 움직인다
      p.setDepth(p.y);
      this.shadow.setPosition(p.x, p.y).setDepth(p.y - 0.5);
      return;
    }
    const moving = dir.x !== 0 || dir.y !== 0;
    if (moving) {
      const step = (PLAYER_SPEED * dt) / 1000;
      if (!this.blocked(p.x + dir.x * step, p.y)) p.x += dir.x * step;
      if (!this.blocked(p.x, p.y + dir.y * step)) p.y += dir.y * step;
    }
    if (!this.casting && time >= this.invulnUntil) p.play(moving ? 'p-walk' : 'p-idle', true);
    this.facing = this.arsenal.facing;
    p.setFlipX(this.facing < 0);
    p.setAlpha(time < this.invulnUntil && Math.floor(time / 70) % 2 === 0 ? 0.4 : 1);
    p.setDepth(p.y);
    this.shadow.setPosition(p.x, p.y).setDepth(p.y - 0.5);
  }

  /** 맞았다: 숫자 · 번쩍 · 찌그러짐 · 넉백 + 먼지 · (강타면) 멈칫 */
  private hit(f: Foe, dmg: number, nx: number, ny: number, crit: boolean): void {
    if (f.hp <= 0) return;
    this.fx.number(f.sprite.x, f.sprite.y - (f.kind === 'dummy' ? 30 : 22), dmg, crit ? 'crit' : 'normal');
    this.fx.flash(f.sprite, crit);
    this.fx.spark(f.sprite.x - nx * 6, f.sprite.y - f.bodyY - ny * 6, crit ? 'G' : 'L');
    if (crit) {
      this.fx.hitStop(55);
      this.cameras.main.shake(70, 0.003);
    }

    if (f.kind === 'dummy') {
      this.tweens.add({ targets: f.sprite, angle: nx * (crit ? 16 : 9), duration: 70, yoyo: true, ease: 'Sine.easeOut' });
      this.fx.dust(f.sprite.x, f.sprite.y, nx, ny, crit ? 6 : 3);
      return;
    }

    const knock = crit ? 260 : 170;
    f.vx += nx * knock;
    f.vy += ny * knock;
    this.fx.dust(f.sprite.x, f.sprite.y, nx, ny, crit ? 7 : 4, 'P');
    f.hp -= dmg;
    if (f.hp <= 0) {
      this.fx.burst(f.sprite.x, f.sprite.y - 10, ['P', 'L', 'W'], 12);
      this.fx.hitStop(35);
      f.sprite.destroy();
      this.foes = this.foes.filter((x) => x !== f);
      this.gainXp(1);
    }
  }

  // ── 레벨업: 퀴즈 → 무기 강화 / 새 무기 ─────────────────

  private gainXp(n: number): void {
    this.xp += n;
    while (this.xp >= xpNeed(this.level)) {
      this.xp -= xpNeed(this.level);
      this.level++;
      this.pendingLevels++;
    }
    this.updateHud();
  }

  private levelUp(): void {
    this.pendingLevels--;
    this.paused = true;
    this.tweens.pauseAll();
    this.time.paused = true;
    this.ui.root.classList.add('dimmed');

    // 무기 선택지 3개 (모자라면 회복으로 채움)
    const offers: ChoiceDef[] = Phaser.Utils.Array.Shuffle(this.arsenal.offers(SAMPLE_UNLOCKED)).slice(0, 3);
    while (offers.length < 3) offers.push(healChoice(() => undefined));

    void this.levelPanel.open(makeQuiz(this.ttsOk), this.level, offers).then(({ upgrade }) => {
      upgrade.apply();
      this.ui.root.classList.remove('dimmed');
      this.tweens.resumeAll();
      this.time.paused = false;
      this.paused = false;
      this.updateHud();
    });
  }

  // ── 혼불 ─────────────────────────────────────────────

  private spawn(dt: number): void {
    this.spawnAcc += dt;
    if (this.spawnAcc < 900) return;
    this.spawnAcc = 0;
    if (this.foes.filter((f) => f.kind === 'hitodama').length >= 18) return;
    const a = Math.random() * Math.PI * 2;
    const x = Phaser.Math.Clamp(this.player.x + Math.cos(a) * 340, 20, SANDBOX_W - 20);
    const y = Phaser.Math.Clamp(this.player.y + Math.sin(a) * 220, 40, SANDBOX_H - 20);
    if (this.blocked(x, y)) return;
    const s = this.add.sprite(x, y, HD.hitodama, 0).setOrigin(0.5, 0.85).setAlpha(0);
    s.play('hitodama-float');
    this.tweens.add({ targets: s, alpha: 1, duration: 300 });
    this.foes.push({ sprite: s, kind: 'hitodama', hp: 30, vx: 0, vy: 0, radius: 8, bodyY: 8 });
  }

  private updateFoes(time: number, dt: number): void {
    const p = this.player;
    const sec = dt / 1000;
    for (const f of this.foes) {
      if (f.kind === 'dummy') {
        f.sprite.setDepth(f.sprite.y);
        continue;
      }
      const dx = p.x - f.sprite.x;
      const dy = p.y - 6 - f.sprite.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = f.sprite.x + ((dx / d) * 46 + f.vx) * sec;
      const ny = f.sprite.y + ((dy / d) * 46 + f.vy) * sec;
      if (!this.blocked(nx, f.sprite.y, 2)) f.sprite.x = nx;
      else f.vx *= -0.3;
      if (!this.blocked(f.sprite.x, ny, 2)) f.sprite.y = ny;
      else f.vy *= -0.3;
      f.vx *= 0.86;
      f.vy *= 0.86;
      f.sprite.setFlipX(dx < 0);
      f.sprite.setDepth(f.sprite.y + 2);

      if (d < 14 && time > this.invulnUntil && !settings.god) {
        this.invulnUntil = time + 800;
        p.play('p-hurt', true);
        this.fx.flash(p);
        this.fx.number(p.x, p.y - 34, 8, 'boss');
        this.cameras.main.shake(100, 0.004);
        f.vx -= (dx / d) * 220;
        f.vy -= (dy / d) * 220;
      }
    }
  }
}
