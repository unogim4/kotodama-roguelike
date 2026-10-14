import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { registerHd } from '../art/hd/register';
import { registerBosses, arenaGround } from '../art/hd/bossArt';
import { TenguRig, TenguPose, registerTenguRig } from '../art/rig/tenguRig';

/** 팩 텐구 시트 (Ninja Adventure · CC0) — 프레임 수 */
const PACK: Record<string, number> = { idle: 6, attack: 15, hit: 8, trans: 11, walk: 10 };

/**
 * 🧪 보스 비교 (#bosscompare) — 텐구 하나를 세 가지로:
 * ① 지금(80px · 자세 3장) ② 팩 개조(Ninja Adventure TenguRed를 우리 색으로 · 2배 · 같은 이펙트) ③ 고급 코드 리그(약 175px · 부위별 움직임)
 * 1 대기 · 2 공격 · 3 외침 · 4 피격 · 5 발악 · Z 확대(←/→ 칸 고르기)
 */
export class BossCompareScene extends Phaser.Scene {
  private ui!: UILayer;
  private cur!: Phaser.GameObjects.Sprite;
  private pack!: Phaser.GameObjects.Sprite;
  private packAura!: Phaser.GameObjects.Image;
  private rig!: TenguRig;
  private pose: TenguPose = 'idle';
  private zoomCol = -1;
  private hud!: HTMLElement;

  constructor() {
    super('BossCompare');
  }

  preload(): void {
    for (const k of Object.keys(PACK)) this.load.image(`pk-src-${k}`, `assets/ninja/boss/tengu-${k}.png`);
  }

  create(): void {
    registerHd(this);
    registerBosses(this);
    registerTenguRig(this);
    if (!this.textures.exists('arena-tengu')) this.textures.addCanvas('arena-tengu', arenaGround('tengu'));
    this.add.image(0, 0, 'arena-tengu').setOrigin(0);
    const cam = this.cameras.main;
    cam.setScroll(320, 60);
    this.recolorPack();

    const floor = 60 + 300;
    const X = [320 + 110, 320 + 320, 320 + 530];
    for (const x of X) this.add.ellipse(x, floor, 70, 18, 0x000000, 0.3);
    // ① 지금
    this.cur = this.add.sprite(X[0], floor, 'boss-tengu', 0).setOrigin(0.5, 1);
    // ② 팩 개조 (2배 · 우리 색)
    this.packAura = this.add.image(X[1], floor - 80, 'tr-glow').setBlendMode(Phaser.BlendModes.ADD).setScale(3.4, 4).setTint(0xff4030).setAlpha(0);
    this.pack = this.add.sprite(X[1], floor + 6, 'pk-idle', 0).setOrigin(0.5, 1).setScale(2).play('pk-idle');
    this.pack.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.pose !== 'rage' && this.pack.play('pk-idle'));
    // ③ 코드 리그
    this.rig = new TenguRig(this, X[2], floor);

    this.ui = new UILayer(this);
    const labels = ['① 지금 · 80px 자세 3장', '② 팩 개조 · Ninja Adventure 텐구 2배', '③ 고급 코드 리그 · 175px 부위별 움직임'];
    labels.forEach((l, i) => {
      const el = this.ui.el('div', `artlab-label${i ? ' new' : ''}`, l);
      el.style.width = '200px';
      this.ui.place(el, X[i] - 320, floor - 60 + 14);
    });
    this.hud = this.ui.el('div', 'artlab-hud');
    this.renderHud();
    const kb = this.input.keyboard!;
    const poses: TenguPose[] = ['idle', 'attack', 'shout', 'hit', 'rage'];
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].forEach((k, i) => kb.on(`keydown-${k}`, () => this.setPose(poses[i])));
    kb.on('keydown-Z', () => this.zoom(this.zoomCol < 0 ? 2 : -1));
    kb.on('keydown-LEFT', () => this.zoomCol >= 0 && this.zoom(Math.max(0, this.zoomCol - 1)));
    kb.on('keydown-RIGHT', () => this.zoomCol >= 0 && this.zoom(Math.min(2, this.zoomCol + 1)));
    const bar = this.ui.el('div', 'compare-bar');
    ['대기', '공격', '외침', '피격', '발악'].forEach((name, i) => this.ui.button(`${name}<small>${i + 1}</small>`, () => this.setPose(poses[i]), 'small', bar));
    this.ui.button('확대<small>Z</small>', () => this.zoom(this.zoomCol < 0 ? 2 : -1), 'small', bar);
    // 데모: 저절로 자세를 돌려 보인다
    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.pose === 'idle' && this.setPose('attack') });
  }

  /** 팩 시트를 우리 팔레트로 다시 칠한다 (붉은 얼굴 → 주홍 램프, 검은 날개 → 먹보라 램프, 살구 → 한지) */
  private recolorPack(): void {
    const red = [[255, 130, 100], [224, 65, 58], [169, 39, 57], [108, 24, 51]];
    const ink = [[111, 99, 166], [74, 65, 120], [50, 42, 88], [31, 26, 58]];
    const paper = [[255, 251, 233], [239, 224, 182], [205, 182, 136], [150, 120, 80]];
    for (const [k, n] of Object.entries(PACK)) {
      const key = `pk-${k}`;
      if (this.textures.exists(key)) continue;
      const src = this.textures.get(`pk-src-${k}`).getSourceImage() as HTMLImageElement;
      const c = document.createElement('canvas');
      c.width = src.width;
      c.height = src.height;
      const g = c.getContext('2d')!;
      g.drawImage(src, 0, 0);
      const img = g.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const r = d[i] / 255;
        const gg = d[i + 1] / 255;
        const b = d[i + 2] / 255;
        const mx = Math.max(r, gg, b);
        const mn = Math.min(r, gg, b);
        const l = (mx + mn) / 2;
        const s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
        let h = 0;
        if (mx !== mn) h = mx === r ? ((gg - b) / (mx - mn)) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4;
        h = (h * 60 + 360) % 360;
        const tone = (rmp: number[][]) => rmp[Math.max(0, Math.min(3, Math.floor((1 - l) * 4.2 - 0.6)))];
        let out: number[] | null = null;
        if (l < 0.2) continue; // 외곽선은 그대로
        if (s < 0.25 && l < 0.45) out = tone(ink);
        else if ((h < 20 || h > 330) && s > 0.35) out = tone(red);
        else if (h >= 20 && h < 60) out = tone(paper);
        if (out) [d[i], d[i + 1], d[i + 2]] = out;
      }
      g.putImageData(img, 0, 0);
      const tex = this.textures.addCanvas(key, c)!;
      for (let f = 0; f < n; f++) tex.add(f, 0, f * 82, 0, 82, 82);
      if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: k === 'idle' ? 8 : 14, repeat: k === 'idle' ? -1 : 0 });
    }
  }

  private setPose(p: TenguPose): void {
    this.pose = p;
    // ① 지금: 자세 3장 + 번쩍
    this.cur.clearTint().setFrame(p === 'attack' ? 2 : p === 'shout' || p === 'rage' ? 1 : 0);
    if (p === 'hit') {
      this.cur.setTintFill(0xffffff);
      this.time.delayedCall(70, () => this.cur.clearTint());
    }
    if (p === 'rage') this.cur.setTint(0xff9080);
    // ② 팩: 애니메이션 시트
    this.pack.clearTint();
    if (p === 'attack') this.pack.play('pk-attack');
    else if (p === 'shout') this.pack.play('pk-trans');
    else if (p === 'hit') this.pack.play('pk-hit');
    else if (p === 'rage') this.pack.play({ key: 'pk-trans', repeat: -1 });
    else this.pack.play('pk-idle');
    this.packAura.setAlpha(p === 'rage' ? 0.3 : 0);
    // ③ 리그
    this.rig.setPose(p);
    if (p !== 'rage') this.time.delayedCall(1300, () => this.pose === p && (this.pose = 'idle'));
    this.renderHud();
  }

  private zoom(col: number): void {
    this.zoomCol = col;
    const cam = this.cameras.main;
    if (col < 0) {
      cam.setZoom(1).setScroll(320, 60);
    } else {
      cam.setZoom(2);
      cam.centerOn([320 + 110, 320 + 320, 320 + 530][col], 60 + 300 - 90);
    }
    this.renderHud();
  }

  private renderHud(): void {
    this.hud.innerHTML = `<b>🧪 보스 비교 — 텐구</b> · 지금 자세 <b>${{ idle: '대기', windup: '예비', attack: '공격', shout: '외침', hit: '피격', rage: '발악' }[this.pose]}</b> · 1~5 자세 · Z 확대${this.zoomCol >= 0 ? ' (←/→ 칸)' : ''}`;
  }

  update(_t: number, dt: number): void {
    this.rig.update(Math.min(dt, 50));
    this.rig.root.setDepth(this.rig.root.y);
    if (this.pose === 'rage') this.packAura.setAlpha(0.25 + Math.sin(this.time.now / 120) * 0.08);
  }
}
