import Phaser from 'phaser';
import { Fine } from '../fine/fine';
import { BossRig, RigPose, ell, ramp, stroke, registerGlow, approach } from './BossRig';

/**
 * 👹 오니 리그 — 키 약 170px. 붉은 근육 · 금빛 뿔 · 검은 산발 · 송곳니 · 염주 · 호피 · 쇠몽둥이.
 * 대기(무거운 숨) · 예비(몽둥이를 머리 위로) · 공격(내리찍기) · 외침(포효 + 김) · 발악(뿔에 불)
 */

// 다리 + 호피 허리감개 78×62 (발밑 = 39,62)
function legs(): HTMLCanvasElement {
  const f = new Fine(80, 64);
  for (const [lx, flip] of [[22, -1], [56, 1]] as const) {
    // 허벅지 → 무릎 → 정강이
    ell(f, lx, 20, 12, 14, (nx, ny, x, y) => ramp('rRqQ', nx, ny, x, y, 0.02));
    ell(f, lx + flip * 1, 42, 9.5, 14, (nx, ny, x, y) => ramp('rRqQ', nx, ny, x, y, 0.04));
    for (let x = lx - 6; x <= lx + 6; x++) f.set(x, 32, 'q');
    // 맨발 (발가락)
    ell(f, lx + flip * 3, 58, 11, 4.6, (nx, ny, x, y) => ramp('rRqQ', nx, ny, x, y, 0.08));
    for (let k = 0; k < 4; k++) f.set(lx + flip * 3 - 6 + k * 4, 61, 'Q');
  }
  // 호피 허리감개 (노랑 + 검은 줄)
  for (let y = 0; y < 22; y++) {
    const half = 34 - Math.max(0, y - 14) * 2;
    for (let x = 40 - half; x <= 40 + half; x++) {
      if (y > 14 && (x - 40 + 99) % 11 > 7) continue;
      const stripe = Math.abs(((x * 0.9 + y * 1.4) % 13) - 6) < 1.4;
      f.set(x, y, stripe ? 'k' : ramp('yYzZ', (x - 40) / half, y / 22 - 0.5, x, y, 0.05));
    }
  }
  // 새끼줄 허리띠
  for (let x = 6; x <= 74; x++) f.set(x, 1, (x >> 1) % 2 ? 'o' : 'O').set(x, 2, (x >> 1) % 2 ? 'O' : 'X');
  return f.canvas();
}

// 몸통 90×68 (허리 = 45,68): 둥근 어깨 · 가슴 근육 · 복근 덩어리 · 큰 염주 — 근육마다 따로 둥글게 칠한다
function torso(): HTMLCanvasElement {
  const f = new Fine(92, 70);
  const R = 'rRqQ';
  // 허리 (아래로 좁아짐)
  for (let y = 30; y < 68; y++) {
    const t = (y - 30) / 38;
    const half = 27 - t * 7;
    for (let x = Math.floor(46 - half); x <= Math.ceil(46 + half); x++) f.set(x, y, ramp(R, (x + 0.5 - 46) / half, t - 0.3, x, y, 0.06));
  }
  // 가슴통
  ell(f, 46, 26, 33, 21, (nx, ny, x, y) => ramp(R, nx, ny, x, y, 0.02));
  // 어깨 (삼각근)
  for (const sx of [15, 77]) ell(f, sx, 18, 14, 13, (nx, ny, x, y) => ramp(R, nx, ny, x, y, -0.04));
  // 가슴 근육 두 덩이 (아래 테두리 진하게)
  for (const px of [34, 58]) {
    ell(f, px, 26, 13, 10, (nx, ny, x, y) => (ny > 0.72 ? 'Q' : ramp(R, nx, ny, x, y, -0.08)));
  }
  // 복근 (2 × 3 덩이)
  for (let row = 0; row < 3; row++)
    for (const bx of [40, 52]) ell(f, bx, 42 + row * 8, 5.4, 3.6, (nx, ny, x, y) => (ny > 0.65 ? 'Q' : ramp(R, nx, ny, x, y, -0.04)));
  f.set(46, 64, 'Q').set(46, 65, 'Q');
  // 흉터
  stroke(f, 62, 12, 72, 30, 1, 0.8, () => 'Q');
  // 큰 염주 (목에서 가슴으로 늘어진다)
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (0.12 + (i / 12) * 0.76);
    const bx = 46 + Math.cos(a) * 24;
    const by = 3 + Math.sin(a) * 17;
    ell(f, bx, by, 3.4, 3.2, (nx, ny) => (nx < -0.3 && ny < -0.3 ? 'o' : nx + ny > 0.7 ? 'X' : 'O'));
  }
  ell(f, 46, 21, 4.6, 4.2, (nx, ny) => (nx < -0.3 && ny < -0.3 ? 'y' : nx + ny > 0.7 ? 'z' : 'Y'));
  return f.canvas();
}

// 머리 72×74 (목 = 36,74): 붉은 얼굴 · 산발 · 금빛 뿔 · 성난 눈 · 송곳니
function head(roar = false): HTMLCanvasElement {
  const f = new Fine(74, 76);
  const cx = 37;
  const cy = 44;
  // 산발 (뒤 · 옆으로 뻗친 검은 머리)
  for (let k = 0; k < 26; k++) {
    const a = (180 + k * 7) * (Math.PI / 180);
    const len = 22 + ((k * 5) % 4) * 4;
    stroke(f, cx + Math.cos(a) * 10, cy - 8 + Math.sin(a) * 8, cx + Math.cos(a) * (14 + len), cy - 6 + Math.sin(a) * (10 + len * 0.7), 3.6, 0.8, (t, side) => (side < -0.4 ? '1' : t > 0.8 ? '4' : '3'));
  }
  // 얼굴
  ell(f, cx, cy, 20, 21, (nx, ny, x, y) => ramp('rRqQ', nx, ny, x, y, -0.04));
  // 뿔 두 개 (금빛 · 위로 휘어)
  for (const s of [-1, 1]) {
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      const x = cx + s * (11 + t * 6 + t * t * 4);
      const y = cy - 17 - t * 22;
      const w = 4.6 * (1 - t) + 0.8;
      for (let q = -w; q <= w; q += 0.5) f.set(Math.round(x + q), Math.round(y), q < -w * 0.3 ? 'y' : q > w * 0.4 ? 'Z' : t > 0.85 ? 'z' : 'Y');
    }
    for (let i = 0; i < 3; i++) f.set(cx + s * (12 + i * 2), cy - 22 - i * 6, 'z');
  }
  // 굵은 눈썹 · 눈 (흰자 + 금빛 · 찌푸림)
  stroke(f, cx - 17, cy - 9, cx - 3, cy - 4, 3, 2, () => '4');
  stroke(f, cx + 3, cy - 4, cx + 17, cy - 9, 3, 2, () => '4');
  f.stamp(['kkkkkk', 'kwwYYk', 'kwYYzk', '.kkkk.'], cx - 14, cy - 3).stamp(['kkkkkk', 'kYYwwk', 'kzYYwk', '.kkkk.'], cx + 3, cy - 3);
  f.set(cx - 11, cy - 2, 'h').set(cx + 5, cy - 2, 'h');
  // 코 · 콧구멍
  ell(f, cx, cy + 5, 4.5, 3.5, (nx, ny) => (ny < -0.2 && nx < 0 ? 'r' : 'q'));
  f.set(cx - 2, cy + 7, 'Q').set(cx + 2, cy + 7, 'Q');
  // 입 · 송곳니 · 수염
  if (roar) {
    f.stamp(['QQQQQQQQQQQQ', 'QkkkkkkkkkkQ', 'QkkRRRRRRkkQ', 'QkRRqqqqRRkQ', '.QkkkkkkkkQ.', '..QQQQQQQQ..'], cx - 6, cy + 10);
    f.set(cx - 4, cy + 11, 'w').set(cx - 4, cy + 12, 'w').set(cx + 4, cy + 11, 'w').set(cx + 4, cy + 12, 'w');
  } else {
    f.stamp(['QQQQQQQQQQ', 'Q........Q'], cx - 5, cy + 12);
  }
  // 아래 송곳니 (위로 솟음)
  for (const s of [-1, 1]) f.stamp(['w.', 'ww', 'Vw'], cx + s * 6 - (s < 0 ? 1 : 0), cy + (roar ? 13 : 9));
  // 턱수염
  for (let k = 0; k < 9; k++) stroke(f, cx - 12 + k * 3, cy + 17, cx - 13 + k * 3.2, cy + 26 + (k % 3) * 2, 1.8, 0.6, () => (k % 2 ? '3' : '4'));
  return f.canvas();
}

// 몽둥이 든 팔 96×96 (어깨 = 14,14): 굵은 팔 · 주먹 · 가시 박힌 쇠몽둥이
function armClub(): HTMLCanvasElement {
  const f = new Fine(98, 98);
  // 위팔 · 아래팔 (아래로)
  ell(f, 16, 26, 11, 15, (nx, ny, x, y) => ramp('rRqQ', nx, ny, x, y));
  ell(f, 22, 48, 9, 13, (nx, ny, x, y) => ramp('rRqQ', nx, ny, x, y, 0.04));
  f.stamp(['YYYYYYYYYY', 'zzzzzzzzzz'], 13, 38);
  // 주먹
  ell(f, 25, 62, 8, 7, (nx, ny, x, y) => ramp('rRqQ', nx, ny, x, y, 0.06));
  for (let k = 0; k < 3; k++) f.set(20 + k * 4, 58, 'Q');
  // 쇠몽둥이 (주먹에서 앞 · 아래로 길게 · 굵어진다 · 쇠 징)
  const x0 = 24;
  const y0 = 62;
  const x1 = 90;
  const y1 = 92;
  stroke(f, x0 - 8, y0 - 4, x0 + 6, y0 + 3, 2.4, 2.4, () => 'O');
  stroke(f, x0 + 4, y0 + 2, x1, y1, 3.4, 8, (_t, side, x, y) => (side < -0.45 ? 'S' : side > 0.55 ? 'T' : (x + y) % 9 === 0 ? 't' : 't'));
  const len = Math.hypot(x1 - x0, y1 - y0);
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  for (let i = 0; i < 8; i++) {
    const t = 0.25 + i * 0.1;
    const sx = x0 + (x1 - x0) * t;
    const sy = y0 + (y1 - y0) * t;
    const r = 3.4 + 4.6 * t;
    for (const side of [-1, 1]) {
      const kx = sx + nx * (r + 1.5) * side;
      const ky = sy + ny * (r + 1.5) * side;
      ell(f, kx, ky, 2.2, 2.2, (ex, ey) => (ex + ey < -0.3 ? 's' : ex + ey > 0.5 ? 'T' : 'S'));
    }
    ell(f, sx, sy, 1.6, 1.6, () => 'S');
  }
  return f.canvas();
}

// 뒷팔 52×72 (어깨 = 30,10): 주먹 쥔 굵은 팔
function armBack(): HTMLCanvasElement {
  const f = new Fine(54, 74);
  ell(f, 28, 22, 11, 15, (nx, ny, x, y) => ramp('rRqQ', nx, ny, x, y, 0.1));
  ell(f, 24, 44, 9, 13, (nx, ny, x, y) => ramp('rRqQ', nx, ny, x, y, 0.12));
  f.stamp(['YYYYYYYYYY', 'zzzzzzzzzz'], 18, 34);
  ell(f, 22, 60, 9, 8, (nx, ny, x, y) => ramp('rRqQ', nx, ny, x, y, 0.14));
  return f.canvas();
}

const PARTS: Record<string, () => HTMLCanvasElement> = {
  'or-legs': legs,
  'or-torso': torso,
  'or-head': () => head(false),
  'or-head-roar': () => head(true),
  'or-arm': armClub,
  'or-armb': armBack,
};

export function registerOniRig(scene: Phaser.Scene): void {
  for (const [k, make] of Object.entries(PARTS)) if (!scene.textures.exists(k)) scene.textures.addCanvas(k, make());
  registerGlow(scene);
}

export class OniRig extends BossRig {
  readonly tall = 168;
  private legs: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private arm: Phaser.GameObjects.Image;
  private armB: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private hornFire: Phaser.GameObjects.Image[];
  private cur = { arm: 0.5, armB: 0.1, lean: 0, headR: 0, crouch: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    registerOniRig(scene);
    this.aura = this.glow('rig-glow').setPosition(0, -86).setScale(3.8, 4.4).setTint(0xff3010);
    this.armB = this.part('or-armb', 30 / 54, 10 / 74, 0xc89090);
    this.legs = this.part('or-legs', 0.5, 1);
    this.torso = this.part('or-torso', 0.5, 1);
    this.head = this.part('or-head', 37 / 74, 72 / 76);
    this.arm = this.part('or-arm', 14 / 98, 14 / 98);
    this.hornFire = [0, 1].map(() => this.glow('rig-glow').setScale(0.5, 0.8).setTint(0xff7a20));
  }

  protected onPose(p: RigPose): void {
    this.head.setTexture(p === 'shout' || p === 'rage' ? 'or-head-roar' : 'or-head');
    if (p === 'attack') {
      this.scene.time.delayedCall(110, () => {
        if (!this.active) return;
        this.scene.cameras.main.shake(140, 0.006);
        this.dust();
      });
    }
    if (p === 'shout') this.steam(6);
  }

  /** 내리찍은 자리의 흙먼지 */
  private dust(): void {
    const dir = this.flipX ? -1 : 1;
    for (let i = 0; i < 10; i++) {
      const d = this.scene.add.circle(this.x + dir * Phaser.Math.Between(60, 100), this.y - Phaser.Math.Between(0, 10), Phaser.Math.Between(3, 6), 0xc8b490, 0.8).setDepth(this.depth + 1);
      this.scene.tweens.add({ targets: d, x: d.x + Phaser.Math.Between(-30, 30), y: d.y - Phaser.Math.Between(10, 30), alpha: 0, scale: 2, duration: 600, onComplete: () => d.destroy() });
    }
  }

  /** 콧김 · 입김 */
  private steam(n: number): void {
    const dir = this.flipX ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const s = this.scene.add.circle(this.x + dir * 14, this.y - 132, 4, 0xffffff, 0.5).setDepth(this.depth + 1);
      this.scene.tweens.add({ targets: s, x: s.x + dir * Phaser.Math.Between(20, 50), y: s.y - Phaser.Math.Between(10, 30), scale: 3, alpha: 0, duration: 800, delay: i * 60, onComplete: () => s.destroy() });
    }
  }

  protected animate(dt: number): void {
    const t = this.t;
    const k = this.poseT;
    const breath = Math.sin(t / 520);
    let arm = 0.55 + Math.sin(t / 900) * 0.06;
    let armB = 0.1 + Math.sin(t / 700) * 0.05;
    let lean = 0;
    let headR = Math.sin(t / 1300) * 0.03;
    let crouch = 0;
    switch (this.pose) {
      case 'windup':
        arm = -2.5 + Math.sin(t / 80) * 0.04;
        armB = -0.5;
        lean = -0.08;
        headR = -0.1;
        crouch = 2;
        break;
      case 'attack': {
        const p = Math.min(1, k / 110);
        arm = -2.5 + p * 3.5;
        lean = 0.12 * p;
        crouch = 6 * p;
        if (k > 650) this.setPose('idle');
        break;
      }
      case 'shout':
        arm = -0.4;
        armB = -1.2;
        headR = -0.18;
        lean = -0.06;
        if (k > 1100) this.setPose('idle');
        break;
      case 'hit':
        lean = -0.1 * Math.max(0, 1 - k / 260);
        if (k > 320) this.setPose('idle');
        break;
      case 'rage':
        arm = -1.2 + Math.sin(t / 90) * 0.15;
        armB = -1.0 + Math.sin(t / 110) * 0.15;
        headR = -0.12 + Math.sin(t / 60) * 0.03;
        crouch = 3 + Math.sin(t / 200) * 2;
        if (Math.random() < dt / 300) this.steam(1);
        break;
    }
    const c = this.cur;
    const atk = this.pose === 'attack';
    c.arm = approach(c.arm, arm, atk ? 0.7 : 0.15);
    c.armB = approach(c.armB, armB, 0.15);
    c.lean = approach(c.lean, lean, 0.2);
    c.headR = approach(c.headR, headR, 0.12);
    c.crouch = approach(c.crouch, crouch, atk ? 0.6 : 0.15);
    // 몸 배치 (무거운 숨: 어깨가 들썩)
    const hip = -50 + c.crouch;
    this.legs.setPosition(0, 0).setScale(1, 1 - c.crouch * 0.006);
    this.torso.setPosition(c.lean * 40, hip).setScale(1 + breath * 0.012, 1 + breath * 0.02).setRotation(c.lean * 0.6);
    const shoulderY = hip - 58 - breath * 1.6;
    this.head.setPosition(4 + c.lean * 70, shoulderY + 6).setRotation(c.headR + c.lean * 0.5);
    this.arm.setPosition(30 + c.lean * 60, shoulderY + 6).setRotation(c.arm);
    this.armB.setPosition(-32 + c.lean * 40, shoulderY + 8).setRotation(c.armB);
    const rage = this.pose === 'rage';
    this.aura.setAlpha(rage ? 0.22 + Math.sin(t / 110) * 0.08 : Math.max(0, this.aura.alpha - dt / 600));
    this.hornFire.forEach((h, i) => {
      h.setPosition(this.head.x + (i ? 19 : -13), this.head.y - 66 + Math.sin(t / 70 + i) * 2);
      h.setAlpha(rage ? 0.65 + Math.sin(t / 45 + i * 2) * 0.25 : 0);
    });
  }
}
