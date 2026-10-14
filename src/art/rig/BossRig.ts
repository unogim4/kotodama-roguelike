import Phaser from 'phaser';
import { Fine, bayer } from '../fine/fine';

/**
 * 🦴 보스 리그 공용 틀 — 부위를 따로 그려 컨테이너로 조립하고, 부위마다 축을 두고 움직인다.
 * 보스전 · 패턴 코드가 쓰던 스프라이트 함수(setFrame · setTexture · setFlipX · setTint…)를 그대로 받아
 * 자세로 바꿔 준다: 0 대기 · 1 외침 · 2 예비 동작(→ 다시 0이 되면 '공격' 휘두름).
 */
export type RigPose = 'idle' | 'windup' | 'attack' | 'shout' | 'hit' | 'rage';

export abstract class BossRig extends Phaser.GameObjects.Container {
  /** 좌우 뒤집기는 안쪽 컨테이너로 (바깥 scaleX는 찌그러짐 연출에 쓴다) */
  protected readonly inner: Phaser.GameObjects.Container;
  private readonly tintables: { img: Phaser.GameObjects.Image; base?: number }[] = [];
  protected t = 0;
  protected pose: RigPose = 'idle';
  protected poseT = 0;
  /** 몸 높이 (판정 · 말풍선 · 탄이 나가는 자리) */
  abstract readonly tall: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
    this.inner = scene.add.container(0, 0);
    this.add(this.inner);
    this.addToUpdateList();
  }

  /** 부위 하나 (tint가 있으면 늘 그 색으로 — 뒤쪽 부위를 어둡게) */
  protected part(key: string, ox: number, oy: number, tint?: number): Phaser.GameObjects.Image {
    const img = this.scene.add.image(0, 0, key).setOrigin(ox, oy);
    if (tint !== undefined) img.setTint(tint);
    this.inner.add(img);
    this.tintables.push({ img, base: tint });
    return img;
  }

  /** 색이 바뀌지 않는 이펙트 부위 (빛 · 오라) */
  protected glow(key: string): Phaser.GameObjects.Image {
    const img = this.scene.add.image(0, 0, key).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.inner.add(img);
    return img;
  }

  preUpdate(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) * this.scene.time.timeScale;
    this.t += dt;
    this.poseT += dt;
    this.animate(dt);
  }

  protected abstract animate(dt: number): void;
  protected onPose(_p: RigPose): void {}

  setPose(p: RigPose): this {
    this.pose = p;
    this.poseT = 0;
    this.onPose(p);
    return this;
  }

  get currentPose(): RigPose {
    return this.pose;
  }

  // ── 스프라이트처럼 ─────────────────────────────────

  setFrame(f: number | string): this {
    const n = Number(f);
    if (this.pose === 'rage' && n !== 0) return this;
    if (n === 2) return this.setPose('windup');
    if (n === 1) return this.setPose('shout');
    if (this.pose === 'windup') return this.setPose('attack');
    if (this.pose !== 'attack' && this.pose !== 'rage' && this.pose !== 'shout') this.setPose('idle');
    return this;
  }

  setTexture(_key: string, frame: number | string = 0): this {
    return this.setFrame(frame);
  }

  get flipX(): boolean {
    return this.inner.scaleX < 0;
  }

  setFlipX(v: boolean): this {
    this.inner.scaleX = v ? -1 : 1;
    return this;
  }

  setTintFill(c: number): this {
    for (const t of this.tintables) t.img.setTintFill(c);
    return this;
  }

  setTint(c: number): this {
    for (const t of this.tintables) t.img.setTint(c);
    return this;
  }

  clearTint(): this {
    for (const t of this.tintables) {
      if (t.base !== undefined) t.img.setTint(t.base);
      else t.img.clearTint();
    }
    return this;
  }

  /** 맞았다: 하얗게 번쩍 + 젖혀짐 */
  flashHit(): void {
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.active && this.clearTint());
    if (this.pose === 'idle') this.setPose('hit');
  }
}

// ── 그리기 도구 (모든 리그가 같이 쓴다) ─────────────────

export const ell = (f: Fine, cx: number, cy: number, rx: number, ry: number, pick: (nx: number, ny: number, x: number, y: number) => string | null): void => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const c = pick(nx, ny, x, y);
      if (c) f.set(x, y, c);
    }
};

/** 빛은 왼쪽 위에서 — 4단계 램프 */
export const ramp = (r: string, nx: number, ny: number, x: number, y: number, bias = 0): string => {
  const v = (nx * 0.6 + ny * 0.8) * 0.5 + 0.5 + bias + (bayer(x, y) - 0.5) * 0.18;
  return r[v < 0.28 ? 0 : v < 0.55 ? 1 : v < 0.8 ? 2 : 3];
};

/** 굵기가 줄어드는 선 (깃털 · 머리카락 · 뿔 · 손가락) */
export const stroke = (f: Fine, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, pick: (t: number, side: number, x: number, y: number) => string): void => {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const n = Math.ceil(len * 2);
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;
    const w = w0 + (w1 - w0) * t;
    for (let k = -w; k <= w; k += 0.5) {
      const x = Math.round(cx + nx * k);
      const y = Math.round(cy + ny * k);
      f.set(x, y, pick(t, k / Math.max(w, 0.5), x, y));
    }
  }
};

/** 부드러운 원형 빛 텍스처 */
export function registerGlow(scene: Phaser.Scene): void {
  if (scene.textures.exists('rig-glow')) return;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  scene.textures.addCanvas('rig-glow', c);
}

/** 부드럽게 따라가기 */
export const approach = (cur: number, want: number, k: number): number => cur + (want - cur) * k;
