import Phaser from 'phaser';
import type { UILayer } from '../ui/UILayer';
import type { HitFx } from '../fx/HitFx';
import { HD } from '../art/hd/register';
import { SpellDef } from '../data/spells';
import { HangulSyllableTyper } from '../util/hangulKeys';
import { tts } from '../systems/tts';

/** 시전 제한시간 (달의 고요 가호로 늘어난다) */
const CAST_MS = 4000;

export interface SpellHooks {
  /** 지금은 언령술을 쓸 수 없다 (퀴즈 · 레벨업 · 끝난 뒤 등) */
  blocked: () => boolean;
  /** 시전하는 동안 슬로우 */
  slow: (on: boolean) => void;
  /** 바위가 떨어질 자리 (요괴가 모인 곳 · 보스) */
  aim: () => { x: number; y: number };
  /** 범위 피해 */
  areaHit: (x: number, y: number, r: number, dmg: number) => void;
  /** 퀴즈 제한시간 가호 (초) */
  extraTime: () => number;
}

interface Slot {
  def: SpellDef;
  /** 남은 쿨타임 (ms) */
  cd: number;
  el: HTMLElement;
  fill: HTMLElement;
}

/**
 * 언령술 시전기 — 습격 · 시련 · 원한 요괴 · 보스에서 같이 쓴다.
 * Q/E → 슬로우 속에서 단어를 한글로 입력 → 빠를수록 강하게 발동. 틀리면 불발(쿨타임 절반).
 */
export class SpellCaster {
  private slots: Slot[] = [];
  private typer = new HangulSyllableTyper();
  private cast: { slot: Slot; step: number; left: number; limit: number; box: HTMLElement; cells: HTMLElement[]; typed: HTMLElement } | null = null;
  /** 우산 방패가 남은 시간 (ms) */
  private shieldMs = 0;
  private shield: Phaser.GameObjects.Container | null = null;
  private onKey: (e: KeyboardEvent) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ui: UILayer,
    private readonly fx: HitFx,
    private readonly player: Phaser.GameObjects.Sprite,
    spells: SpellDef[],
    private readonly hooks: SpellHooks,
  ) {
    if (spells.length > 0) {
      const bar = ui.el('div', 'spell-slots');
      this.slots = spells.map((def) => {
        const el = ui.el('div', 'spell-slot', `<b>${def.key}</b><span>${def.icon}</span><i class="jp">${def.word}</i>`, bar);
        el.title = `${def.word} (${def.meaning}) — ${def.desc}`;
        const fill = ui.el('em', '', '', el);
        return { def, cd: 0, el, fill };
      });
    }
    this.onKey = (e) => this.handleKey(e);
    window.addEventListener('keydown', this.onKey, true);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', this.onKey, true);
      this.shield?.destroy();
    });
  }

  /** 입력 중이면 WASD가 한글 자판이 되므로 장면은 이동을 멈춘다 */
  get casting(): boolean {
    return this.cast !== null;
  }

  get shielded(): boolean {
    return this.shieldMs > 0;
  }

  private handleKey(e: KeyboardEvent): void {
    if (this.scene.sys.isPaused() || document.querySelector('.settings-panel')) return;
    if (this.cast) {
      const c = this.cast;
      const handled = this.typer.handle(
        e,
        (p) => (c.typed.innerHTML = p ? `<b>${p}</b>` : '<span class="caret">_</span>'),
        (syl) => this.onSyllable(syl),
      );
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      return;
    }
    const slot = this.slots.find((s) => e.code === `Key${s.def.key}`);
    if (!slot || slot.cd > 0 || this.hooks.blocked()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.begin(slot);
  }

  private begin(slot: Slot): void {
    this.typer = new HangulSyllableTyper();
    this.hooks.slow(true);
    const box = this.ui.el('div', 'spell-cast fade-up');
    this.ui.el('div', 'spell-cast-head', `${slot.def.icon} 언령술 — <b>${slot.def.meaning}</b> <small>한글로 입력 · 빠를수록 강하게</small>`, box);
    const row = this.ui.el('div', 'spell-cast-word', '', box);
    const cells = [...slot.def.word].map((ch) => this.ui.el('span', 'jp', ch, row));
    cells[0].classList.add('now');
    const typed = this.ui.el('div', 'spell-cast-typed', '<span class="caret">_</span>', box);
    const limit = CAST_MS + this.hooks.extraTime() * 1000;
    this.cast = { slot, step: 0, left: limit, limit, box, cells, typed };
  }

  private onSyllable(syl: string): void {
    const c = this.cast!;
    if (syl !== c.slot.def.ko[c.step]) {
      c.typed.innerHTML = `<i>${syl}</i> — 정답은 <b>${c.slot.def.ko.join('')}</b>`;
      this.end(false);
      return;
    }
    c.cells[c.step].classList.remove('now');
    c.cells[c.step].classList.add('done');
    c.step++;
    c.typed.innerHTML = '<span class="caret">_</span>';
    if (c.step >= c.slot.def.ko.length) this.end(true);
    else c.cells[c.step].classList.add('now');
  }

  private end(ok: boolean): void {
    const c = this.cast!;
    this.cast = null;
    this.hooks.slow(false);
    const power = 1 + 0.5 * Math.max(0, c.left / c.limit);
    c.slot.cd = ok ? c.slot.def.cooldownMs : c.slot.def.cooldownMs * 0.5;
    c.box.classList.add(ok ? 'ok' : 'ng');
    this.scene.time.delayedCall(ok ? 500 : 1200, () => c.box.remove());
    if (!ok) return;
    void tts.speak(c.slot.def.word);
    if (c.slot.def.id === 'ishi') this.ishi(power);
    else this.kasa(power);
  }

  update(dt: number): void {
    for (const s of this.slots) {
      s.cd = Math.max(0, s.cd - dt);
      const frac = s.cd / s.def.cooldownMs;
      s.fill.style.height = `${frac * 100}%`;
      s.el.classList.toggle('ready', s.cd <= 0);
    }
    if (this.cast) {
      this.cast.left -= dt;
      this.cast.box.style.setProperty('--t', String(Math.max(0, this.cast.left / this.cast.limit)));
      if (this.cast.left <= 0) {
        this.cast.typed.innerHTML = `시간 초과 — 정답은 <b>${this.cast.slot.def.ko.join('')}</b>`;
        this.end(false);
      }
    }
    if (this.shieldMs > 0) {
      this.shieldMs -= dt;
      this.shield?.setPosition(this.player.x, this.player.y);
      if (this.shieldMs <= 0) {
        const s = this.shield;
        this.shield = null;
        if (s) this.scene.tweens.add({ targets: s, alpha: 0, duration: 200, onComplete: () => s.destroy() });
      }
    }
  }

  // ── 효과 ─────────────────────────────────────────────

  /** いし — 큰 바위가 떨어진다 */
  private ishi(power: number): void {
    const { x, y } = this.hooks.aim();
    const r = 90;
    const mark = this.scene.add.ellipse(x, y, r * 2, r * 1.24, 0xd8432e, 0.25).setStrokeStyle(2, 0xd8432e, 0.8).setDepth(2);
    const rock = this.scene.add.image(x, y - 260, HD.boulder).setScale(2.2 * Math.min(1.3, power)).setDepth(5000);
    this.scene.tweens.add({
      targets: rock,
      y,
      duration: 260,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        mark.destroy();
        this.scene.cameras.main.shake(260, 0.012);
        this.fx.hitStop(80);
        this.fx.burst(x, y - 10, ['y', 'w', 'W', 'd'], 22);
        for (let k = 0; k < 8; k++) this.fx.dust(x, y, Math.cos((k / 8) * Math.PI * 2), Math.sin((k / 8) * Math.PI * 2), 3);
        this.hooks.areaHit(x, y, r, Math.round(120 * power));
        this.scene.tweens.add({ targets: rock, alpha: 0, scale: rock.scale * 1.2, duration: 400, delay: 200, onComplete: () => rock.destroy() });
      },
    });
  }

  /** かさ — 우산 방패 */
  private kasa(power: number): void {
    this.shieldMs = 3000 * power;
    this.shield?.destroy();
    const g = this.scene.add.graphics();
    g.fillStyle(0x8fd8ff, 0.18).fillEllipse(0, -16, 52, 44);
    g.lineStyle(2, 0x8fd8ff, 0.8).strokeEllipse(0, -16, 52, 44);
    // 우산 (붉은 기름종이)
    g.fillStyle(0xd8432e, 1).fillTriangle(-20, -36, 20, -36, 0, -50);
    g.fillStyle(0x8f2a20, 1).fillRect(-20, -37, 40, 2);
    g.fillStyle(0x6a4024, 1).fillRect(-1, -36, 2, 14);
    this.shield = this.scene.add.container(this.player.x, this.player.y, [g]).setDepth(4600).setAlpha(0);
    this.scene.tweens.add({ targets: this.shield, alpha: 1, duration: 150 });
    this.fx.burst(this.player.x, this.player.y - 24, ['C', 'L', 'W'], 12);
  }
}
