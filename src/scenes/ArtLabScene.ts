import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { registerHd } from '../art/hd/register';
import { sandboxGround, SANDBOX_W, SANDBOX_H } from '../art/hd/world';
import { strip } from '../art/fine/fine';
import { sheet as gridSheet } from '../art/hd/grid';
import { playerFrames, PLAYER_FRAMES } from '../art/hd/player';
import { hitodamaFrames, kasaFrames } from '../art/hd/world';
import { kotohaFrames, handCanvas, K2 } from '../art/fine/kotoha';
import { swordArt, ofudaArt, ofudaShotArt, naginataArt, hitodamaFrames2, kasaFrames2, GearArt } from '../art/fine/gear';
import { createMoveKeys, readMove, MoveKeys } from '../systems/movement';
import { HitFx } from '../fx/HitFx';

type GearId = 'sword' | 'ofuda' | 'naginata';

interface Gear {
  name: string;
  key: string;
  art: GearArt;
  /** 공격 간격 · 사거리 */
  cd: number;
  /** 대시가 있는 무기 */
  dash: boolean;
}

interface LabFoe {
  s: Phaser.GameObjects.Sprite;
  sh: Phaser.GameObjects.Ellipse;
  kind: 'hito' | 'kasa';
  hp: number;
  vx: number;
  vy: number;
  stun: number;
  t: number;
}

/** 놀이터는 비교 화면 아래에 따로 둔다 */
const ARENA_Y = 600;

/**
 * 🎨 아트 시험장 (#artlab) — 2세대 세밀 도트 샘플.
 * [비교] 옛 그림 ↔ 새 그림을 3배로 나란히 · [움직여 보기] WASD 이동 · 마우스 조준 · 1/2/3 무기 · Space 대시(나기나타)
 */
export class ArtLabScene extends Phaser.Scene {
  private ui!: UILayer;
  private fx!: HitFx;
  private keys!: MoveKeys;
  private mode: 'compare' | 'play' = 'compare';
  private compare: Phaser.GameObjects.GameObject[] = [];
  private gear: Record<GearId, Gear> = {} as Record<GearId, Gear>;
  private cur: GearId = 'sword';
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private hand!: Phaser.GameObjects.Image;
  private weapon!: Phaser.GameObjects.Image;
  private foes: LabFoe[] = [];
  private aim = 0;
  private facing = 1;
  /** 휘두르기 각도 오프셋 · 찌르기 거리 · 손 당김 */
  private swing = { a: -0.5, push: 0 };
  private atkCd = 0;
  private dashCd = 0;
  private dashing = 0;
  private dashDir = { x: 1, y: 0 };
  private blinkIn = 2500;
  private lastFrame = -1;
  private hud!: HTMLElement;

  constructor() {
    super('ArtLab');
  }

  create(): void {
    registerHd(this);
    this.fx = new HitFx(this);
    this.foes = [];
    this.mode = 'compare';
    this.registerFine();
    this.cameras.main.setBackgroundColor('#241e36');
    this.ui = new UILayer(this);
    this.buildCompare();
    this.buildArena();
    this.keys = createMoveKeys(this);
    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.equip('sword'));
    kb.on('keydown-TWO', () => this.equip('ofuda'));
    kb.on('keydown-THREE', () => this.equip('naginata'));
    kb.on('keydown-M', () => this.setMode(this.mode === 'compare' ? 'play' : 'compare'));
    kb.on('keydown-SPACE', () => this.tryDash());
    this.input.on('pointerdown', () => this.tryDash());
    this.setMode('compare');
  }

  private registerFine(): void {
    const sheet = (key: string, frames: HTMLCanvasElement[], fw: number, fh: number) => {
      if (this.textures.exists(key)) return;
      const tex = this.textures.addCanvas(key, strip(frames))!;
      frames.forEach((_, i) => tex.add(i, 0, i * fw, 0, fw, fh));
    };
    sheet('k2', kotohaFrames(), 32, 32);
    sheet('hito2', hitodamaFrames2(), 24, 24);
    sheet('kasa2', kasaFrames2(), 30, 32);
    const img = (key: string, c: HTMLCanvasElement) => !this.textures.exists(key) && this.textures.addCanvas(key, c);
    img('k2-hand', handCanvas());
    img('ofuda2-shot', ofudaShotArt());
    const gears: [GearId, string, () => GearArt, number, boolean][] = [
      ['sword', '⚔️ 신검', swordArt, 520, false],
      ['ofuda', '📜 부적', ofudaArt, 380, false],
      ['naginata', '🔱 나기나타', naginataArt, 700, true],
    ];
    for (const [id, name, make, cd, dash] of gears) {
      const art = make();
      img(`gear-${id}`, art.canvas);
      this.gear[id] = { name, key: `gear-${id}`, art, cd, dash };
    }
    const a = this.anims;
    const mk = (key: string, tex: string, frames: number[], rate: number, repeat = -1) =>
      !a.exists(key) && a.create({ key, frames: a.generateFrameNumbers(tex, { frames }), frameRate: rate, repeat });
    // 옛 그림 (비교용)
    const old = (key: string, c: HTMLCanvasElement, fw: number, fh: number) => {
      if (this.textures.exists(key)) return;
      const tex = this.textures.addCanvas(key, c)!;
      for (let i = 0; i * fw < c.width; i++) tex.add(i, 0, i * fw, 0, fw, fh);
    };
    old('old-player', gridSheet(playerFrames()), 32, 32);
    old('old-hito', gridSheet(hitodamaFrames()), 24, 24);
    old('old-kasa', gridSheet(kasaFrames()), 28, 32);
    mk('old-idle', 'old-player', [...PLAYER_FRAMES.idle], 2.5);
    mk('old-walk', 'old-player', [...PLAYER_FRAMES.walk], 9);
    mk('old-hito', 'old-hito', [0, 1], 4);
    mk('old-kasa', 'old-kasa', [0, 1], 3);
    mk('k2-idle', 'k2', [...K2.idle], 5);
    mk('k2-run', 'k2', [...K2.run], 14);
    mk('hito2-float', 'hito2', [0, 1, 2, 3, 4, 5], 10);
    mk('kasa2-hop', 'kasa2', [0, 1, 2, 3, 4, 5], 8);
  }

  // ── 비교 화면 ─────────────────────────────────────────

  private buildCompare(): void {
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.compare.push(o);
      return o;
    };
    const cell = (x: number, y: number, label: string, isNew: boolean) => {
      add(this.add.rectangle(x, y - 46, 104, 112, isNew ? 0x2f3a5c : 0x2e2840).setStrokeStyle(1, isNew ? 0x8fd8ff : 0x5a5070));
      add(this.add.ellipse(x, y + 1, 54, 14, 0x000000, 0.25));
      const el = this.ui.el('div', `artlab-label${isNew ? ' new' : ''}`, label);
      this.ui.place(el, x, y + 14);
      add({ destroy: () => el.remove(), setVisible: (v: boolean) => (el.style.display = v ? '' : 'none') } as never);
    };
    const S = 3;
    // 1줄: 코토하
    cell(64, 150, '옛 · 대기', false);
    add(this.add.sprite(64, 150, 'old-player', 0).setOrigin(0.5, 1).setScale(S).play('old-idle'));
    cell(176, 150, '새 · 대기 (숨쉬기 · 깜빡)', true);
    const idle = add(this.add.sprite(176, 150, 'k2', 0).setOrigin(0.5, 1).setScale(S).play('k2-idle'));
    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.blinkOnce(idle) });
    cell(288, 150, '옛 · 걷기', false);
    add(this.add.sprite(288, 150, 'old-player', 0).setOrigin(0.5, 1).setScale(S).play('old-walk'));
    cell(400, 150, '새 · 달리기 8프레임', true);
    add(this.add.sprite(400, 150, 'k2', 4).setOrigin(0.5, 1).setScale(S).play('k2-run'));
    cell(512, 150, '새 · 대시 / 피격', true);
    const dh = add(this.add.sprite(512, 150, 'k2', K2.dash).setOrigin(0.5, 1).setScale(S));
    this.time.addEvent({ delay: 900, loop: true, callback: () => dh.setFrame(dh.frame.name === String(K2.dash) ? K2.hurt : K2.dash) });
    // 2줄: 요괴 · 무기
    cell(64, 310, '옛 · 히토다마', false);
    add(this.add.sprite(64, 300, 'old-hito', 0).setOrigin(0.5, 1).setScale(S).play('old-hito'));
    cell(176, 310, '새 · 히토다마 6프레임', true);
    add(this.add.sprite(176, 300, 'hito2', 0).setOrigin(0.5, 1).setScale(S).play('hito2-float'));
    cell(288, 310, '옛 · 카사오바케', false);
    add(this.add.sprite(288, 310, 'old-kasa', 0).setOrigin(0.5, 1).setScale(S).play('old-kasa'));
    cell(400, 310, '새 · 카사오바케 6프레임', true);
    add(this.add.sprite(400, 310, 'kasa2', 0).setOrigin(0.5, 1).setScale(S).play('kasa2-hop'));
    cell(512, 310, '새 · 손에 든 무기', true);
    const gx = 512;
    const gy = 270;
    const ids: GearId[] = ['sword', 'ofuda', 'naginata'];
    const g = add(this.add.image(gx, gy, this.gear.sword.key).setScale(2));
    let gi = 0;
    let ang = 0;
    this.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        ang += 0.06;
        g.setRotation(ang);
      },
    });
    this.time.addEvent({
      delay: 1600,
      loop: true,
      callback: () => {
        gi = (gi + 1) % ids.length;
        const gear = this.gear[ids[gi]];
        g.setTexture(gear.key).setOrigin(gear.art.px / gear.art.canvas.width, gear.art.py / gear.art.canvas.height);
      },
    });
    g.setOrigin(this.gear.sword.art.px / this.gear.sword.art.canvas.width, this.gear.sword.art.py / this.gear.sword.art.canvas.height);
  }

  private blinkOnce(s: Phaser.GameObjects.Sprite): void {
    if (!s.active || s.anims.currentAnim?.key !== 'k2-idle') return;
    s.anims.pause();
    s.setFrame(K2.blink);
    this.time.delayedCall(110, () => s.active && s.anims.resume());
  }

  // ── 움직여 보기 ───────────────────────────────────────

  private buildArena(): void {
    if (!this.textures.exists('sandbox-ground')) this.textures.addCanvas('sandbox-ground', sandboxGround());
    this.add.image(0, ARENA_Y, 'sandbox-ground').setOrigin(0);
    const x = SANDBOX_W / 2;
    const y = ARENA_Y + SANDBOX_H / 2;
    this.shadow = this.add.ellipse(x, y, 16, 5, 0x000000, 0.3);
    this.player = this.add.sprite(x, y, 'k2', 0).setOrigin(0.5, 1).play('k2-idle');
    this.weapon = this.add.image(x, y, this.gear.sword.key);
    this.hand = this.add.image(x, y, 'k2-hand');
    this.hud = this.ui.el('div', 'artlab-hud');
    this.equip('sword');
    for (let i = 0; i < 7; i++) this.spawnFoe(i % 3 === 0 ? 'kasa' : 'hito');
  }

  private setMode(m: 'compare' | 'play'): void {
    this.mode = m;
    const cam = this.cameras.main;
    for (const o of this.compare) (o as unknown as { setVisible(v: boolean): void }).setVisible(m === 'compare');
    if (m === 'compare') {
      cam.stopFollow();
      cam.setZoom(1);
      cam.removeBounds();
      cam.setScroll(0, 0);
    } else {
      cam.setZoom(2);
      cam.setBounds(0, ARENA_Y, SANDBOX_W, SANDBOX_H);
      cam.startFollow(this.player, true, 0.15, 0.15);
    }
    this.renderHud();
  }

  private renderHud(): void {
    const head =
      this.mode === 'compare'
        ? '<b>🎨 아트 시험장</b> · 왼쪽(어두운 칸) 옛 그림 · 오른쪽(푸른 칸) 새 그림 · 3배 확대'
        : `<b>🎨 움직여 보기</b> · 2배 확대 · WASD 이동 · 마우스 조준(자동 공격) · <b>1</b> 신검 <b>2</b> 부적 <b>3</b> 나기나타${this.gear[this.cur].dash ? ' · <b>Space/클릭</b> 찌르며 돌진' : ''}`;
    this.hud.innerHTML = `${head}<br><span class="artlab-switch">M — ${this.mode === 'compare' ? '움직여 보기' : '비교 화면'}로</span> · 지금 무기 <b>${this.gear[this.cur].name}</b>`;
  }

  private equip(id: GearId): void {
    this.cur = id;
    const g = this.gear[id];
    this.weapon.setTexture(g.key).setOrigin(g.art.px / g.art.canvas.width, g.art.py / g.art.canvas.height);
    this.atkCd = 200;
    this.renderHud();
  }

  private spawnFoe(kind: 'hito' | 'kasa'): void {
    const a = Math.random() * Math.PI * 2;
    const x = Phaser.Math.Clamp(this.player.x + Math.cos(a) * 200, 30, SANDBOX_W - 30);
    const y = Phaser.Math.Clamp(this.player.y + Math.sin(a) * 120, ARENA_Y + 40, ARENA_Y + SANDBOX_H - 20);
    const sh = this.add.ellipse(x, y, kind === 'kasa' ? 18 : 14, 5, 0x000000, 0.28);
    const s = this.add.sprite(x, y, kind === 'kasa' ? 'kasa2' : 'hito2', 0).setOrigin(0.5, kind === 'kasa' ? 1 : 0.9).setAlpha(0);
    if (kind === 'hito') s.play({ key: 'hito2-float', startFrame: Phaser.Math.Between(0, 5) });
    this.tweens.add({ targets: s, alpha: 1, duration: 300 });
    this.foes.push({ s, sh, kind, hp: kind === 'kasa' ? 5 : 3, vx: 0, vy: 0, stun: 0, t: Math.random() * 1000 });
  }

  update(time: number, rawDelta: number): void {
    const dt = Math.min(rawDelta, 50);
    if (this.mode !== 'play' || this.fx.stopped) return;
    const sec = dt / 1000;
    const p = this.player;
    // 조준: 어깨 → 마우스
    const ptr = this.input.activePointer;
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const sx = p.x + this.facing * 2;
    const sy = p.y - 14;
    this.aim = Math.atan2(wp.y - sy, wp.x - sx);
    this.facing = Math.cos(this.aim) < 0 ? -1 : 1;

    // 이동 · 대시
    const dir = readMove(this.keys);
    const moving = dir.x !== 0 || dir.y !== 0;
    if (this.dashing > 0) {
      this.dashing -= dt;
      p.x += this.dashDir.x * 520 * sec;
      p.y += this.dashDir.y * 520 * sec;
      p.anims.stop();
      p.setFrame(K2.dash);
      if (Math.floor(time / 24) !== Math.floor((time - dt) / 24)) this.afterimage();
      this.hitLine(p.x, p.y - 12, this.dashDir.x, this.dashDir.y, 26, 16, 2);
    } else {
      if (moving) {
        p.x += dir.x * 120 * sec;
        p.y += dir.y * 120 * sec;
        p.play('k2-run', true);
      } else if (p.anims.currentAnim?.key !== 'k2-idle' || !p.anims.isPlaying) p.play('k2-idle', true);
      this.blinkIn -= dt;
      if (this.blinkIn <= 0 && !moving) {
        this.blinkIn = 2200 + Math.random() * 2000;
        this.blinkOnce(p);
      }
    }
    p.x = Phaser.Math.Clamp(p.x, 12, SANDBOX_W - 12);
    p.y = Phaser.Math.Clamp(p.y, ARENA_Y + 24, ARENA_Y + SANDBOX_H - 6);
    p.setFlipX(this.facing < 0).setDepth(p.y);
    this.shadow.setPosition(p.x, p.y).setDepth(p.y - 0.5);
    // 달리기: 발이 닿는 프레임마다 먼지
    const fr = Number(p.frame.name);
    if (fr !== this.lastFrame && (fr === 4 || fr === 8)) this.fx.dust(p.x - this.facing * 3, p.y, this.facing, 0, 3, 'w');
    this.lastFrame = fr;
    this.dashCd -= dt;

    // 무기: 자동 공격
    this.atkCd -= dt;
    if (this.atkCd <= 0 && this.dashing <= 0) {
      this.atkCd = this.gear[this.cur].cd;
      this.attack();
    }
    this.placeHand();
    this.updateFoes(dt);
  }

  /** 어깨 기준으로 손 · 무기 위치 (조준 + 휘두르기) */
  private placeHand(): void {
    const p = this.player;
    const sx = p.x + this.facing * 2;
    const sy = p.y - 15;
    const a = this.aim + this.swing.a * this.facing;
    const reach = 7 + this.swing.push;
    const hx = sx + Math.cos(a) * reach;
    const hy = sy + Math.sin(a) * reach;
    this.hand.setPosition(Math.round(hx), Math.round(hy)).setDepth(p.y + 2);
    this.weapon
      .setPosition(Math.round(hx), Math.round(hy))
      .setRotation(a)
      .setFlipY(this.facing < 0)
      .setDepth(Math.sin(a) < -0.3 ? p.y - 1 : p.y + 1);
  }

  private attack(): void {
    const id = this.cur;
    if (id === 'sword') {
      // 위에서 아래로 크게 베고 천천히 돌아온다
      this.swing.a = -1.7;
      this.tweens.killTweensOf(this.swing);
      this.tweens.add({
        targets: this.swing,
        a: 1.5,
        duration: 90,
        ease: 'Cubic.easeOut',
        onComplete: () => this.tweens.add({ targets: this.swing, a: -0.5, duration: 260, ease: 'Sine.easeInOut' }),
      });
      this.slashArc();
      this.hitArc(46, 1.5);
    } else if (id === 'ofuda') {
      // 뒤로 당겼다 휙 던진다
      this.tweens.killTweensOf(this.swing);
      this.tweens.add({
        targets: this.swing,
        a: -1.1,
        push: -3,
        duration: 70,
        yoyo: false,
        onComplete: () => {
          this.throwOfuda();
          this.tweens.add({ targets: this.swing, a: 0.4, push: 3, duration: 60, onComplete: () => this.tweens.add({ targets: this.swing, a: -0.5, push: 0, duration: 200 }) });
        },
      });
    } else {
      // 찌르기: 앞으로 쭉 → 천천히 회수
      this.tweens.killTweensOf(this.swing);
      this.swing.a = 0;
      this.tweens.add({
        targets: this.swing,
        push: 12,
        duration: 80,
        ease: 'Cubic.easeOut',
        onComplete: () => this.tweens.add({ targets: this.swing, push: 0, a: -0.3, duration: 240 }),
      });
      const p = this.player;
      this.hitLine(p.x, p.y - 14, Math.cos(this.aim), Math.sin(this.aim), 56, 14, 2);
      this.thrustFlash();
    }
  }

  /** 신검 궤적: 하얀 초승달 */
  private slashArc(): void {
    const p = this.player;
    const cx = p.x + this.facing * 2;
    const cy = p.y - 15;
    const g = this.add.graphics().setDepth(p.y + 3);
    const st = { t: 0 };
    const a0 = this.aim - 1.7 * this.facing;
    const a1 = this.aim + 1.5 * this.facing;
    this.tweens.add({
      targets: st,
      t: 1,
      duration: 180,
      onUpdate: () => {
        g.clear();
        const end = a0 + (a1 - a0) * Math.min(1, st.t * 2);
        const start = a0 + (a1 - a0) * Math.max(0, st.t * 2 - 1);
        for (const [r, w, col, al] of [
          [30, 5, 0xfffaf0, 0.95],
          [24, 3, 0x8fd8ff, 0.7],
        ] as const) {
          g.lineStyle(w * (1 - st.t * 0.6), col, al * (1 - st.t * 0.7));
          g.beginPath();
          g.arc(cx, cy, r, Math.min(start, end), Math.max(start, end), false);
          g.strokePath();
        }
      },
      onComplete: () => g.destroy(),
    });
  }

  private thrustFlash(): void {
    const p = this.player;
    const g = this.add.graphics().setDepth(p.y + 3);
    const x0 = p.x + Math.cos(this.aim) * 18;
    const y0 = p.y - 14 + Math.sin(this.aim) * 18;
    const st = { t: 0 };
    this.tweens.add({
      targets: st,
      t: 1,
      duration: 140,
      onUpdate: () => {
        g.clear();
        g.lineStyle(3 * (1 - st.t), 0xfffaf0, 1 - st.t);
        g.lineBetween(x0, y0, x0 + Math.cos(this.aim) * (30 + st.t * 14), y0 + Math.sin(this.aim) * (30 + st.t * 14));
      },
      onComplete: () => g.destroy(),
    });
  }

  private throwOfuda(): void {
    const p = this.player;
    const a = this.aim;
    const x0 = this.hand.x;
    const y0 = this.hand.y;
    const o = this.add.image(x0, y0, 'ofuda2-shot').setRotation(a).setDepth(p.y + 4);
    const st = { d: 0 };
    let hit = false;
    this.tweens.add({
      targets: st,
      d: 220,
      duration: 650,
      onUpdate: () => {
        o.setPosition(x0 + Math.cos(a) * st.d, y0 + Math.sin(a) * st.d);
        if (hit) return;
        for (const f of this.foes) {
          if (Phaser.Math.Distance.Between(o.x, o.y, f.s.x, f.s.y - 10) < 12) {
            hit = true;
            this.hurtFoe(f, Math.cos(a), Math.sin(a), 1);
            o.destroy();
            return;
          }
        }
      },
      onComplete: () => o.active && this.tweens.add({ targets: o, alpha: 0, duration: 120, onComplete: () => o.destroy() }),
    });
  }

  /** 반원 안 요괴 */
  private hitArc(r: number, half: number): void {
    const p = this.player;
    for (const f of [...this.foes]) {
      const dx = f.s.x - p.x;
      const dy = f.s.y - 10 - (p.y - 14);
      if (Math.hypot(dx, dy) > r) continue;
      if (Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - this.aim)) > half) continue;
      const d = Math.hypot(dx, dy) || 1;
      this.hurtFoe(f, dx / d, dy / d, 1);
    }
  }

  /** 직선 띠 안 요괴 */
  private hitLine(x: number, y: number, nx: number, ny: number, len: number, w: number, dmg: number): void {
    for (const f of [...this.foes]) {
      if (f.stun > 120) continue;
      const dx = f.s.x - x;
      const dy = f.s.y - 10 - y;
      const along = dx * nx + dy * ny;
      const across = Math.abs(-dx * ny + dy * nx);
      if (along > -6 && along < len && across < w) this.hurtFoe(f, nx, ny, dmg);
    }
  }

  private afterimage(): void {
    const p = this.player;
    const ghost = this.add.image(p.x, p.y, 'k2', K2.dash).setOrigin(0.5, 1).setFlipX(p.flipX).setDepth(p.y - 1).setTintFill(0x8fd8ff).setAlpha(0.55);
    this.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
  }

  private tryDash(): void {
    if (this.mode !== 'play' || !this.gear[this.cur].dash || this.dashCd > 0) return;
    this.dashCd = 900;
    this.dashing = 150;
    this.dashDir = { x: Math.cos(this.aim), y: Math.sin(this.aim) };
    this.swing.a = 0;
    this.swing.push = 12;
    this.tweens.add({ targets: this.swing, push: 0, delay: 160, duration: 220 });
    this.cameras.main.shake(80, 0.002);
  }

  // ── 요괴 ─────────────────────────────────────────────

  private hurtFoe(f: LabFoe, nx: number, ny: number, dmg: number): void {
    if (f.hp <= 0) return;
    f.hp -= dmg;
    f.stun = 160;
    f.vx = nx * 240;
    f.vy = ny * 240;
    this.fx.flash(f.s, true);
    this.fx.spark(f.s.x - nx * 4, f.s.y - 10, 'L');
    this.fx.hitStop(f.hp <= 0 ? 60 : 28);
    if (f.hp <= 0) this.killFoe(f);
  }

  private killFoe(f: LabFoe): void {
    this.foes = this.foes.filter((x) => x !== f);
    const s = f.s;
    s.anims.stop();
    s.setTintFill(0xffffff);
    this.tweens.add({
      targets: s,
      scaleX: 1.5,
      scaleY: 0.6,
      duration: 70,
      onComplete: () => {
        this.fx.burst(s.x, s.y - 10, f.kind === 'kasa' ? ['W', 'y', 'R'] : ['P', 'L', 'W'], 16);
        const ring = this.add.circle(s.x, s.y - 10, 4, 0xffffff, 0).setStrokeStyle(2, 0xfffaf0).setDepth(s.y + 5);
        this.tweens.add({ targets: ring, radius: 16, alpha: 0, duration: 220, onComplete: () => ring.destroy() });
        s.destroy();
        f.sh.destroy();
      },
    });
    this.cameras.main.shake(60, 0.002);
    this.time.delayedCall(1200, () => this.mode === 'play' && this.spawnFoe(f.kind));
  }

  private updateFoes(dt: number): void {
    const p = this.player;
    const sec = dt / 1000;
    for (const f of this.foes) {
      f.t += dt;
      const dx = p.x - f.s.x;
      const dy = p.y - f.s.y;
      const d = Math.hypot(dx, dy) || 1;
      f.stun -= dt;
      let speed = 0;
      if (f.stun <= 0) {
        if (f.kind === 'hito') speed = 28;
        else {
          // 카사오바케: 6프레임 한 번에 한 번 뛴다 — 공중(2~4)에서만 움직인다
          const fr = Math.floor(f.t / 125) % 6;
          f.s.setFrame(fr);
          speed = fr >= 2 && fr <= 4 ? 70 : 0;
        }
      }
      f.s.x += ((dx / d) * speed + f.vx) * sec;
      f.s.y += ((dy / d) * speed + f.vy) * sec;
      f.vx *= 0.84;
      f.vy *= 0.84;
      f.s.setFlipX(dx < 0).setDepth(f.s.y);
      f.sh.setPosition(f.s.x, f.s.y).setDepth(f.s.y - 0.5);
    }
  }
}
