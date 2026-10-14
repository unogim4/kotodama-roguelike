import Phaser from 'phaser';
import { Fine } from '../fine/fine';
import { BossRig, RigPose, ell, ramp, stroke, limb, registerGlow, approach } from './BossRig';

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
  for (const s of [-1, 1]) {
    const lx = cx + s * 11;
    // 외굽 게타 (발판 + 가운데 굽 하나)
    for (let x = lx - 8; x <= lx + 8; x++) f.set(x, 114, x === lx - 8 ? 'O' : 'o').set(x, 115, 'O').set(x, 116, 'X');
    for (let y = 117; y < 122; y++) for (let x = lx - 2; x <= lx + 2; x++) f.set(x, y, x === lx - 2 ? 'O' : 'X');
    // 버선 (흰 · 엄지가 갈라진)
    ell(f, lx + s, 111, 6.5, 3.4, (nx, ny, x, y) => ramp('wWVU', nx, ny, x, y, 0.05));
    f.set(lx + s * 4, 110, 'V').set(lx + s * 4, 111, 'V');
    // 게타 끈 (붉은 하나오)
    f.set(lx - 2, 109, 'R').set(lx - 1, 110, 'R').set(lx, 109, 'r').set(lx + 1, 110, 'R').set(lx + 2, 109, 'R');
    // 각반 (흰 정강이 · 아래로 가늘어짐 · 붉은 끈이 엇갈림)
    for (let y = 94; y < 109; y++) {
      const t = (y - 94) / 15;
      const half = 6.2 - t * 1.8;
      for (let x = Math.round(lx - half); x <= Math.round(lx + half); x++) {
        const nx = (x + 0.5 - lx) / half;
        const tie = Math.abs(((x - lx + y) % 7) + 7) % 7 === 0 || Math.abs(((lx - x + y) % 7) + 7) % 7 === 0;
        f.set(x, y, tie && y > 97 && y < 106 ? 'q' : ramp('wWVU', nx, -0.2, x, y, 0.06));
      }
    }
  }
  // 하카마 (쪽빛 · 주름 · 아래로 퍼지고 두 가랑이로 갈라짐 · 끝단은 각반 위로 묶임)
  for (let y = 58; y < 99; y++) {
    const t = (y - 58) / 40;
    const half = 19 + t * 11 - Math.max(0, y - 92) * 1.6;
    const gap = y > 78 ? (y - 78) * 0.45 : 0;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      if (Math.abs(x + 0.5 - cx) < gap) continue;
      const nx = (x + 0.5 - cx) / half;
      let c = ramp('uvmM', nx, t * 1.2 - 0.5, x, y, 0.08);
      const pleat = Math.round(x - cx + (x - cx) * t * 0.5) % 7 === 0;
      if (pleat) c = 'M';
      if (y === 98 || Math.abs(Math.abs(x + 0.5 - cx) - gap) < 1) c = 'M';
      f.set(x, y, c);
    }
  }
  // 저고리 (흰 · 둥근 어깨 · 허리 좁게)
  for (let y = 10; y < 60; y++) {
    const t = (y - 12) / 48;
    const sh = y < 20 ? Math.sqrt(Math.max(0, 1 - ((20 - y) / 10) ** 2)) : 1;
    const half = (13 + (23 - t * 4 + Math.sin(Math.max(0, t) * Math.PI) * 1.5 - 13) * sh);
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

// ── 위 소매 28×42 (어깨 축 = 14,11 · 팔꿈치 = 14,30): 둥근 어깨가 축을 감싸고 아래로 넓어진다 ──

function upperSleeve(): HTMLCanvasElement {
  const f = new Fine(30, 44);
  limb(f, 15, 11, 9.5, 15, 30, 10.5, (nx, ny, x, y, t) => {
    // 소매 주름 (비스듬한 줄)
    if (t > 0.25 && (Math.round(nx * 6 + t * 9) % 5 === 0) && nx > -0.5) return 'V';
    return ramp('wWVU', nx, ny, x, y, 0.03);
  });
  // 어깨 솔기
  for (let k = -6; k <= 6; k++) f.set(15 + k, 15 + Math.round(Math.abs(k) * 0.3), 'V');
  return f.canvas();
}

// ── 아래 소매 + 손 + 깃털 부채 60×74 (팔꿈치 축 = 16,10): 넓은 소맷부리 · 붉은 매듭 끈 · 붉은 손 · 하우치와 ──

function sleeveEnd(f: Fine, fan: boolean): void {
  limb(f, 16, 10, 10, 16, 23, 12, (nx, ny, x, y, t) => {
    if (t > 0.3 && (Math.round(nx * 5 - t * 7) % 5 === 0) && nx > -0.4) return 'V';
    return ramp('wWVU', nx, ny, x, y, 0.05);
  });
  // 소맷부리 안쪽 그늘
  ell(f, 16, 27, 10, 4, (_nx, ny) => (ny < -0.2 ? 'V' : 'U'));
  // 붉은 매듭 끈
  f.stamp(['.rR.', 'rRRq', '.qQ.'], 4, 20);
  for (let i = 0; i < 6; i++) f.set(5 + (i % 2), 23 + i, 'R');
  // 손
  ell(f, 17, 31, 4.6, 4.2, (nx, ny, x, y) => ramp('rRqQ', nx, ny, x, y));
  if (!fan) {
    for (let k = 0; k < 3; k++) f.set(15 + k * 2, 35, 'q');
    return;
  }
  // 손잡이 · 깃털 부채 (잎 모양)
  stroke(f, 18, 33, 26, 43, 1.4, 1.2, () => 'O');
  for (let k = 0; k < 11; k++) {
    const a = (10 + k * 12) * (Math.PI / 180);
    stroke(f, 27, 44, 27 + Math.cos(a) * 26, 44 + Math.sin(a) * 22 - 6, 4.2, 1.2, (t, side) => (t > 0.85 ? 'U' : side < -0.3 ? 'w' : side > 0.5 ? 'V' : 'W'));
  }
  ell(f, 28, 44, 3.5, 3, () => 'R');
}

function foreArmFan(): HTMLCanvasElement {
  const f = new Fine(60, 74);
  sleeveEnd(f, true);
  return f.noLine(16, 10, 10.5).canvas();
}

function foreArmBack(): HTMLCanvasElement {
  const f = new Fine(34, 40);
  sleeveEnd(f, false);
  return f.noLine(16, 10, 10.5).canvas();
}

const PARTS: Record<string, () => HTMLCanvasElement> = {
  'tr-wing': wing,
  'tr-body': body,
  'tr-head': () => head(false),
  'tr-head-shout': () => head(true),
  'tr-uarm': upperSleeve,
  'tr-farm': foreArmFan,
  'tr-farmb': foreArmBack,
};

export function registerTenguRig(scene: Phaser.Scene): void {
  for (const [k, make] of Object.entries(PARTS)) if (!scene.textures.exists(k)) scene.textures.addCanvas(k, make());
  registerGlow(scene);
  if (!scene.textures.exists('tr-glow')) scene.textures.addCanvas('tr-glow', scene.textures.get('rig-glow').getSourceImage() as HTMLCanvasElement);
  if (!scene.textures.exists('tr-feather')) scene.textures.addCanvas('tr-feather', new Fine(10, 6).stamp(['..12....', '.1223...', '122334..', '.2344...'], 1, 1).canvas());
}

export type TenguPose = RigPose;

/** 몸 안의 관절 자리 (몸 축 = 발밑 가운데에서 잰 px) */
const SHOULDER_F = { x: 17, y: -105 };
const SHOULDER_B = { x: -17, y: -104 };
const NECK = { x: 2, y: -108 };
const WING_F = { x: -2, y: -98 };
const WING_B = { x: -10, y: -98 };
const UPPER = 19;
const FORE = 22;

type Limb = { up: Phaser.GameObjects.Image; low: Phaser.GameObjects.Image };

/** 👺 텐구 리그 */
export class TenguRig extends BossRig {
  readonly tall = 165;
  private wingB: Phaser.GameObjects.Image;
  private wingF: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private armF: Limb;
  private armB: Limb;
  private aura: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Image[];
  /** 지금 각도: 날개 · 앞 위팔 · 앞 아래팔 · 뒤 위팔 · 뒤 아래팔 (팔은 절대값 · 0 = 아래로 · −면 앞) */
  private cur = { wing: 0, fa: -0.1, fb: -0.6, ba: 0.15, bb: 0.05, lean: 0, headR: 0, lift: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    registerTenguRig(scene);
    const back = 0xd8d0e4;
    this.aura = this.glow('rig-glow').setPosition(0, -90).setScale(3.6, 4.2).setTint(0xff4030);
    this.wingB = this.part('tr-wing', 1 - 12 / 112, 90 / 100, 0x9a90b8).setFlipX(true);
    this.wingF = this.part('tr-wing', 12 / 112, 90 / 100);
    this.armB = { up: this.part('tr-uarm', 15 / 30, 11 / 44, back), low: this.part('tr-farmb', 1 - 16 / 34, 10 / 40, back).setFlipX(true) };
    this.torso = this.part('tr-body', 0.5, 1);
    this.head = this.part('tr-head', 34 / 78, 76 / 80);
    this.armF = { up: this.part('tr-uarm', 15 / 30, 11 / 44), low: this.part('tr-farm', 16 / 60, 10 / 74) };
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
    let fa = -0.12 + Math.sin(t / 900) * 0.06;
    let fb = -0.65 + Math.sin(t / 900) * 0.08;
    let ba = 0.18 + Math.sin(t / 800) * 0.04;
    let bb = 0.02 + Math.sin(t / 800) * 0.05;
    let lean = 0;
    let headR = Math.sin(t / 1100) * 0.03;
    let lift = 0;
    switch (this.pose) {
      case 'windup':
        // 부채를 얼굴 옆 위로 치켜든다
        wing = -0.42 + Math.sin(t / 90) * 0.04;
        fa = -1.8;
        fb = -2.6;
        ba = 0.5;
        bb = 0.3;
        lean = -0.06;
        headR = -0.06;
        break;
      case 'attack': {
        // 부채를 앞으로 내리치며 날개로 한 번
        const p = Math.min(1, k / 140);
        fa = -1.8 + p * 1.1;
        fb = -2.6 + p * 1.6;
        ba = 0.5 - p * 0.3;
        bb = 0.3 - p * 0.2;
        wing = -0.4 + p * 0.65;
        lean = 0.08 * p;
        if (k > 600) this.setPose('idle');
        break;
      }
      case 'shout':
        // 팔을 벌리고 날개를 편다
        wing = -0.55 + Math.sin(t / 60) * 0.05;
        fa = -1.25;
        fb = -1.7;
        ba = 1.1;
        bb = 1.5;
        headR = -0.16;
        lift = -4;
        if (k > 1100) this.setPose('idle');
        break;
      case 'hit':
        lean = -0.12 * Math.max(0, 1 - k / 260);
        wing = 0.2;
        fb = -0.3;
        if (k > 320) this.setPose('idle');
        break;
      case 'rage':
        wing = -0.5 + Math.sin(t / 45) * 0.06;
        fa = -1.6 + Math.sin(t / 130) * 0.2;
        fb = -2.4 + Math.sin(t / 130) * 0.25;
        ba = 1.0 + Math.sin(t / 150) * 0.15;
        bb = 1.3 + Math.sin(t / 150) * 0.2;
        headR = -0.08 + Math.sin(t / 70) * 0.02;
        lift = -6 + Math.sin(t / 300) * 3;
        break;
    }
    const c = this.cur;
    const atk = this.pose === 'attack';
    const kk = atk ? 0.7 : 0.18;
    c.wing = approach(c.wing, wing, atk ? 0.6 : 0.16);
    c.fa = approach(c.fa, fa, kk);
    c.fb = approach(c.fb, fb, kk);
    c.ba = approach(c.ba, ba, 0.16);
    c.bb = approach(c.bb, bb, 0.16);
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
    this.torso.setPosition(0, c.lift).setScale(1, 1 + breath * 0.012).setRotation(c.lean * 0.5);
    const nk = this.anchor(this.torso, NECK.x, NECK.y - breath * 1.4);
    this.head.setPosition(nk.x, nk.y).setRotation(c.headR + c.lean);
    const wf = this.anchor(this.torso, WING_F.x, WING_F.y - breath);
    this.wingF.setPosition(wf.x, wf.y).setRotation(c.wing);
    const wb = this.anchor(this.torso, WING_B.x, WING_B.y - breath);
    this.wingB.setPosition(wb.x, wb.y).setRotation(-c.wing * 0.9);
    const sf = this.anchor(this.torso, SHOULDER_F.x, SHOULDER_F.y - breath);
    this.chain(this.armF.up, this.armF.low, sf.x, sf.y, UPPER, FORE, c.fa, c.fb);
    const sb = this.anchor(this.torso, SHOULDER_B.x, SHOULDER_B.y - breath);
    this.chain(this.armB.up, this.armB.low, sb.x, sb.y, UPPER, FORE, c.ba, c.bb);
    const e0 = this.anchor(this.head, -9, -38);
    const e1 = this.anchor(this.head, 5, -38);
    this.eyes[0].setPosition(e0.x, e0.y);
    this.eyes[1].setPosition(e1.x, e1.y);
  }
}
