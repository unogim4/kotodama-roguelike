import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { registerHd } from '../art/hd/register';
import { registerBosses, arenaGround } from '../art/hd/bossArt';
import { TenguRig, TenguPose, registerTenguRig } from '../art/rig/tenguRig';
import { makeBossRig, BossRig, PackRig } from '../art/rig';
import type { BossId } from '../data/chapters';

/** 4보스 나란히 놓는 자리 */
const LINE_X = [320 + 95, 320 + 250, 320 + 400, 320 + 555];

/**
 * 🧪 보스 비교 (#bosscompare) — 텐구 하나를 세 가지로:
 * ① 예전(80px · 자세 3장) ② 팩 개조(Ninja Adventure TenguRed를 우리 색으로 · 3배 — 지금 보스전) ③ 코드 리그(부위별 움직임 · 안 씀)
 * 1 대기 · 2 공격 · 3 외침 · 4 피격 · 5 발악 · Z 확대(←/→ 칸 고르기) · B 4보스 나란히 (야마비코 · 갓파 · 텐구 · 오니)
 */
export class BossCompareScene extends Phaser.Scene {
  private ui!: UILayer;
  private cur!: Phaser.GameObjects.Sprite;
  private pack!: PackRig;
  private rig!: TenguRig;
  private pose: TenguPose = 'idle';
  private zoomCol = -1;
  private hud!: HTMLElement;
  /** 4보스 나란히 보기 */
  private lineup: BossRig[] = [];
  private lineMode = false;
  private compareObjs: Phaser.GameObjects.GameObject[] = [];
  private labels: HTMLElement[] = [];

  constructor() {
    super('BossCompare');
  }

  create(): void {
    registerHd(this);
    registerBosses(this);
    registerTenguRig(this);
    if (!this.textures.exists('arena-tengu')) this.textures.addCanvas('arena-tengu', arenaGround('tengu'));
    this.add.image(0, 0, 'arena-tengu').setOrigin(0);
    const cam = this.cameras.main;
    cam.setScroll(320, 60);

    const floor = 60 + 300;
    const X = [320 + 110, 320 + 320, 320 + 530];
    const shadows = X.map((x) => this.add.ellipse(x, floor, 70, 18, 0x000000, 0.3));
    // ① 지금
    this.cur = this.add.sprite(X[0], floor, 'boss-tengu', 0).setOrigin(0.5, 1);
    // ② 팩 개조 (우리 색 · 3배) — 실제 보스전의 텐구
    this.pack = new PackRig(this, X[1], floor, 'tengu');
    // ③ 코드 리그
    this.rig = new TenguRig(this, X[2], floor);
    this.compareObjs = [...shadows, this.cur, this.pack, this.rig];
    // 4보스 나란히 (처음엔 숨김)
    (['yamabiko', 'kappa', 'tengu', 'oni'] as BossId[]).forEach((id, i) => {
      this.add.ellipse(LINE_X[i], floor, 90, 22, 0x000000, 0.3).setVisible(false).setName('line-shadow');
      const r = makeBossRig(id, this, LINE_X[i], floor);
      if (r) this.lineup.push(r.setVisible(false));
    });

    this.ui = new UILayer(this);
    const labels = ['① 예전 · 80px 자세 3장', '② 팩 개조 · 지금 보스전 (Ninja Adventure 텐구 3배)', '③ 코드 리그 · 부위별 움직임 (안 씀)'];
    labels.forEach((l, i) => {
      const el = this.ui.el('div', `artlab-label${i ? ' new' : ''}`, l);
      el.style.width = '200px';
      this.ui.place(el, X[i] - 320, floor - 60 + 14);
      this.labels.push(el);
    });
    this.hud = this.ui.el('div', 'artlab-hud');
    this.renderHud();
    const kb = this.input.keyboard!;
    const poses: TenguPose[] = ['idle', 'attack', 'shout', 'hit', 'rage'];
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'].forEach((k, i) => kb.on(`keydown-${k}`, () => this.setPose(poses[i])));
    kb.on('keydown-Z', () => this.zoom(this.zoomCol < 0 ? 2 : -1));
    kb.on('keydown-LEFT', () => this.zoomCol >= 0 && this.zoom(Math.max(0, this.zoomCol - 1)));
    kb.on('keydown-RIGHT', () => this.zoomCol >= 0 && this.zoom(Math.min(this.cols - 1, this.zoomCol + 1)));
    kb.on('keydown-B', () => this.toggleLineup());
    const bar = this.ui.el('div', 'compare-bar');
    ['대기', '공격', '외침', '피격', '발악'].forEach((name, i) => this.ui.button(`${name}<small>${i + 1}</small>`, () => this.setPose(poses[i]), 'small', bar));
    this.ui.button('확대<small>Z</small>', () => this.zoom(this.zoomCol < 0 ? 2 : -1), 'small', bar);
    this.ui.button('4보스<small>B</small>', () => this.toggleLineup(), 'small', bar);
    // 데모: 저절로 자세를 돌려 보인다
    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.pose === 'idle' && this.setPose('attack') });
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
    // ② 팩: 자세마다 애니메이션 시트
    this.pack.setPose(p);
    // ③ 리그 (+ 4보스)
    this.rig.setPose(p);
    for (const r of this.lineup) r.setPose(p);
    if (p !== 'rage') this.time.delayedCall(1300, () => this.pose === p && (this.pose = 'idle'));
    this.renderHud();
  }

  private get cols(): number {
    return this.lineMode ? 4 : 3;
  }

  private zoom(col: number): void {
    this.zoomCol = Math.min(col, this.cols - 1);
    const cam = this.cameras.main;
    if (this.zoomCol < 0) {
      cam.setZoom(1).setScroll(320, 60);
    } else {
      cam.setZoom(2);
      cam.centerOn((this.lineMode ? LINE_X : [320 + 110, 320 + 320, 320 + 530])[this.zoomCol], 60 + 300 - 85);
    }
    this.renderHud();
  }

  /** 텐구 비교 ↔ 4보스 나란히 */
  private toggleLineup(): void {
    this.lineMode = !this.lineMode;
    for (const o of this.compareObjs) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(!this.lineMode);
    for (const r of this.lineup) r.setVisible(this.lineMode);
    for (const o of this.children.getAll('name', 'line-shadow')) (o as Phaser.GameObjects.Ellipse).setVisible(this.lineMode);
    for (const el of this.labels) el.style.display = this.lineMode ? 'none' : '';
    this.zoom(-1);
  }

  private renderHud(): void {
    this.hud.innerHTML = `<b>🧪 ${this.lineMode ? '보스 4종 리그' : '보스 비교 — 텐구'}</b> · B ${this.lineMode ? '텐구 비교로' : '4보스 나란히'} · 지금 자세 <b>${{ idle: '대기', windup: '예비', attack: '공격', shout: '외침', hit: '피격', rage: '발악' }[this.pose]}</b> · 1~5 자세 · Z 확대${this.zoomCol >= 0 ? ' (←/→ 칸)' : ''}`;
  }

  update(_t: number, dt: number): void {
    void dt;
    this.rig.setDepth(this.rig.y);
    this.pack.setDepth(this.pack.y);
    for (const r of this.lineup) r.setDepth(r.y);
  }
}
