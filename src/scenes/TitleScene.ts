import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { HD } from '../art/hd/register';
import { sandboxGround } from '../art/hd/world';

/**
 * 본편 타이틀. 지금은 개발 중인 미리보기 장면으로 들어가는 입구.
 * (M1에서 '새 이야기' → 프롤로그 → 1챕터 지역 맵으로 이어진다)
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    this.cameras.main.fadeIn(400, 12, 10, 18);
    if (!this.textures.exists('sandbox-ground')) this.textures.addCanvas('sandbox-ground', sandboxGround());
    this.add.image(320, 180, 'sandbox-ground').setScale(1).setAlpha(0.35);
    this.add.rectangle(0, 0, 640, 360, 0x0c0a12, 0.55).setOrigin(0);

    // 코토하와 콘(여우불)이 서 있는 첫 장면
    this.add.ellipse(320, 236, 22, 7, 0x000000, 0.35);
    const kotoha = this.add.sprite(320, 236, HD.player, 0).setOrigin(0.5, 1).setScale(2);
    kotoha.play('p-idle');
    const fox = this.add.image(352, 206, HD.foxfire).setScale(2);
    this.tweens.add({ targets: fox, y: 200, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const ui = new UILayer(this);
    const head = ui.el('div', 'main-title');
    head.innerHTML = '<b>언령 <span class="jp">言霊</span></b><span>문자가 사라진 세계</span>';

    const menu = ui.el('div', 'main-menu');
    const story = ui.button('새 이야기 <small>준비 중</small>', () => undefined, 'primary', menu);
    story.disabled = true;
    ui.button('🧪 전투 샘플', () => this.scene.start('Sandbox'), '', menu);
    ui.button('🧪 보스 시험장', () => this.scene.start('BossLab'), '', menu);

    ui.el('div', 'main-foot', '본편 개발 중 · 전투 리마스터 완료 → 다음: 1챕터 지역 맵 · <b>F2</b> 설정');
  }
}
