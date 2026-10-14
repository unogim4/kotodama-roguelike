import Phaser from 'phaser';
import { registerHd } from '../art/hd/register';

/** 도트 텍스처를 만들고 폰트를 불러온 뒤 타이틀로 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  /** Ninja Adventure(CC0) 그림 — 바닥 장식 · 분위기 입자 (public/assets/ninja) */
  preload(): void {
    const base = 'assets/ninja/';
    for (const k of ['nature', 'floor-detail', 'water', 'village-abandoned', 'fog', 'raylight']) this.load.image(`nj-${k}`, `${base}${k}.png`);
    this.load.spritesheet('nj-leaf', `${base}leaf.png`, { frameWidth: 12, frameHeight: 7 });
    this.load.spritesheet('nj-leaf-pink', `${base}leaf-pink.png`, { frameWidth: 12, frameHeight: 7 });
    this.load.spritesheet('nj-spark', `${base}spark.png`, { frameWidth: 10, frameHeight: 8 });
    this.load.spritesheet('nj-fire', `${base}fire.png`, { frameWidth: 12, frameHeight: 12 });
    this.load.spritesheet('nj-water-ripples', `${base}water-ripples.png`, { frameWidth: 16, frameHeight: 16 });
  }

  create(): void {
    registerHd(this);

    const fonts = ['10px Galmuri9', '12px Galmuri11', '15px Galmuri14', '600 16px "Klee One"'];
    Promise.all(fonts.map((f) => document.fonts.load(f, 'あ가')))
      .catch(() => undefined)
      // 주소 끝 #sandbox · #bosslab 으로 미리보기 장면에 바로
      .then(() => this.scene.start({ '#sandbox': 'Sandbox', '#bosslab': 'BossLab', '#artlab': 'ArtLab', '#bosscompare': 'BossCompare', '#map': 'ChapterMap', '#library': 'Library', '#raid': 'Raid', '#kon': 'StoryKon', '#prologue': 'Prologue', '#visit': 'Visit', '#boss': 'Boss', '#ending': 'Ending' }[location.hash] ?? 'Title'));
  }
}
