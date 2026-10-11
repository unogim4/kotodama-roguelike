import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { HD } from '../art/hd/register';
import { chapter1World, streamBridge, scrollRollerV, nodePedestal, nodeRing, nodeIcon, REGIONS, M } from '../art/hd/worldMap';
import { MAP_W, MAP_H, CHAPTER1_SIGNS, trailPoint } from '../map/chapter1';
import { NODE_INFO, MapNode } from '../map/nodes';
import { ROWS } from '../data/kana';
import { journey, newJourney } from '../systems/journey';

const ROW_NAMES = ['あ', 'か', 'さ'];
/** 지도에서 걷는 속도 (px/초) */
const WALK = 150;
/** 좌우 두루마리 축 너비 — 노드·간판은 축 사이에서만 보인다 */
const ROLL = 12;
/** 키보드(A/D · ←/→)로 훑어보는 속도 (px/초) */
const PAN = 360;
/** 노드 옆, 언령사가 서는 자리 */
const STAND = { x: -17, y: 5 };

const hex = (c: string) => parseInt(c.slice(1), 16);

interface NodeView {
  ring: Phaser.GameObjects.Image;
  pedestal: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  bob?: Phaser.Tweens.Tween;
}

/**
 * 지역 지도 — 1챕터 산기슭 신사 마을 (가로 두루마리).
 * 왼쪽 신사 마을에서 오른쪽 산 정상까지, 이어진 다음 노드를 클릭해 나아간다.
 * (노드 안의 내용은 아직 임시 창 — 하나씩 제작 예정)
 */
export class MapScene extends Phaser.Scene {
  private ui!: UILayer;
  private layer!: HTMLElement;
  private nodeEls = new Map<number, HTMLButtonElement>();
  private views = new Map<number, NodeView>();
  private signEls: { el: HTMLElement; word: string }[] = [];
  private trailBase!: Phaser.GameObjects.Graphics;
  private trailMarks!: Phaser.GameObjects.Graphics;
  private token!: Phaser.GameObjects.Sprite;
  private tokenShadow!: Phaser.GameObjects.Ellipse;
  private tip!: HTMLElement;
  private regionEl!: HTMLElement;
  private rowChips: HTMLElement[] = [];
  private keys!: Record<'a' | 'd' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private busy = false;
  private drag: { x: number; scroll: number } | null = null;
  private marchTimer = 0;

  constructor() {
    super('ChapterMap');
  }

  create(): void {
    if (journey.nodes.length === 0) newJourney();
    this.busy = false;
    this.nodeEls.clear();
    this.views.clear();
    this.signEls = [];

    const tex = (key: string, make: () => HTMLCanvasElement) => {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, make());
    };
    tex('map-ch1', chapter1World);
    tex('map-roller-v', scrollRollerV);
    tex('map-pedestal', nodePedestal);
    tex('map-ring', nodeRing);
    for (const k of [...Object.keys(NODE_INFO), 'fox'] as const) tex(`map-icon-${k}`, () => nodeIcon(k as never));

    this.add.image(0, 0, 'map-ch1').setOrigin(0);
    this.trailBase = this.add.graphics().setDepth(1);
    const br = streamBridge();
    tex('map-bridge', () => br.art);
    this.add.image(br.x, br.y, 'map-bridge').setDepth(2);
    this.trailMarks = this.add.graphics().setDepth(3);

    for (const n of journey.nodes) {
      const ring = this.add.image(n.x, n.y + 1, 'map-ring').setDepth(4).setVisible(false);
      this.tweens.add({ targets: ring, alpha: { from: 0.35, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const pedestal = this.add.image(n.x, n.y + 1, 'map-pedestal').setDepth(5);
      const icon = this.add.image(n.x, n.y + 2, `map-icon-${this.iconKey(n)}`).setOrigin(0.5, 1).setDepth(6 + n.y / 1000);
      this.views.set(n.id, { ring, pedestal, icon });
    }

    const cur = this.node(journey.current);
    this.tokenShadow = this.add.ellipse(cur.x + STAND.x, cur.y + STAND.y, 14, 4, 0x000000, 0.3).setDepth(19);
    this.token = this.add.sprite(cur.x + STAND.x, cur.y + STAND.y, HD.player, 0).setOrigin(0.5, 1).setDepth(20);
    this.token.play('p-idle');

    // 좌우 두루마리 축 (화면에 고정)
    this.add.image(0, 0, 'map-roller-v').setOrigin(0).setScrollFactor(0).setDepth(100);
    this.add.image(640, 0, 'map-roller-v').setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    const cam = this.cameras.main;
    cam.setBounds(-ROLL, 0, MAP_W + ROLL * 2, MAP_H);
    cam.scrollX = this.clampX(cur.x - 220);
    cam.fadeIn(400, 12, 10, 18);

    this.createUi();
    this.drawTrails();
    this.refreshNodes();
    this.refreshSigns(false);

    // 휠 · 드래그 · A/D 로 지도 훑어보기
    this.input.on('wheel', (_p: unknown, _o: unknown, dx: number, dy: number) => {
      cam.scrollX = this.clampX(cam.scrollX + (Math.abs(dx) > Math.abs(dy) ? dx : dy) * 0.8);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (this.drag = { x: p.x, scroll: cam.scrollX }));
    this.input.on('pointerup', () => (this.drag = null));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.drag && p.isDown) cam.scrollX = this.clampX(this.drag.scroll - (p.x - this.drag.x));
    });
    this.keys = this.input.keyboard!.addKeys({ a: 'A', d: 'D', left: 'LEFT', right: 'RIGHT' }) as typeof this.keys;
  }

  private node(id: number): MapNode {
    return journey.nodes[id];
  }

  private iconKey(n: MapNode): string {
    return n.kind === 'story' && n.title?.includes('콘') ? 'fox' : n.kind;
  }

  private clampX(x: number): number {
    return Phaser.Math.Clamp(x, -ROLL, MAP_W + ROLL - 640);
  }

  // ── 화면 ─────────────────────────────────────────────

  private createUi(): void {
    this.ui = new UILayer(this);
    // 지도와 함께 움직이는 층 (노드 · 간판). 두루마리 축 사이 창 밖은 잘라낸다
    const view = this.ui.el('div', 'map-viewport');
    view.style.left = `${ROLL}px`;
    view.style.width = `${640 - ROLL * 2}px`;
    this.layer = this.ui.el('div', 'map-layer', '', view);
    this.layer.style.width = `${MAP_W}px`;

    for (const n of journey.nodes) {
      const b = this.ui.button('', () => this.choose(n), 'map-node', this.layer);
      b.style.left = `${n.x}px`;
      b.style.top = `${n.y}px`;
      if (n.kind === 'library' || n.kind === 'trial') this.ui.el('span', 'map-node-tag jp', ROW_NAMES[n.row], b);
      b.addEventListener('mouseenter', () => this.hover(n, true));
      b.addEventListener('mouseleave', () => this.hover(n, false));
      this.nodeEls.set(n.id, b);
    }

    for (const s of CHAPTER1_SIGNS) {
      const el = this.ui.el('div', 'map-sign', '', this.layer);
      el.style.left = `${s.x}px`;
      el.style.top = `${s.y}px`;
      el.dataset.ko = s.ko;
      this.signEls.push({ el, word: s.word });
    }

    this.tip = this.ui.el('div', 'map-tip', '', this.layer);
    this.tip.style.display = 'none';

    const hud = this.ui.el('div', 'map-hud');
    hud.style.left = `${ROLL + 6}px`;
    const head = this.ui.el('div', 'map-hud-head', '<b>1장 · 산기슭 신사 마을</b>', hud);
    this.regionEl = this.ui.el('span', 'map-region', '', head);
    const rows = this.ui.el('div', 'map-rows', '<span>되찾은 글자</span>', hud);
    this.rowChips = ROW_NAMES.map((r) => this.ui.el('i', 'jp', r, rows));
    this.ui.el('div', 'map-help', '빛나는 곳을 클릭해 나아가기 · 휠 / 드래그 / A·D 로 지도 보기');
  }

  update(_t: number, dt: number): void {
    const cam = this.cameras.main;
    if (!this.busy) {
      const dir = (this.keys.d.isDown || this.keys.right.isDown ? 1 : 0) - (this.keys.a.isDown || this.keys.left.isDown ? 1 : 0);
      if (dir) cam.scrollX = this.clampX(cam.scrollX + (dir * PAN * dt) / 1000);
    }
    // DOM 층을 카메라와 함께 움직인다
    this.layer.style.transform = `translateX(${-Math.round(cam.scrollX) - ROLL}px)`;
    const mid = cam.scrollX + 320;
    const region = [...REGIONS].reverse().find((r) => mid >= r.from)!.name;
    if (this.regionEl.textContent !== region) this.regionEl.textContent = region;
    // 갈 수 있는 길의 금빛 점선이 앞으로 흐른다
    this.marchTimer += dt;
    if (this.marchTimer > 110) {
      this.marchTimer = 0;
      this.drawMarks();
    }
  }

  private reachable(): number[] {
    if (this.busy) return [];
    return this.node(journey.current).next;
  }

  private refreshNodes(): void {
    const can = this.reachable();
    for (const [id, el] of this.nodeEls) {
      const open = can.includes(id);
      const visited = journey.visited.includes(id) && id !== journey.current;
      el.classList.toggle('reachable', open);
      el.disabled = !open;
      const v = this.views.get(id)!;
      const n = this.node(id);
      v.ring.setVisible(open);
      v.bob?.stop();
      v.bob = undefined;
      v.icon.setY(n.y + 2).setScale(1);
      if (open) v.bob = this.tweens.add({ targets: v.icon, y: n.y, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      // 지나온 곳은 먹빛으로 바랜다
      if (visited) {
        v.icon.setTint(0x9894a8);
        v.pedestal.setTint(0xb8b4c4);
      } else {
        v.icon.clearTint();
        v.pedestal.clearTint();
      }
    }
    this.rowChips.forEach((c, i) => c.classList.toggle('on', journey.learnedRows.includes(i)));
  }

  private edges(): [MapNode, MapNode][] {
    return journey.nodes.flatMap((a) => a.next.map((b) => [a, this.node(b)] as [MapNode, MapNode]));
  }

  /** 노드 사이 흙길 (테두리 → 흙 → 밝은 결) */
  private drawTrails(): void {
    const g = this.trailBase.clear();
    const passes: [number, number, string][] = [
      [3, 6, M.dirt2],
      [2, 4, M.dirt1],
    ];
    for (const [r, size, col] of passes) {
      g.fillStyle(hex(col), 1);
      for (const [a, b] of this.edges()) {
        this.walkTrail(a, b, 1, (x, y) => g.fillRect(x - r + 1, y - r + 1, size - 1, size - 1));
      }
    }
    g.fillStyle(hex(M.dirt0), 1);
    for (const [a, b] of this.edges()) this.walkTrail(a, b, 5, (x, y) => g.fillRect(x - 1, y - 1, 2, 1));
    this.drawMarks();
  }

  /** 지나온 길엔 붉은 발자국, 갈 수 있는 길엔 흐르는 금빛 점선 */
  private drawMarks(): void {
    const g = this.trailMarks.clear();
    const can = this.reachable();
    const phase = Math.floor(this.time.now / 110) % 6;
    for (const [a, b] of this.edges()) {
      const walked = this.onRoute(a, b);
      const open = a.id === journey.current && can.includes(b.id);
      if (walked) {
        g.fillStyle(hex(M.red1), 1);
        this.walkTrail(a, b, 6, (x, y, i) => g.fillRect(x - 1, y - (i % 2 ? 2 : 0), 2, 2));
      } else if (open) {
        // 진한 금 테두리 + 밝은 빛 (흙길 위에서도 또렷하게)
        const lit = (i: number) => (i + 6 - phase) % 6 < 3;
        g.fillStyle(hex(M.gold2), 1);
        this.walkTrail(a, b, 1, (x, y, i) => lit(i) && g.fillRect(x - 2, y - 2, 4, 4));
        g.fillStyle(hex(M.fi0), 1);
        this.walkTrail(a, b, 1, (x, y, i) => lit(i) && g.fillRect(x - 1, y - 1, 2, 2));
      }
    }
  }

  /** 실제로 걸어온 길인지 (방문 순서상 a 다음이 b) */
  private onRoute(a: MapNode, b: MapNode): boolean {
    const ia = journey.visited.indexOf(a.id);
    return ia >= 0 && journey.visited[ia + 1] === b.id;
  }

  /** 길을 일정 간격으로 따라가며 fn(x, y, 순번) — 노드 받침돌 아래는 건너뛴다 */
  private walkTrail(a: MapNode, b: MapNode, step: number, fn: (x: number, y: number, i: number) => void): void {
    const len = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) * 1.1;
    const n = Math.ceil(len / step);
    for (let i = 0; i <= n; i++) {
      const [x, y] = trailPoint(a, b, i / n);
      if (Math.hypot(x - a.x, (y - a.y) * 2) < 15 || Math.hypot(x - b.x, (y - b.y) * 2) < 15) continue;
      fn(Math.round(x), Math.round(y), i);
    }
  }

  private hover(n: MapNode, on: boolean): void {
    const v = this.views.get(n.id)!;
    if (!on) {
      this.tip.style.display = 'none';
      v.icon.setScale(1);
      return;
    }
    if (this.reachable().includes(n.id)) v.icon.setScale(1.12);
    this.showTip(n);
  }

  private showTip(n: MapNode): void {
    const info = NODE_INFO[n.kind];
    const row = n.kind === 'library' || n.kind === 'trial' ? ` <span class="jp">${ROW_NAMES[n.row]}</span>행` : '';
    const title = n.title ?? `${info.name}${row}`;
    const desc = n.text ?? info.desc;
    const state = journey.visited.includes(n.id) ? '<em>지나온 곳</em>' : this.reachable().includes(n.id) ? '<em class="go">갈 수 있음</em>' : '';
    this.tip.innerHTML = `<b>${info.icon} ${title}</b>${state}<p>${desc}</p>${info.reward ? `<small>보상: ${info.reward}</small>` : ''}`;
    this.tip.style.display = '';
    // 화면 안에 들어오게, 아래쪽 노드는 위로 띄운다
    const sx = this.cameras.main.scrollX;
    this.tip.style.left = `${Phaser.Math.Clamp(n.x, sx + ROLL + 108, sx + 640 - ROLL - 108)}px`;
    const below = n.y < 190;
    this.tip.style.top = `${below ? n.y + 10 : n.y - 30}px`;
    this.tip.classList.toggle('above', !below);
  }

  // ── 간판 복원 ────────────────────────────────────────

  private known(kana: string): boolean {
    return journey.learnedRows.some((r) => ROWS[r]?.kana.some((k) => k.kana === kana));
  }

  /** 되찾은 글자만 간판에 보인다. animate면 새로 돌아온 글자가 반짝 */
  private refreshSigns(animate: boolean): void {
    for (const s of this.signEls) {
      const before = s.el.querySelectorAll('.k.on').length;
      const letters = [...s.word].map((ch) => `<span class="k ${this.known(ch) ? 'on' : ''}">${this.known(ch) ? ch : '・'}</span>`).join('');
      const full = [...s.word].every((ch) => this.known(ch));
      s.el.innerHTML = `<span class="jp">${letters}</span>${full ? `<small>${s.el.dataset.ko}</small>` : ''}`;
      if (animate && s.el.querySelectorAll('.k.on').length > before) {
        s.el.classList.remove('restored');
        void s.el.offsetWidth;
        s.el.classList.add('restored');
      }
    }
  }

  // ── 이동 · 노드 들어가기 ──────────────────────────────

  private choose(n: MapNode): void {
    if (!this.reachable().includes(n.id)) return;
    const from = this.node(journey.current);
    this.busy = true;
    this.tip.style.display = 'none';
    this.refreshNodes();
    this.drawMarks();
    const len = Phaser.Math.Distance.Between(from.x, from.y, n.x, n.y) * 1.1;
    this.token.play('p-walk', true);
    this.token.setFlipX(n.x < from.x);
    const walk = { t: 0 };
    this.tweens.add({
      targets: walk,
      t: 1,
      duration: (len / WALK) * 1000,
      onUpdate: () => {
        const [x, y] = trailPoint(from, n, walk.t);
        this.token.setPosition(x + STAND.x, y + STAND.y);
        this.tokenShadow.setPosition(x + STAND.x, y + STAND.y);
        // 걷는 동안 카메라가 따라간다
        const cam = this.cameras.main;
        cam.scrollX = this.clampX(Phaser.Math.Linear(cam.scrollX, this.token.x - 220, 0.08));
      },
      onComplete: () => {
        this.token.play('p-idle');
        this.enter(n);
      },
    });
  }

  /** 노드 내용 — 지금은 임시 창 (하나씩 실제 장면으로 교체 예정) */
  private enter(n: MapNode): void {
    const info = NODE_INFO[n.kind];
    const row = ROW_NAMES[n.row];
    const panel = this.ui.el('div', 'panel fade-in map-panel');
    let title = `${info.icon} ${n.title ?? info.name}`;
    let body = `${n.text ?? info.desc}<br><small>노드 내용은 다음 단계에서 만들어요 (지금은 지도 테스트)</small>`;
    let done = '완료로 처리';
    if (n.kind === 'library') {
      title = `⛩️ <span class="jp">${row}</span>행 서고`;
      body = `봉인된 두루마리 ${ROWS[n.row].kana.length}개 — <span class="jp">${ROWS[n.row].kana.map((k) => k.kana).join(' ')}</span><br><small>서고 장면은 리마스터해서 이어 붙일 예정이에요</small>`;
      done = '글자를 되찾은 것으로 처리';
    } else if (n.kind === 'trial') {
      title = `⚔️ <span class="jp">${row}</span>행 시련`;
      done = '통과로 처리';
    } else if (n.kind === 'boss') {
      done = '쓰러뜨린 것으로 처리';
    }
    this.ui.el('h2', '', title, panel);
    this.ui.el('p', '', body, panel);
    const btns = this.ui.el('div', 'row', '', panel);
    btns.style.marginBottom = '0';
    this.ui.button(done, () => {
      panel.remove();
      this.complete(n);
    }, 'primary', btns);
  }

  private complete(n: MapNode): void {
    journey.current = n.id;
    if (!journey.visited.includes(n.id)) journey.visited.push(n.id);
    if (n.kind === 'library' && !journey.learnedRows.includes(n.row)) {
      journey.learnedRows.push(n.row);
      this.refreshSigns(true);
    }
    if (n.kind === 'trial') journey.checkpoint = n.id;
    this.busy = false;
    this.refreshNodes();
    this.drawMarks();

    if (n.kind === 'boss') {
      const panel = this.ui.el('div', 'panel fade-in map-panel');
      this.ui.el('h2', '', '1장 돌파!', panel);
      this.ui.el('p', '', '마지막 언령 <b class="jp">こえ</b> — 목소리<br><small>(지도 테스트 끝 · 새 지도로 다시 해 볼 수 있어요)</small>', panel);
      const btns = this.ui.el('div', 'row', '', panel);
      btns.style.marginBottom = '0';
      this.ui.button('새 지도로 다시', () => {
        newJourney();
        this.scene.restart();
      }, 'primary', btns);
      this.ui.button('타이틀', () => this.scene.start('Title'), '', btns);
    }
  }
}
