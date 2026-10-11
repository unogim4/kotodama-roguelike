import Phaser from 'phaser';
import { registerHd } from '../art/hd/register';

/** 도트 텍스처를 만들고 폰트를 불러온 뒤 타이틀로 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    registerHd(this);

    const fonts = ['10px Galmuri9', '12px Galmuri11', '15px Galmuri14', '600 16px "Klee One"'];
    Promise.all(fonts.map((f) => document.fonts.load(f, 'あ가')))
      .catch(() => undefined)
      // 주소 끝 #sandbox · #bosslab 으로 미리보기 장면에 바로
      .then(() => this.scene.start({ '#sandbox': 'Sandbox', '#bosslab': 'BossLab', '#map': 'ChapterMap' }[location.hash] ?? 'Title'));
  }
}
