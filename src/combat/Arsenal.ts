import Phaser from 'phaser';
import { ARSENAL, ArmsId, Owned, MAX_SLOTS, MAX_LEVEL } from '../data/arsenal';
import type { ChoiceDef } from '../data/choices';
import { baseMods, Mods } from '../data/blessings';
import { handCanvas, K2 } from '../art/fine/kotoha';
import {
  GearArt,
  swordArt,
  ofudaArt,
  ofudaShotArt,
  naginataArt,
  suzuArt,
  foxArt,
  foxShotArt,
  bowArt,
  arrowArt,
  nusaArt,
  fanArt,
} from '../art/fine/gear';

/** 무기가 때릴 수 있는 대상 */
export interface ArmsTarget {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  radius: number;
  /** 몸통 중심이 발보다 얼마나 위인지 */
  bodyY: number;
  /** 무기별로 같은 대상을 다시 때릴 수 있는 시각 (여우불 · 정화 장판) */
  lastHitBy?: Partial<Record<string, number>>;
}

/** 맞힘 처리는 장면이 정한다 (피해 · 숫자 · 넉백 · 처치). knock = 넉백 배율 */
export type ArmsHit = (t: ArmsTarget, damage: number, dirX: number, dirY: number, crit: boolean, weapon: ArmsId, knock?: number) => void;

export interface ArsenalOpts {
  /** 대시가 이 자리로 갈 수 있는지 (장애물 · 싸움터 밖) */
  blocked?: (x: number, y: number) => boolean;
  /** 입력을 받지 않을 때 (글자 입력 중 등) */
  inputBlocked?: () => boolean;
}

interface Shot {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  pierce: number;
  hit: Set<ArmsTarget>;
  id: ArmsId;
  dmg: number;
  /** 여우불: 가까운 요괴 쪽으로 휜다 */
  homing?: boolean;
}

interface Zone {
  g: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  r: number;
  life: number;
  dmg: number;
}

const CRIT_CHANCE = 0.15;
const CRIT_MULT = 2.2;
const FLAT = 0.62;

const ART: Record<ArmsId, () => GearArt> = {
  ofuda: ofudaArt,
  tsurugi: swordArt,
  suzu: suzuArt,
  kitsunebi: foxArt,
  hamayumi: bowArt,
  naginata: naginataArt,
  nusa: nusaArt,
  uchiwa: fanArt,
};
/** 그림의 손잡이 위치 (텍스처 origin) */
const ORIGIN: Partial<Record<ArmsId, [number, number]>> = {};

/** 손 · 무기 · 탄 텍스처 */
export function registerArmsArt(scene: Phaser.Scene): void {
  const img = (key: string, c: HTMLCanvasElement) => !scene.textures.exists(key) && scene.textures.addCanvas(key, c);
  for (const id of Object.keys(ART) as ArmsId[]) {
    const art = ART[id]();
    img(`arm-${id}`, art.canvas);
    ORIGIN[id] = [art.px / art.canvas.width, art.py / art.canvas.height];
  }
  img('arm-hand', handCanvas());
  img('shot-ofuda', ofudaShotArt());
  img('shot-arrow', arrowArt());
  img('shot-fox', foxShotArt());
}

/**
 * ⚔️ 손에 든 무기 (던그리드식).
 * 손에 든 무기 하나가 마우스 쪽으로 자동 공격 · Tab/휠로 두 손의 무기를 바꿔 든다(바꾸는 순간 한 번 친다)
 * · 우클릭/Shift = 대시(나기나타 · 텐구 부채만).
 * 마우스를 아직 움직이지 않았으면 가장 가까운 요괴를 조준한다.
 */
export class Arsenal {
  private hand: Phaser.GameObjects.Image;
  private weapon: Phaser.GameObjects.Image;
  private shots: Shot[] = [];
  private zones: Zone[] = [];
  private orbs: Phaser.GameObjects.Image[] = [];
  private orbAngle = 0;
  private stormT = 0;
  private aim = 0;
  facing = 1;
  private pointerMoved = false;
  /** 휘두르기 각도 오프셋 · 손 내밀기 */
  private swing = { a: -0.5, push: 0 };
  private atkCd = 400;
  private swapCd = 0;
  private dashCd = 0;
  private dashT = 0;
  private dashMax = 1;
  private dashDir = { x: 1, y: 0 };
  private dashHit = new Set<ArmsTarget>();
  private invulnUntil = 0;
  private active = false;
  private attacks = 0;
  private visible = true;
  private lastHeld: ArmsId | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.GameObjects.Sprite,
    private readonly targets: () => ArmsTarget[],
    private readonly onHit: ArmsHit,
    /** (예전 시전 모션 알림 — 지금은 손이 직접 움직인다) */
    _onCast: (dirX: number) => void = () => {},
    /** 든 무기 — 한 판의 빌드를 그대로 넘기면 강화가 이어진다 (owned[0] = 지금 든 무기) */
    readonly owned: Owned[] = [{ id: 'ofuda', level: 1 }],
    private readonly mods: () => Mods = baseMods,
    private readonly opts: ArsenalOpts = {},
  ) {
    if (owned.length > MAX_SLOTS) owned.splice(MAX_SLOTS);
    registerArmsArt(scene);
    this.hand = scene.add.image(player.x, player.y, 'arm-hand');
    this.weapon = scene.add.image(player.x, player.y, 'arm-hand');
    this.applyWeaponArt();

    const input = scene.input;
    input.mouse?.disableContextMenu();
    const onMove = () => (this.pointerMoved = true);
    const onDown = (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) this.tryDash();
    };
    const onWheel = () => this.swap();
    input.on('pointermove', onMove);
    input.on('pointerdown', onDown);
    input.on('wheel', onWheel);
    const kb = input.keyboard;
    kb?.addCapture('TAB');
    const onTab = () => this.swap();
    const onShift = () => this.tryDash();
    kb?.on('keydown-TAB', onTab);
    kb?.on('keydown-SHIFT', onShift);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      input.off('pointermove', onMove);
      input.off('pointerdown', onDown);
      input.off('wheel', onWheel);
      kb?.off('keydown-TAB', onTab);
      kb?.off('keydown-SHIFT', onShift);
      kb?.removeCapture('TAB');
    });
  }

  // ── 상태 ─────────────────────────────────────────────

  get held(): Owned | undefined {
    return this.owned[0];
  }

  /** 대시 · 도약 중 */
  get dashing(): boolean {
    return this.dashT > 0;
  }

  /** 대시 무적 */
  get invuln(): boolean {
    return this.scene.time.now < this.invulnUntil;
  }

  /** 지금 든 무기의 대시 준비 정도 (0~1, 대시가 없으면 -1) */
  get dashReady(): number {
    const d = this.held && ARSENAL[this.held.id].dash;
    if (!d) return -1;
    return 1 - Math.max(0, this.dashCd) / d.cooldownMs;
  }

  level(id: ArmsId): number {
    return this.owned.find((o) => o.id === id)?.level ?? 0;
  }

  private evo(id: ArmsId): boolean {
    return this.owned.some((o) => o.id === id && o.evo);
  }

  private stats(id: ArmsId) {
    return ARSENAL[id].levels[Math.max(1, this.level(id)) - 1];
  }

  private roll(base: number): [number, boolean] {
    const crit = Math.random() < CRIT_CHANCE + this.mods().crit;
    return [base * (crit ? CRIT_MULT : 1) * Phaser.Math.FloatBetween(0.9, 1.1), crit];
  }

  /** 레벨업 선택지 */
  offers(unlocked: ArmsId[], blessings: string[] = []): ChoiceDef[] {
    return armsOffers(this.owned, unlocked, blessings);
  }

  levelUp(id: ArmsId): void {
    levelUpArms(this.owned, id);
    this.applyWeaponArt();
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.hand.setVisible(v);
    this.weapon.setVisible(v);
    this.orbs.forEach((o) => o.setVisible(v));
  }

  // ── 입력 ─────────────────────────────────────────────

  private canInput(): boolean {
    return this.active && !this.opts.inputBlocked?.();
  }

  /** 두 손의 무기를 바꿔 든다 — 바꾸는 순간 한 번 친다 */
  swap(): void {
    if (!this.canInput() || this.owned.length < 2 || this.swapCd > 0 || this.dashing) return;
    this.swapCd = 350;
    [this.owned[0], this.owned[1]] = [this.owned[1], this.owned[0]];
    this.applyWeaponArt();
    this.atkCd = 0;
    this.dashCd = Math.min(this.dashCd, 300);
    const def = ARSENAL[this.owned[0].id];
    const t = this.scene.add
      .text(this.player.x, this.player.y - 40, `${def.icon} ${def.name}`, { fontFamily: 'Galmuri11', fontSize: '11px', color: '#ffe39a', stroke: '#1b1626', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(5000);
    this.scene.tweens.add({ targets: t, y: t.y - 10, alpha: 0, delay: 250, duration: 400, onComplete: () => t.destroy() });
  }

  tryDash(): void {
    const id = this.held?.id;
    const d = id && ARSENAL[id].dash;
    if (!d || !this.canInput() || this.dashCd > 0 || this.dashing) return;
    this.dashCd = d.cooldownMs * (this.level(id) >= 5 ? 0.75 : 1);
    this.dashDir = { x: Math.cos(this.aim), y: Math.sin(this.aim) };
    this.dashMax = id === 'uchiwa' ? 280 : 150;
    this.dashT = this.dashMax;
    this.dashHit.clear();
    this.invulnUntil = this.scene.time.now + this.dashMax + 140;
    this.player.anims.stop();
    this.player.setFrame(K2.dash);
    if (id === 'naginata') {
      this.tweens(this.swing, { a: 0, push: 12 }, 60, () => this.tweens(this.swing, { push: 0, a: -0.4 }, 260, undefined, this.dashMax));
      this.scene.cameras.main.shake(80, 0.002);
    } else {
      this.tweens(this.swing, { a: -1.4 }, 120, () => this.tweens(this.swing, { a: -0.5 }, 200));
      this.gust(this.player.x, this.player.y - 10, this.aim + Math.PI, 40, 0.6);
    }
  }

  // ── 매 프레임 ─────────────────────────────────────────

  update(dt: number, active: boolean): void {
    this.active = active;
    this.swapCd -= dt;
    this.dashCd -= dt;
    if (this.held?.id !== this.lastHeld) {
      this.lastHeld = this.held?.id;
      this.applyWeaponArt();
    }
    this.updateAim();
    if (this.dashT > 0) this.updateDash(dt);
    this.atkCd -= dt;
    const held = this.held;
    if (held && active && !this.dashing && this.atkCd <= 0 && this.inReach(held.id)) {
      this.atkCd = this.stats(held.id).cooldownMs;
      this.attack(held.id);
    }
    this.updateShots(dt);
    this.updateZones(dt);
    this.updateOrbs(dt, active);
    this.placeHand();
  }

  private updateAim(): void {
    const p = this.player;
    const sx = p.x;
    const sy = p.y - 15;
    if (this.pointerMoved) {
      const ptr = this.scene.input.activePointer;
      const w = this.scene.cameras.main.getWorldPoint(ptr.x, ptr.y);
      this.aim = Math.atan2(w.y - sy, w.x - sx);
    } else {
      // 마우스를 아직 안 움직였으면 가장 가까운 요괴 쪽
      let best: ArmsTarget | null = null;
      let bd = 320;
      for (const t of this.targets()) {
        const d = Phaser.Math.Distance.Between(sx, sy, t.sprite.x, t.sprite.y - t.bodyY);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      if (best) this.aim = Math.atan2(best.sprite.y - best.bodyY - sy, best.sprite.x - sx);
      else this.aim = this.facing > 0 ? 0 : Math.PI;
    }
    if (!this.dashing) this.facing = Math.cos(this.aim) < 0 ? -1 : 1;
  }

  /** 사거리 안에 요괴가 있을 때만 휘두른다 */
  private inReach(id: ArmsId): boolean {
    const s = this.stats(id);
    const reach = id === 'ofuda' || id === 'hamayumi' || id === 'kitsunebi' ? s.range : s.range + 40;
    const p = this.player;
    return this.targets().some((t) => Phaser.Math.Distance.Between(p.x, p.y - 15, t.sprite.x, t.sprite.y - t.bodyY) < reach + t.radius);
  }

  private get shoulder(): { x: number; y: number } {
    return { x: this.player.x + this.facing * 2, y: this.player.y - 15 };
  }

  private placeHand(): void {
    const p = this.player;
    const id = this.held?.id;
    const show = this.visible && !!id && p.visible;
    this.hand.setVisible(show);
    this.weapon.setVisible(show);
    if (!show || !id) return;
    const { x: sx, y: sy } = this.shoulder;
    const lift = p.originY > 1 ? (p.originY - 1) * p.height : 0;
    const a = this.aim + this.swing.a * this.facing;
    const reach = 7 + this.swing.push;
    const hx = Math.round(sx + Math.cos(a) * reach);
    const hy = Math.round(sy + Math.sin(a) * reach - lift);
    const front = Math.sin(a) > -0.3;
    this.hand.setPosition(hx, hy).setDepth(p.depth + (front ? 2 : -1)).setAlpha(p.alpha);
    if (id === 'kitsunebi') {
      // 여우불은 손바닥 위에 세워 둔다
      this.weapon.setPosition(hx + this.facing * 3, hy + 2).setRotation(0).setFlipY(false).setDepth(p.depth + 3);
    } else {
      this.weapon
        .setPosition(hx, hy)
        .setRotation(a)
        .setFlipY(this.facing < 0)
        .setDepth(p.depth + (front ? 1 : -2))
        .setAlpha(p.alpha);
    }
  }

  private applyWeaponArt(): void {
    const id = this.held?.id;
    if (!id) return;
    const [ox, oy] = ORIGIN[id] ?? [0.5, 0.5];
    this.weapon.setTexture(`arm-${id}`).setOrigin(ox, oy);
    this.swing.a = -0.5;
    this.swing.push = 0;
    this.scene.tweens.killTweensOf(this.swing);
  }

  private tweens(target: object, props: object, duration: number, onComplete?: () => void, delay = 0): void {
    this.scene.tweens.add({ targets: target, ...props, duration, delay, ease: 'Cubic.easeOut', onComplete });
  }

  // ── 공격 ─────────────────────────────────────────────

  private attack(id: ArmsId): void {
    this.attacks++;
    this.scene.tweens.killTweensOf(this.swing);
    switch (id) {
      case 'ofuda':
        this.tweens(this.swing, { a: -1.1, push: -3 }, 70, () => {
          this.throwOfuda();
          this.tweens(this.swing, { a: 0.4, push: 3 }, 60, () => this.tweens(this.swing, { a: -0.5, push: 0 }, 200));
        });
        break;
      case 'tsurugi': {
        const s = this.stats('tsurugi');
        this.slash(-1.7, 1.5, s.range, 1.35, 'tsurugi', s.damage);
        if (s.count >= 2) this.scene.time.delayedCall(170, () => this.slash(1.5, -1.7, s.range, 1.35, 'tsurugi', s.damage * 0.8));
        break;
      }
      case 'suzu':
        this.ringBell();
        break;
      case 'kitsunebi':
        this.tweens(this.swing, { push: 4 }, 60, () => this.tweens(this.swing, { push: 0 }, 200));
        this.launchFox();
        break;
      case 'hamayumi':
        this.tweens(this.swing, { a: 0, push: -4 }, 160, () => {
          this.shootArrow();
          this.tweens(this.swing, { push: 2 }, 50, () => this.tweens(this.swing, { push: 0, a: -0.3 }, 220));
        });
        break;
      case 'naginata':
        this.naginata();
        break;
      case 'nusa': {
        const s = this.stats('nusa');
        this.slash(-2.0, 1.8, s.range, 1.6, 'nusa', s.damage, 160);
        if (s.count >= 1) this.purifyZone();
        break;
      }
      case 'uchiwa': {
        const s = this.stats('uchiwa');
        this.fan();
        if (s.count >= 2) this.scene.time.delayedCall(180, () => this.fan());
        break;
      }
    }
  }

  /** 휘두르기 (신검 · 오오누사 · 나기나타 휘돌리기): 손이 a0 → a1로 돌고, 반원 안을 친다 */
  private slash(a0: number, a1: number, range: number, half: number, id: ArmsId, damage: number, ms = 90): void {
    this.swing.a = a0;
    this.tweens(this.swing, { a: a1 }, ms, () => this.tweens(this.swing, { a: -0.5 }, 260));
    const { x: cx, y: cy } = this.shoulder;
    const f = this.facing;
    const s0 = this.aim + a0 * f;
    const s1 = this.aim + a1 * f;
    const color = id === 'nusa' ? 0xfff4d0 : 0xfffaf0;
    const g = this.scene.add.graphics().setDepth(4600);
    const st = { t: 0 };
    this.scene.tweens.add({
      targets: st,
      t: 1,
      duration: ms + 110,
      onUpdate: () => {
        g.clear();
        const e = s0 + (s1 - s0) * Math.min(1, st.t * 1.8);
        const b = s0 + (s1 - s0) * Math.max(0, st.t * 1.8 - 0.8);
        const lo = Math.min(b, e);
        const hi = Math.max(b, e);
        g.lineStyle(6 * (1 - st.t * 0.6), color, 0.95 * (1 - st.t * 0.7));
        g.beginPath();
        g.arc(cx, cy, range * 0.72, lo, hi, false);
        g.strokePath();
        g.lineStyle(2, id === 'nusa' ? 0xf0b84a : 0x8fd8ff, 0.7 * (1 - st.t));
        g.beginPath();
        g.arc(cx, cy, range * 0.52, lo, hi, false);
        g.strokePath();
      },
      onComplete: () => g.destroy(),
    });
    const knock = ARSENAL[id].knock ?? 1;
    this.scene.time.delayedCall(ms * 0.5, () => {
      for (const t of [...this.targets()]) {
        const dx = t.sprite.x - cx;
        const dy = t.sprite.y - t.bodyY - cy;
        const d = Math.hypot(dx, dy);
        if (d > range + t.radius) continue;
        if (Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - this.aim)) > half) continue;
        const [dmg, crit] = this.roll(damage);
        this.onHit(t, dmg, dx / (d || 1), dy / (d || 1), crit, id, knock);
      }
    });
  }

  private throwOfuda(): void {
    const s = this.stats('ofuda');
    const sun = this.evo('ofuda');
    const n = s.count + (sun ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = this.aim + (i - (n - 1) / 2) * 0.16;
      const img = this.scene.add.image(this.hand.x, this.hand.y, 'shot-ofuda').setRotation(a).setDepth(4500);
      if (sun) img.setTint(0xffe39a).setScale(1.35);
      this.shots.push({
        img,
        vx: Math.cos(a) * 340,
        vy: Math.sin(a) * 340,
        life: (s.range / 340) * 1000,
        pierce: sun ? 99 : s.pierce,
        hit: new Set(),
        id: 'ofuda',
        dmg: s.damage * this.mods().ofudaDmg,
      });
    }
  }

  private shootArrow(): void {
    const s = this.stats('hamayumi');
    for (let i = 0; i < s.count; i++) {
      const a = this.aim + (i - (s.count - 1) / 2) * 0.12;
      const img = this.scene.add.image(this.hand.x, this.hand.y, 'shot-arrow').setRotation(a).setDepth(4500);
      this.shots.push({ img, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, life: (s.range / 520) * 1000, pierce: s.pierce, hit: new Set(), id: 'hamayumi', dmg: s.damage });
    }
    this.scene.cameras.main.shake(40, 0.0015);
  }

  private launchFox(): void {
    const s = this.stats('kitsunebi');
    const img = this.scene.add.image(this.hand.x, this.hand.y - 4, 'shot-fox').setDepth(4500);
    if (this.evo('kitsunebi')) img.setScale(1.4);
    this.shots.push({
      img,
      vx: Math.cos(this.aim) * 220,
      vy: Math.sin(this.aim) * 220,
      life: 1600,
      pierce: 0,
      hit: new Set(),
      id: 'kitsunebi',
      dmg: s.damage * (this.evo('kitsunebi') ? 1.3 : 1),
      homing: true,
    });
  }

  /** 방울: 마우스 쪽 소리 물결 (Lv4부터 몸 둘레로도 한 번 더) */
  private ringBell(): void {
    const s = this.stats('suzu');
    const st0 = { k: 0 };
    this.scene.tweens.add({
      targets: st0,
      k: 1,
      duration: 160,
      onUpdate: () => (this.swing.a = -0.5 + Math.sin(st0.k * Math.PI * 4) * 0.45),
      onComplete: () => (this.swing.a = -0.5),
    });
    const { x: cx, y: cy } = this.shoulder;
    const half = 0.75;
    const a = this.aim;
    this.wave(cx, cy, s.range, a - half, a + half, 0xf0b84a);
    this.hitCone(cx, cy, s.range, a, half, 'suzu', s.damage, 1);
    if (s.count >= 2) {
      this.scene.time.delayedCall(200, () => {
        this.wave(cx, cy, s.range * 0.75, -Math.PI, Math.PI, 0xfffaf0);
        this.hitCone(cx, cy, s.range * 0.75, a, Math.PI, 'suzu', s.damage * 0.7, 1);
      });
    }
  }

  /** 퍼지는 물결 그림 */
  private wave(cx: number, cy: number, r: number, a0: number, a1: number, color: number): void {
    const g = this.scene.add.graphics().setDepth(4400);
    const st = { r: 6, a: 1 };
    this.scene.tweens.add({
      targets: st,
      r,
      a: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        g.clear();
        for (const [w, k, al] of [
          [4, 1, 0.35],
          [2, 0.82, 1],
        ] as const) {
          g.lineStyle(w, k === 1 ? color : 0xfffaf0, st.a * al);
          g.beginPath();
          for (let i = 0; i <= 20; i++) {
            const ang = a0 + ((a1 - a0) * i) / 20;
            const x = cx + Math.cos(ang) * st.r * k;
            const y = cy + Math.sin(ang) * st.r * k * 0.75;
            if (i === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          g.strokePath();
        }
      },
      onComplete: () => g.destroy(),
    });
  }

  private hitCone(cx: number, cy: number, r: number, a: number, half: number, id: ArmsId, damage: number, knock: number): void {
    for (const t of [...this.targets()]) {
      const dx = t.sprite.x - cx;
      const dy = t.sprite.y - t.bodyY - cy;
      const d = Math.hypot(dx, dy);
      if (d > r + t.radius) continue;
      if (half < Math.PI && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - a)) > half) continue;
      const [dmg, crit] = this.roll(damage);
      this.onHit(t, dmg, dx / (d || 1), dy / (d || 1), crit, id, knock);
    }
  }

  /** 나기나타: 찌르기 · Lv3부터 세 번째마다 크게 휘돌리기 */
  private naginata(): void {
    const s = this.stats('naginata');
    if (s.count >= 2 && this.attacks % 3 === 0) {
      this.slash(-2.6, 2.6, s.range * 0.85, 2.5, 'naginata', s.damage, 200);
      return;
    }
    this.swing.a = 0;
    this.tweens(this.swing, { push: 12 }, 80, () => this.tweens(this.swing, { push: 0, a: -0.3 }, 240));
    const { x, y } = this.shoulder;
    const nx = Math.cos(this.aim);
    const ny = Math.sin(this.aim);
    const g = this.scene.add.graphics().setDepth(4600);
    const st = { t: 0 };
    this.scene.tweens.add({
      targets: st,
      t: 1,
      duration: 150,
      onUpdate: () => {
        g.clear();
        g.lineStyle(3 * (1 - st.t), 0xfffaf0, 1 - st.t);
        g.lineBetween(x + nx * 20, y + ny * 20, x + nx * (s.range + st.t * 10), y + ny * (s.range + st.t * 10));
      },
      onComplete: () => g.destroy(),
    });
    this.scene.time.delayedCall(40, () => this.hitLine(x, y, nx, ny, s.range, 12, 'naginata', s.damage));
  }

  private hitLine(x: number, y: number, nx: number, ny: number, len: number, w: number, id: ArmsId, damage: number, once?: Set<ArmsTarget>): void {
    for (const t of [...this.targets()]) {
      if (once?.has(t)) continue;
      const dx = t.sprite.x - x;
      const dy = t.sprite.y - t.bodyY - y;
      const along = dx * nx + dy * ny;
      const across = Math.abs(-dx * ny + dy * nx);
      if (along > -8 && along < len + t.radius && across < w + t.radius) {
        once?.add(t);
        const [dmg, crit] = this.roll(damage);
        this.onHit(t, dmg, nx, ny, crit, id, ARSENAL[id].knock ?? 1);
      }
    }
  }

  /** 오오누사 Lv3: 휘두른 자리를 3초 정화 */
  private purifyZone(): void {
    const s = this.stats('nusa');
    const { x } = this.shoulder;
    const zx = x + Math.cos(this.aim) * s.range * 0.6;
    const zy = this.player.y + Math.sin(this.aim) * s.range * 0.6 * FLAT;
    this.zones.push({ g: this.scene.add.graphics().setDepth(3), x: zx, y: zy, r: 30, life: 3000, dmg: s.damage * 0.35 });
  }

  /** 텐구 부채: 마우스 쪽 돌풍 — 멀리 날려 보낸다 */
  private fan(): void {
    const s = this.stats('uchiwa');
    this.swing.a = -1.2;
    this.tweens(this.swing, { a: 0.6 }, 90, () => this.tweens(this.swing, { a: -0.5 }, 240));
    const { x, y } = this.shoulder;
    this.gust(x, y, this.aim, s.range, 0.5);
    this.hitCone(x, y, s.range, this.aim, 0.5, 'uchiwa', s.damage, ARSENAL.uchiwa.knock ?? 1);
  }

  /** 바람 줄기 그림 */
  private gust(x: number, y: number, a: number, r: number, half: number): void {
    for (let i = 0; i < 6; i++) {
      const ang = a + (Math.random() * 2 - 1) * half;
      const line = this.scene.add.graphics().setDepth(4600);
      const st = { t: 0 };
      const off = Math.random() * 8;
      this.scene.tweens.add({
        targets: st,
        t: 1,
        duration: 260 + Math.random() * 80,
        delay: i * 20,
        onUpdate: () => {
          line.clear();
          const d0 = 10 + off + st.t * r * 0.8;
          const d1 = d0 + 14 + (1 - st.t) * 10;
          line.lineStyle(2, 0xffffff, 0.75 * (1 - st.t));
          line.lineBetween(x + Math.cos(ang) * d0, y + Math.sin(ang) * d0 * 0.8, x + Math.cos(ang) * d1, y + Math.sin(ang) * d1 * 0.8);
        },
        onComplete: () => line.destroy(),
      });
    }
  }

  // ── 대시 ─────────────────────────────────────────────

  private updateDash(dt: number): void {
    const p = this.player;
    const id = this.held?.id;
    const d = id ? ARSENAL[id].dash : undefined;
    if (!id || !d) {
      this.dashT = 0;
      return;
    }
    const step = (d.distance / this.dashMax) * Math.min(dt, this.dashT);
    const nx = p.x + this.dashDir.x * step;
    const ny = p.y + this.dashDir.y * step;
    if (!this.opts.blocked?.(nx, p.y)) p.x = nx;
    if (!this.opts.blocked?.(p.x, ny)) p.y = ny;
    this.dashT -= dt;
    const t = 1 - Math.max(0, this.dashT) / this.dashMax;
    p.anims.stop();
    p.setFrame(K2.dash);
    if (Math.random() < dt / 26) this.afterimage(id === 'uchiwa' ? 0xffffff : 0x8fd8ff);
    if (id === 'naginata') {
      // 찌르며 돌진: 앞을 막는 요괴를 꿰뚫는다
      const s = this.stats('naginata');
      this.hitLine(p.x, p.y - 14, this.dashDir.x, this.dashDir.y, 26, 14, 'naginata', s.damage * 1.2, this.dashHit);
    } else {
      // 바람 타고 도약: 몸이 떠올랐다 내려앉는다
      p.setOrigin(0.5, 1 + (Math.sin(t * Math.PI) * 18) / p.height);
    }
    if (this.dashT <= 0) {
      p.setOrigin(0.5, 1);
      if (id === 'uchiwa') this.landBurst();
    }
  }

  private landBurst(): void {
    const s = this.stats('uchiwa');
    const p = this.player;
    this.scene.cameras.main.shake(100, 0.004);
    this.wave(p.x, p.y - 8, 56, -Math.PI, Math.PI, 0xffffff);
    this.hitCone(p.x, p.y - 8, 56, 0, Math.PI, 'uchiwa', s.damage * 1.5, ARSENAL.uchiwa.knock ?? 1);
  }

  private afterimage(tint: number): void {
    const p = this.player;
    const ghost = this.scene.add
      .image(p.x, p.y, p.texture.key, K2.dash)
      .setOrigin(p.originX, p.originY)
      .setFlipX(p.flipX)
      .setDepth(p.depth - 1)
      .setTintFill(tint)
      .setAlpha(0.5);
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
  }

  // ── 탄 · 장판 · 여우불 ─────────────────────────────────

  private updateShots(dt: number): void {
    const sec = dt / 1000;
    for (const shot of this.shots) {
      if (shot.homing) {
        // 가까운 요괴 쪽으로 조금씩 꺾인다
        let best: ArmsTarget | null = null;
        let bd = 140;
        for (const t of this.targets()) {
          const d = Phaser.Math.Distance.Between(shot.img.x, shot.img.y, t.sprite.x, t.sprite.y - t.bodyY);
          if (d < bd) {
            bd = d;
            best = t;
          }
        }
        if (best) {
          const want = Math.atan2(best.sprite.y - best.bodyY - shot.img.y, best.sprite.x - shot.img.x);
          const cur = Math.atan2(shot.vy, shot.vx);
          const na = cur + Phaser.Math.Angle.Wrap(want - cur) * Math.min(1, sec * 6);
          const sp = Math.hypot(shot.vx, shot.vy);
          shot.vx = Math.cos(na) * sp;
          shot.vy = Math.sin(na) * sp;
        }
      }
      shot.img.x += shot.vx * sec;
      shot.img.y += shot.vy * sec;
      shot.life -= dt;
      if (shot.life <= 0) continue;
      for (const t of this.targets()) {
        if (shot.hit.has(t)) continue;
        if (Phaser.Math.Distance.Between(shot.img.x, shot.img.y, t.sprite.x, t.sprite.y - t.bodyY) < t.radius + 5) {
          shot.hit.add(t);
          const d = Math.hypot(shot.vx, shot.vy) || 1;
          const [dmg, crit] = this.roll(shot.dmg);
          this.onHit(t, dmg, shot.vx / d, shot.vy / d, crit, shot.id, 1);
          if (shot.id === 'ofuda' && this.evo('ofuda')) this.sunBurst(t.sprite.x, t.sprite.y - t.bodyY, dmg * 0.5, t);
          if (shot.pierce-- <= 0) {
            shot.life = 0;
            break;
          }
        }
      }
    }
    this.shots = this.shots.filter((x) => {
      if (x.life > 0) return true;
      x.img.destroy();
      return false;
    });
  }

  /** 일륜 부적: 맞은 자리의 작은 빛 폭발 (주변 요괴에게 절반 피해) */
  private sunBurst(x: number, y: number, dmg: number, except: ArmsTarget): void {
    const ring = this.scene.add.circle(x, y, 6, 0xffe39a, 0.55).setDepth(4400);
    this.scene.tweens.add({ targets: ring, radius: 30, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    for (const t of [...this.targets()]) {
      if (t === except) continue;
      const dx = t.sprite.x - x;
      const dy = t.sprite.y - t.bodyY - y;
      const d = Math.hypot(dx, dy);
      if (d < 30 + t.radius) this.onHit(t, Math.round(dmg), dx / (d || 1), dy / (d || 1), false, 'ofuda');
    }
  }

  private updateZones(dt: number): void {
    const now = this.scene.time.now;
    for (const z of this.zones) {
      z.life -= dt;
      const fade = Math.min(1, z.life / 400);
      z.g.clear();
      z.g.fillStyle(0xfff4d0, 0.18 * fade).fillEllipse(z.x, z.y, z.r * 2, z.r * 2 * FLAT);
      z.g.lineStyle(1, 0xf0b84a, 0.7 * fade).strokeEllipse(z.x, z.y, z.r * 2, z.r * 2 * FLAT);
      const k = ((3000 - z.life) / 600) % 1;
      z.g.lineStyle(1, 0xffffff, 0.5 * fade * (1 - k)).strokeEllipse(z.x, z.y, z.r * 2 * k, z.r * 2 * FLAT * k);
      for (const t of this.targets()) {
        t.lastHitBy ??= {};
        if (now - (t.lastHitBy.zone ?? 0) < 400) continue;
        const dx = (t.sprite.x - z.x) / z.r;
        const dy = (t.sprite.y - z.y) / (z.r * FLAT);
        if (dx * dx + dy * dy <= 1) {
          t.lastHitBy.zone = now;
          this.onHit(t, z.dmg, 0, 0, false, 'nusa', 0);
        }
      }
    }
    this.zones = this.zones.filter((z) => {
      if (z.life > 0) return true;
      z.g.destroy();
      return false;
    });
  }

  /** 여우불을 들고 있으면 몸 주위를 돈다 */
  private updateOrbs(dt: number, active: boolean): void {
    const holding = this.held?.id === 'kitsunebi' && this.visible;
    if (!holding) {
      this.orbs.forEach((o) => o.destroy());
      this.orbs = [];
      return;
    }
    const base = this.stats('kitsunebi');
    const m = this.mods();
    const storm = this.evo('kitsunebi');
    this.stormT = (this.stormT + dt) % 4000;
    const burst = storm && this.stormT < 1200 ? Math.sin((this.stormT / 1200) * Math.PI) * 1.4 : 0;
    const count = base.count + m.foxCount;
    const range = base.range * m.foxRange * (1 + burst);
    const damage = base.damage * 0.8 * (storm ? 1.3 : 1);
    while (this.orbs.length < count) this.orbs.push(this.scene.add.image(0, 0, 'shot-fox').setScale(storm ? 1.5 : 1));
    this.orbAngle += (dt / 1300) * Math.PI * 2 * (1 + (this.level('kitsunebi') >= 4 ? 0.25 : 0));
    const p = this.player;
    const now = this.scene.time.now;
    this.orbs.forEach((orb, k) => {
      const a = this.orbAngle + (Math.PI * 2 * k) / this.orbs.length;
      orb.setPosition(p.x + Math.cos(a) * range, p.y - 14 + Math.sin(a) * range * 0.7);
      orb.setDepth(orb.y + 14);
      if (!active) return;
      for (const t of [...this.targets()]) {
        t.lastHitBy ??= {};
        if (now - (t.lastHitBy.kitsunebi ?? 0) < 380) continue;
        const dx = t.sprite.x - orb.x;
        const dy = t.sprite.y - t.bodyY - orb.y;
        if (Math.hypot(dx, dy) < t.radius + 8) {
          t.lastHitBy.kitsunebi = now;
          const ox = t.sprite.x - p.x;
          const oy = t.sprite.y - p.y;
          const od = Math.hypot(ox, oy) || 1;
          const [dmg, crit] = this.roll(damage);
          this.onHit(t, dmg, ox / od, oy / od, crit, 'kitsunebi', 0.6);
        }
      }
    });
  }

  // ── HUD ──────────────────────────────────────────────

  /** 손 두 칸 (든 무기는 크게) + 대시 준비 */
  hudKey(): string {
    const dr = this.dashReady;
    return `${this.owned.map((o) => `${o.id}${o.level}${o.evo ? '*' : ''}`).join(',')}|${dr < 0 ? '-' : Math.floor(dr * 8)}`;
  }

  hudHtml(): string {
    const cell = (o: Owned | undefined, held: boolean) => {
      if (!o) return `<div class="hand-slot empty${held ? ' held' : ''}"><span>✋</span><b>빈 손</b></div>`;
      const def = ARSENAL[o.id];
      const evo = o.evo && def.evo;
      const pips = Array.from({ length: MAX_LEVEL }, (_, k) => `<i class="${k < o.level ? 'on' : ''}"></i>`).join('');
      return `<div class="hand-slot${held ? ' held' : ''}${evo ? ' evo' : ''}"><span>${evo ? def.evo!.icon : def.icon}</span><b>${evo ? def.evo!.name : def.name}</b><em>${pips}</em></div>`;
    };
    const dr = this.dashReady;
    const dash =
      dr < 0
        ? ''
        : `<div class="hand-dash${dr >= 1 ? ' ready' : ''}"><i style="width:${Math.min(1, dr) * 100}%"></i><span>우클릭 ${ARSENAL[this.held!.id].dash!.name}</span></div>`;
    const swap = this.owned.length >= 2 ? '<div class="hand-swap">Tab · 휠 바꿔 들기</div>' : '';
    return `${cell(this.owned[0], true)}${cell(this.owned[1], false)}${dash}${swap}`;
  }
}

/** 무기 강화 · 새 무기 선택지 (전투 밖 — 찻집 등에서도 쓴다) */
export function armsOffers(owned: Owned[], unlocked: ArmsId[], blessings: string[] = []): ChoiceDef[] {
  const list: ChoiceDef[] = [];
  // 진화: Lv5 + 짝 가호 → 금빛 카드
  for (const o of owned) {
    const evo = ARSENAL[o.id].evo;
    if (!evo || o.evo || o.level < MAX_LEVEL || !blessings.includes(evo.blessing)) continue;
    list.push({ id: `evo-${o.id}`, name: `진화: ${evo.name}`, desc: evo.desc, icon: evo.icon, special: 'evo', apply: () => (o.evo = true) });
  }
  for (const o of owned) {
    if (o.level >= MAX_LEVEL) continue;
    const def = ARSENAL[o.id];
    const next = def.levels[o.level];
    list.push({ id: `arms-${o.id}`, name: `${def.name} Lv${o.level + 1}`, desc: next.note, icon: def.icon, apply: () => levelUpArms(owned, o.id) });
  }
  // 새 무기는 빈 손이 있을 때만 — 두 손이 다 차면 그 판은 강화만 고른다
  if (owned.length < MAX_SLOTS) {
    for (const id of unlocked) {
      if (owned.some((o) => o.id === id)) continue;
      const def = ARSENAL[id];
      list.push({ id: `arms-${id}`, name: `새 무기: ${def.name}`, desc: def.desc, icon: def.icon, apply: () => levelUpArms(owned, id) });
    }
  }
  return list;
}

/** 진화 카드는 반드시 맨 앞에, 나머지는 섞어서 n장 (새 무기는 많아야 1장) */
export function pickOffers(all: ChoiceDef[], n: number): ChoiceDef[] {
  const evo = all.filter((c) => c.special === 'evo');
  const rest = all.filter((c) => c.special !== 'evo').sort(() => Math.random() - 0.5);
  const out: ChoiceDef[] = [...evo];
  let fresh = 0;
  for (const c of rest) {
    if (out.length >= n) break;
    if (c.name.startsWith('새 무기') && fresh++ >= 1) continue;
    out.push(c);
  }
  return out;
}

export function levelUpArms(owned: Owned[], id: ArmsId): void {
  const o = owned.find((x) => x.id === id);
  if (o) o.level = Math.min(MAX_LEVEL, o.level + 1);
  // 새 무기는 빈 손이 있을 때만, 바로 손에 든다
  else if (owned.length < MAX_SLOTS) owned.unshift({ id, level: 1 });
}
