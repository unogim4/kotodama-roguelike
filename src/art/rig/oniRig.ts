import Phaser from 'phaser';
import { Fine } from '../fine/fine';
import { BossRig, RigPose, ell, ramp, stroke, limb, registerGlow, approach } from './BossRig';

/**
 * 👹 오니 리그 — 키 약 170px. 붉은 근육 · 금빛 뿔 · 검은 산발 · 송곳니 · 염주 · 호피 · 쇠몽둥이.
 * 팔다리는 두 마디(위팔 · 아래팔 / 허벅지 · 정강이) — 끝이 둥근 원통이라 관절에서 돌려도 이음매가 벌어지지 않는다.
 * 다리는 IK: 발은 땅에 두고 엉덩이만 내리면 무릎이 저절로 굽는다.
 * 대기(무거운 숨) · 예비(몽둥이를 머리 위로) · 공격(내리찍기) · 외침(힘자랑 + 김) · 발악(뿔에 불)
 */

const R = 'rRqQ';

// 허벅지 30×52 (엉덩이 축 = 15,13 · 무릎 = 15,40): 굵은 원통 + 바깥 근육 골 · 무릎뼈
function thigh(): HTMLCanvasElement {
  const f = new Fine(30, 52);
  limb(f, 15, 13, 12, 15, 40, 9.5, (nx, ny, x, y, t) => (nx > 0.35 && nx < 0.55 && t > 0.25 && t < 0.8 ? 'q' : ramp(R, nx, ny, x, y, 0.02)), 1.5);
  ell(f, 14, 40, 4.5, 3.4, (nx, ny) => (nx + ny < -0.4 ? 'r' : ny > 0.5 ? 'q' : 'R'));
  return f.canvas();
}

// 정강이 24×42 (무릎 축 = 12,9 · 발목 = 12,34): 종아리가 불룩 · 위쪽은 허벅지에 이어지게 외곽선 없음
function shin(): HTMLCanvasElement {
  const f = new Fine(24, 42);
  limb(f, 12, 9, 9, 12, 34, 6.5, (nx, ny, x, y, t) => (nx > 0.5 && t > 0.2 && t < 0.6 ? 'q' : ramp(R, nx, ny, x, y, 0.05)), 2);
  return f.noLine(12, 9, 9.5).canvas();
}

// 맨발 32×14 (발목 = 16,3 · 바닥 = 13)
function foot(): HTMLCanvasElement {
  const f = new Fine(32, 14);
  ell(f, 16, 8, 13, 5.6, (nx, ny, x, y) => ramp(R, nx, ny, x, y, 0.06));
  for (let k = 0; k < 5; k++) {
    ell(f, 6 + k * 5, 11, 2.6, 2.2, (nx, ny) => (nx + ny < -0.5 ? 'R' : 'q'));
    f.set(6 + k * 5, 13, 'f');
  }
  return f.canvas();
}

// 호피 허리감개 70×36 (허리띠 가운데 = 35,4): 둘러 감은 호피 · 앞으로 늘어진 자락 · 털 술 끝
function loin(): HTMLCanvasElement {
  const f = new Fine(70, 36);
  const fur = (x: number, y: number, nx: number, ny: number): string => {
    const stripe = Math.abs(((x * 0.9 + y * 1.6) % 12) - 6) < 1.3 && (x * 7 + y) % 5 !== 0;
    return stripe ? 'k' : ramp('yYzZ', nx, ny, x, y, 0.05);
  };
  // 허리를 둘러 감아 가운데가 아래로 휘는 띠 (양 끝은 둥글게 뒤로 돌아감)
  const curve = (x: number) => 1 - ((x - 35) / 32) ** 2;
  for (let x = 3; x <= 67; x++) {
    const cv = curve(x);
    const top = 3 + cv * 3;
    const bot = 13 + cv * 8 + ((x * 5) % 3);
    for (let y = Math.round(top); y <= bot; y++) f.set(x, y, fur(x, y, (x - 35) / 32, (y - top) / (bot - top) - 0.3));
  }
  // 앞자락 (가운데로 길게 · 끝은 털)
  for (let y = 16; y < 35; y++) {
    const half = 11 - (y - 16) * 0.25;
    for (let x = Math.round(36 - half); x <= Math.round(36 + half); x++) {
      if (y > 30 && (x * 3) % 5 < y - 30) continue;
      f.set(x, y, fur(x, y, (x - 36) / half, (y - 16) / 19 - 0.2));
    }
  }
  // 새끼줄 허리띠 + 매듭
  for (let x = 3; x <= 67; x++) {
    const y = Math.round(3 + curve(x) * 3);
    f.set(x, y, (x >> 1) % 2 ? 'o' : 'O').set(x, y + 1, (x >> 1) % 2 ? 'O' : 'X').set(x, y + 2, 'X');
  }
  ell(f, 22, 7.5, 3.4, 3, (nx, ny) => (nx + ny < -0.3 ? 'o' : 'O'));
  stroke(f, 21, 10, 18, 19, 1.2, 0.8, () => 'O');
  stroke(f, 23, 10, 25, 18, 1.2, 0.8, () => 'O');
  return f.canvas();
}

// 몸통 90×68 (허리 = 45,68): 둥근 어깨 · 가슴 근육 · 복근 덩어리 · 큰 염주 — 근육마다 따로 둥글게 칠한다
function torso(): HTMLCanvasElement {
  const f = new Fine(92, 70);
  // 허리 (아래로 좁아짐)
  for (let y = 30; y < 68; y++) {
    const t = (y - 30) / 38;
    const half = 27 - t * 7;
    for (let x = Math.floor(46 - half); x <= Math.ceil(46 + half); x++) f.set(x, y, ramp(R, (x + 0.5 - 46) / half, t - 0.3, x, y, 0.06));
  }
  // 가슴통
  ell(f, 46, 26, 33, 21, (nx, ny, x, y) => ramp(R, nx, ny, x, y, 0.02));
  // 어깨 (삼각근)
  for (const sx of [17, 75]) ell(f, sx, 19, 11, 11, (nx, ny, x, y) => ramp(R, nx, ny, x, y, -0.04));
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
  for (let k = 0; k < 11; k++) {
    const len = 5 + (5 - Math.abs(k - 5)) * 1.7 + (k % 2) * 1.5;
    const x0 = cx - 13 + k * 2.6;
    stroke(f, x0, cy + 15, x0 + (k - 5) * 0.35, cy + 17 + len, 1.9, 0.5, (t, side) => (side < -0.3 && t < 0.6 ? '2' : k % 3 ? '3' : '4'));
  }
  return f.canvas();
}

// 위팔 32×48 (어깨 축 = 16,13 · 팔꿈치 = 16,39): 둥근 삼각근이 축을 감싼다 · 이두 · 금 팔찌
function upperArm(): HTMLCanvasElement {
  const f = new Fine(32, 48);
  limb(f, 16, 13, 12.5, 16, 39, 9.5, (nx, ny, x, y, t) => {
    if (t > 0.72 && t < 0.84) return nx < -0.4 ? 'y' : nx > 0.5 ? 'z' : 'Y';
    if (t > 0.84 && t < 0.88) return 'Z';
    // 삼각근과 이두 사이의 골
    if (t > 0.3 && t < 0.36 && nx > -0.2) return 'q';
    return ramp(R, nx, ny, x, y, 0.02);
  }, 2);
  return f.canvas();
}

// 아래팔 + 주먹 28×50 (팔꿈치 축 = 14,10 · 손목 = 14,32 · 주먹 가운데 = 14,39)
function foreArm(): HTMLCanvasElement {
  const f = new Fine(28, 50);
  limb(f, 14, 10, 9, 14, 32, 7, (nx, ny, x, y) => ramp(R, nx, ny, x, y, 0.04), 1.2);
  ell(f, 14, 39, 9, 8.4, (nx, ny, x, y) => ramp(R, nx, ny, x, y, 0.06));
  for (let k = 0; k < 4; k++) f.set(9 + k * 3, 43, 'Q').set(9 + k * 3, 44, 'q');
  stroke(f, 7, 36, 10, 40, 1, 0.8, () => 'q');
  return f.noLine(14, 10, 9.5).canvas();
}

// 쇠몽둥이 26×92 (손잡이 = 13,8 · 아래로 길게): 나무 손잡이 · 굵어지는 쇠 · 징
function club(): HTMLCanvasElement {
  const f = new Fine(26, 92);
  stroke(f, 13, 0, 13, 18, 2.6, 2.6, (_t, side) => (side < -0.3 ? 'o' : side > 0.5 ? 'X' : 'O'));
  limb(f, 13, 14, 3.6, 13, 82, 8, (nx, _ny, x, y) => (nx < -0.45 ? 'S' : nx > 0.55 ? 'T' : (x + y) % 7 === 0 ? 'S' : 't'));
  for (let i = 0; i < 7; i++) {
    const y = 26 + i * 9;
    const r = 3.6 + (8 - 3.6) * ((y - 14) / 68);
    for (const side of [-1, 1]) ell(f, 13 + side * (r + 1.6), y, 2.2, 2.2, (ex, ey) => (ex + ey < -0.3 ? 's' : ex + ey > 0.5 ? 'T' : 'S'));
    ell(f, 13 - r * 0.2, y + 4, 1.5, 1.5, () => 'S');
  }
  return f.canvas();
}

const PARTS: Record<string, () => HTMLCanvasElement> = {
  'or-thigh': thigh,
  'or-shin': shin,
  'or-foot': foot,
  'or-loin': loin,
  'or-torso': torso,
  'or-head': () => head(false),
  'or-head-roar': () => head(true),
  'or-uarm': upperArm,
  'or-farm': foreArm,
  'or-club': club,
};

export function registerOniRig(scene: Phaser.Scene): void {
  for (const [k, make] of Object.entries(PARTS)) if (!scene.textures.exists(k)) scene.textures.addCanvas(k, make());
  registerGlow(scene);
}

/** 몸통 안의 관절 자리 (몸통 축 = 허리 가운데 아래에서 잰 px) */
const SHOULDER_F = { x: 31, y: -52 };
const SHOULDER_B = { x: -31, y: -50 };
const NECK = { x: 4, y: -52 };
const HIP = 14;
const UPPER = 26;
const FORE = 29;
const THIGH = 27;
const SHIN = 25;

type Limb = { up: Phaser.GameObjects.Image; low: Phaser.GameObjects.Image };

export class OniRig extends BossRig {
  readonly tall = 168;
  private torso: Phaser.GameObjects.Image;
  private loin: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private armF: Limb;
  private armB: Limb;
  private club: Phaser.GameObjects.Image;
  private legs: (Limb & { foot: Phaser.GameObjects.Image; side: number })[];
  private aura: Phaser.GameObjects.Image;
  private hornFire: Phaser.GameObjects.Image[];
  /** 지금 각도 (부드럽게 따라감): 앞 위팔 · 앞 아래팔 · 몽둥이 · 뒤 위팔 · 뒤 아래팔 */
  private cur = { fa: -0.1, fb: -0.7, clubA: -0.8, ba: 0.12, bb: -0.1, lean: 0, headR: 0, crouch: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    registerOniRig(scene);
    const back = 0xc89090;
    this.aura = this.glow('rig-glow').setPosition(0, -86).setScale(3.8, 4.4).setTint(0xff3010);
    this.armB = { up: this.part('or-uarm', 16 / 32, 13 / 48, back), low: this.part('or-farm', 14 / 28, 10 / 50, back) };
    this.legs = [-1, 1].map((side) => {
      const foot = this.part('or-foot', 16 / 32, 13 / 14);
      if (side < 0) foot.setFlipX(true);
      const low = this.part('or-shin', 12 / 24, 9 / 42);
      // 허벅지가 정강이 위 (무릎뼈가 보이게)
      const up = this.part('or-thigh', 15 / 30, 13 / 52);
      return { foot, up, low, side };
    });
    this.torso = this.part('or-torso', 0.5, 1);
    this.loin = this.part('or-loin', 35 / 70, 4 / 36);
    this.head = this.part('or-head', 37 / 74, 72 / 76);
    this.club = this.part('or-club', 13 / 26, 8 / 92);
    this.armF = { up: this.part('or-uarm', 16 / 32, 13 / 48), low: this.part('or-farm', 14 / 28, 10 / 50) };
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
    // 각도는 절대값 (0 = 아래로 · −면 앞(+x)으로 든다)
    let fa = -0.12 + Math.sin(t / 900) * 0.05;
    let fb = -0.75 + Math.sin(t / 900) * 0.05;
    let clubA = -0.8;
    let ba = 0.14 + Math.sin(t / 700) * 0.05;
    let bb = -0.05 + Math.sin(t / 700) * 0.08;
    let lean = 0;
    let headR = Math.sin(t / 1300) * 0.03;
    let crouch = 0;
    switch (this.pose) {
      case 'windup':
        // 몽둥이를 머리 위 뒤로
        fa = -2.5 + Math.sin(t / 80) * 0.04;
        fb = -3.5;
        clubA = -3.3;
        ba = -0.6;
        bb = -1.3;
        lean = -0.08;
        headR = -0.1;
        crouch = 3;
        break;
      case 'attack': {
        const p = Math.min(1, k / 110);
        fa = -2.5 + p * 1.75;
        fb = -3.5 + p * 2.6;
        clubA = -3.3 + p * 2.4;
        ba = -0.6 + p * 0.9;
        bb = -1.3 + p * 1.2;
        lean = 0.12 * p;
        crouch = 10 * p;
        if (k > 650) this.setPose('idle');
        break;
      }
      case 'shout':
        // 두 팔을 굽혀 힘자랑 (몽둥이는 하늘로)
        fa = -1.35;
        fb = -2.9;
        clubA = -2.5;
        ba = 1.35;
        bb = 2.9;
        headR = -0.18;
        lean = -0.06;
        crouch = 2;
        if (k > 1100) this.setPose('idle');
        break;
      case 'hit':
        lean = -0.1 * Math.max(0, 1 - k / 260);
        fb = -0.4;
        if (k > 320) this.setPose('idle');
        break;
      case 'rage':
        fa = -1.35 + Math.sin(t / 90) * 0.15;
        fb = -2.9 + Math.sin(t / 90) * 0.2;
        clubA = -2.5 + Math.sin(t / 90) * 0.2;
        ba = 1.3 + Math.sin(t / 110) * 0.15;
        bb = 2.8 + Math.sin(t / 110) * 0.2;
        headR = -0.12 + Math.sin(t / 60) * 0.03;
        crouch = 5 + Math.sin(t / 200) * 2;
        if (Math.random() < dt / 300) this.steam(1);
        break;
    }
    const c = this.cur;
    const atk = this.pose === 'attack';
    const kk = atk ? 0.7 : 0.15;
    c.fa = approach(c.fa, fa, kk);
    c.fb = approach(c.fb, fb, kk);
    c.clubA = approach(c.clubA, clubA, kk);
    c.ba = approach(c.ba, ba, 0.15);
    c.bb = approach(c.bb, bb, 0.15);
    c.lean = approach(c.lean, lean, 0.2);
    c.headR = approach(c.headR, headR, 0.12);
    c.crouch = approach(c.crouch, crouch, atk ? 0.6 : 0.15);
    // 다리: 발은 땅에 두고 엉덩이만 내린다 → 무릎이 저절로 굽는다
    const hipY = -58 + c.crouch + breath * 0.5;
    const hipX = c.lean * 20;
    for (const l of this.legs) {
      const ax = l.side * 21;
      l.foot.setPosition(ax + l.side * 2, 0);
      this.leg(l.up, l.low, hipX + l.side * HIP, hipY, ax, -9, THIGH, SHIN, -1);
    }
    // 몸통 (무거운 숨: 어깨가 들썩)
    this.torso.setPosition(hipX, hipY + 2).setScale(1 + breath * 0.012, 1 + breath * 0.02).setRotation(c.lean * 0.6);
    const lo = this.anchor(this.torso, 0, -4);
    this.loin.setPosition(lo.x, lo.y).setRotation(c.lean * 0.3);
    const nk = this.anchor(this.torso, NECK.x, NECK.y);
    this.head.setPosition(nk.x, nk.y).setRotation(c.headR + c.lean * 0.5);
    // 팔: 몸통의 어깨 자리에서 위팔 → 아래팔 → 주먹 → 몽둥이
    const sf = this.anchor(this.torso, SHOULDER_F.x, SHOULDER_F.y);
    const hand = this.chain(this.armF.up, this.armF.low, sf.x, sf.y, UPPER, FORE, c.fa, c.fb);
    this.club.setPosition(hand.x, hand.y).setRotation(c.clubA);
    const sb = this.anchor(this.torso, SHOULDER_B.x, SHOULDER_B.y);
    this.chain(this.armB.up, this.armB.low, sb.x, sb.y, UPPER, FORE, c.ba, c.bb);
    const rage = this.pose === 'rage';
    this.aura.setAlpha(rage ? 0.22 + Math.sin(t / 110) * 0.08 : Math.max(0, this.aura.alpha - dt / 600));
    this.hornFire.forEach((h, i) => {
      const p = this.anchor(this.head, i ? 21 : -21, -66 + Math.sin(t / 70 + i) * 2);
      h.setPosition(p.x, p.y);
      h.setAlpha(rage ? 0.65 + Math.sin(t / 45 + i * 2) * 0.25 : 0);
    });
  }
}
