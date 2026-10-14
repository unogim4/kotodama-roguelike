import Phaser from 'phaser';
import { settings } from '../systems/settings';
import { sfx } from '../systems/sfx';

/**
 * 🎥 카메라 · 시간 연출 (영상 연출 기법을 게임으로).
 * - 트래킹 + 리드: 카메라가 조준하는 쪽으로 살짝 앞서 따라간다
 * - 줌 펀치(돌리 인): 강타 · 연속 처치 · 마지막 일격에 순간 확대
 * - 더치 앵글: 보스 페이즈 전환 · 발악 · 엘리트 등장 때 화면이 기운다
 * - 핸드헬드: 발악 · 체력 위험 때 화면이 미세하게 계속 흔들린다
 * - 슬로 모션 · 스피드 램프: 간발의 회피 · 마지막 일격 (실제 시간 기준으로 돌아온다)
 * - 프리즈 프레임: 강한 일격에 화면이 멈추고 흑백 대비 + 이름 도장
 * - 랙 포커스: 퀴즈 패널이 뜨면 배경이 흐려진다
 * F2 '화면 연출 줄이기'면 흔들림 · 기울기 · 줌을 약하게 한다 (시간 연출은 그대로).
 */
export class CamFx {
  private focus: Phaser.GameObjects.Zone;
  private lead = { x: 0, y: 0 };
  private zoomBase = 1;
  private zoomKick = 0;
  private tilt = 0;
  private tiltHold = 0;
  private hand = 0;
  private handT = 0;
  /** 슬로 모션: 남은 시간(실제 ms) · 배율 · 되돌아오는 램프 길이 */
  private slow = { left: 0, scale: 1, ramp: 0, rampLeft: 0 };
  private blur: Phaser.FX.Blur | null = null;
  private blurTo = 0;
  private freezeLeft = 0;
  /** 대본 카메라: 이 자리를 본다 (리드 무시) */
  private look: { x: number; y: number } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly target: Phaser.GameObjects.Sprite,
    /** 조준 방향 (없으면 앞서가지 않는다) */
    private readonly aim: () => number | null,
  ) {
    this.focus = scene.add.zone(target.x, target.y - 12, 1, 1);
    const cam = scene.cameras.main;
    cam.startFollow(this.focus, true, 0.12, 0.12);
    this.zoomBase = cam.zoom;
    // 랙 포커스용 흐림 (WebGL에서만)
    const fxp = (cam as unknown as { postFX?: Phaser.GameObjects.Components.FX }).postFX;
    if (fxp && scene.game.renderer.type === Phaser.WEBGL) {
      this.blur = fxp.addBlur(1, 1, 1, 0, 0xffffff, 4);
      this.blur.active = false;
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.setCanvasFilter('');
      cam.setRotation(0);
    });
  }

  private get reduced(): boolean {
    return settings.motion === 'reduced';
  }

  /** 지금 시간 배율 (장면이 dt · 시계 · 트윈에 곱한다) */
  get timeScale(): number {
    if (this.freezeLeft > 0) return 0;
    if (this.slow.left > 0) return this.slow.scale;
    if (this.slow.rampLeft > 0) {
      const t = 1 - this.slow.rampLeft / this.slow.ramp;
      return this.slow.scale + (1 - this.slow.scale) * t * t;
    }
    return 1;
  }

  // ── 연출 요청 ─────────────────────────────────────────

  /** 줌 펀치 (amount = 확대 비율) */
  punch(amount = 0.04): void {
    this.zoomKick = Math.max(this.zoomKick, amount * (this.reduced ? 0.35 : 1));
  }

  /** 더치 앵글: deg만큼 기울였다가 holdMs 뒤 돌아온다 */
  dutch(deg: number, holdMs = 900): void {
    if (this.reduced) return;
    this.tilt = Phaser.Math.DegToRad(deg);
    this.tiltHold = holdMs;
  }

  /** 핸드헬드 흔들림 세기 (0 = 끔) */
  handheld(strength: number): void {
    this.hand = this.reduced ? 0 : strength;
  }

  /** 슬로 모션: scale로 holdMs(실제 시간) 동안, 그다음 rampMs 동안 원래 속도로 */
  slowmo(scale: number, holdMs: number, rampMs = 300): void {
    this.slow = { left: holdMs, scale, ramp: Math.max(1, rampMs), rampLeft: rampMs };
  }

  /** 프리즈 프레임: 화면이 멈추고 흑백 대비 · 도장 글씨 */
  freeze(ms: number, stamp?: { title: string; sub?: string }): void {
    this.freezeLeft = ms;
    this.setCanvasFilter('grayscale(1) contrast(1.6) brightness(1.15)');
    this.scene.cameras.main.flash(80, 255, 255, 255);
    sfx('boom');
    if (stamp) {
      const el = document.createElement('div');
      el.className = 'freeze-stamp';
      el.innerHTML = `<b>${stamp.title}</b>${stamp.sub ? `<small>${stamp.sub}</small>` : ''}`;
      document.getElementById('ui')!.appendChild(el);
      window.setTimeout(() => el.classList.add('out'), ms + 700);
      window.setTimeout(() => el.remove(), ms + 1100);
    }
  }

  /** 대본 카메라: 이 자리로 천천히 옮겨 본다 (null = 다시 주인공) */
  lookAt(p: { x: number; y: number } | null, lerp = 0.06): void {
    this.look = p;
    this.scene.cameras.main.setLerp(lerp, lerp);
    if (!p) this.scene.time.delayedCall(700, () => this.scene.cameras.main.setLerp(0.12, 0.12));
  }

  /** 랙 포커스: 0 = 선명 · 1 = 배경 흐림 */
  focusOn(amount: number): void {
    this.blurTo = amount;
  }

  // ── 매 프레임 (실제 시간) ───────────────────────────────

  update(realDt: number): void {
    const cam = this.scene.cameras.main;
    const sec = realDt / 1000;
    // 시간 연출
    if (this.freezeLeft > 0) {
      this.freezeLeft -= realDt;
      if (this.freezeLeft <= 0) this.setCanvasFilter('');
    } else if (this.slow.left > 0) this.slow.left -= realDt;
    else if (this.slow.rampLeft > 0) this.slow.rampLeft -= realDt;

    // 트래킹 + 리드: 조준 쪽으로 앞서 간다
    const a = this.aim();
    const k = this.reduced ? 12 : 26;
    const want = a === null ? { x: 0, y: 0 } : { x: Math.cos(a) * k, y: Math.sin(a) * k * 0.7 };
    this.lead.x += (want.x - this.lead.x) * Math.min(1, sec * 3);
    this.lead.y += (want.y - this.lead.y) * Math.min(1, sec * 3);
    if (this.look) this.focus.setPosition(this.look.x, this.look.y);
    else this.focus.setPosition(this.target.x + this.lead.x, this.target.y - 12 + this.lead.y);

    // 핸드헬드: 느린 흔들림
    this.handT += realDt;
    const hx = this.hand ? (Math.sin(this.handT / 230) + Math.sin(this.handT / 97) * 0.4) * this.hand * 1.6 : 0;
    const hy = this.hand ? (Math.cos(this.handT / 310) + Math.sin(this.handT / 131) * 0.4) * this.hand * 1.2 : 0;
    cam.setFollowOffset(-hx, -hy);

    // 줌 펀치: 확 커졌다가 부드럽게
    this.zoomKick *= Math.pow(0.0015, sec);
    if (this.zoomKick < 0.001) this.zoomKick = 0;
    // 기울이면 모서리가 비지 않게 그만큼 살짝 당긴다
    cam.setZoom(this.zoomBase * (1 + this.zoomKick) * (1 + Math.abs(this.tilt) * 0.9));

    // 더치 앵글 (+ 핸드헬드의 미세한 기울기)
    if (this.tiltHold > 0) this.tiltHold -= realDt;
    else this.tilt *= Math.pow(0.02, sec);
    const sway = this.hand ? Math.sin(this.handT / 410) * 0.006 * this.hand : 0;
    cam.setRotation(this.tilt + sway);

    // 랙 포커스
    if (this.blur) {
      const cur = this.blur.strength;
      const next = cur + (this.blurTo * 1.6 - cur) * Math.min(1, sec * 8);
      this.blur.strength = next;
      this.blur.active = next > 0.05;
    }
  }

  private setCanvasFilter(f: string): void {
    const c = this.scene.game.canvas;
    if (c) c.style.filter = f;
  }
}

/** 머리 위에 잠깐 떠오르는 글씨 (회피! · 아슬아슬! …) */
export function popText(scene: Phaser.Scene, x: number, y: number, text: string, color = '#8fd8ff'): void {
  const t = scene.add
    .text(x, y, text, { fontFamily: 'Galmuri11', fontSize: '12px', color, stroke: '#1b1626', strokeThickness: 3 })
    .setOrigin(0.5, 1)
    .setDepth(5200)
    .setScale(1.6);
  scene.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, y: y - 14, alpha: 0, delay: 380, duration: 320, onComplete: () => t.destroy() });
}
