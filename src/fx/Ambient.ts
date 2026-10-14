import Phaser from 'phaser';
import type { AmbientKind } from '../art/hd/raidArena';
import type { LightSrc } from './Lighting';

interface Mote {
  img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  kind: AmbientKind;
  vx: number;
  vy: number;
  t: number;
  phase: number;
}

/** 빛 점 (반딧불 · 먼지) */
function dotTexture(scene: Phaser.Scene, key: string, core: string, edge: string): void {
  if (scene.textures.exists(key)) return;
  const c = document.createElement('canvas');
  c.width = c.height = 5;
  const g = c.getContext('2d')!;
  g.fillStyle = edge;
  g.fillRect(1, 0, 3, 5);
  g.fillRect(0, 1, 5, 3);
  g.fillStyle = core;
  g.fillRect(1, 1, 3, 3);
  scene.textures.addCanvas(key, c);
}

/**
 * 🍃 분위기 입자 — 카메라가 보는 자리 둘레에만 띄운다 (화면 밖으로 나가면 반대쪽에서 다시).
 * 벚꽃잎 · 낙엽(Ninja Adventure CC0 프레임) · 반딧불 · 불씨 · 안개 · 햇살 · 먼지
 */
export class Ambient {
  private motes: Mote[] = [];
  private fog: Phaser.GameObjects.TileSprite | null = null;
  private rays: Phaser.GameObjects.Image[] = [];
  private t = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    kinds: AmbientKind[],
    /** 어둠이 깔린 장면이면 낙엽을 어둠 아래로 */
    private readonly dark = false,
  ) {
    const a = scene.anims;
    const mk = (key: string, tex: string, n: number, rate: number) =>
      scene.textures.exists(tex) && !a.exists(key) && a.create({ key, frames: a.generateFrameNumbers(tex, { start: 0, end: n - 1 }), frameRate: rate, repeat: -1 });
    mk('amb-petal', 'nj-leaf-pink', 6, 7);
    mk('amb-leaf', 'nj-leaf', 6, 7);
    mk('amb-fire', 'nj-fire', 8, 10);
    dotTexture(scene, 'amb-firefly', '#f4ffb0', '#9ee05a');
    dotTexture(scene, 'amb-mote', '#fffaf0', '#f0d890');
    const v = scene.cameras.main.worldView;
    for (const k of kinds) {
      if (k === 'fog' && scene.textures.exists('nj-fog')) {
        this.fog = scene.add.tileSprite(v.x, v.y, 800, 520, 'nj-fog').setOrigin(0).setAlpha(this.dark ? 0.09 : 0.07).setDepth(2050).setTileScale(2);
        continue;
      }
      if (k === 'rays' && scene.textures.exists('nj-raylight')) {
        for (let i = 0; i < 4; i++) this.rays.push(scene.add.image(0, 0, 'nj-raylight').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(2600).setScale(2.2));
        continue;
      }
      const n = { petal: 26, leaf: 22, firefly: 26, ember: 22, mote: 28 }[k as 'petal'] ?? 0;
      for (let i = 0; i < n; i++) this.spawn(k, true);
    }
  }

  private spawn(kind: AmbientKind, anywhere: boolean, m?: Mote): void {
    const v = this.scene.cameras.main.worldView;
    const x = v.x - 40 + Math.random() * (v.width + 80);
    const y = anywhere || kind === 'ember' ? v.y - 30 + Math.random() * (v.height + 60) : v.y - 20;
    const s = this.scene;
    let img = m?.img;
    if (!img) {
      if (kind === 'petal' || kind === 'leaf') {
        const sp = s.add.sprite(x, y, kind === 'petal' ? 'nj-leaf-pink' : 'nj-leaf', 0).setDepth(this.dark ? 1900 : 2500);
        if (s.anims.exists(`amb-${kind}`)) sp.play({ key: `amb-${kind}`, startFrame: Math.floor(Math.random() * 6) });
        img = sp;
      } else if (kind === 'ember') {
        const sp = s.add.sprite(x, y, 'nj-fire', 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(2100).setScale(0.6);
        if (s.anims.exists('amb-fire')) sp.play({ key: 'amb-fire', startFrame: Math.floor(Math.random() * 8) });
        img = sp;
      } else img = s.add.image(x, y, kind === 'firefly' ? 'amb-firefly' : 'amb-mote').setBlendMode(Phaser.BlendModes.ADD).setDepth(2100);
    }
    img.setPosition(x, y);
    const mote: Mote = m ?? { img, kind, vx: 0, vy: 0, t: 0, phase: 0 };
    mote.t = 0;
    mote.phase = Math.random() * Math.PI * 2;
    if (kind === 'petal' || kind === 'leaf') {
      mote.vx = 14 + Math.random() * 26;
      mote.vy = 16 + Math.random() * 18;
    } else if (kind === 'ember') {
      mote.vx = (Math.random() - 0.5) * 12;
      mote.vy = -(16 + Math.random() * 22);
    } else if (kind === 'firefly') {
      mote.vx = (Math.random() - 0.5) * 16;
      mote.vy = (Math.random() - 0.5) * 12;
    } else {
      mote.vx = (Math.random() - 0.5) * 6;
      mote.vy = -2 - Math.random() * 4;
      img.setAlpha(0.5);
    }
    if (!m) this.motes.push(mote);
  }

  update(dt: number): void {
    this.t += dt;
    const sec = dt / 1000;
    const v = this.scene.cameras.main.worldView;
    for (const m of this.motes) {
      m.t += dt;
      const img = m.img;
      if (m.kind === 'petal' || m.kind === 'leaf') {
        img.x += (m.vx + Math.sin(m.t / 420 + m.phase) * 18) * sec;
        img.y += m.vy * sec;
      } else if (m.kind === 'firefly') {
        // 느릿느릿 떠돌며 깜빡인다
        m.vx += (Math.random() - 0.5) * 30 * sec;
        m.vy += (Math.random() - 0.5) * 24 * sec;
        m.vx = Phaser.Math.Clamp(m.vx, -14, 14);
        m.vy = Phaser.Math.Clamp(m.vy, -10, 10);
        img.x += m.vx * sec;
        img.y += m.vy * sec;
        img.setAlpha(0.35 + Math.max(0, Math.sin(m.t / 380 + m.phase)) * 0.65);
      } else if (m.kind === 'ember') {
        img.x += (m.vx + Math.sin(m.t / 300 + m.phase) * 8) * sec;
        img.y += m.vy * sec;
        img.setAlpha(Math.max(0, Math.sin((Math.min(m.t, 4200) / 4200) * Math.PI)));
      } else {
        img.x += (m.vx + Math.sin(m.t / 900 + m.phase) * 3) * sec;
        img.y += m.vy * sec;
        img.setAlpha(0.25 + Math.max(0, Math.sin(m.t / 700 + m.phase)) * 0.45);
      }
      const out = img.x < v.x - 60 || img.x > v.right + 60 || img.y < v.y - 60 || img.y > v.bottom + 60 || (m.kind === 'ember' && m.t > 4200);
      if (out) this.spawn(m.kind, m.kind === 'firefly' || m.kind === 'mote', m);
    }
    if (this.fog) {
      this.fog.setPosition(v.x - 80, v.y - 80);
      this.fog.tilePositionX = (v.x - 80) / 2 + this.t * 0.006;
      this.fog.tilePositionY = (v.y - 80) / 2 + Math.sin(this.t / 4000) * 6;
    }
    this.rays.forEach((r, i) => {
      r.setPosition(v.x + 80 + i * 170 + Math.sin(this.t / 3000 + i) * 20, v.y + 60);
      r.setAlpha(0.05 + Math.max(0, Math.sin(this.t / 2600 + i * 1.7)) * 0.09);
    });
  }

  /** 빛을 내는 입자 (반딧불 · 불씨) — 조명에 넘긴다 */
  lights(): LightSrc[] {
    const out: LightSrc[] = [];
    for (const m of this.motes) {
      if (m.kind === 'firefly') out.push({ x: m.img.x, y: m.img.y, r: 22, color: 0xc8ff80, i: m.img.alpha });
      else if (m.kind === 'ember') out.push({ x: m.img.x, y: m.img.y, r: 18, color: 0xff9a40, i: m.img.alpha * 0.8 });
    }
    return out;
  }
}
