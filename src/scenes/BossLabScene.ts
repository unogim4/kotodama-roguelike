import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { HD, registerHd } from '../art/hd/register';
import { labGround, LAB_W, LAB_H } from '../art/hd/bossHd';
import { createMoveKeys, readMove, MoveKeys } from '../systems/movement';
import { HitFx } from '../fx/HitFx';
import { settings } from '../systems/settings';
import { Arsenal, ArmsTarget } from '../combat/Arsenal';
import { BossPatterns, PATTERNS, PatternId } from '../combat/BossPatterns';

const PLAYER_SPEED = 120;
const PLAYER_MAX_HP = 120;
const BOSS_MAX_HP = 6000;

interface TempObstacle {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  until: number;
}

/**
 * 🧪 보스 시험장 — 리마스터 야마비코(80px)의 피지컬 패턴 미리보기.
 * 자동으로 패턴을 차례로 보여주고, 숫자키 1~9로 원하는 패턴을 바로 볼 수 있다.
 */
export class BossLabScene extends Phaser.Scene {
  private keys!: MoveKeys;
  private fx!: HitFx;
  private ui!: UILayer;
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private boss!: Phaser.GameObjects.Sprite;
  private bossShadow!: Phaser.GameObjects.Ellipse;
  private bossTarget!: ArmsTarget;
  private arsenal!: Arsenal;
  private patterns!: BossPatterns;
  private obstacles: TempObstacle[] = [];
  private hp = PLAYER_MAX_HP;
  private bossHp = BOSS_MAX_HP;
  private invulnUntil = 0;
  private casting = false;
  private facing = 1;
  private auto = true;
  private nextIndex = 0;
  private queued: PatternId | null = null;
  private idleMs = 1500;
  private hud!: { hp: HTMLElement; hpText: HTMLElement; boss: HTMLElement; list: HTMLElement[]; mode: HTMLElement };

  constructor() {
    super('BossLab');
  }

  create(): void {
    registerHd(this);
    this.fx = new HitFx(this);
    this.obstacles = [];
    this.hp = PLAYER_MAX_HP;
    this.bossHp = BOSS_MAX_HP;
    this.auto = true;
    this.nextIndex = 0;
    this.queued = null;
    this.idleMs = 1500;
    this.casting = false;

    if (!this.textures.exists('lab-ground')) this.textures.addCanvas('lab-ground', labGround());
    this.add.image(0, 0, 'lab-ground').setOrigin(0);

    this.bossShadow = this.add.ellipse(LAB_W / 2, 260, 64, 18, 0x000000, 0.35);
    this.boss = this.add.sprite(LAB_W / 2, 260, HD.yamabiko, 0).setOrigin(0.5, 1);
    const core = this.add.image(LAB_W / 2, 220, HD.dust('w')).setVisible(false);
    this.bossTarget = { sprite: core, radius: 26, bodyY: 0 };

    this.shadow = this.add.ellipse(LAB_W / 2, 470, 18, 6, 0x000000, 0.3);
    this.player = this.add.sprite(LAB_W / 2, 470, HD.player, 0).setOrigin(0.5, 1);
    this.player.play('p-idle');
    this.player.on(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + 'p-cast', () => (this.casting = false));

    this.arsenal = new Arsenal(
      this,
      this.player,
      () => [this.bossTarget],
      (_t, dmg, _nx, _ny, crit) => this.hitBoss(dmg, crit),
      () => {},
    );
    // 시험장: 세 무기를 적당히 키운 상태
    // 시험장: 부적 Lv3 + 나기나타 Lv2 (Tab으로 바꿔 들기 · 우클릭 돌진)
    for (const id of ['ofuda', 'ofuda', 'naginata', 'naginata'] as const) this.arsenal.levelUp(id);

    this.patterns = new BossPatterns({
      scene: this,
      fx: this.fx,
      boss: this.boss,
      shadow: this.bossShadow,
      player: this.player,
      bounds: { x: 0, y: 0, w: LAB_W, h: LAB_H },
      hurt: (dmg, fx, fy) => this.hurtPlayer(dmg, fx, fy),
      addObstacle: (x, y, rx, ry, ms) => this.obstacles.push({ cx: x, cy: y, rx, ry, until: this.time.now + ms }),
    });

    const cam = this.cameras.main;
    cam.setZoom(1);
    cam.setBounds(0, 0, LAB_W, LAB_H);
    cam.startFollow(this.player, true, 0.1, 0.1);
    cam.fadeIn(300, 12, 10, 18);

    this.keys = createMoveKeys(this);
    const kb = this.input.keyboard!;
    PATTERNS.forEach((p, i) => kb.on(`keydown-${['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'][i]}`, () => (this.queued = p.id)));
    kb.on('keydown-P', () => {
      this.auto = !this.auto;
      this.hud.mode.textContent = this.auto ? '자동 진행 중 (P로 멈춤)' : '멈춤 — 숫자키로 패턴 실행 (P로 자동)';
    });

    this.createHud();
  }

  private createHud(): void {
    this.ui = new UILayer(this);
    const left = this.ui.el('div', 'raid-hud-left');
    this.ui.el('div', 'raid-room', '🧪 보스 시험장', left);
    const bar = this.ui.el('div', 'bar hp', '', left);
    const hp = this.ui.el('i', '', '', bar);
    const hpText = this.ui.el('span', '', '', bar);

    const bossHud = this.ui.el('div', 'boss-hud');
    this.ui.el('div', 'boss-name', '야마비코 <span class="jp">山彦</span> <small>리마스터 80px</small>', bossHud);
    const bb = this.ui.el('div', 'bar boss', '', bossHud);
    const boss = this.ui.el('i', '', '', bb);

    const panel = this.ui.el('div', 'lab-list');
    this.ui.el('b', '', '패턴 (숫자키)', panel);
    const list = PATTERNS.map((p, i) => this.ui.el('div', `lab-item ${p.kind === '고유' ? 'unique' : ''}`, `<i>${i + 1}</i>${p.name}<small>${p.kind}</small>`, panel));
    const mode = this.ui.el('div', 'lab-mode', '자동 진행 중 (P로 멈춤)', panel);
    const back = this.ui.button('챕터 선택으로', () => this.scene.start('Title'), '', this.ui.root);
    back.classList.add('lab-back');
    this.hud = { hp, hpText, boss, list, mode };
    this.updateHud();
  }

  private updateHud(): void {
    this.hud.hp.style.width = `${(this.hp / PLAYER_MAX_HP) * 100}%`;
    this.hud.hpText.textContent = `${Math.ceil(this.hp)} / ${PLAYER_MAX_HP}`;
    this.hud.boss.style.width = `${(this.bossHp / BOSS_MAX_HP) * 100}%`;
  }

  private highlight(id: PatternId | null): void {
    this.hud.list.forEach((el, i) => el.classList.toggle('on', PATTERNS[i].id === id));
  }

  // ── 매 프레임 ─────────────────────────────────────────

  update(time: number, rawDelta: number): void {
    const dt = Math.min(rawDelta, 50);
    if (this.fx.stopped) return;
    this.obstacles = this.obstacles.filter((o) => o.until > time);

    this.movePlayer(time, dt);
    this.arsenal.update(dt, true);
    this.patterns.update(dt);
    this.bossBrain(dt);
    this.bossTarget.sprite.setPosition(this.boss.x, this.boss.y - 40);
    this.boss.setDepth(this.boss.y);
    this.bossShadow.setDepth(this.boss.y - 1);
    this.contact(time);
  }

  /** 패턴 사이엔 언령사 쪽으로 걸어오고, 차례가 되면 다음 패턴 */
  private bossBrain(dt: number): void {
    if (this.patterns.busy) return;
    const b = this.boss;
    this.highlight(null);
    if (this.queued) {
      const id = this.queued;
      this.queued = null;
      this.startPattern(id);
      return;
    }
    if (!this.auto) return;
    const dx = this.player.x - b.x;
    const dy = this.player.y - 60 - b.y;
    const d = Math.hypot(dx, dy);
    if (d > 90) {
      b.x += (dx / d) * 40 * (dt / 1000);
      b.y += (dy / d) * 40 * (dt / 1000);
      this.bossShadow.setPosition(b.x, b.y);
    }
    b.setFlipX(dx < 0);
    this.idleMs -= dt;
    if (this.idleMs <= 0) {
      this.startPattern(PATTERNS[this.nextIndex % PATTERNS.length].id);
      this.nextIndex++;
    }
  }

  private startPattern(id: PatternId): void {
    this.highlight(id);
    const name = PATTERNS.find((p) => p.id === id)!.name;
    const tag = this.add
      .text(this.boss.x, this.boss.y - 92, name, { fontFamily: 'Galmuri11', fontSize: '12px', color: '#e6c9ff', stroke: '#1b1626', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(5000);
    this.tweens.add({ targets: tag, y: tag.y - 10, alpha: 0, delay: 700, duration: 400, onComplete: () => tag.destroy() });
    void this.patterns.run(id).then(() => (this.idleMs = 1300));
  }

  private hitBoss(dmg: number, crit: boolean): void {
    this.bossHp = Math.max(0, this.bossHp - dmg);
    if (this.bossHp <= 0) this.bossHp = BOSS_MAX_HP; // 시험장: 다시 가득
    this.fx.number(this.boss.x + Phaser.Math.Between(-14, 14), this.boss.y - 70, dmg, crit ? 'crit' : 'boss');
    this.boss.setTintFill(0xffffff);
    this.time.delayedCall(45, () => this.boss.clearTint());
    if (crit) this.fx.hitStop(40);
    this.updateHud();
  }

  private hurtPlayer(dmg: number, fromX: number, fromY: number): void {
    const now = this.time.now;
    if (now < this.invulnUntil || this.arsenal.invuln) return;
    this.invulnUntil = now + 900;
    const p = this.player;
    // 피격: 숫자 · 모션 · 밀려남 (무적 모드여도 연출은 보여준다)
    this.fx.number(p.x, p.y - 36, dmg, 'hurt');
    p.play('p-hurt', true);
    this.fx.flash(p);
    this.cameras.main.shake(120, 0.006);
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    let tx = p.x + (dx / d) * 26;
    let ty = p.y + (dy / d) * 18;
    tx = Phaser.Math.Clamp(tx, 16, LAB_W - 16);
    ty = Phaser.Math.Clamp(ty, 40, LAB_H - 8);
    this.tweens.add({ targets: p, x: tx, y: ty, duration: 150, ease: 'Cubic.easeOut' });
    this.fx.dust(p.x, p.y, dx / d, dy / d, 5);
    if (!settings.god) this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = PLAYER_MAX_HP;
      this.fx.number(p.x, p.y - 50, PLAYER_MAX_HP, 'heal');
    }
    this.updateHud();
  }

  /** 보스 몸에 부딪히면 피해 + 밀려남 */
  private contact(time: number): void {
    if (time < this.invulnUntil) return;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y - 8, this.boss.x, this.boss.y - 26) < 30) {
      this.hurtPlayer(10, this.boss.x, this.boss.y - 10);
    }
  }

  private blocked(x: number, y: number): boolean {
    if (x < 16 || y < 40 || x > LAB_W - 16 || y > LAB_H - 8) return true;
    return this.obstacles.some((o) => {
      const dx = (x - o.cx) / (o.rx + 5);
      const dy = (y - o.cy) / (o.ry + 3);
      return dx * dx + dy * dy < 1;
    });
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
    if (!this.casting && time >= this.invulnUntil - 600) p.play(moving ? 'p-walk' : 'p-idle', true);
    this.facing = this.arsenal.facing;
    p.setFlipX(this.facing < 0);
    p.setAlpha(time < this.invulnUntil && Math.floor(time / 70) % 2 === 0 ? 0.4 : 1);
    p.setDepth(p.y);
    this.shadow.setPosition(p.x, p.y).setDepth(p.y - 0.5);
  }
}
