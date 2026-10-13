import Phaser from 'phaser';
import { ROWS, Row, Kana } from '../data/kana';
import { tts } from '../systems/tts';
import { createMoveKeys, readMove, MoveKeys } from '../systems/movement';
import { UILayer } from '../ui/UILayer';
import { HD, registerHd } from '../art/hd/register';
import {
  LIB,
  libraryRoom,
  libStand,
  sealedScroll,
  hangingScroll,
  doorPanel,
  doorSeal,
  andon,
  softGlow,
  sparkle,
  HANG_W,
  HANG_H,
  HANG_PAPER,
  HANG_FRAMES,
} from '../art/hd/library';
import { finishNode } from '../systems/journey';

/** 받침대 가로 위치 (글자 수에 맞춰 가운데로) */
const standXs = (n: number) => Array.from({ length: n }, (_, i) => 320 + (i - (n - 1) / 2) * 84);
/** 받침대 발 위치 */
const STAND_Y = 238;
const WALK = 120;
const FLOOR = { minX: 42, maxX: 598, minY: LIB.floorY + 12, maxY: 346 };
const DOOR = LIB.door;
const DOOR_CX = DOOR.x + DOOR.w / 2;
/** 펼침 화면: 족자 2배 */
const REVEAL_SCALE = 2;
const REVEAL_TOP = 26;
/** 가까이서 Space로 펼칠 수 있는 거리 */
const REACH = 40;
const OVERLAY = 1000;
const NUM_KO = ['', '하나', '둘', '셋', '넷', '다섯'];

interface Slot {
  kana: Kana;
  /** 묶음 두루마리 (4장: 탁음 · 요음 …) — 펼치면 여러 글자 */
  group?: { name: string; kana: Kana[] };
  x: number;
  sealed?: Phaser.GameObjects.Image;
  label?: HTMLElement;
  opened: boolean;
}

interface Reveal {
  slot: Slot;
  objs: Phaser.GameObjects.GameObject[];
  hang: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  dom: HTMLElement[];
  ready: boolean;
}

/**
 * ⛩️ 서고 (리마스터) — 지도의 서고 노드.
 * WASD로 걸어 다니며 봉인된 두루마리를 펼친다(클릭 또는 가까이서 Space).
 * 글자가 뜨고 TTS가 읽어 준다 → 벽에 족자로 걸린다 → 모두 펼치면 장지문이 열리고, 걸어 나가면 지도로.
 */
export class LibraryScene extends Phaser.Scene {
  private row!: Row;
  private nodeId: number | null = null;
  private ui!: UILayer;
  private slots: Slot[] = [];
  private reveal: Reveal | null = null;
  private panel: HTMLElement | null = null;
  private completed = false;
  private leaving = false;
  private doorOpen = false;
  private pips: HTMLElement[] = [];
  private hint!: HTMLElement;
  private tooltip!: HTMLElement;
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private keys!: MoveKeys;
  private facing = 1;
  private lastBump = 0;
  private door!: { left: Phaser.GameObjects.Image; right: Phaser.GameObjects.Image; seal: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image };

  constructor() {
    super('Library');
  }

  init(data: { row?: number; nodeId?: number }): void {
    this.row = ROWS[data.row ?? 0] ?? ROWS[0];
    this.nodeId = data.nodeId ?? null;
  }

  create(): void {
    registerHd(this);
    this.slots = [];
    this.reveal = null;
    this.panel = null;
    this.completed = false;
    this.leaving = false;
    this.doorOpen = false;

    const tex = (key: string, make: () => HTMLCanvasElement) => !this.textures.exists(key) && this.textures.addCanvas(key, make());
    tex('lib-room', libraryRoom);
    tex('lib-stand', libStand);
    tex('lib-sealed', sealedScroll);
    for (let f = 0; f < HANG_FRAMES; f++) tex(`lib-hang-${f}`, () => hangingScroll(f));
    tex('lib-door', doorPanel);
    tex('lib-seal', doorSeal);
    tex('lib-andon', andon);
    tex('lib-glow', () => softGlow());
    tex('lib-spark', sparkle);

    this.add.image(0, 0, 'lib-room').setOrigin(0);
    this.cameras.main.fadeIn(350, 12, 10, 18);
    this.ui = new UILayer(this);

    // 행등 (흔들리는 불빛)
    for (const x of [74, 566]) {
      const glow = this.add.image(x, 182, 'lib-glow').setScale(1.3).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(150);
      this.tweens.add({ targets: glow, alpha: 0.5, scale: 1.4, duration: 900 + x, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add.image(x, 196, 'lib-andon').setOrigin(0.5, 1).setDepth(196);
    }

    this.createDoor();
    const groups = this.row.groups;
    if (groups) standXs(groups.length).forEach((x, i) => this.createSlot(groups[i].kana[0], x, i, groups[i]));
    else standXs(this.row.kana.length).forEach((x, i) => this.createSlot(this.row.kana[i], x, i));
    this.createPlayer();
    this.createHud();

    this.keys = createMoveKeys(this);
    const kb = this.input.keyboard!;
    kb.on('keydown-SPACE', () => {
      if (this.reveal?.ready) {
        if (this.reveal.slot.group) this.speakAll(this.reveal.slot.group.kana);
        else void this.speak(this.reveal.slot.kana);
      }
      else if (!this.reveal && !this.panel) {
        const near = this.nearestSlot();
        if (near) this.openReveal(near);
      }
    });
    kb.on('keydown-ENTER', () => {
      if (this.reveal?.ready) this.closeReveal();
      else if (this.panel) this.closePanel();
    });
    kb.on('keydown-ESC', () => this.reveal?.ready && this.closeReveal());
  }

  // ── 배치 ─────────────────────────────────────────────

  private createPlayer(): void {
    this.shadow = this.add.ellipse(320, 320, 18, 6, 0x000000, 0.3);
    this.player = this.add.sprite(320, 320, HD.player, 0).setOrigin(0.5, 1);
    this.player.play('p-idle');
    this.syncPlayer();
  }

  private createSlot(kana: Kana, x: number, i: number, group?: { name: string; kana: Kana[] }): void {
    this.add.image(x, STAND_Y, 'lib-stand').setOrigin(0.5, 1).setDepth(STAND_Y);
    const sealed = this.add.image(x, STAND_Y - 16, 'lib-sealed').setOrigin(0.5, 1).setDepth(STAND_Y + 1).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: sealed, y: STAND_Y - 19, duration: 900 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const slot: Slot = { kana, x, sealed, opened: false, group };
    sealed.on('pointerover', () => this.showTooltipAt(x, STAND_Y - 48, '봉인된 두루마리 · 클릭'));
    sealed.on('pointerout', () => this.hideTooltip());
    sealed.on('pointerdown', () => this.openReveal(slot));
    this.slots.push(slot);
  }

  private createDoor(): void {
    const glow = this.add.image(DOOR_CX, DOOR.y + DOOR.h / 2, 'lib-glow').setAlpha(0).setScale(1.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    const left = this.add.image(DOOR.x, DOOR.y, 'lib-door').setOrigin(0).setDepth(2);
    const right = this.add.image(DOOR.x + DOOR.w / 2, DOOR.y, 'lib-door').setOrigin(0).setFlipX(true).setDepth(2);
    // 문짝은 문간 밖으로 미끄러져 사라진다
    const mask = this.make.graphics({}, false).fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h).createGeometryMask();
    left.setMask(mask);
    right.setMask(mask);
    const seal = this.add.image(DOOR_CX, DOOR.y + 14, 'lib-seal').setDepth(3);
    this.door = { left, right, seal, glow };

    const zone = this.add.zone(DOOR.x - 2, DOOR.y - 4, DOOR.w + 4, DOOR.h + 6).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => this.showTooltipAt(DOOR_CX, DOOR.y + DOOR.h + 8, this.doorOpen ? 'WASD로 걸어 나가기' : '봉인된 문 · 두루마리를 모두 펼치면 열린다', 'right'));
    zone.on('pointerout', () => this.hideTooltip());
    zone.on('pointerdown', () => !this.doorOpen && this.rattleSeal());
  }

  private createHud(): void {
    this.ui.el('div', 'hud-title', `⛩️ <span class="jp">${this.row.name}</span> 서고`);
    const progress = this.ui.el('div', 'hud-progress', '<span>두루마리</span>');
    this.pips = (this.row.groups ?? this.row.kana).map(() => this.ui.el('div', 'pip', '', progress));
    this.hint = this.ui.el('div', 'hint', '<b>WASD</b> 이동 · 두루마리를 <b>클릭</b>하거나 가까이서 <b>Space</b>');
    this.tooltip = this.ui.el('div', 'tooltip');
    this.tooltip.style.display = 'none';
  }

  // ── 이동 ─────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (this.reveal || this.panel || this.leaving) {
      this.player.play('p-idle', true);
      return;
    }
    const dir = readMove(this.keys);
    const moving = dir.x !== 0 || dir.y !== 0;
    this.player.play(moving ? 'p-walk' : 'p-idle', true);
    if (moving) {
      const step = (WALK * Math.min(delta, 50)) / 1000;
      const p = this.player;
      if (!this.blocked(p.x + dir.x * step, p.y)) p.x += dir.x * step;
      if (!this.blocked(p.x, p.y + dir.y * step)) p.y += dir.y * step;
      if (dir.x !== 0) this.facing = Math.sign(dir.x);
      this.player.setFlipX(this.facing < 0);
      this.syncPlayer();
      this.checkDoor(dir.y);
    }
    // 가까운 두루마리를 살짝 밝혀 Space로 펼칠 수 있음을 알린다
    const near = this.nearestSlot();
    for (const s of this.slots) s.sealed?.setTint(s === near ? 0xfff2c8 : 0xffffff);
  }

  private syncPlayer(): void {
    this.player.setDepth(this.player.y);
    this.shadow.setPosition(this.player.x, this.player.y).setDepth(this.player.y - 0.5);
  }

  private inDoorway(x: number): boolean {
    return x >= DOOR.x + 12 && x <= DOOR.x + DOOR.w - 12;
  }

  private blocked(x: number, y: number): boolean {
    if (x < FLOOR.minX || x > FLOOR.maxX || y > FLOOR.maxY) return true;
    const top = this.doorOpen && this.inDoorway(x) ? DOOR.y + DOOR.h - 6 : FLOOR.minY;
    if (y < top) return true;
    // 받침대 · 행등
    if (this.slots.some((s) => Math.abs(x - s.x) < 22 && y > STAND_Y - 10 && y < STAND_Y + 4)) return true;
    return [74, 566].some((lx) => Math.abs(x - lx) < 12 && y > 186 && y < 200);
  }

  private nearestSlot(): Slot | null {
    let best: Slot | null = null;
    let bd = REACH;
    for (const s of this.slots) {
      if (s.opened) continue;
      const d = Math.hypot(this.player.x - s.x, (this.player.y - STAND_Y) * 1.4);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  private checkDoor(dy: number): void {
    if (!this.inDoorway(this.player.x)) return;
    if (this.doorOpen) {
      if (this.player.y <= DOOR.y + DOOR.h + 2) this.leave();
    } else if (dy < 0 && this.player.y <= FLOOR.minY + 3 && this.time.now - this.lastBump > 700) {
      this.lastBump = this.time.now;
      this.rattleSeal();
      this.showTooltipAt(DOOR_CX, DOOR.y + DOOR.h + 8, '봉인된 문 · 두루마리를 모두 펼치면 열린다', 'right');
      this.time.delayedCall(1400, () => this.hideTooltip());
    }
  }

  private showTooltipAt(x: number, y: number, text: string, align: 'center' | 'right' = 'center'): void {
    if (this.reveal || this.panel || this.leaving) return;
    this.tooltip.textContent = text;
    this.tooltip.style.display = '';
    this.tooltip.style.transform = align === 'right' ? 'translate(-80%, 0)' : '';
    this.ui.place(this.tooltip, x, y);
  }

  private hideTooltip(): void {
    this.tooltip.style.display = 'none';
  }

  // ── 펼침 ─────────────────────────────────────────────

  private openReveal(slot: Slot): void {
    if (this.reveal || this.panel || this.leaving) return;
    this.hideTooltip();
    this.hint.style.opacity = '0';
    this.ui.root.classList.add('dimmed');
    this.coverWallLabels(true);

    const dim = this.add.rectangle(0, 0, 640, 360, 0x0c0a12, 0.8).setOrigin(0).setDepth(OVERLAY).setAlpha(0).setInteractive();
    dim.on('pointerdown', () => this.reveal?.ready && this.closeReveal());
    this.tweens.add({ targets: dim, alpha: 1, duration: 250 });

    const cx = 320;
    const glow = this.add
      .image(cx, REVEAL_TOP + HANG_H, 'lib-glow')
      .setDepth(OVERLAY + 1)
      .setScale(0)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    const hang = this.add.image(cx, REVEAL_TOP, 'lib-hang-0').setOrigin(0.5, 0).setScale(REVEAL_SCALE).setDepth(OVERLAY + 2).setVisible(false);
    this.reveal = { slot, objs: [dim, glow, hang], hang, glow, dom: [], ready: false };

    if (slot.opened) {
      // 이미 펼친 족자는 바로 보여준다 (복습)
      hang.setTexture(`lib-hang-${HANG_FRAMES - 1}`).setVisible(true).setAlpha(0);
      this.tweens.add({ targets: hang, alpha: 1, duration: 200, onComplete: () => this.onRevealed() });
      return;
    }

    // 받침대의 두루마리가 화면 가운데로 떠오른다
    slot.sealed?.setVisible(false);
    const fly = this.add.image(slot.x, STAND_Y - 22, 'lib-sealed').setDepth(OVERLAY + 2);
    this.tweens.add({
      targets: fly,
      x: cx,
      y: REVEAL_TOP + 10,
      scale: REVEAL_SCALE,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        fly.destroy();
        this.unroll(hang);
      },
    });
  }

  /** 펼침 족자와 겹치는 벽 글자(DOM)는 숨긴다 */
  private coverWallLabels(cover: boolean): void {
    const reach = (HANG_W * REVEAL_SCALE + HANG_W) / 2;
    for (const s of this.slots) s.label?.classList.toggle('covered', cover && Math.abs(s.x - 320) < reach);
  }

  private unroll(hang: Phaser.GameObjects.Image): void {
    hang.setVisible(true);
    let frame = 0;
    this.time.addEvent({
      delay: 90,
      repeat: HANG_FRAMES - 2,
      callback: () => {
        frame++;
        hang.setTexture(`lib-hang-${frame}`);
        if (frame === HANG_FRAMES - 1) this.onRevealed();
      },
    });
  }

  private onRevealed(): void {
    const r = this.reveal;
    if (!r) return;
    if (r.slot.group) {
      this.revealGroup(r.slot.group);
      return;
    }
    const { kana } = r.slot;

    this.tweens.add({ targets: r.glow, scale: 2.4, alpha: 0.8, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: r.glow, scale: 2.1, duration: 1200, yoyo: true, repeat: -1, delay: 300, ease: 'Sine.easeInOut' });
    if (!r.slot.opened) this.burstSparks(320, REVEAL_TOP + HANG_PAPER.y * REVEAL_SCALE);

    const glyph = this.ui.el('div', 'glyph fade-in', kana.kana);
    glyph.style.fontSize = '60px';
    this.ui.place(glyph, 320, REVEAL_TOP + HANG_PAPER.y * REVEAL_SCALE);

    const tip = kana.tip ? `<small>💡 ${kana.tip}</small>` : '';
    const caption = this.ui.el('div', 'reveal-caption', `발음 <b>${kana.ko}</b> · ${kana.romaji}${tip}`);
    const buttons = this.ui.el('div', 'reveal-buttons');
    this.ui.button('🔊 다시 듣기<small>Space</small>', () => void this.speak(kana), '', buttons);
    this.ui.button('확인<small>Enter</small>', () => this.closeReveal(), 'primary', buttons);
    r.dom.push(glyph, caption, buttons);
    requestAnimationFrame(() => {
      caption.style.opacity = '1';
      buttons.style.opacity = '1';
    });

    this.time.delayedCall(180, () => void this.speak(kana));
    r.ready = true;
  }

  /** 묶음 두루마리: 한지 카드에 글자를 격자로 — 누르면 읽어 준다 */
  private revealGroup(group: { name: string; kana: Kana[] }): void {
    const r = this.reveal!;
    r.hang.setVisible(false);
    this.tweens.add({ targets: r.glow, scale: 3, alpha: 0.6, duration: 300 });
    if (!r.slot.opened) this.burstSparks(320, 150);
    const card = this.ui.el('div', 'bundle-card');
    this.ui.el('div', 'bundle-head', `<b>${group.name}</b><small>글자를 누르면 읽어 줘요 · Space 모두 듣기</small>`, card);
    const grid = this.ui.el('div', `bundle-grid${group.kana.length > 6 ? ' wide' : ''}`, '', card);
    const tip = this.ui.el('div', 'bundle-tip', '', card);
    group.kana.forEach((k) => {
      const cell = this.ui.el('button', 'bundle-cell clickable', `<span class="jp">${k.kana}</span><b>${k.ko}</b><small>${k.romaji}</small>`, grid);
      cell.addEventListener('click', () => {
        grid.querySelectorAll('.bundle-cell').forEach((c) => c.classList.remove('on'));
        cell.classList.add('on');
        tip.innerHTML = k.tip ? `💡 ${k.tip}` : '';
        void this.speak(k);
      });
    });
    const first = group.kana.find((k) => k.tip);
    tip.innerHTML = first?.tip ? `💡 ${first.tip}` : '';
    const buttons = this.ui.el('div', 'reveal-buttons');
    this.ui.button('🔊 모두 듣기<small>Space</small>', () => this.speakAll(group.kana), '', buttons);
    this.ui.button('확인<small>Enter</small>', () => this.closeReveal(), 'primary', buttons);
    r.dom.push(card, buttons);
    requestAnimationFrame(() => (buttons.style.opacity = '1'));
    if (!r.slot.opened) this.time.delayedCall(300, () => this.speakAll(group.kana));
    r.ready = true;
  }

  /** 묶음의 글자를 차례로 읽는다 (글자 칸이 차례로 빛난다) */
  private speakAll(list: Kana[]): void {
    speechSynthesis.cancel();
    const cells = [...this.ui.root.querySelectorAll<HTMLElement>('.bundle-cell')];
    list.forEach((k, i) =>
      this.time.delayedCall(i * 750, () => {
        if (!this.reveal) return;
        cells.forEach((c, j) => c.classList.toggle('on', j === i));
        void tts.speak(k.kana);
      }),
    );
  }

  private async speak(kana: Kana): Promise<void> {
    const ok = await tts.speak(kana.kana);
    if (ok || !this.reveal || this.reveal.dom.some((e) => e.classList.contains('notice'))) return;
    this.reveal.dom.push(this.ui.el('div', 'notice', '일본어 음성을 찾지 못했어요 · Edge 브라우저에서 가장 잘 들려요'));
  }

  private burstSparks(x: number, y: number, depth = OVERLAY + 3): void {
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
      const d = 50 + Math.random() * 30;
      const s = this.add.image(x, y, 'lib-spark').setDepth(depth);
      this.tweens.add({
        targets: s,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        alpha: 0,
        duration: 600 + Math.random() * 300,
        ease: 'Cubic.easeOut',
        onComplete: () => s.destroy(),
      });
    }
  }

  private closeReveal(): void {
    const r = this.reveal;
    if (!r) return;
    speechSynthesis.cancel();
    r.dom.forEach((e) => e.remove());
    this.tweens.killTweensOf(r.glow);
    this.tweens.add({ targets: r.objs, alpha: 0, duration: 200, onComplete: () => r.objs.forEach((o) => o.destroy()) });
    this.ui.root.classList.remove('dimmed');
    this.coverWallLabels(false);

    if (!r.slot.opened) this.hangOnWall(r.slot);
    this.reveal = null;
    if (!this.slots.every((s) => s.opened)) this.hint.style.opacity = '1';
    if (!this.completed && this.slots.every((s) => s.opened)) {
      this.completed = true;
      this.time.delayedCall(450, () => this.showComplete());
    }
  }

  /** 봉인이 풀린 두루마리는 받침대 위 벽에 족자로 걸린다 (클릭하면 다시 보기) */
  private hangOnWall(slot: Slot): void {
    slot.opened = true;
    slot.sealed?.destroy();
    slot.sealed = undefined;

    const hung = this.add.image(slot.x, LIB.hookY - 8, `lib-hang-${HANG_FRAMES - 1}`).setOrigin(0.5, 0).setAlpha(0).setDepth(10);
    hung.setInteractive({ useHandCursor: true });
    hung.on('pointerover', () => this.showTooltipAt(slot.x, LIB.hookY + HANG_H + 2, '다시 보기'));
    hung.on('pointerout', () => this.hideTooltip());
    hung.on('pointerdown', () => this.openReveal(slot));

    // 묶음은 첫 글자 + 줄임표, 낱글자는 그대로
    const label = this.ui.el('div', 'glyph wall-glyph', slot.group ? `${slot.group.kana[0].kana.slice(0, 2)}…` : slot.kana.kana);
    label.style.fontSize = slot.group ? '16px' : '28px';
    this.ui.place(label, slot.x, LIB.hookY + HANG_PAPER.y);
    slot.label = label;

    this.tweens.add({ targets: hung, y: LIB.hookY, alpha: 1, duration: 300, ease: 'Back.easeOut', onComplete: () => label.classList.add('shown') });
    const i = this.slots.indexOf(slot);
    this.pips[i].classList.add('on');
    this.pips[i].textContent = slot.kana.kana.slice(0, slot.group ? 2 : undefined);
  }

  // ── 완료 · 문 ───────────────────────────────────────

  private showComplete(): void {
    this.ui.root.classList.add('dimmed');
    const panel = this.ui.el('div', 'panel fade-in');
    this.ui.el('h2', '', '봉인 해제 완료', panel);
    const n = this.row.kana.length;
    this.ui.el('p', '', `<span class="jp">${this.row.name}</span>의 언령 ${NUM_KO[n] ?? `${n}개`}을 되찾았다.<br>오른쪽 문의 봉인이 풀린다.`, panel);
    const row = this.ui.el('div', `row${n > 5 ? ' many' : ''}`, '', panel);
    this.row.kana.forEach((k) => this.ui.el('div', 'kana', k.kana, row));
    const btns = this.ui.el('div', 'row', '', panel);
    btns.style.marginBottom = '0';
    this.ui.button('확인<small>Enter</small>', () => this.closePanel(), 'primary', btns);
    this.panel = panel;
  }

  private closePanel(): void {
    if (!this.panel) return;
    this.panel.remove();
    this.panel = null;
    this.ui.root.classList.remove('dimmed');
    this.unlockDoor();
  }

  private rattleSeal(): void {
    const { seal } = this.door;
    this.tweens.killTweensOf(seal);
    seal.x = DOOR_CX;
    this.tweens.add({ targets: seal, x: DOOR_CX + 2, duration: 50, yoyo: true, repeat: 3, onComplete: () => (seal.x = DOOR_CX) });
  }

  /** 금줄이 타올라 사라지고 장지문이 양옆으로 열린다 */
  private unlockDoor(): void {
    const d = this.door;
    this.tweens.add({ targets: d.seal, y: d.seal.y - 8, alpha: 0, duration: 400, ease: 'Cubic.easeIn' });
    this.burstSparks(DOOR_CX, d.seal.y, 20);
    this.tweens.add({ targets: d.left, x: DOOR.x - DOOR.w / 2, duration: 600, delay: 350, ease: 'Cubic.easeInOut' });
    this.tweens.add({ targets: d.right, x: DOOR.x + DOOR.w, duration: 600, delay: 350, ease: 'Cubic.easeInOut' });
    this.tweens.add({
      targets: d.glow,
      alpha: 0.7,
      duration: 500,
      delay: 600,
      onComplete: () => {
        this.doorOpen = true;
        this.tweens.add({ targets: d.glow, scale: 1.05, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const arrow = this.ui.el('div', 'door-arrow', '▲');
        this.ui.place(arrow, DOOR_CX, DOOR.y + DOOR.h + 6);
        this.hint.innerHTML = '<b>WASD</b>로 걸어서 오른쪽 문으로 나가세요';
        this.hint.style.opacity = '1';
      },
    });
  }

  /** 문빛 속으로 걸어 나가면 지도로 (서고 노드 완료) */
  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.hideTooltip();
    this.hint.style.opacity = '0';
    this.ui.root.querySelector('.door-arrow')?.remove();
    this.player.play('p-walk', true);
    this.tweens.add({ targets: [this.player, this.shadow], x: DOOR_CX, y: DOOR.y + DOOR.h - 6, alpha: 0, duration: 320 });
    this.cameras.main.fadeOut(450, 12, 10, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (this.nodeId !== null) finishNode(this.nodeId);
      this.scene.start('ChapterMap');
    });
  }
}
