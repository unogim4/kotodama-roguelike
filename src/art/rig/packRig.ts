import Phaser from 'phaser';
import type { BossId } from '../../data/chapters';
import { BossRig, RigPose, registerGlow } from './BossRig';
import { registerBossFace } from '../hd/portraits';

/**
 * 🎴 팩 보스 — Ninja Adventure(CC0) 보스 시트를 우리 색으로 다시 칠하고 크게 키워, 자세마다 애니메이션을 튼다.
 * 👺 텐구 = TenguRed · 👹 오니 = GiantRedSamurai · 🐢 갓파 = GiantFrog(+ 머리 접시) · 🏔️ 야마비코 = GiantRacoon(잿빛 털)
 * BossRig를 이어받아 보스전 · 패턴 코드가 쓰던 스프라이트 함수(setFrame · setFlipX · setTint…)를 그대로 받는다.
 */

/** 시트 하나: 프레임 크기 · 발밑 줄(프레임 안 y — 시트마다 캐릭터가 서 있는 높이가 다르다) */
interface Sheet {
  fw: number;
  fh: number;
  foot: number;
}

/** 자세 하나에 트는 동작: 시트의 프레임 범위 · 초당 프레임 · 반복 */
interface Clip {
  sheet: string;
  from: number;
  to: number;
  rate: number;
  loop?: boolean;
  yoyo?: boolean;
}

type Rgb = [number, number, number];

interface PackCfg {
  /** 키우는 배수 (정수 — 도트가 고르게) */
  scale: number;
  /** 몸 높이 (판정 · 말풍선 자리) */
  tall: number;
  /** 시트 이름 → public/assets/ninja/boss/<보스>-<시트>.png */
  sheets: Record<string, Sheet>;
  clips: Record<RigPose, Clip>;
  /** 발악 오라 색 */
  aura: number;
  /** 색 바꾸기 (null이면 그대로) */
  recolor?: (rgb: Rgb) => Rgb | null;
  /** 갓파: 머리 위에 물 접시를 그려 얹는다 */
  dish?: boolean;
}

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const key = (c: Rgb): string => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** 팩 팔레트 → 우리 팔레트 (색 하나하나 짝지어 바꾼다) */
function swap(pairs: Record<string, string>): (rgb: Rgb) => Rgb | null {
  const m = new Map(Object.entries(pairs).map(([a, b]) => [a, hex(b)]));
  return (rgb) => m.get(key(rgb)) ?? null;
}

/** 텐구: 붉은 얼굴 → 주홍 램프 · 검은 날개 → 먹보라 램프 · 살구 → 한지 (보스 비교 ②와 같은 색) */
function tenguColors([r, g, b]: Rgb): Rgb | null {
  const red = [[255, 130, 100], [224, 65, 58], [169, 39, 57], [108, 24, 51]];
  const ink = [[111, 99, 166], [74, 65, 120], [50, 42, 88], [31, 26, 58]];
  const paper = [[255, 251, 233], [239, 224, 182], [205, 182, 136], [150, 120, 80]];
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const mx = Math.max(rr, gg, bb);
  const mn = Math.min(rr, gg, bb);
  const l = (mx + mn) / 2;
  if (l < 0.2) return null; // 외곽선은 그대로
  const s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (mx !== mn) h = mx === rr ? ((gg - bb) / (mx - mn)) % 6 : mx === gg ? (bb - rr) / (mx - mn) + 2 : (rr - gg) / (mx - mn) + 4;
  h = (h * 60 + 360) % 360;
  const tone = (rmp: number[][]) => rmp[Math.max(0, Math.min(3, Math.floor((1 - l) * 4.2 - 0.6)))] as Rgb;
  if (s < 0.25 && l < 0.45) return tone(ink);
  if ((h < 20 || h > 330) && s > 0.35) return tone(red);
  if (h >= 20 && h < 60) return tone(paper);
  return null;
}

const CFG: Record<BossId, PackCfg> = {
  tengu: {
    scale: 3,
    tall: 100,
    sheets: { idle: { fw: 82, fh: 82, foot: 57 }, attack: { fw: 82, fh: 82, foot: 80 }, hit: { fw: 82, fh: 82, foot: 66 }, trans: { fw: 82, fh: 82, foot: 70 } },
    clips: {
      idle: { sheet: 'idle', from: 0, to: 5, rate: 8, loop: true },
      windup: { sheet: 'attack', from: 0, to: 3, rate: 12 },
      attack: { sheet: 'attack', from: 4, to: 14, rate: 20 },
      shout: { sheet: 'trans', from: 4, to: 10, rate: 12 },
      hit: { sheet: 'hit', from: 0, to: 7, rate: 18 },
      rage: { sheet: 'trans', from: 5, to: 8, rate: 10, loop: true, yoyo: true },
    },
    aura: 0xff4030,
    recolor: tenguColors,
  },
  oni: {
    scale: 3,
    tall: 114,
    sheets: { idle: { fw: 96, fh: 48, foot: 42 }, attack: { fw: 96, fh: 96, foot: 70 }, charge: { fw: 96, fh: 96, foot: 76 }, hit: { fw: 96, fh: 48, foot: 44 } },
    clips: {
      idle: { sheet: 'idle', from: 0, to: 5, rate: 8, loop: true },
      windup: { sheet: 'charge', from: 0, to: 2, rate: 10 },
      attack: { sheet: 'attack', from: 0, to: 3, rate: 14 },
      shout: { sheet: 'charge', from: 1, to: 2, rate: 6, loop: true, yoyo: true },
      hit: { sheet: 'hit', from: 0, to: 3, rate: 14 },
      rage: { sheet: 'charge', from: 1, to: 2, rate: 9, loop: true, yoyo: true },
    },
    aura: 0xff3010,
  },
  kappa: {
    scale: 4,
    tall: 104,
    sheets: { idle: { fw: 40, fh: 40, foot: 32 }, charge: { fw: 40, fh: 40, foot: 32 }, attack: { fw: 40, fh: 40, foot: 34 }, hit: { fw: 40, fh: 40, foot: 32 } },
    clips: {
      idle: { sheet: 'idle', from: 0, to: 4, rate: 8, loop: true },
      windup: { sheet: 'charge', from: 0, to: 6, rate: 12 },
      attack: { sheet: 'attack', from: 0, to: 2, rate: 10 },
      shout: { sheet: 'attack', from: 1, to: 2, rate: 6, loop: true, yoyo: true },
      hit: { sheet: 'hit', from: 0, to: 2, rate: 12 },
      rage: { sheet: 'charge', from: 3, to: 6, rate: 10, loop: true, yoyo: true },
    },
    aura: 0x3080ff,
    // 갓파 초록 · 크림빛 배 (볼과 입안의 붉은빛은 그대로)
    recolor: swap({ '#adbc3a': '#72bd52', '#74a334': '#3e8443', '#56864c': '#255232', '#e3f1f5': '#efe0b6', '#9ba7aa': '#cdb688' }),
    dish: true,
  },
  yamabiko: {
    scale: 3,
    tall: 146,
    sheets: { idle: { fw: 60, fh: 60, foot: 54 }, charge: { fw: 60, fh: 60, foot: 54 }, attack: { fw: 60, fh: 60, foot: 57 } },
    clips: {
      idle: { sheet: 'idle', from: 0, to: 5, rate: 8, loop: true },
      windup: { sheet: 'charge', from: 0, to: 1, rate: 6 },
      attack: { sheet: 'attack', from: 0, to: 3, rate: 12 },
      shout: { sheet: 'charge', from: 0, to: 1, rate: 5, loop: true, yoyo: true },
      hit: { sheet: 'idle', from: 0, to: 0, rate: 8 },
      rage: { sheet: 'charge', from: 0, to: 1, rate: 8, loop: true, yoyo: true },
    },
    aura: 0xb090ff,
    // 산의 잿빛 털 · 짙은 줄무늬 · 창백한 얼굴
    recolor: swap({ '#d14b34': '#bab5c8', '#8f3e56': '#6e6882', '#f2ad7d': '#efe0b6' }),
  },
};

const fileOf = (id: BossId, sheet: string) => `${id === 'yamabiko' ? 'yama' : id}-${sheet}`;

/** 시트 파일 목록 (BootScene이 미리 불러 둔다) — 시트들 + 대화 초상화 얼굴 */
export const PACK_BOSS_FILES: string[] = (Object.keys(CFG) as BossId[]).flatMap((id) => [...Object.keys(CFG[id].sheets), 'face'].map((s) => fileOf(id, s)));

/** 그림 한 장을 보스 색으로 */
function recolorCanvas(src: HTMLImageElement, recolor?: (rgb: Rgb) => Rgb | null): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  if (!recolor) return c;
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const out = recolor([d[i], d[i + 1], d[i + 2]]);
    if (out) [d[i], d[i + 1], d[i + 2]] = out;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** 대화 초상화: 팩 얼굴(38px)을 보스 색으로 고쳐 2배로 키우고 가운데 64px만 */
export function registerPackFaces(scene: Phaser.Scene): void {
  for (const id of Object.keys(CFG) as BossId[]) {
    const k = `pkb-src-${fileOf(id, 'face')}`;
    if (!scene.textures.exists(k)) continue;
    const src = recolorCanvas(scene.textures.get(k).getSourceImage() as HTMLImageElement, CFG[id].recolor);
    // 갓파는 얼굴에도 접시 (머리 꼭대기가 잘리지 않게 위를 붙여 그린다)
    const top = CFG[id].dish ? 0 : -4;
    if (CFG[id].dish) {
      const g = src.getContext('2d')!;
      const img = g.getImageData(0, 0, src.width, src.height);
      drawDish(img.data, src.width, 0, src.width, src.height);
      g.putImageData(img, 0, 0);
    }
    registerBossFace(id, () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      g.drawImage(src, 0, 0, src.width, src.height, -6, top, src.width * 2, src.height * 2);
      return c;
    });
  }
}

const srcKey = (file: string) => `pkb-src-${file}`;
const texKey = (id: BossId, sheet: string) => `pkb-${id}-${sheet}`;
const animKey = (id: BossId, pose: RigPose) => `pkb-${id}-${pose}`;

/** 갓파 접시: 머리 꼭대기(눈 사이)에 흰 테 · 물 */
function drawDish(d: Uint8ClampedArray, w: number, ox: number, fw: number, fh: number): void {
  // 프레임의 몸 가운데 · 눈 사이 머리 꼭대기
  let x0 = fw;
  let x1 = -1;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (d[(y * w + ox + x) * 4 + 3] > 0) ((x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)));
  if (x1 < 0) return;
  const cx = Math.round((x0 + x1) / 2);
  let top = fh;
  for (let x = cx - 2; x <= cx + 2; x++)
    for (let y = 0; y < fh; y++)
      if (d[(y * w + ox + x) * 4 + 3] > 0) {
        top = Math.min(top, y);
        break;
      }
  const cy = top + 1;
  const put = (x: number, y: number, c: string) => {
    if (x < 0 || x >= fw || y < 0 || y >= fh) return;
    const i = (y * w + ox + x) * 4;
    const [r, g, b] = hex(c);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = 255;
  };
  const rx = 6.5;
  const ry = 2.6;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x + 0.5 - cx - 0.5) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const r = Math.hypot(nx, ny);
      if (r <= 1) put(x, y, r > 0.7 ? (ny > 0.1 ? '#9ba7aa' : '#f2eaf1') : ny < -0.1 && nx < 0 ? '#ffffff' : '#79b8ce');
      else if (r <= 1.25 && ny < 0.6) put(x, y, '#141b1b');
    }
}

/** 시트들을 다시 칠해 텍스처 · 애니메이션으로 */
export function registerPackBoss(scene: Phaser.Scene, id: BossId): void {
  const cfg = CFG[id];
  for (const [name, sh] of Object.entries(cfg.sheets)) {
    const k = texKey(id, name);
    if (scene.textures.exists(k) || !scene.textures.exists(srcKey(fileOf(id, name)))) continue;
    const c = recolorCanvas(scene.textures.get(srcKey(fileOf(id, name))).getSourceImage() as HTMLImageElement, cfg.recolor);
    const n = Math.floor(c.width / sh.fw);
    if (cfg.dish) {
      const g = c.getContext('2d')!;
      const img = g.getImageData(0, 0, c.width, c.height);
      for (let f = 0; f < n; f++) drawDish(img.data, c.width, f * sh.fw, sh.fw, sh.fh);
      g.putImageData(img, 0, 0);
    }
    const tex = scene.textures.addCanvas(k, c)!;
    for (let f = 0; f < n; f++) tex.add(f, 0, f * sh.fw, 0, sh.fw, sh.fh);
  }
  for (const [pose, clip] of Object.entries(cfg.clips) as [RigPose, Clip][]) {
    const ak = animKey(id, pose);
    if (scene.anims.exists(ak)) continue;
    scene.anims.create({
      key: ak,
      frames: scene.anims.generateFrameNumbers(texKey(id, clip.sheet), { start: clip.from, end: clip.to }),
      frameRate: clip.rate,
      repeat: clip.loop ? -1 : 0,
      yoyo: clip.yoyo ?? false,
    });
  }
  registerGlow(scene);
}

export class PackRig extends BossRig {
  readonly tall: number;
  private readonly cfg: PackCfg;
  private readonly spr: Phaser.GameObjects.Sprite;
  private readonly aura: Phaser.GameObjects.Image;
  /** 자세가 저절로 대기로 돌아가는 때 (ms, 0이면 그대로) */
  private holdMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, readonly bossId: BossId) {
    super(scene, x, y);
    registerPackBoss(scene, bossId);
    this.cfg = CFG[bossId];
    this.tall = this.cfg.tall;
    this.aura = this.glow('rig-glow').setTint(this.cfg.aura);
    this.spr = scene.add.sprite(0, 0, texKey(bossId, 'idle'), 0).setScale(this.cfg.scale);
    this.inner.add(this.spr);
    this.tintTarget(this.spr);
    this.spr.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      // 한 번 트는 동작이 끝나면: 예비는 마지막 프레임에 멈춰 기다리고 · 나머지는 대기로
      if (this.pose === 'attack' || this.pose === 'hit' || this.pose === 'shout') this.setPose('idle');
    });
    this.play('idle');
  }

  private play(p: RigPose): void {
    const clip = this.cfg.clips[p];
    const sh = this.cfg.sheets[clip.sheet];
    this.spr.setOrigin(0.5, sh.foot / sh.fh);
    this.spr.play(animKey(this.bossId, p), true);
  }

  protected onPose(p: RigPose): void {
    this.play(p);
    // 외침은 고리 동작이면 잠시 뒤 대기로
    this.holdMs = p === 'shout' && this.cfg.clips.shout.loop ? 1100 : 0;
    if (p === 'attack') {
      // 내리칠 때 살짝 눌렸다 펴진다
      this.spr.setScale(this.cfg.scale * 1.08, this.cfg.scale * 0.92);
      this.scene.tweens.add({ targets: this.spr, scaleX: this.cfg.scale, scaleY: this.cfg.scale, duration: 220, ease: 'Back.easeOut' });
    }
  }

  protected animate(dt: number): void {
    if (this.holdMs > 0) {
      this.holdMs -= dt;
      if (this.holdMs <= 0 && this.pose === 'shout') this.setPose('idle');
    }
    const rage = this.pose === 'rage';
    const t = this.t;
    // 맞으면 뒤로 젖혀짐 · 발악이면 떨림
    const k = this.poseT;
    this.spr.x = this.pose === 'hit' ? -6 * Math.max(0, 1 - k / 260) : rage ? Math.sin(t / 30) * 1.2 : 0;
    this.aura.setPosition(0, -this.tall * 0.5).setScale((this.tall / 64) * 1.4, (this.tall / 64) * 1.6);
    this.aura.setAlpha(rage ? 0.24 + Math.sin(t / 120) * 0.08 : Math.max(0, this.aura.alpha - dt / 600));
  }
}
