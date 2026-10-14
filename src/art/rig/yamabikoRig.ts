import Phaser from 'phaser';
import { Fine, bayer } from '../fine/fine';
import { BossRig, RigPose, ell, ramp, stroke, registerGlow, approach } from './BossRig';

/**
 * ⛰️ 야마비코 리그 — 키 약 160px. 산의 정령: 덥수룩한 회갈색 털 · 어깨의 눈 · 허리의 금줄(시메나와)과 종이 시데 ·
 * 둥근 귀 · 창백한 얼굴 · 금빛 눈 · 커다란 입 · 긴 팔과 큰 손.
 * 외침(두 손을 입에 모으고 메아리 고리) · 공격(두 주먹으로 땅 치기) · 발악(털이 곤두서고 눈이 타오름)
 */
/** 차가운 잿빛 털 (안개 낀 산) — 갈색 가닥 · 이끼가 섞인다 */
const FUR = '%&*+';

/** 털 덩어리: 타원을 칠하고 아래로 흘러내리는 털 가닥을 얹는다 */
function furMass(f: Fine, cx: number, cy: number, rx: number, ry: number, bias = 0): void {
  ell(f, cx, cy, rx, ry, (nx, ny, x, y) => ramp(FUR, nx, ny, x, y, bias));
  for (let k = 0; k < Math.round(rx * ry * 0.08); k++) {
    const a = bayer(k, k * 3) * Math.PI * 2;
    const r = Math.sqrt((k * 0.618) % 1);
    const x0 = cx + Math.cos(a) * rx * r * 0.9;
    const y0 = cy + Math.sin(a) * ry * r * 0.9;
    const len = 5 + (k % 4) * 2;
    stroke(f, x0, y0, x0 + ((k % 3) - 1) * 1.5, y0 + len, 1.2, 0.5, (t) => (t > 0.6 ? '+' : k % 5 === 0 ? 'J' : x0 < cx - rx * 0.3 && y0 < cy ? '%' : '*'));
  }
  // 아래 가장자리는 털끝이 갈라져 늘어진다
  for (let x = Math.floor(cx - rx * 0.9); x <= cx + rx * 0.9; x += 3) {
    const by = cy + ry * Math.sqrt(1 - ((x - cx) / rx) ** 2);
    stroke(f, x, by - 3, x + 1, by + 4 + (x % 3), 1.6, 0.4, () => (x % 4 === 0 ? 'K' : '+'));
  }
}

// 몸 100×104 (발밑 = 50,104): 웅크린 털 몸 · 굵은 다리 · 금줄 · 시데 · 어깨의 눈
function bodyPart(): HTMLCanvasElement {
  const f = new Fine(102, 106);
  // 다리 · 발
  for (const lx of [30, 70]) {
    furMass(f, lx, 84, 13, 16, 0.06);
    ell(f, lx + (lx < 50 ? -3 : 3), 101, 13, 4, (nx, ny, x, y) => ramp('%&*+', nx, ny, x, y, 0.1));
  }
  // 몸통 (위가 넓은 털 덩어리)
  furMass(f, 50, 50, 44, 40, 0);
  // 가슴 쪽 밝은 털
  ell(f, 52, 46, 18, 20, (nx, ny, x, y) => (bayer(x, y) < 0.5 ? ramp('%%&*', nx, ny, x, y) : null));
  // 등 · 어깨의 이끼
  for (const [mx, my, mr] of [[16, 30, 7], [84, 34, 6], [34, 22, 5], [70, 60, 5]] as const) ell(f, mx, my, mr, mr * 0.7, (nx, ny, x, y) => (bayer(x, y) < 0.7 ? (nx + ny < 0 ? '6' : '7') : null));
  // 어깨에 쌓인 눈
  for (const sx of [22, 78]) ell(f, sx, 16, 14, 5, (nx, ny) => (ny > 0.4 ? 'V' : nx < 0 ? 'w' : 'W'));
  // 금줄 (꼬인 새끼줄)
  for (let x = 10; x <= 92; x++) {
    const y = 62 + Math.round(Math.sin(((x - 10) / 82) * Math.PI) * 6);
    for (let d = 0; d < 6; d++) f.set(x, y + d, ((x + d) >> 1) % 2 ? 'o' : d > 3 ? 'X' : 'O');
  }
  // 시데 (번개 모양 종이 넷)
  for (const sx of [26, 44, 60, 76]) {
    const sy = 68 + Math.round(Math.sin(((sx - 10) / 82) * Math.PI) * 6);
    let x = sx;
    let y = sy;
    for (let i = 0; i < 4; i++) {
      f.set(x, y, 'w').set(x + 1, y, 'W').set(x, y + 1, 'W').set(x + 1, y + 1, 'V').set(x, y + 2, 'W').set(x + 1, y + 2, 'V');
      x += i % 2 ? -2 : 2;
      y += 3;
    }
  }
  return f.canvas();
}

// 머리 78×72 (목 = 39,72): 둥근 귀 · 덥수룩한 머리 · 창백한 얼굴 · 금빛 눈 · 입
function head(open = false): HTMLCanvasElement {
  const f = new Fine(80, 74);
  const cx = 40;
  const cy = 40;
  // 귀
  for (const s of [-1, 1]) {
    ell(f, cx + s * 27, cy - 16, 9, 10, (nx, ny, x, y) => ramp(FUR, nx, ny, x, y));
    ell(f, cx + s * 27, cy - 15, 4.5, 5.5, () => 'J');
  }
  // 머리 털
  furMass(f, cx, cy - 2, 30, 28, -0.04);
  // 머리 위의 눈
  ell(f, cx - 4, cy - 26, 16, 5, (nx, ny) => (ny > 0.4 ? 'V' : nx < -0.2 ? 'w' : 'W'));
  // 얼굴 (창백한 가면 같은)
  ell(f, cx + 2, cy + 6, 19, 17, (nx, ny, x, y) => ramp('fFFg', nx, ny, x, y, -0.1));
  // 눈 (움푹 · 금빛)
  for (const ex of [cx - 7, cx + 11]) {
    ell(f, ex, cy + 1, 5.5, 4.5, () => 'x');
    ell(f, ex, cy + 1.5, 3, 2.5, (nx) => (nx < 0 ? 'y' : 'Y'));
    f.set(ex - 1, cy, 'h');
  }
  // 이마 주름 · 코
  for (let x = cx - 8; x <= cx + 12; x++) f.set(x, cy - 7 + ((x & 3) === 0 ? 1 : 0), 'g');
  f.set(cx + 2, cy + 8, 'O').set(cx + 4, cy + 8, 'O');
  // 입 (외칠 때 크게)
  if (open) ell(f, cx + 2, cy + 17, 9, 8, (nx, ny) => (Math.hypot(nx, ny) > 0.82 ? 'O' : ny > 0.4 ? 'q' : ny < -0.55 ? 'w' : 'x'));
  else f.stamp(['OOOOOOOOOO', '.O......O.'], cx - 3, cy + 15);
  return f.canvas();
}

// 긴 팔 70×92 (어깨 = 16,10): 털 팔 · 큰 손 (네 손가락)
function arm(): HTMLCanvasElement {
  const f = new Fine(72, 94);
  furMass(f, 18, 26, 13, 18, 0.02);
  furMass(f, 26, 56, 11, 18, 0.06);
  // 손 (회색 가죽 · 손가락)
  ell(f, 30, 78, 10, 8, (nx, ny, x, y) => ramp('IJKK', nx, ny, x, y, -0.1));
  for (let k = 0; k < 4; k++) stroke(f, 24 + k * 4, 82, 22 + k * 5, 91, 2, 1.3, (t) => (t > 0.75 ? 'X' : 'K'));
  return f.canvas();
}

const PARTS: Record<string, () => HTMLCanvasElement> = {
  'yr-body': bodyPart,
  'yr-head': () => head(false),
  'yr-head-open': () => head(true),
  'yr-arm': arm,
};

export function registerYamabikoRig(scene: Phaser.Scene): void {
  for (const [k, make] of Object.entries(PARTS)) if (!scene.textures.exists(k)) scene.textures.addCanvas(k, make());
  registerGlow(scene);
}

export class YamabikoRig extends BossRig {
  readonly tall = 158;
  private torso: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private armF: Phaser.GameObjects.Image;
  private armB: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Image[];
  private ringT = 0;
  private cur = { armF: 0.2, armB: 0.2, lean: 0, headR: 0, crouch: 0, bristle: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    registerYamabikoRig(scene);
    this.aura = this.glow('rig-glow').setPosition(0, -80).setScale(4, 4.4).setTint(0xb090ff);
    this.armB = this.part('yr-arm', 16 / 72, 10 / 94, 0xc0b8c8).setFlipX(true);
    this.torso = this.part('yr-body', 0.5, 1);
    this.head = this.part('yr-head', 40 / 80, 72 / 74);
    this.armF = this.part('yr-arm', 16 / 72, 10 / 94);
    this.eyes = [0, 1].map(() => this.glow('rig-glow').setScale(0.22).setTint(0xffd060));
  }

  protected onPose(p: RigPose): void {
    this.head.setTexture(p === 'shout' || p === 'rage' ? 'yr-head-open' : 'yr-head');
    if (p === 'shout') this.ringT = 0;
    if (p === 'attack') this.scene.time.delayedCall(120, () => this.active && this.slamDust());
  }

  /** 두 주먹으로 땅을 친 자리 */
  private slamDust(): void {
    this.scene.cameras.main.shake(160, 0.007);
    for (let i = 0; i < 14; i++) {
      const d = this.scene.add.circle(this.x + Phaser.Math.Between(-60, 60), this.y - Phaser.Math.Between(0, 8), Phaser.Math.Between(3, 6), 0xd8d0c0, 0.8).setDepth(this.depth + 1);
      this.scene.tweens.add({ targets: d, y: d.y - Phaser.Math.Between(10, 40), alpha: 0, scale: 2.2, duration: 650, onComplete: () => d.destroy() });
    }
  }

  /** 입에서 퍼지는 메아리 고리 */
  private echoRing(): void {
    const dir = this.flipX ? -1 : 1;
    const c = this.scene.add.circle(this.x + dir * 6, this.y - 104, 8).setStrokeStyle(2, 0xd8c8ff, 0.9).setFillStyle(0, 0).setDepth(this.depth + 1);
    this.scene.tweens.add({ targets: c, radius: 60, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => c.destroy() });
  }

  protected animate(dt: number): void {
    const t = this.t;
    const k = this.poseT;
    const breath = Math.sin(t / 700);
    // 팔 각도는 절대값: 0 = 아래, +는 몸 안쪽(앞팔) · −는 몸 안쪽(뒷팔)
    let armF = 0.2 + Math.sin(t / 1000) * 0.08;
    let armB = -0.2 - Math.sin(t / 1100 + 1) * 0.08;
    let lean = Math.sin(t / 1400) * 0.02;
    let headR = Math.sin(t / 1200) * 0.04;
    let crouch = 0;
    let bristle = 0;
    switch (this.pose) {
      case 'windup':
        armF = 3.0;
        armB = -3.0;
        crouch = 6;
        lean = -0.05;
        break;
      case 'attack': {
        const p = Math.min(1, k / 120);
        armF = 3.0 - p * 2.6;
        armB = -3.0 + p * 2.6;
        crouch = 6 + p * 6;
        lean = 0.1 * p;
        if (k > 650) this.setPose('idle');
        break;
      }
      case 'shout':
        // 두 팔을 활짝 벌리고 산이 울리도록 외친다
        armF = -2.0;
        armB = 2.0;
        headR = -0.1;
        lean = 0.04;
        this.ringT -= dt;
        if (this.ringT <= 0) {
          this.ringT = 260;
          this.echoRing();
        }
        if (k > 1200) this.setPose('idle');
        break;
      case 'hit':
        lean = -0.1 * Math.max(0, 1 - k / 260);
        if (k > 320) this.setPose('idle');
        break;
      case 'rage':
        armF = -2.0 + Math.sin(t / 90) * 0.12;
        armB = 2.0 - Math.sin(t / 100) * 0.12;
        headR = -0.08 + Math.sin(t / 60) * 0.03;
        bristle = 0.05 + Math.sin(t / 40) * 0.02;
        this.ringT -= dt;
        if (this.ringT <= 0) {
          this.ringT = 420;
          this.echoRing();
        }
        break;
    }
    const c = this.cur;
    const atk = this.pose === 'attack';
    c.armF = approach(c.armF, armF, atk ? 0.6 : 0.14);
    c.armB = approach(c.armB, armB, atk ? 0.6 : 0.14);
    c.lean = approach(c.lean, lean, 0.2);
    c.headR = approach(c.headR, headR, 0.12);
    c.crouch = approach(c.crouch, crouch, atk ? 0.6 : 0.15);
    c.bristle = approach(c.bristle, bristle, 0.2);
    const sq = 1 - c.crouch * 0.008;
    this.torso.setPosition(c.lean * 30, 0).setScale(1 + c.bristle + breath * 0.01, sq + c.bristle * 0.6 + breath * 0.015).setRotation(c.lean * 0.5);
    const shoulderY = -86 * sq - breath * 1.5;
    this.head.setPosition(4 + c.lean * 70, shoulderY + 4).setRotation(c.headR + c.lean * 0.5).setScale(1 + c.bristle);
    this.armF.setPosition(30 + c.lean * 50, shoulderY + 10).setRotation(c.armF);
    this.armB.setPosition(-30 + c.lean * 40, shoulderY + 10).setRotation(c.armB);
    this.eyes[0].setPosition(this.head.x - 6, this.head.y - 31);
    this.eyes[1].setPosition(this.head.x + 12, this.head.y - 31);
    const glowing = this.pose === 'rage' || this.pose === 'shout';
    this.eyes.forEach((e) => e.setAlpha(glowing ? 0.75 + Math.sin(t / 50) * 0.2 : 0.25));
    this.aura.setAlpha(this.pose === 'rage' ? 0.2 + Math.sin(t / 130) * 0.08 : Math.max(0, this.aura.alpha - dt / 600));
  }
}
