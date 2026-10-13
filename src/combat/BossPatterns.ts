import Phaser from 'phaser';
import { HD } from '../art/hd/register';
import type { HitFx } from '../fx/HitFx';

/** 바닥은 살짝 눕혀 보이므로 원형 범위는 세로를 줄인 타원으로 */
const FLAT = 0.62;

export type PatternId =
  | 'slam' | 'dash3' | 'sweep' | 'burst' | 'spiral' | 'aimed' | 'fan'
  | 'echoRing' | 'boulder'
  | 'waterCannon' | 'puddle'
  | 'featherStorm' | 'teleport'
  | 'club3' | 'quake';

export const PATTERNS: { id: PatternId; name: string; kind: '공통' | '고유' }[] = [
  { id: 'slam', name: '점프 내려찍기', kind: '공통' },
  { id: 'dash3', name: '연속 돌진', kind: '공통' },
  { id: 'sweep', name: '휩쓸기', kind: '공통' },
  { id: 'burst', name: '장판 폭발', kind: '공통' },
  { id: 'spiral', name: '탄막 · 나선', kind: '공통' },
  { id: 'aimed', name: '탄막 · 조준', kind: '공통' },
  { id: 'fan', name: '탄막 · 부채꼴', kind: '공통' },
  { id: 'echoRing', name: '메아리 고리', kind: '고유' },
  { id: 'boulder', name: '바위 던지기', kind: '고유' },
  { id: 'waterCannon', name: '물대포', kind: '고유' },
  { id: 'puddle', name: '물웅덩이', kind: '고유' },
  { id: 'featherStorm', name: '깃털 회오리', kind: '고유' },
  { id: 'teleport', name: '순간이동', kind: '고유' },
  { id: 'club3', name: '쇠몽둥이 3연타', kind: '고유' },
  { id: 'quake', name: '땅 갈라짐', kind: '고유' },
];

/** 패턴이 장면과 주고받는 것 */
export interface BossCtx {
  scene: Phaser.Scene;
  fx: HitFx;
  boss: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  player: Phaser.GameObjects.Sprite;
  /** 보스가 설 수 있는 범위 */
  bounds: { x: number; y: number; w: number; h: number };
  /** 언령사에게 피해 (무적 시간은 장면이 처리) */
  hurt: (dmg: number, fromX: number, fromY: number) => void;
  /** 잠시 머무는 장애물 (떨어진 바위) */
  addObstacle: (x: number, y: number, rx: number, ry: number, ms: number) => void;
  /** 탄 텍스처 (없으면 메아리 탄) */
  bullet?: string;
}

/** 바닥에 잠시 남는 위험 지대 (물웅덩이 · 회오리) */
interface Zone {
  g: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  /** 초당 이동 (회오리는 언령사를 쫓는다) */
  chase: number;
  kind: 'water' | 'wind';
  dmg: number;
  tick: number;
}

interface Bullet {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
}

interface Ring {
  g: Phaser.GameObjects.Graphics;
  cx: number;
  cy: number;
  r: number;
  gapAt: number;
  gapHalf: number;
  hit: boolean;
}

/**
 * 보스 피지컬 패턴 모음. 모든 공격은
 * ① 붉은 예고 범위가 차오르고 → ② 그 순간 범위 안이면 피해 → ③ 연출.
 */
export class BossPatterns {
  private bullets: Bullet[] = [];
  private rings: Ring[] = [];
  private zones: Zone[] = [];
  /** 지금 패턴을 쓰는 중 */
  busy = false;

  constructor(private readonly c: BossCtx) {}

  private wait(ms: number): Promise<void> {
    return new Promise((res) => this.c.scene.time.delayedCall(ms, res));
  }

  /** 언령사 몸통 위치 */
  private get pp(): { x: number; y: number } {
    return { x: this.c.player.x, y: this.c.player.y - 8 };
  }

  private get core(): { x: number; y: number } {
    return { x: this.c.boss.x, y: this.c.boss.y - 40 };
  }

  private clampToArena(x: number, y: number): [number, number] {
    const b = this.c.bounds;
    return [Phaser.Math.Clamp(x, b.x + 50, b.x + b.w - 50), Phaser.Math.Clamp(y, b.y + 70, b.y + b.h - 20)];
  }

  async run(id: PatternId): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this[id]();
    } finally {
      this.busy = false;
      this.c.boss.setFrame(0);
    }
  }

  // ── 예고 그리기 ──────────────────────────────────────

  /** 테두리가 깜빡이고 안쪽이 차오르는 붉은 예고. draw(g, 진행도 0~1) */
  private telegraph(ms: number, draw: (g: Phaser.GameObjects.Graphics, p: number) => void): Promise<void> {
    const g = this.c.scene.add.graphics().setDepth(5);
    const st = { p: 0 };
    return new Promise((res) => {
      this.c.scene.tweens.add({
        targets: st,
        p: 1,
        duration: ms,
        onUpdate: () => {
          g.clear();
          draw(g, st.p);
        },
        onComplete: () => {
          g.destroy();
          res();
        },
      });
    });
  }

  private circleWarn(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, p: number): void {
    const blink = 0.55 + Math.sin(p * 30) * 0.25;
    g.fillStyle(0xd8432e, 0.16).fillEllipse(x, y, r * 2, r * 2 * FLAT);
    g.fillStyle(0xd8432e, 0.34).fillEllipse(x, y, r * 2 * p, r * 2 * FLAT * p);
    g.lineStyle(2, 0xff8a7a, blink).strokeEllipse(x, y, r * 2, r * 2 * FLAT);
  }

  private inCircle(x: number, y: number, cx: number, cy: number, r: number): boolean {
    const dx = (x - cx) / r;
    const dy = (y - cy) / (r * FLAT);
    return dx * dx + dy * dy <= 1;
  }

  /** 착지·폭발 충격파 */
  private shockwave(x: number, y: number, r: number, color = 0xfffaf0): void {
    const g = this.c.scene.add.graphics().setDepth(6);
    const st = { r: r * 0.3, a: 1 };
    this.c.scene.tweens.add({
      targets: st,
      r: r * 1.15,
      a: 0,
      duration: 320,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        g.clear();
        g.lineStyle(4, color, st.a).strokeEllipse(x, y, st.r * 2, st.r * 2 * FLAT);
        g.lineStyle(2, 0xd8432e, st.a * 0.7).strokeEllipse(x, y, st.r * 1.7, st.r * 1.7 * FLAT);
      },
      onComplete: () => g.destroy(),
    });
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      this.c.fx.dust(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6 * FLAT, -Math.cos(a), -Math.sin(a), 1, i % 2 ? 'w' : 'y');
    }
  }

  // ── ① 점프 내려찍기 ───────────────────────────────────

  private async slam(): Promise<void> {
    const b = this.c.boss;
    const [tx, ty] = this.clampToArena(this.c.player.x, this.c.player.y);
    const sx = b.x;
    const sy = b.y;
    b.setFrame(2);
    await this.tween(b, { scaleY: 0.8, scaleX: 1.12 }, 220);
    // 공중: 그림자와 예고가 착지점에서 기다린다
    const lift = { t: 0 };
    const air = 900;
    const flight = this.tweenP(lift, { t: 1 }, air, 'Sine.easeInOut', () => {
      const t = lift.t;
      const gx = sx + (tx - sx) * t;
      const gy = sy + (ty - sy) * t;
      b.setPosition(gx, gy - Math.sin(t * Math.PI) * 120);
      b.setScale(1, 1);
      this.c.shadow.setPosition(gx, gy).setScale(0.6 + 0.4 * Math.abs(Math.cos(t * Math.PI)));
    });
    await Promise.all([flight, this.telegraph(air, (g, p) => this.circleWarn(g, tx, ty, 74, p))]);
    b.setPosition(tx, ty);
    this.c.shadow.setPosition(tx, ty).setScale(1);
    this.c.scene.cameras.main.shake(220, 0.012);
    this.shockwave(tx, ty, 74);
    this.c.fx.hitStop(60);
    if (this.inCircle(this.pp.x, this.c.player.y, tx, ty, 74)) this.c.hurt(22, tx, ty);
    b.setFrame(0);
    await this.tween(b, { scaleY: 0.85, scaleX: 1.1 }, 90, true);
    await this.wait(350);
  }

  // ── ② 연속 돌진 (3회) ─────────────────────────────────

  private async dash3(): Promise<void> {
    const b = this.c.boss;
    for (let i = 0; i < 3; i++) {
      const a = Phaser.Math.Angle.Between(b.x, b.y, this.c.player.x, this.c.player.y);
      const len = 280;
      const w = 40;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const nx = -sin * (w / 2);
      const ny = cos * (w / 2) * FLAT;
      await this.telegraph(i === 0 ? 520 : 380, (g, p) => {
        const pts = (l: number) => [
          new Phaser.Math.Vector2(b.x + nx, b.y + ny),
          new Phaser.Math.Vector2(b.x + cos * l + nx, b.y + sin * l * FLAT + ny),
          new Phaser.Math.Vector2(b.x + cos * l - nx, b.y + sin * l * FLAT - ny),
          new Phaser.Math.Vector2(b.x - nx, b.y - ny),
        ];
        g.fillStyle(0xd8432e, 0.16).fillPoints(pts(len), true);
        g.fillStyle(0xd8432e, 0.34).fillPoints(pts(len * p), true);
        g.lineStyle(2, 0xff8a7a, 0.6 + Math.sin(p * 30) * 0.25).strokePoints(pts(len), true);
      });
      // 돌진
      const [ex, ey] = this.clampToArena(b.x + cos * len, b.y + sin * len * FLAT);
      let hitDone = false;
      await this.tweenP(b, { x: ex, y: ey }, 260, 'Cubic.easeIn', () => {
        this.c.shadow.setPosition(b.x, b.y);
        this.c.fx.dust(b.x, b.y, cos, sin, 1, 'y');
        if (!hitDone && Phaser.Math.Distance.Between(b.x, b.y - 20, this.pp.x, this.pp.y) < 34) {
          hitDone = true;
          this.c.hurt(18, b.x, b.y);
        }
      });
      this.c.scene.cameras.main.shake(90, 0.005);
      await this.wait(160);
    }
    await this.wait(300);
  }

  // ── ③ 휩쓸기 (부채꼴) ─────────────────────────────────

  private async sweep(): Promise<void> {
    const b = this.c.boss;
    const a0 = Phaser.Math.Angle.Between(b.x, b.y - 20, this.pp.x, this.pp.y);
    const half = Phaser.Math.DegToRad(65);
    const R = 120;
    const cx = b.x;
    const cy = b.y - 12;
    const sector = (r: number) => {
      const pts = [new Phaser.Math.Vector2(cx, cy)];
      for (let i = 0; i <= 16; i++) {
        const a = a0 - half + (half * 2 * i) / 16;
        pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r * FLAT));
      }
      return pts;
    };
    b.setFrame(2);
    b.setFlipX(Math.cos(a0) < 0);
    await this.telegraph(720, (g, p) => {
      g.fillStyle(0xd8432e, 0.16).fillPoints(sector(R), true);
      g.fillStyle(0xd8432e, 0.34).fillPoints(sector(R * p), true);
      g.lineStyle(2, 0xff8a7a, 0.6 + Math.sin(p * 30) * 0.25).strokePoints(sector(R), true);
    });
    b.setFrame(0);
    // 판정
    const dx = this.pp.x - cx;
    const dy = (this.pp.y - cy) / FLAT;
    const d = Math.hypot(dx, dy);
    const diff = Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - a0);
    if (d < R && Math.abs(diff) < half) this.c.hurt(20, cx, cy);
    // 하얀 초승달 궤적
    const g = this.c.scene.add.graphics().setDepth(6);
    const st = { t: 0 };
    this.c.scene.tweens.add({
      targets: st,
      t: 1,
      duration: 220,
      onUpdate: () => {
        g.clear();
        const end = a0 - half + half * 2 * st.t;
        g.lineStyle(7, 0xfffaf0, 1 - st.t * 0.6);
        g.beginPath();
        for (let i = 0; i <= 12; i++) {
          const a = a0 - half + ((end - (a0 - half)) * i) / 12;
          const x = cx + Math.cos(a) * R * 0.85;
          const y = cy + Math.sin(a) * R * 0.85 * FLAT;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.strokePath();
      },
      onComplete: () => g.destroy(),
    });
    this.c.scene.cameras.main.shake(120, 0.006);
    await this.wait(450);
  }

  // ── ④ 장판 폭발 ──────────────────────────────────────

  private async burst(): Promise<void> {
    const spots: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      const [x, y] = this.clampToArena(
        this.c.player.x + (i === 0 ? 0 : Phaser.Math.Between(-90, 90)),
        this.c.player.y + (i === 0 ? 0 : Phaser.Math.Between(-60, 60)),
      );
      spots.push(
        this.telegraph(820, (g, p) => this.circleWarn(g, x, y, 42, p)).then(() => {
          this.shockwave(x, y, 42, 0xf0b84a);
          if (this.inCircle(this.pp.x, this.c.player.y, x, y, 42)) this.c.hurt(16, x, y);
        }),
      );
      await this.wait(240);
    }
    await Promise.all(spots);
    await this.wait(300);
  }

  // ── ⑤ 탄막 3종 ──────────────────────────────────────

  private shoot(angle: number, speed: number): void {
    const { x, y } = this.core;
    const img = this.c.scene.add.image(x, y, this.c.bullet ?? HD.echo).setDepth(4600);
    if (this.c.bullet) img.setRotation(angle + Math.PI / 2);
    this.bullets.push({ img, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 6000 });
  }

  private async spiral(): Promise<void> {
    this.c.boss.setFrame(1);
    let a = Math.random() * Math.PI * 2;
    for (let i = 0; i < 28; i++) {
      this.shoot(a, 115);
      this.shoot(a + Math.PI, 115);
      a += 0.42;
      await this.wait(85);
    }
    await this.wait(400);
  }

  private async aimed(): Promise<void> {
    this.c.boss.setFrame(1);
    for (let v = 0; v < 3; v++) {
      const a = Phaser.Math.Angle.Between(this.core.x, this.core.y, this.pp.x, this.pp.y);
      for (const s of [-0.13, 0, 0.13]) this.shoot(a + s, 175);
      await this.wait(380);
    }
    await this.wait(300);
  }

  private async fan(): Promise<void> {
    this.c.boss.setFrame(1);
    for (let w = 0; w < 2; w++) {
      const a = Phaser.Math.Angle.Between(this.core.x, this.core.y, this.pp.x, this.pp.y);
      const spread = Phaser.Math.DegToRad(100);
      for (let i = 0; i < 9; i++) this.shoot(a - spread / 2 + (spread * i) / 8 + (w ? spread / 16 : 0), 135);
      await this.wait(520);
    }
    await this.wait(300);
  }

  // ── 고유기 ① 메아리 고리: 틈이 있는 고리가 퍼진다 ───────────

  private async echoRing(): Promise<void> {
    const b = this.c.boss;
    b.setFrame(1);
    for (let i = 0; i < 3; i++) {
      this.c.scene.cameras.main.shake(100, 0.004);
      const g = this.c.scene.add.graphics().setDepth(6);
      this.rings.push({ g, cx: b.x, cy: b.y - 10, r: 20, gapAt: Math.random() * Math.PI * 2, gapHalf: Phaser.Math.DegToRad(26), hit: false });
      await this.wait(650);
    }
    await this.wait(900);
  }

  // ── 고유기 ② 바위 던지기: 떨어진 바위는 잠시 길을 막는다 ──────

  private async boulder(): Promise<void> {
    const b = this.c.boss;
    b.setFrame(2);
    const throws: Promise<void>[] = [];
    for (let i = 0; i < 3; i++) {
      const [x, y] = this.clampToArena(this.c.player.x + Phaser.Math.Between(-70, 70), this.c.player.y + Phaser.Math.Between(-40, 40));
      const rock = this.c.scene.add.image(this.core.x, this.core.y - 20, HD.boulder).setDepth(4700);
      const fly = { t: 0 };
      const sx = rock.x;
      const sy = rock.y;
      throws.push(
        Promise.all([
          this.telegraph(900, (g, p) => this.circleWarn(g, x, y, 30, p)),
          this.tweenP(fly, { t: 1 }, 900, 'Linear', () => {
            rock.setPosition(sx + (x - sx) * fly.t, sy + (y - 10 - sy) * fly.t - Math.sin(fly.t * Math.PI) * 140);
            rock.setRotation(fly.t * 6);
          }),
        ]).then(() => {
          rock.setRotation(0).setPosition(x, y).setOrigin(0.5, 0.9).setDepth(y);
          this.shockwave(x, y, 30, 0xa3a1b5);
          this.c.scene.cameras.main.shake(110, 0.006);
          if (this.inCircle(this.pp.x, this.c.player.y, x, y, 30)) this.c.hurt(18, x, y);
          this.c.addObstacle(x, y - 4, 12, 6, 5000);
          this.c.scene.time.delayedCall(5000, () => this.c.scene.tweens.add({ targets: rock, alpha: 0, duration: 300, onComplete: () => rock.destroy() }));
        }),
      );
      await this.wait(300);
    }
    b.setFrame(0);
    await Promise.all(throws);
    await this.wait(300);
  }

  // ── 공용: 띠 모양 예고 (물대포 · 갈라짐) ───────────────

  private band(x: number, y: number, a: number, len: number, w: number): Phaser.Math.Vector2[] {
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const nx = -sin * (w / 2);
    const ny = cos * (w / 2) * FLAT;
    return [
      new Phaser.Math.Vector2(x + nx, y + ny),
      new Phaser.Math.Vector2(x + cos * len + nx, y + sin * len * FLAT + ny),
      new Phaser.Math.Vector2(x + cos * len - nx, y + sin * len * FLAT - ny),
      new Phaser.Math.Vector2(x - nx, y - ny),
    ];
  }

  private inBand(px: number, py: number, x: number, y: number, a: number, len: number, w: number): boolean {
    const dx = px - x;
    const dy = (py - y) / FLAT;
    const along = dx * Math.cos(a) + dy * Math.sin(a);
    const across = -dx * Math.sin(a) + dy * Math.cos(a);
    return along > -8 && along < len && Math.abs(across) < w / 2;
  }

  private bandWarn(x: number, y: number, a: number, len: number, w: number, ms: number): Promise<void> {
    return this.telegraph(ms, (g, p) => {
      g.fillStyle(0xd8432e, 0.16).fillPoints(this.band(x, y, a, len, w), true);
      g.fillStyle(0xd8432e, 0.34).fillPoints(this.band(x, y, a, len * p, w), true);
      g.lineStyle(2, 0xff8a7a, 0.6 + Math.sin(p * 30) * 0.25).strokePoints(this.band(x, y, a, len, w), true);
    });
  }

  /** 띠가 번쩍 (색 · 굵기) */
  private bandFlash(x: number, y: number, a: number, len: number, w: number, color: number, ms = 260): void {
    const g = this.c.scene.add.graphics().setDepth(6);
    const st = { t: 0 };
    this.c.scene.tweens.add({
      targets: st,
      t: 1,
      duration: ms,
      onUpdate: () => {
        g.clear();
        g.fillStyle(color, 0.85 * (1 - st.t)).fillPoints(this.band(x, y, a, len, w * (1 - st.t * 0.5)), true);
        g.fillStyle(0xffffff, 0.7 * (1 - st.t)).fillPoints(this.band(x, y, a, len, w * 0.3), true);
      },
      onComplete: () => g.destroy(),
    });
  }

  private addZone(kind: Zone['kind'], x: number, y: number, r: number, ms: number, chase = 0, dmg = 6): void {
    const g = this.c.scene.add.graphics().setDepth(4);
    this.zones.push({ g, x, y, r, life: ms, max: ms, chase, kind, dmg, tick: 0 });
  }

  // ── 갓파 ① 물대포: 조준한 물줄기 세 번 ─────────────────

  private async waterCannon(): Promise<void> {
    const b = this.c.boss;
    for (let i = 0; i < 3; i++) {
      b.setFrame(2);
      const x = b.x;
      const y = b.y - 16;
      const a = Math.atan2((this.pp.y - y) / FLAT, this.pp.x - x);
      b.setFlipX(Math.cos(a) < 0);
      await this.bandWarn(x, y, a, 560, 34, i === 0 ? 700 : 480);
      b.setFrame(1);
      this.bandFlash(x, y, a, 560, 34, 0x5aaee8, 320);
      this.c.scene.cameras.main.shake(90, 0.005);
      if (this.inBand(this.pp.x, this.pp.y, x, y, a, 560, 34)) this.c.hurt(20, x, y);
      for (let k = 0; k < 6; k++) {
        const l = 60 + k * 80;
        this.c.fx.dust(x + Math.cos(a) * l, y + Math.sin(a) * l * FLAT, Math.cos(a), Math.sin(a), 1, 'w');
      }
      await this.wait(220);
    }
    await this.wait(300);
  }

  // ── 갓파 ② 물웅덩이: 던진 물방울이 웅덩이로 남는다 ────────

  private async puddle(): Promise<void> {
    const b = this.c.boss;
    b.setFrame(2);
    const drops: Promise<void>[] = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = this.clampToArena(
        this.c.player.x + (i === 0 ? 0 : Phaser.Math.Between(-130, 130)),
        this.c.player.y + (i === 0 ? 0 : Phaser.Math.Between(-80, 80)),
      );
      const drop = this.c.scene.add.image(this.core.x, this.core.y, this.c.bullet ?? HD.echo).setScale(2.2).setDepth(4700);
      const sx = drop.x;
      const sy = drop.y;
      const fly = { t: 0 };
      drops.push(
        Promise.all([
          this.telegraph(800, (g, p) => this.circleWarn(g, x, y, 46, p)),
          this.tweenP(fly, { t: 1 }, 800, 'Linear', () => {
            drop.setPosition(sx + (x - sx) * fly.t, sy + (y - sy) * fly.t - Math.sin(fly.t * Math.PI) * 120);
          }),
        ]).then(() => {
          drop.destroy();
          this.shockwave(x, y, 46, 0x9ed8ff);
          if (this.inCircle(this.pp.x, this.c.player.y, x, y, 46)) this.c.hurt(14, x, y);
          this.addZone('water', x, y, 46, 5200);
        }),
      );
      await this.wait(220);
    }
    b.setFrame(0);
    await Promise.all(drops);
    await this.wait(400);
  }

  // ── 텐구 ① 깃털 회오리: 쫓아오는 회오리 + 깃털 고리 ───────

  private async featherStorm(): Promise<void> {
    const b = this.c.boss;
    b.setFrame(2);
    await this.tween(b, { y: b.y - 14 }, 200, true);
    for (let i = 0; i < 2; i++) {
      const a = Phaser.Math.Angle.Between(b.x, b.y, this.c.player.x, this.c.player.y) + (i ? 0.9 : -0.9);
      const [x, y] = this.clampToArena(b.x + Math.cos(a) * 90, b.y + Math.sin(a) * 60);
      this.addZone('wind', x, y, 30, 4200, 62, 12);
    }
    b.setFrame(1);
    for (let w = 0; w < 3; w++) {
      const off = w * 0.2 + Math.random() * 0.3;
      for (let i = 0; i < 14; i++) this.shoot(off + (Math.PI * 2 * i) / 14, 120);
      await this.wait(560);
    }
    await this.wait(600);
  }

  // ── 텐구 ② 순간이동: 언령사 곁에 나타나 부채로 휩쓴다 ──────

  private async teleport(): Promise<void> {
    const b = this.c.boss;
    for (let i = 0; i < 2; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const [tx, ty] = this.clampToArena(this.c.player.x + side * 80, this.c.player.y + Phaser.Math.Between(-20, 20));
      // 깃털이 흩날리며 사라짐
      for (let k = 0; k < 8; k++) this.c.fx.dust(b.x, b.y - 30, Math.cos(k), Math.sin(k), 1, 'w');
      await this.tween(b, { alpha: 0, scaleX: 0.4 }, 160);
      this.c.shadow.setVisible(false);
      await this.telegraph(420, (g, p) => this.circleWarn(g, tx, ty, 26, p));
      b.setPosition(tx, ty).setScale(1);
      this.c.shadow.setPosition(tx, ty).setVisible(true);
      await this.tween(b, { alpha: 1 }, 120);
      await this.sweep();
    }
  }

  // ── 오니 ① 쇠몽둥이 3연타: 앞으로 걸어 나오며 내려친다 ──────

  private async club3(): Promise<void> {
    const b = this.c.boss;
    for (let i = 0; i < 3; i++) {
      const a = Phaser.Math.Angle.Between(b.x, b.y, this.c.player.x, this.c.player.y);
      b.setFlipX(Math.cos(a) < 0);
      const [tx, ty] = this.clampToArena(b.x + Math.cos(a) * 70, b.y + Math.sin(a) * 70 * FLAT);
      const R = i === 2 ? 68 : 50;
      b.setFrame(2);
      await this.telegraph(i === 0 ? 620 : 420, (g, p) => this.circleWarn(g, tx, ty, R, p));
      b.setFrame(1);
      await this.tweenP(b, { x: b.x + (tx - b.x) * 0.45, y: b.y + (ty - b.y) * 0.45 }, 90, 'Cubic.easeIn', () => {
        this.c.shadow.setPosition(b.x, b.y);
      });
      this.c.scene.cameras.main.shake(i === 2 ? 260 : 140, i === 2 ? 0.014 : 0.008);
      this.shockwave(tx, ty, R, 0xf0b84a);
      this.c.fx.hitStop(i === 2 ? 70 : 40);
      if (this.inCircle(this.pp.x, this.c.player.y, tx, ty, R)) this.c.hurt(i === 2 ? 26 : 18, tx, ty);
      await this.wait(160);
    }
    await this.wait(380);
  }

  // ── 오니 ② 땅 갈라짐: 땅을 내리쳐 사방으로 금이 간다 ───────

  private async quake(): Promise<void> {
    const b = this.c.boss;
    const base = Math.atan2((this.c.player.y - b.y) / FLAT, this.c.player.x - b.x);
    const dirs = [0, 1, 2, 3, 4].map((k) => base + (k * Math.PI * 2) / 5);
    b.setFrame(2);
    await this.tween(b, { scaleY: 0.85, scaleX: 1.1 }, 200);
    await Promise.all(dirs.map((a) => this.bandWarn(b.x, b.y, a, 460, 30, 900)));
    b.setFrame(1).setScale(1);
    this.c.scene.cameras.main.shake(320, 0.016);
    this.c.fx.hitStop(70);
    this.shockwave(b.x, b.y, 60, 0xf0b84a);
    let hit = false;
    for (const a of dirs) {
      this.bandFlash(b.x, b.y, a, 460, 30, 0xf06a3a, 420);
      if (!hit && this.inBand(this.pp.x, this.c.player.y, b.x, b.y, a, 460, 30)) {
        hit = true;
        this.c.hurt(24, b.x, b.y);
      }
    }
    // 금 사이로 불씨가 튄다
    for (let i = 0; i < 10; i++) this.shoot(base + Math.PI / 5 + (Math.PI * 2 * i) / 10, 100);
    await this.wait(700);
  }

  // ── 매 프레임: 탄 · 고리 ──────────────────────────────

  update(dt: number): void {
    const sec = dt / 1000;
    const { x: px, y: py } = this.pp;
    for (const bl of this.bullets) {
      bl.img.x += bl.vx * sec;
      bl.img.y += bl.vy * sec;
      bl.life -= dt;
      if (bl.life > 0 && Phaser.Math.Distance.Between(bl.img.x, bl.img.y, px, py) < 9) {
        bl.life = 0;
        this.c.hurt(9, bl.img.x, bl.img.y);
      }
      const bd = this.c.bounds;
      if (bl.img.x < bd.x - 20 || bl.img.y < bd.y - 20 || bl.img.x > bd.x + bd.w + 20 || bl.img.y > bd.y + bd.h + 20) bl.life = 0;
    }
    this.bullets = this.bullets.filter((bl) => {
      if (bl.life > 0) return true;
      bl.img.destroy();
      return false;
    });

    for (const ring of this.rings) {
      ring.r += 125 * sec;
      const g = ring.g;
      g.clear();
      // 고리 (틈 부분은 금색 점선으로 안전 표시)
      const steps = 72;
      for (let i = 0; i < steps; i++) {
        const a = (Math.PI * 2 * i) / steps;
        const inGap = Math.abs(Phaser.Math.Angle.Wrap(a - ring.gapAt)) < ring.gapHalf;
        const x = ring.cx + Math.cos(a) * ring.r;
        const y = ring.cy + Math.sin(a) * ring.r * FLAT;
        if (inGap) {
          if (i % 2 === 0) g.fillStyle(0xf0b84a, 0.8).fillRect(x - 1, y - 1, 2, 2);
        } else {
          g.fillStyle(0xc9b8f0, 0.95).fillRect(x - 2, y - 2, 4, 4);
          g.fillStyle(0x7a62b8, 0.9).fillRect(x - 1, y - 1, 2, 2);
        }
      }
      // 판정: 고리 두께 안 + 틈이 아닌 각도
      const dx = px - ring.cx;
      const dy = (py - ring.cy) / FLAT;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const inGap = Math.abs(Phaser.Math.Angle.Wrap(a - ring.gapAt)) < ring.gapHalf;
      if (!ring.hit && Math.abs(d - ring.r) < 6 && !inGap) {
        ring.hit = true;
        this.c.hurt(14, ring.cx, ring.cy);
      }
    }
    this.rings = this.rings.filter((ring) => {
      if (ring.r < 900) return true;
      ring.g.destroy();
      return false;
    });

    for (const z of this.zones) {
      z.life -= dt;
      z.tick -= dt;
      if (z.chase > 0) {
        const a = Math.atan2(this.c.player.y - z.y, this.c.player.x - z.x);
        z.x += Math.cos(a) * z.chase * sec;
        z.y += Math.sin(a) * z.chase * sec;
      }
      const fade = Math.max(0, Math.min(1, z.life / 400, (z.max - z.life) / 200));
      const g = z.g;
      g.clear();
      if (z.kind === 'water') {
        g.fillStyle(0x3f7fd0, 0.55 * fade).fillEllipse(z.x, z.y, z.r * 2, z.r * 2 * FLAT);
        g.lineStyle(2, 0x9ed8ff, 0.8 * fade).strokeEllipse(z.x, z.y, z.r * 2, z.r * 2 * FLAT);
        const w = ((z.max - z.life) / 900) % 1;
        g.lineStyle(1, 0xd4f2ff, 0.6 * fade).strokeEllipse(z.x, z.y, z.r * (0.4 + w * 1.4), z.r * (0.4 + w * 1.4) * FLAT);
      } else {
        const t = (z.max - z.life) / 1000;
        g.fillStyle(0xd8d0e8, 0.25 * fade).fillEllipse(z.x, z.y, z.r * 2, z.r * 2 * FLAT);
        for (let i = 0; i < 3; i++) {
          const rr = z.r * (1 - i * 0.28);
          g.lineStyle(3 - i, 0xfffaf0, 0.75 * fade);
          g.beginPath();
          g.arc(z.x, z.y - 10 - i * 12, rr, t * 9 + i, t * 9 + i + 4.2, false);
          g.strokePath();
        }
      }
      if (z.tick <= 0 && z.life > 200 && this.inCircle(px, this.c.player.y, z.x, z.y, z.r)) {
        z.tick = 600;
        this.c.hurt(z.dmg, z.x, z.y);
      }
    }
    this.zones = this.zones.filter((z) => {
      if (z.life > 0) return true;
      z.g.destroy();
      return false;
    });
  }

  /** 장면이 끝날 때 남은 탄 · 고리 · 지대 정리 */
  clear(): void {
    for (const bl of this.bullets) bl.img.destroy();
    for (const r of this.rings) r.g.destroy();
    for (const z of this.zones) z.g.destroy();
    this.bullets = [];
    this.rings = [];
    this.zones = [];
  }

  /** 트윈을 Promise로 */
  private tweenP(target: object, props: object, duration: number, ease = 'Linear', onUpdate?: () => void): Promise<void> {
    return new Promise((res) => this.c.scene.tweens.add({ targets: target, ...props, duration, ease, onUpdate, onComplete: () => res() }));
  }

  /** 찌그러뜨렸다(옵션: 되돌리기) */
  private tween(target: Phaser.GameObjects.Sprite, props: object, duration: number, yoyo = false): Promise<void> {
    return new Promise((res) => this.c.scene.tweens.add({ targets: target, ...props, duration, yoyo, onComplete: () => res() }));
  }
}
