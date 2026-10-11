import Phaser from 'phaser';
import { settings, saveSettings } from '../systems/settings';

/** 바로 이동할 수 있는 장면 */
const JUMPS: { label: string; scene: string }[] = [
  { label: '타이틀', scene: 'Title' },
  { label: '🧪 전투 샘플', scene: 'Sandbox' },
  { label: '🧪 보스 시험장', scene: 'BossLab' },
];

/**
 * ⚙ 사용자 설정 — 개발 중 원하는 장면으로 바로 이동, 무적.
 * 어느 장면에서나 F2 또는 오른쪽 아래 ⚙ 버튼으로 연다. 열려 있는 동안 게임은 멈춘다.
 */
export class SettingsPanel {
  private readonly toggle: HTMLButtonElement;
  private panel: HTMLElement | null = null;
  private paused: Phaser.Scene[] = [];

  constructor(private readonly game: Phaser.Game) {
    const ui = document.getElementById('ui')!;
    this.toggle = document.createElement('button');
    this.toggle.className = 'settings-toggle';
    this.toggle.addEventListener('click', () => this.flip());
    ui.appendChild(this.toggle);
    this.refreshToggle();

    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'F2') {
          e.preventDefault();
          this.flip();
        } else if (e.key === 'Escape' && this.panel) {
          e.stopImmediatePropagation();
          this.close();
        }
      },
      true,
    );
  }

  private refreshToggle(): void {
    this.toggle.innerHTML = `⚙${settings.god ? '<b>무적</b>' : ''}`;
    this.toggle.title = '사용자 설정 (F2)';
  }

  private flip(): void {
    if (this.panel) this.close();
    else this.open();
  }

  private open(): void {
    this.paused = this.game.scene.getScenes(true).filter((s) => s.scene.key !== 'Boot');
    this.paused.forEach((s) => s.scene.pause());
    const p = document.createElement('div');
    p.className = 'settings-panel fade-in';
    this.panel = p;
    document.getElementById('ui')!.appendChild(p);
    this.render();
  }

  private render(): void {
    const p = this.panel!;
    p.innerHTML = '<h2>⚙ 사용자 설정</h2><p class="settings-sub">개발 중 확인용 — 원하는 장면으로 바로 이동</p>';
    const row = (label: string) => {
      const r = document.createElement('div');
      r.className = 'settings-row';
      r.innerHTML = `<span>${label}</span>`;
      p.appendChild(r);
      return r;
    };
    const btn = (parent: HTMLElement, label: string, on: boolean, fn: () => void, cls = 'small') => {
      const b = document.createElement('button');
      b.className = `btn ${cls}${on ? ' on' : ''}`;
      b.innerHTML = label;
      b.addEventListener('click', fn);
      parent.appendChild(b);
    };

    const g = row('무적');
    btn(g, '끔', !settings.god, () => this.set(false));
    btn(g, '켬', settings.god, () => this.set(true));

    const j = row('이동');
    for (const x of JUMPS) btn(j, x.label, false, () => this.jump(x.scene), 'primary small');

    const foot = document.createElement('div');
    foot.className = 'settings-foot';
    p.appendChild(foot);
    btn(foot, '닫기<small>Esc · F2</small>', false, () => this.close(), '');
  }

  private set(god: boolean): void {
    settings.god = god;
    saveSettings();
    this.refreshToggle();
    this.render();
  }

  private jump(key: string): void {
    this.panel?.remove();
    this.panel = null;
    const sm = this.game.scene;
    const target = sm.getScene(key);
    const running = (s: Phaser.Scene) => s.scene.isActive() || s.scene.isPaused();
    sm.getScenes(false)
      .filter((s) => s.scene.key !== 'Boot' && s !== target && running(s))
      .forEach((s) => s.scene.stop());
    this.paused = [];
    // 같은 장면으로 이동하면 멈췄다 켜는 대신 다시 시작
    if (running(target)) target.scene.restart();
    else sm.start(key);
  }

  private close(): void {
    this.panel?.remove();
    this.panel = null;
    this.paused.forEach((s) => s.scene.isPaused() && s.scene.resume());
    this.paused = [];
  }
}
