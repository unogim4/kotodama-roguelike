import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { HD } from '../art/hd/register';
import { sandboxGround } from '../art/hd/world';
import { chapterDef, chapterWidth, rowShort } from '../data/chapters';
import { MAP_W } from '../map/chapter1';
import { newJourney } from '../systems/journey';
import { saveSummary, loadJourney, hasSave } from '../systems/save';
import { profile } from '../systems/profile';


/** 저장 시각을 '방금 · n분 전 · n시간 전 · n일 전'으로 */
function ago(t: number): string {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 60 / 24)}일 전`;
}

/**
 * 본편 타이틀 — 이어하기(자동 저장 1칸) · 새 이야기 · 개발 미리보기.
 */
export class TitleScene extends Phaser.Scene {
  private ui!: UILayer;

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

    this.ui = new UILayer(this);
    const head = this.ui.el('div', 'main-title');
    head.innerHTML = '<b>언령 <span class="jp">言霊</span></b><span>문자가 사라진 세계</span>';

    const menu = this.ui.el('div', 'main-menu');
    const save = saveSummary();
    if (save) {
      const def = chapterDef(save.chapter);
      const W = save.chapter === 1 ? MAP_W : chapterWidth(def);
      const region = [...def.regions].reverse().find((r) => save.x >= r.from * W)?.name ?? def.title;
      const rows = save.learnedRows.map((r) => rowShort(r)).join('') || '—';
      const cont = this.ui.button(
        `이어하기<small>${save.chapter}장 · ${region} · <span class="jp">${rows}</span> · Lv ${save.level} · 🔮${save.orbs} · ${ago(save.savedAt)}</small>`,
        () => this.continueJourney(),
        'primary main-continue',
        menu,
      );
      cont.title = '지도에 돌아올 때마다 자동으로 저장돼요';
    }
    const row = this.ui.el('div', 'main-row', '', menu);
    this.ui.button('새 이야기', () => (hasSave() ? this.confirmNew() : this.startNew()), save ? '' : 'primary', row);
    this.ui.button('🧪 전투 샘플', () => this.scene.start('Sandbox'), '', row);
    this.ui.button('🧪 보스 시험장', () => this.scene.start('BossLab'), '', row);

    const cleared = [1, 2, 3, 4].filter((n) => profile.seen.includes(`ch${n}-clear`));
    const clear = profile.seen.includes('hiragana-clear') ? ' · <b>히라가나 완주 ✓</b>' : cleared.length ? ` · <b>${cleared.join('·')}장 클리어 ✓</b>` : '';
    this.ui.el('div', 'main-foot', `본편 개발 중 · 1부 히라가나 1~4장 플레이 가능${clear} · <b>F2</b> 설정`);
  }

  private continueJourney(): void {
    if (!loadJourney()) return this.startNew();
    this.go();
  }

  /** 새 이야기 → 프롤로그(한 번 본 뒤엔 건너뛰기 가능) → 지도 */
  private startNew(): void {
    newJourney();
    this.go('Prologue');
  }

  private go(scene = 'ChapterMap'): void {
    this.cameras.main.fadeOut(350, 12, 10, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene));
  }

  /** 저장이 있으면 덮어쓸지 묻는다 */
  private confirmNew(): void {
    if (this.ui.root.querySelector('.title-confirm')) return;
    this.ui.root.classList.add('dimmed');
    const panel = this.ui.el('div', 'panel fade-in title-confirm');
    this.ui.el('h2', '', '새 이야기를 시작할까요?', panel);
    this.ui.el('p', '', '지금 이어지던 여정은 사라져요.<br><small>(저장 칸은 하나예요)</small>', panel);
    const btns = this.ui.el('div', 'row', '', panel);
    btns.style.marginBottom = '0';
    this.ui.button('새로 시작', () => this.startNew(), 'primary', btns);
    this.ui.button('그만두기', () => {
      panel.remove();
      this.ui.root.classList.remove('dimmed');
    }, '', btns);
  }
}
