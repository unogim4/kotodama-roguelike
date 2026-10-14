import Phaser from 'phaser';
import { Fine } from '../fine/fine';
import { BossRig, RigPose, ell, ramp, stroke, registerGlow, approach } from './BossRig';

/**
 * 👺 텐구 (고급 리그) — 키 약 175px.
 * 부위를 따로 그려(날개 2 · 몸 · 머리 · 부채 든 팔 · 뒷소매) 컨테이너에 붙이고, 부위마다 축을 두고 움직인다.
 * 숨쉬기 · 날개 퍼덕임 · 갈기 · 부채 휘두르기의 따라오는 흔들림이 프레임이 아니라 부위의 움직임에서 나온다.
 */

// ── 날개 112×100 (어깨 축 = 12,90): 뼈대(어깨→팔꿈치→손목) 위에 셋째깃 · 둘째깃 · 첫째깃 · 덮깃을 겹친다 ──

/** 깃털 한 장: 뿌리(x,y)에서 a 방향으로 len, 폭 w — 윗가장자리 밝게 · 아랫가장자리 어둡게 · 깃대 */
function feather(f: Fine, x: number, y: number, a: number, len: number, w: number, base: '2' | '3'): void {
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = -uy;
  const ny = ux;
  for (let t = 0; t <= len; t += 0.5) {
    const k = t / len;
    // 뿌리는 가늘고 가운데가 넓다가 끝이 둥글게
    const half = w * Math.sin(Math.min(1, k * 1.15) * Math.PI * 0.62 + 0.25) * (k > 0.9 ? (1 - k) * 8 : 1);
    for (let q = -half; q <= half; q += 0.5) {
      const px = Math.round(x + ux * t + nx * q);
      const py = Math.round(y + uy * t + ny * q);
      const e = q / Math.max(half, 0.5);
      const ch = e < -0.55 ? (base === '2' ? '1' : '2') : e > 0.6 ? '4' : Math.abs(e) < 0.12 && k < 0.85 ? '4' : base;
      f.set(px, py, ch);
    }
  }
}

function wing(): HTMLCanvasElement {
  const f = new Fine(112, 100);
  const S = { x: 12, y: 90 };
  const E = { x: 40, y: 50 };
  const W = { x: 70, y: 20 };
  const T = { x: 104, y: 10 };
  const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  // 셋째깃 (어깨~팔꿈치, 아래로 짧게)
  for (let i = 0; i < 4; i++) {
    const p = lerp(S, E, 0.15 + i * 0.22);
    feather(f, p.x, p.y, ((100 - i * 6) * Math.PI) / 180, 22 + i * 2, 4.2, '3');
  }
  // 둘째깃 (팔꿈치~손목, 아래 · 바깥으로 — 날개 뒷전)
  for (let i = 0; i < 7; i++) {
    const p = lerp(E, W, i / 6);
    feather(f, p.x, p.y, ((88 - i * 7) * Math.PI) / 180, 34 + i * 1.5, 5, '3');
  }
  // 첫째깃 (손목~날개 끝, 바깥으로 길게 — 끝이 갈라진 까마귀 날개)
  for (let i = 0; i < 7; i++) {
    const p = lerp(W, T, i / 6);
    feather(f, p.x, p.y, ((42 - i * 9) * Math.PI) / 180, 40 - Math.abs(i - 2) * 3, 4.6, '3');
  }
  // 뼈대 (앞전 · 굵고 밝게)
  for (const [a, b, w] of [[S, E, 5.5], [E, W, 4.6], [W, T, 3.4]] as const)
    for (let t = 0; t <= 1; t += 0.01) {
      const p = lerp(a, b, t);
      const ww = w + (1 - t) * 0.8;
      for (let q = -ww; q <= ww; q += 0.5) {
        const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
        f.set(Math.round(p.x + Math.cos(ang) * q), Math.round(p.y + Math.sin(ang) * q), q < -ww * 0.4 ? '1' : q > ww * 0.5 ? '3' : '2');
      }
    }
  // 덮깃 (뼈대를 따라 짧고 둥근 깃 두 줄 — 밝게)
  for (const [row, len, w] of [[0, 13, 4.4], [1, 9, 3.6]] as const)
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const p = t < 0.5 ? lerp(S, E, t * 2) : lerp(E, W, (t - 0.5) * 2);
      feather(f, p.x + row * 2, p.y + 3 + row * 2, ((92 - t * 40) * Math.PI) / 180, len, w, '2');
    }
  return f.canvas();
}

// ── 몸 70×122 (발밑 가운데 = 35,122): 흰 스즈카케 저고리 · 쪽빛 하카마 · 방울 술 · 붉은 띠 · 외굽 게타 ──

function body(): HTMLCanvasElement {
  const f = new Fine(72, 124);
  const cx = 36;
  // 게타 (외굽 나막신)
  for (const gx of [14, 42]) {
    f.stamp(['oooooooooooooo', 'OOOOOOOOOOOOOO'], gx, 112);
    f.stamp(['XXXX', 'XXXX', 'XXXX', 'XXXX', 'XXXX', 'XXXX', 'XXXX', 'XXXX'], gx + 5, 114);
    f.set(gx + 6, 110, 'R').set(gx + 7, 111, 'R').set(gx + 8, 110, 'R');
  }
  // 각반 (흰 다리 · 끈)
  for (const lx of [17, 45]) for (let y = 92; y < 112; y++) for (let x = lx; x < lx + 10; x++) f.set(x, y, x === lx ? 'w' : x > lx + 7 ? 'V' : y % 5 === 0 ? 'U' : 'W');
  // 하카마 (쪽빛 · 주름 · 아래로 퍼진다)
  for (let y = 58; y < 96; y++) {
    const t = (y - 58) / 38;
    const half = 19 + t * 12;
    const gap = y > 84 ? 2 : 0;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      if (gap && Math.abs(x - cx) < gap) continue;
      const nx = (x + 0.5 - cx) / half;
      let c = ramp('uvmM', nx, t * 1.2 - 0.5, x, y, 0.08);
      const pleat = Math.round(x - cx + (x - cx) * t * 0.5) % 7 === 0;
      if (pleat) c = 'M';
      if (y === 95) c = 'M';
      f.set(x, y, c);
    }
  }
  // 저고리 (흰 · 어깨 넓고 허리 좁게)
  for (let y = 12; y < 60; y++) {
    const t = (y - 12) / 48;
    const half = 23 - t * 4 + Math.sin(t * Math.PI) * 1.5;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const nx = (x + 0.5 - cx) / half;
      let c = ramp('wWVU', nx, t * 1.3 - 0.6, x, y, 0.02);
      // 바느질 무늬 (야마부시 옷의 마름모 줄)
      if ((x + y * 2) % 13 === 0 && Math.abs(nx) > 0.35) c = 'V';
      f.set(x, y, c);
    }
  }
  // 옷깃 (겹친 V자 · 안쪽 붉은 속옷)
  for (let i = 0; i < 22; i++) {
    const w = Math.round(i * 0.55);
    for (let x = cx - w; x <= cx + w; x++) f.set(x, 12 + i, i < 5 ? 'R' : x === cx - w || x === cx + w ? 'U' : 'q');
  }
  // 띠 (붉은 오비 + 금 매듭 + 늘어진 끈)
  for (let x = cx - 20; x <= cx + 20; x++) for (let y = 56; y < 62; y++) f.set(x, y, y === 56 ? 'r' : y === 61 ? 'Q' : x > cx + 14 ? 'q' : 'R');
  f.stamp(['.yYY.', 'yYYYz', 'YYzzZ', '.zZZ.'], cx + 10, 55);
  for (let i = 0; i < 14; i++) f.set(cx + 12 + (i % 3 === 0 ? 1 : 0), 61 + i, i > 11 ? 'Q' : 'R').set(cx + 14, 61 + i, i > 10 ? 'q' : 'R');
  // 방울 술 (본텐) — 큰 셋 · 작은 셋
  const pom = (x: number, y: number, r: number, ch: string) =>
    ell(f, x, y, r, r * 0.95, (nx, ny) => (nx < -0.25 && ny < -0.25 ? (ch === 'R' ? 'r' : ch === 'Y' ? 'y' : 'w') : nx + ny > 0.75 ? (ch === 'R' ? 'Q' : ch === 'Y' ? 'z' : 'V') : ch));
  for (const [x, y, r, c] of [[cx - 12, 22, 4.6, 'R'], [cx - 12, 34, 4.6, 'W'], [cx - 12, 46, 4.6, 'R'], [cx + 12, 22, 4.6, 'Y'], [cx + 12, 34, 4.6, 'R'], [cx + 12, 46, 4.6, 'Y']] as const) pom(x, y, r, c);
  return f.canvas();
}

// ── 머리 76×78 (목 = 34,78): 붉은 긴 코 가면 · 흰 갈기 · 검은 도킨 · 금빛 눈 · 흰 수염 ──

function head(shout = false): HTMLCanvasElement {
  const f = new Fine(78, 80);
  const fx = 34;
  const fy = 40;
  // 갈기 (뒤 · 위로 흩날리는 흰 머리)
  for (let k = 0; k < 22; k++) {
    const a = (150 + k * 5.2 + (k % 3) * 4) * (Math.PI / 180);
    const len = 26 + ((k * 7) % 5) * 6;
    const dark = k % 4 === 3;
    stroke(f, fx - 2, fy - 8 + (k % 5), fx - 2 + Math.cos(a) * len * 1.25, fy - 4 + Math.sin(a) * len * 0.7 + k * 1.3, 4.2 - (k % 3) * 0.6, 0.8, (t, side) =>
      dark ? (t > 0.7 ? 'U' : 'V') : side < -0.4 ? 'w' : t > 0.8 ? 'V' : side > 0.45 ? 'V' : 'W',
    );
  }
  // 얼굴 (붉은 가면 · 광대 · 이마 주름)
  ell(f, fx, fy, 17, 18, (nx, ny, x, y) => ramp('rRqQ', nx, ny, x, y, -0.06));
  for (let x = fx - 8; x <= fx + 6; x++) f.set(x, fy - 12 + ((x & 3) === 0 ? 1 : 0), 'q');
  ell(f, fx - 9, fy + 5, 4, 3, (nx) => (nx < 0 ? 'r' : 'R'));
  // 수염 (흰 · 턱 아래로 길게)
  for (let k = 0; k < 10; k++) stroke(f, fx - 11 + k * 2.6, fy + 13, fx - 13 + k * 2.8, fy + 28 + (k % 3) * 3, 2.4, 0.6, (t) => (t > 0.7 ? 'V' : k < 3 ? 'w' : 'W'));
  // 긴 코 (오른쪽 · 살짝 위로)
  stroke(f, fx + 12, fy + 1, fx + 41, fy - 8, 6.4, 2.4, (_t, side) => (side < -0.4 ? 'r' : side > 0.45 ? 'Q' : 'R'));
  f.set(fx + 40, fy - 9, 'r').set(fx + 39, fy - 10, 'r');
  // 눈썹 (흰 · 성나게 치켜 올라감)
  stroke(f, fx - 13, fy - 9, fx - 2, fy - 5, 2.8, 1.6, () => 'W');
  stroke(f, fx + 3, fy - 5, fx + 14, fy - 11, 2.8, 1.6, () => 'W');
  // 눈 (금빛 · 검은 테)
  f.stamp(['kkkkkk', 'kyYYzk', 'kYYzzk', '.kkkk.'], fx - 11, fy - 3).stamp(['kkkkk', 'kyYzk', 'kYzzk', '.kkk.'], fx + 4, fy - 3);
  f.set(fx - 9, fy - 2, 'h').set(fx + 5, fy - 2, 'h');
  // 입
  if (shout) f.stamp(['QQQQQQQQ', 'QkkkkkkQ', 'QkRRRRkQ', 'QkkRRkkQ', '.QQQQQQ.'], fx - 5, fy + 8);
  else f.stamp(['.QQQQQQ.', 'Q......Q'], fx - 5, fy + 10);
  // 도킨 (작은 검은 모자 · 끈)
  f.stamp(['....xxxxx....', '...xLLLPPx...', '..xLLLPPPPx..', '.xLLPPPPPPPx.', 'xPPPPPPPPPPPx', 'xxxxxxxxxxxxx'], fx - 7, fy - 25);
  for (let i = 0; i < 9; i++) f.set(fx - 9 - Math.round(i * 0.5), fy - 20 + i, 'k');
  return f.canvas();
}

// ── 부채 든 팔 70×70 (어깨 = 10,10): 큰 소매 · 붉은 손 · 깃털 하우치와 ──

function armFront(): HTMLCanvasElement {
  const f = new Fine(72, 72);
  // 소매: 어깨(위)는 좁고 아래로 넓게 늘어진다 · 아래 가장자리는 둥글게
  for (let y = 4; y < 38; y++) {
    const t = (y - 4) / 34;
    const x0 = 6 - t * 3;
    const x1 = 18 + t * 14;
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const nx = ((x - x0) / (x1 - x0)) * 2 - 1;
      if (y > 30 && Math.abs(nx) > 1 - (38 - y) / 9) continue;
      let c = ramp('wWVU', nx, t * 1.4 - 0.6, x, y, 0.03);
      if ((x - 6 + Math.round(t * 6)) % 8 === 0 && t > 0.2) c = 'V';
      f.set(x, y, c);
    }
  }
  // 소매 안쪽 그늘 · 붉은 매듭 끈
  for (let x = 12; x < 28; x++) f.set(x, 36, 'U').set(x, 35, x % 3 ? 'V' : 'U');
  f.stamp(['.rR.', 'rRRq', '.qQ.'], 4, 30);
  for (let i = 0; i < 6; i++) f.set(5 + (i % 2), 33 + i, 'R');
  // 손 · 손잡이
  ell(f, 32, 36, 4.5, 4, (nx, ny, x, y) => ramp('rRqQ', nx, ny, x, y));
  stroke(f, 33, 38, 41, 47, 1.4, 1.2, () => 'O');
  // 깃털 부채 (잎 모양)
  for (let k = 0; k < 11; k++) {
    const a = (10 + k * 12) * (Math.PI / 180);
    stroke(f, 42, 48, 42 + Math.cos(a) * 26, 48 + Math.sin(a) * 22 - 6, 4.2, 1.2, (t, side) => (t > 0.85 ? 'U' : side < -0.3 ? 'w' : side > 0.5 ? 'V' : 'W'));
  }
  ell(f, 43, 48, 3.5, 3, () => 'R');
  return f.canvas();
}

// ── 뒷소매 30×40 ──

function armBack(): HTMLCanvasElement {
  const f = new Fine(32, 42);
  for (let y = 2; y < 38; y++)
    for (let x = 2; x < 28; x++) {
      const nx = (x - 15) / 13;
      const ny = (y - 20) / 18;
      if (nx * nx + ny * ny * 0.9 > 1) continue;
      f.set(x, y, ramp('WVUU', nx, ny, x, y, 0.15));
    }
  return f.canvas();
}

const PARTS: Record<string, () => HTMLCanvasElement> = {
  'tr-wing': wing,
  'tr-body': body,
  'tr-head': () => head(false),
  'tr-head-shout': () => head(true),
  'tr-arm': armFront,
  'tr-armb': armBack,
};

export function registerTenguRig(scene: Phaser.Scene): void {
  for (const [k, make] of Object.entries(PARTS)) if (!scene.textures.exists(k)) scene.textures.addCanvas(k, make());
  registerGlow(scene);
  if (!scene.textures.exists('tr-glow')) scene.textures.addCanvas('tr-glow', scene.textures.get('rig-glow').getSourceImage() as HTMLCanvasElement);
  if (!scene.textures.exists('tr-feather')) scene.textures.addCanvas('tr-feather', new Fine(10, 6).stamp(['..12....', '.1223...', '122334..', '.2344...'], 1, 1).canvas());
}

export type TenguPose = RigPose;

/** 👺 텐구 리그 */
export class TenguRig extends BossRig {
  readonly tall = 165;
  private wingB: Phaser.GameObjects.Image;
  private wingF: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private arm: Phaser.GameObjects.Image;
  private armB: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Image[];
  private cur = { wing: 0, arm: 0.15, lean: 0, headR: 0, lift: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    registerTenguRig(scene);
    this.aura = this.glow('rig-glow').setPosition(0, -90).setScale(3.6, 4.2).setTint(0xff4030);
    this.wingB = this.part('tr-wing', 1 - 12 / 112, 90 / 100, 0x9a90b8).setFlipX(true);
    this.wingF = this.part('tr-wing', 12 / 112, 90 / 100);
    this.armB = this.part('tr-armb', 0.7, 0.08, 0xd8d0e4);
    this.torso = this.part('tr-body', 0.5, 1);
    this.head = this.part('tr-head', 34 / 78, 76 / 80);
    this.arm = this.part('tr-arm', 10 / 72, 10 / 72);
    this.eyes = [0, 1].map(() => this.glow('rig-glow').setScale(0.18).setTint(0xffd060));
    this.layout();
  }

  protected onPose(p: RigPose): void {
    if (p === 'attack') this.feathers(14);
    this.head.setTexture(p === 'shout' || p === 'rage' ? 'tr-head-shout' : 'tr-head');
  }

  /** 깃털이 흩날린다 */
  private feathers(n: number): void {
    const dir = this.flipX ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const f = this.scene.add.image(this.x + Phaser.Math.Between(-60, 60), this.y - Phaser.Math.Between(80, 160), 'tr-feather').setDepth(this.depth + 1);
      this.scene.tweens.add({
        targets: f,
        x: f.x + dir * Phaser.Math.Between(20, 90),
        y: f.y + Phaser.Math.Between(30, 90),
        rotation: Phaser.Math.FloatBetween(-3, 3),
        alpha: 0,
        duration: Phaser.Math.Between(700, 1300),
        ease: 'Sine.easeIn',
        onComplete: () => f.destroy(),
      });
    }
  }

  protected animate(dt: number): void {
    const t = this.t;
    const k = this.poseT;
    const breath = Math.sin(t / 620);
    let wing = Math.sin(t / 760) * 0.06;
    let arm = 0.15 + Math.sin(t / 900) * 0.08;
    let lean = 0;
    let headR = Math.sin(t / 1100) * 0.03;
    let lift = 0;
    switch (this.pose) {
      case 'windup':
        wing = -0.42 + Math.sin(t / 90) * 0.04;
        arm = -1.9;
        lean = -0.06;
        headR = -0.06;
        break;
      case 'attack': {
        const p = Math.min(1, k / 140);
        arm = -1.9 + p * 3.1;
        wing = -0.4 + p * 0.65;
        lean = 0.08 * p;
        if (k > 600) this.setPose('idle');
        break;
      }
      case 'shout':
        wing = -0.55 + Math.sin(t / 60) * 0.05;
        arm = -0.6;
        headR = -0.16;
        lift = -4;
        if (k > 1100) this.setPose('idle');
        break;
      case 'hit':
        lean = -0.12 * Math.max(0, 1 - k / 260);
        wing = 0.2;
        if (k > 320) this.setPose('idle');
        break;
      case 'rage':
        wing = -0.5 + Math.sin(t / 45) * 0.06;
        arm = -0.9 + Math.sin(t / 130) * 0.2;
        headR = -0.08 + Math.sin(t / 70) * 0.02;
        lift = -6 + Math.sin(t / 300) * 3;
        break;
    }
    const c = this.cur;
    const atk = this.pose === 'attack';
    c.wing = approach(c.wing, wing, atk ? 0.6 : 0.16);
    c.arm = approach(c.arm, arm, atk ? 0.7 : 0.18);
    c.lean = approach(c.lean, lean, 0.2);
    c.headR = approach(c.headR, headR, 0.12);
    c.lift = approach(c.lift, lift, 0.08);
    this.layout(breath);
    const rage = this.pose === 'rage';
    this.aura.setAlpha(rage ? 0.25 + Math.sin(t / 120) * 0.08 : Math.max(0, this.aura.alpha - dt / 600));
    this.eyes.forEach((e) => e.setAlpha(rage || this.pose === 'shout' ? 0.8 + Math.sin(t / 50) * 0.2 : 0));
    if (rage && Math.random() < dt / 160) this.feathers(1);
  }

  private layout(breath = 0): void {
    const c = this.cur;
    const by = c.lift;
    this.torso.setPosition(0, by).setScale(1, 1 + breath * 0.012).setRotation(c.lean * 0.5);
    const neckY = -108 + by - breath * 1.4;
    this.head.setPosition(2 + c.lean * 40, neckY).setRotation(c.headR + c.lean);
    this.wingF.setPosition(-2, -98 + by - breath).setRotation(c.wing);
    this.wingB.setPosition(-10, -98 + by - breath).setRotation(-c.wing * 0.9);
    this.arm.setPosition(14 + c.lean * 30, -100 + by - breath).setRotation(c.arm);
    this.armB.setPosition(-14, -100 + by - breath).setRotation(-0.1 + Math.sin(this.t / 800) * 0.04);
    this.eyes[0].setPosition(this.head.x - 8, neckY - 37);
    this.eyes[1].setPosition(this.head.x + 6, neckY - 37);
  }
}
