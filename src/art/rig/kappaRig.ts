import Phaser from 'phaser';
import { Fine } from '../fine/fine';
import { BossRig, RigPose, ell, ramp, stroke, limb, registerGlow, approach } from './BossRig';

/**
 * 🐢 갓파 리그 — 키 약 150px. 팔다리는 두 마디(무릎은 개구리처럼 바깥으로). 등껍질 · 초록 피부 · 배딱지 · 물갈퀴 · 머리 접시(물) · 앞머리 · 노란 부리 · 큰 눈.
 * 대기(접시 물 출렁) · 예비(두 팔을 들고 볼을 부풀림) · 공격(두 팔을 앞으로 — 물대포) · 외침 · 발악(접시에 금 · 물이 쏟아짐)
 */
const G = '5678';

// 등껍질 92×92 (가운데 = 46,46): 거북 등딱지 육각 비늘 · 테두리
function shell(): HTMLCanvasElement {
  const f = new Fine(94, 94);
  ell(f, 47, 47, 44, 44, (nx, ny, x, y) => {
    const d = Math.hypot(nx, ny);
    if (d > 0.88) return ramp('oOXX', nx, ny, x, y, 0.1);
    // 육각 비늘: 벌집 줄눈
    const hx = x / 15;
    const hy = y / 13 + (Math.floor(hx) % 2) * 0.5;
    const gx = Math.abs(hx - Math.round(hx));
    const gy = Math.abs(hy - Math.round(hy));
    if (gx < 0.07 || gy < 0.08) return 'X';
    return ramp('HIJK', nx, ny, x, y, 0.08);
  });
  return f.canvas();
}

// 머리 74×70 (목 = 37,70): 접시(물) · 젖은 앞머리 · 부리 · 큰 눈
function head(open = false, cracked = false): HTMLCanvasElement {
  const f = new Fine(76, 72);
  const cx = 38;
  const cy = 40;
  // 얼굴
  ell(f, cx, cy, 25, 24, (nx, ny, x, y) => ramp(G, nx, ny, x, y, -0.06));
  // 젖은 앞머리 (접시 둘레로 늘어진 짙은 머리칼)
  for (let k = 0; k < 20; k++) {
    const a = (200 + k * 7) * (Math.PI / 180);
    const bx = cx + Math.cos(a) * 21;
    const by = cy - 8 + Math.sin(a) * 15;
    stroke(f, bx, by, bx + Math.cos(a) * 3, by + 9 + (k % 3) * 3, 2.6, 0.8, (t) => (t > 0.7 ? '8' : '7'));
  }
  // 접시 (흰 테 · 물)
  ell(f, cx, cy - 22, 17, 7, (nx, ny) => (Math.hypot(nx, ny) > 0.78 ? (ny > 0 ? 'V' : 'W') : ny < -0.2 ? 'A' : nx > 0.3 ? 'C' : 'B'));
  if (cracked) {
    stroke(f, cx - 6, cy - 27, cx + 2, cy - 18, 0.8, 0.6, () => 'k');
    stroke(f, cx + 2, cy - 18, cx + 9, cy - 22, 0.8, 0.6, () => 'k');
  }
  // 큰 눈 (흰자 · 검은 눈동자 · 빛)
  for (const ex of [cx - 11, cx + 9]) {
    ell(f, ex, cy - 2, 7, 7.5, (nx, ny) => (Math.hypot(nx, ny) > 0.82 ? 'k' : 'w'));
    ell(f, ex + 1.5, cy - 0.5, 3.6, 4.2, () => 'k');
    f.set(ex, cy - 2, 'h').set(ex + 1, cy - 2, 'h');
    // 무거운 윗눈꺼풀 (부릅뜬 눈)
    for (let x = ex - 7; x <= ex + 7; x++) for (let y = cy - 10; y <= cy - 5 + (x > ex ? 1 : 0); y++) if (f.get(x, y) === 'w' || f.get(x, y) === 'k') f.set(x, y, y === cy - 5 + (x > ex ? 1 : 0) ? '8' : '7');
  }
  // 피부 반점
  for (const [x, y] of [[cx - 18, cy - 12], [cx + 16, cy - 14], [cx - 20, cy + 2], [cx + 20, cy], [cx - 4, cy - 14]]) f.set(x, y, '7').set(x + 1, y, '7').set(x, y + 1, '8');
  // 노란 부리 (벌리면 붉은 입안)
  if (open) {
    f.stamp(['...yyYYYYYYYy...', '.yyYYYYYYYYYYYz.', 'yYYYYYYYYYYYYYzZ', 'YzzzzzzzzzzzzzzZ', 'QqqRRRRRRRRRRqqQ', 'QqRRRqqqqqqRRRqQ', '.QqqRRRRRRRRqqQ.', '..zYYYYYYYYYYz..', '...zzzzzzzzzz...'], cx - 8, cy + 6);
  } else {
    f.stamp(['...yyYYYYYYy...', '.yyYYYYYYYYYYz.', 'yYYYYYYYYYYYYzZ', 'YYzzzzzzzzzzYYZ', '.zzzzZZZZZzzzz.', '...zzZZZZZzz...'], cx - 7, cy + 7);
  }
  // 볼 (불그스름)
  f.set(cx - 18, cy + 8, '0').set(cx - 17, cy + 8, '0').set(cx + 17, cy + 8, '0').set(cx + 18, cy + 8, '0');
  return f.canvas();
}

// 몸통 66×70 (가운데 = 33,36): 통통한 초록 몸 · 연한 배딱지(가로 마디)
function bodyPart(): HTMLCanvasElement {
  const f = new Fine(66, 72);
  ell(f, 33, 36, 30, 32, (nx, ny, x, y) => ramp(G, nx, ny, x, y, -0.02));
  ell(f, 33, 40, 18, 24, (nx, ny, x, y) => (Math.abs(((y - 16) % 8) - 0) < 1 ? 'g' : ramp('fFFg', nx, ny, x, y, -0.05)));
  // 목의 주름 (머리가 얹히는 자리)
  for (let x = 22; x <= 44; x++) if ((x & 3) !== 0) f.set(x, 8 + Math.round(Math.abs(x - 33) * 0.12), '7');
  return f.canvas();
}

// 허벅지 20×24 (엉덩이 축 = 10,8 · 무릎 = 10,20)
function thigh(): HTMLCanvasElement {
  const f = new Fine(20, 30);
  limb(f, 10, 8, 8, 10, 20, 6.8, (nx, ny, x, y) => ramp(G, nx, ny, x, y, 0.02), 1);
  return f.canvas();
}

// 정강이 16×24 (무릎 축 = 8,7 · 발목 = 8,19)
function shin(): HTMLCanvasElement {
  const f = new Fine(16, 28);
  limb(f, 8, 7, 6.4, 8, 19, 5, (nx, ny, x, y) => ramp(G, nx, ny, x, y, 0.05), 0.8);
  return f.noLine(8, 7, 6.8).canvas();
}

// 물갈퀴 발 30×12 (발목 = 15,2 · 바닥 = 11): 발가락 셋 + 막
function foot(): HTMLCanvasElement {
  const f = new Fine(30, 12);
  ell(f, 15, 6, 10, 4.4, (nx, ny, x, y) => ramp(G, nx, ny, x, y, 0.08));
  for (let k = 0; k < 3; k++) {
    const tx = 6 + k * 9;
    stroke(f, 15, 7, tx, 10, 1.6, 1.2, () => '7');
    ell(f, tx, 10, 2, 1.4, () => '8');
  }
  // 발가락 사이 막 (반투명 느낌: 밝은 초록)
  for (let x = 8; x <= 22; x++) if (!f.get(x, 9)) f.set(x, 9, '5');
  return f.canvas();
}

// 위팔 18×26 (어깨 축 = 9,8 · 팔꿈치 = 9,24)
function upperArm(): HTMLCanvasElement {
  const f = new Fine(18, 32);
  limb(f, 9, 8, 8.4, 9, 24, 6.8, (nx, ny, x, y) => ramp(G, nx, ny, x, y), 1);
  return f.canvas();
}

// 아래팔 + 물갈퀴 손 36×40 (팔꿈치 축 = 10,7 · 손목 = 10,22): 세 손가락 + 막
function foreArm(): HTMLCanvasElement {
  const f = new Fine(36, 42);
  limb(f, 10, 7, 6.6, 10, 22, 5.4, (nx, ny, x, y) => ramp(G, nx, ny, x, y, 0.03), 0.8);
  // 손바닥
  ell(f, 11, 27, 6.4, 5.6, (nx, ny, x, y) => ramp(G, nx, ny, x, y, 0.04));
  // 손가락 셋 (앞 · 아래로 펼침) + 막
  const tips: [number, number][] = [];
  for (let k = 0; k < 3; k++) {
    const a = (55 + k * 30) * (Math.PI / 180);
    const tx = 11 + Math.cos(a) * 13;
    const ty = 28 + Math.sin(a) * 13;
    tips.push([tx, ty]);
  }
  // 막: 손가락 끝 사이를 메운다
  for (let y = 26; y < 42; y++)
    for (let x = 4; x < 36; x++) {
      const dx = x + 0.5 - 11;
      const dy = y + 0.5 - 28;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) * (180 / Math.PI);
      if (r < 11 && a > 55 && a < 115 && !f.get(x, y)) f.set(x, y, r > 9 ? '6' : '5');
    }
  for (const [tx, ty] of tips) {
    stroke(f, 11, 28, tx, ty, 1.8, 1.2, () => '7');
    ell(f, tx, ty, 1.8, 1.8, () => '8');
  }
  return f.noLine(10, 7, 7).canvas();
}

const PARTS: Record<string, () => HTMLCanvasElement> = {
  'kr-shell': shell,
  'kr-body': bodyPart,
  'kr-head': () => head(false, false),
  'kr-head-open': () => head(true, false),
  'kr-head-crack': () => head(true, true),
  'kr-thigh': thigh,
  'kr-shin': shin,
  'kr-foot': foot,
  'kr-uarm': upperArm,
  'kr-farm': foreArm,
};

export function registerKappaRig(scene: Phaser.Scene): void {
  for (const [k, make] of Object.entries(PARTS)) if (!scene.textures.exists(k)) scene.textures.addCanvas(k, make());
  registerGlow(scene);
  if (!scene.textures.exists('kr-drop')) scene.textures.addCanvas('kr-drop', new Fine(6, 8).stamp(['.A..', 'ABB.', 'BBCC', '.CC.'], 1, 2).canvas());
}

/** 몸통 안의 관절 자리 (몸통 가운데에서 잰 px) */
const SHOULDER_F = { x: 25, y: -18 };
const SHOULDER_B = { x: -27, y: -17 };
const NECK = { x: 2, y: -28 };
const SHELL = { x: -10, y: -6 };
const HIP = { x: 15, y: 22 };
const UPPER = 16;
const FORE = 15;
const THIGH = 12;
const SHIN = 12;

type Limb = { up: Phaser.GameObjects.Image; low: Phaser.GameObjects.Image };

export class KappaRig extends BossRig {
  readonly tall = 148;
  private shell: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private armF: Limb;
  private armB: Limb;
  private legs: (Limb & { foot: Phaser.GameObjects.Image; side: number })[];
  private aura: Phaser.GameObjects.Image;
  /** 지금 각도: 앞 위팔 · 앞 아래팔 · 뒤 위팔 · 뒤 아래팔 (절대값 · 0 = 아래로) */
  private cur = { fa: -0.3, fb: -0.5, ba: 0.3, bb: 0.1, lean: 0, headR: 0, squash: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    registerKappaRig(scene);
    this.aura = this.glow('rig-glow').setPosition(0, -80).setScale(3.6, 4).setTint(0x3080ff);
    this.shell = this.part('kr-shell', 0.5, 0.5);
    const back = 0xb0c8b0;
    this.armB = { up: this.part('kr-uarm', 9 / 18, 8 / 32, back), low: this.part('kr-farm', 10 / 36, 7 / 42, back) };
    this.armB.low.setFlipX(true).setOrigin(1 - 10 / 36, 7 / 42);
    this.legs = [-1, 1].map((side) => {
      const foot = this.part('kr-foot', 15 / 30, 11 / 12);
      const low = this.part('kr-shin', 8 / 16, 7 / 28);
      const up = this.part('kr-thigh', 10 / 20, 8 / 30);
      return { foot, up, low, side };
    });
    this.torso = this.part('kr-body', 33 / 66, 36 / 72);
    this.head = this.part('kr-head', 38 / 76, 70 / 72);
    this.armF = { up: this.part('kr-uarm', 9 / 18, 8 / 32), low: this.part('kr-farm', 10 / 36, 7 / 42) };
  }

  protected onPose(p: RigPose): void {
    this.head.setTexture(p === 'rage' ? 'kr-head-crack' : p === 'shout' || p === 'attack' ? 'kr-head-open' : 'kr-head');
    if (p === 'attack') this.drops(10, 1);
    if (p === 'hit') this.drops(4, 0);
  }

  /** 접시에서 물방울이 튄다 */
  private drops(n: number, forward: number): void {
    const dir = this.flipX ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const d = this.scene.add.image(this.x + Phaser.Math.Between(-14, 14), this.y - this.tall + 6, 'kr-drop').setDepth(this.depth + 1);
      this.scene.tweens.add({
        targets: d,
        x: d.x + dir * forward * Phaser.Math.Between(20, 70) + Phaser.Math.Between(-20, 20),
        y: this.y - Phaser.Math.Between(0, 20),
        alpha: 0,
        duration: Phaser.Math.Between(500, 900),
        ease: 'Quad.easeIn',
        onComplete: () => d.destroy(),
      });
    }
  }

  protected animate(dt: number): void {
    const t = this.t;
    const k = this.poseT;
    const bob = Math.sin(t / 480);
    // 앞팔은 −면 앞(+x)으로 · 뒷팔은 +면 바깥(−x)으로
    let fa = -0.4 + Math.sin(t / 700) * 0.08;
    let fb = -0.6 + Math.sin(t / 700) * 0.1;
    let ba = 0.5 + Math.sin(t / 760 + 1) * 0.08;
    let bb = 0.3 + Math.sin(t / 760 + 1) * 0.1;
    let lean = 0;
    let headR = Math.sin(t / 900) * 0.05;
    let squash = 0;
    switch (this.pose) {
      case 'windup':
        // 두 팔을 들고 볼을 부풀린다
        fa = -2.3 + Math.sin(t / 70) * 0.05;
        fb = -3.0;
        ba = 2.3;
        bb = 3.0;
        squash = 0.12;
        headR = -0.08;
        break;
      case 'attack': {
        // 두 팔을 앞으로 뻗어 물대포
        const p = Math.min(1, k / 120);
        fa = -2.3 + p * 0.75;
        fb = -3.0 + p * 1.45;
        ba = 2.3 - p * 3.8;
        bb = 3.0 - p * 4.5;
        lean = 0.1 * p;
        squash = -0.06 * p;
        if (k > 700) this.setPose('idle');
        break;
      }
      case 'shout':
        fa = -1.1;
        fb = -2.2;
        ba = 1.1;
        bb = 2.2;
        headR = -0.14;
        if (k > 1100) this.setPose('idle');
        break;
      case 'hit':
        lean = -0.12 * Math.max(0, 1 - k / 260);
        squash = 0.08;
        if (k > 320) this.setPose('idle');
        break;
      case 'rage':
        fa = -1.5 + Math.sin(t / 80) * 0.25;
        fb = -2.6 + Math.sin(t / 80) * 0.3;
        ba = 1.5 - Math.sin(t / 90 + 1) * 0.25;
        bb = 2.6 - Math.sin(t / 90 + 1) * 0.3;
        headR = Math.sin(t / 60) * 0.05;
        squash = 0.04 + Math.sin(t / 150) * 0.03;
        if (Math.random() < dt / 90) this.drops(1, 0);
        break;
    }
    const c = this.cur;
    const atk = this.pose === 'attack';
    const kk = atk ? 0.6 : 0.16;
    c.fa = approach(c.fa, fa, kk);
    c.fb = approach(c.fb, fb, kk);
    c.ba = approach(c.ba, ba, kk);
    c.bb = approach(c.bb, bb, kk);
    c.lean = approach(c.lean, lean, 0.2);
    c.headR = approach(c.headR, headR, 0.12);
    c.squash = approach(c.squash, squash, 0.2);
    const sy = 1 - c.squash;
    const sx = 1 + c.squash * 0.6;
    // 몸통: 눌리면 낮아지고 (다리가 더 굽는다)
    this.torso.setPosition(c.lean * 30, -48 * sy - bob * 1.5).setScale(sx, sy + bob * 0.015).setRotation(c.lean * 0.5);
    for (const l of this.legs) {
      const h = this.anchor(this.torso, l.side * HIP.x, HIP.y);
      const ax = l.side * 22;
      l.foot.setPosition(ax + l.side * 3, 0).setFlipX(l.side < 0);
      // 개구리처럼 무릎이 바깥으로
      this.leg(l.up, l.low, h.x, h.y, ax, -6, THIGH, SHIN, -l.side);
    }
    const sh = this.anchor(this.torso, SHELL.x, SHELL.y);
    this.shell.setPosition(sh.x, sh.y).setScale(sx, sy).setRotation(c.lean * 0.4);
    const nk = this.anchor(this.torso, NECK.x, NECK.y);
    this.head.setPosition(nk.x, nk.y).setRotation(c.headR + c.lean * 0.4);
    const sf = this.anchor(this.torso, SHOULDER_F.x, SHOULDER_F.y);
    this.chain(this.armF.up, this.armF.low, sf.x, sf.y, UPPER, FORE, c.fa, c.fb);
    const sb = this.anchor(this.torso, SHOULDER_B.x, SHOULDER_B.y);
    this.chain(this.armB.up, this.armB.low, sb.x, sb.y, UPPER, FORE, c.ba, c.bb);
    const rage = this.pose === 'rage';
    this.aura.setAlpha(rage ? 0.2 + Math.sin(t / 120) * 0.08 : Math.max(0, this.aura.alpha - dt / 600));
    // 접시 물이 이따금 넘쳐 흐른다
    if (!rage && Math.random() < dt / 2400) this.drops(1, 0);
  }
}
