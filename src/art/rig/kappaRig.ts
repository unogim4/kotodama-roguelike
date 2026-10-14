import Phaser from 'phaser';
import { Fine } from '../fine/fine';
import { BossRig, RigPose, ell, ramp, stroke, registerGlow, approach } from './BossRig';

/**
 * 🐢 갓파 리그 — 키 약 150px. 등껍질 · 초록 피부 · 배딱지 · 물갈퀴 · 머리 접시(물) · 앞머리 · 노란 부리 · 큰 눈.
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

// 몸 76×86 (발밑 = 38,86): 통통한 초록 몸 · 연한 배딱지 · 짧은 다리 · 물갈퀴 발
function bodyPart(): HTMLCanvasElement {
  const f = new Fine(78, 88);
  // 다리 · 물갈퀴 발
  for (const [lx, s] of [[24, -1], [54, 1]] as const) {
    ell(f, lx, 70, 9, 11, (nx, ny, x, y) => ramp(G, nx, ny, x, y, 0.04));
    ell(f, lx + s * 4, 84, 12, 4, (nx, ny, x, y) => ramp(G, nx, ny, x, y, 0.1));
    for (let k = 0; k < 3; k++) stroke(f, lx + s * 4, 83, lx + s * 4 - 9 + k * 9, 87, 1.6, 0.8, () => '7');
  }
  // 몸통
  ell(f, 39, 42, 30, 32, (nx, ny, x, y) => ramp(G, nx, ny, x, y, -0.02));
  // 배딱지 (연노랑 · 가로 마디)
  ell(f, 39, 46, 18, 24, (nx, ny, x, y) => (Math.abs(((y - 22) % 8) - 0) < 1 ? 'g' : ramp('fFFg', nx, ny, x, y, -0.05)));
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

// 팔 52×58 (어깨 = 10,8): 초록 팔 · 물갈퀴 손 (세 손가락 + 막)
function arm(): HTMLCanvasElement {
  const f = new Fine(54, 60);
  stroke(f, 10, 8, 26, 36, 8, 6, (_t, side, x, y) => ramp(G, side, 0, x, y));
  // 손 · 물갈퀴
  ell(f, 30, 42, 8, 7, (nx, ny, x, y) => ramp(G, nx, ny, x, y, 0.02));
  for (let k = 0; k < 3; k++) {
    const a = (30 + k * 35) * (Math.PI / 180);
    stroke(f, 32, 44, 32 + Math.cos(a) * 15, 44 + Math.sin(a) * 15, 2.2, 1.2, () => '7');
  }
  ell(f, 38, 50, 7, 5, (nx) => (nx < 0 ? '5' : '6'));
  return f.canvas();
}

const PARTS: Record<string, () => HTMLCanvasElement> = {
  'kr-shell': shell,
  'kr-body': bodyPart,
  'kr-head': () => head(false, false),
  'kr-head-open': () => head(true, false),
  'kr-head-crack': () => head(true, true),
  'kr-arm': arm,
};

export function registerKappaRig(scene: Phaser.Scene): void {
  for (const [k, make] of Object.entries(PARTS)) if (!scene.textures.exists(k)) scene.textures.addCanvas(k, make());
  registerGlow(scene);
  if (!scene.textures.exists('kr-drop')) scene.textures.addCanvas('kr-drop', new Fine(6, 8).stamp(['.A..', 'ABB.', 'BBCC', '.CC.'], 1, 2).canvas());
}

export class KappaRig extends BossRig {
  readonly tall = 148;
  private shell: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private armF: Phaser.GameObjects.Image;
  private armB: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private cur = { armF: 0.3, armB: 0.3, lean: 0, headR: 0, squash: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    registerKappaRig(scene);
    this.aura = this.glow('rig-glow').setPosition(0, -80).setScale(3.6, 4).setTint(0x3080ff);
    this.armB = this.part('kr-arm', 10 / 54, 8 / 60, 0xb0c8b0).setFlipX(true);
    this.shell = this.part('kr-shell', 0.5, 0.5);
    this.torso = this.part('kr-body', 0.5, 1);
    this.head = this.part('kr-head', 38 / 76, 70 / 72);
    this.armF = this.part('kr-arm', 10 / 54, 8 / 60);
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
    // 팔 각도는 절대값 (뒷팔은 몸 왼쪽: 바깥 = +)
    let armF = 0.35 + Math.sin(t / 700) * 0.1;
    let armB = -0.35 - Math.sin(t / 760 + 1) * 0.1;
    let lean = 0;
    let headR = Math.sin(t / 900) * 0.05;
    let squash = 0;
    switch (this.pose) {
      case 'windup':
        armF = -2.2 + Math.sin(t / 70) * 0.05;
        armB = 2.2;
        squash = 0.12;
        headR = -0.08;
        break;
      case 'attack': {
        // 두 팔을 앞으로 뻗어 물대포
        const p = Math.min(1, k / 120);
        // 두 팔 모두 앞으로 (물대포)
        armF = -2.2 + p * 0.9;
        armB = 2.2 - p * 3.4;
        lean = 0.1 * p;
        squash = -0.06 * p;
        if (k > 700) this.setPose('idle');
        break;
      }
      case 'shout':
        armF = -0.8;
        armB = 0.8;
        headR = -0.14;
        if (k > 1100) this.setPose('idle');
        break;
      case 'hit':
        lean = -0.12 * Math.max(0, 1 - k / 260);
        squash = 0.08;
        if (k > 320) this.setPose('idle');
        break;
      case 'rage':
        armF = -1.4 + Math.sin(t / 80) * 0.2;
        armB = 1.4 - Math.sin(t / 90 + 1) * 0.2;
        headR = Math.sin(t / 60) * 0.05;
        squash = 0.04 + Math.sin(t / 150) * 0.03;
        if (Math.random() < dt / 90) this.drops(1, 0);
        break;
    }
    const c = this.cur;
    const atk = this.pose === 'attack';
    c.armF = approach(c.armF, armF, atk ? 0.6 : 0.16);
    c.armB = approach(c.armB, armB, atk ? 0.6 : 0.16);
    c.lean = approach(c.lean, lean, 0.2);
    c.headR = approach(c.headR, headR, 0.12);
    c.squash = approach(c.squash, squash, 0.2);
    const sy = 1 - c.squash;
    const sx = 1 + c.squash * 0.6;
    this.torso.setPosition(c.lean * 30, 0).setScale(sx, sy + bob * 0.015).setRotation(c.lean * 0.5);
    const top = -84 * sy - bob * 1.5;
    this.shell.setPosition(-10 + c.lean * 20, -52 * sy).setScale(sx, sy).setRotation(c.lean * 0.4);
    this.head.setPosition(2 + c.lean * 60, top + 10).setRotation(c.headR + c.lean * 0.4);
    this.armF.setPosition(22 + c.lean * 40, top + 22).setRotation(c.armF);
    this.armB.setPosition(-24 + c.lean * 30, top + 22).setRotation(c.armB);
    const rage = this.pose === 'rage';
    this.aura.setAlpha(rage ? 0.2 + Math.sin(t / 120) * 0.08 : Math.max(0, this.aura.alpha - dt / 600));
    // 접시 물이 이따금 넘쳐 흐른다
    if (!rage && Math.random() < dt / 2400) this.drops(1, 0);
  }
}
