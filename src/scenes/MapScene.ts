import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { HD } from '../art/hd/register';
import { chapter1MapArt, scrollRoller } from '../art/hd/mapArt';
import { MAP_W, MAP_H, CHAPTER1_SIGNS } from '../map/chapter1';
import { NODE_INFO, MapNode } from '../map/nodes';
import { ROWS } from '../data/kana';
import { journey, newJourney } from '../systems/journey';

const ROW_NAMES = ['あ', 'か', 'さ'];
/** 지도에서 걷는 속도 (px/초) */
const WALK = 150;
/** 위아래 두루마리 축 높이 — 노드·간판은 축 사이에서만 보인다 */
const ROLLER = 14;

/**
 * 지역 지도 — 1챕터 산기슭 신사 마을.
 * 두루마리 지도를 위아래로 훑어보고, 이어진 다음 노드를 클릭해 나아간다.
 * (노드 안의 내용은 아직 임시 창 — 하나씩 제작 예정)
 */
export class MapScene extends Phaser.Scene {
  private ui!: UILayer;
  private layer!: HTMLElement;
  private nodeEls = new Map<number, HTMLButtonElement>();
  private signEls: { el: HTMLElement; word: string }[] = [];
  private paths!: Phaser.GameObjects.Graphics;
  private token!: Phaser.GameObjects.Sprite;
  private tokenShadow!: Phaser.GameObjects.Ellipse;
  private tip!: HTMLElement;
  private rowChips: HTMLElement[] = [];
  private busy = false;
  private drag: { y: number; scroll: number } | null = null;

  constructor() {
    super('ChapterMap');
  }

  create(): void {
    if (journey.nodes.length === 0) newJourney();
    this.busy = false;
    this.nodeEls.clear();
    this.signEls = [];

    if (!this.textures.exists('map-ch1')) this.textures.addCanvas('map-ch1', chapter1MapArt());
    if (!this.textures.exists('map-roller')) this.textures.addCanvas('map-roller', scrollRoller());
    this.add.image(0, 0, 'map-ch1').setOrigin(0);
    this.paths = this.add.graphics();

    const cur = this.node(journey.current);
    this.tokenShadow = this.add.ellipse(cur.x, cur.y - 14, 14, 4, 0x000000, 0.3).setDepth(10);
    this.token = this.add.sprite(cur.x, cur.y - 14, HD.player, 0).setOrigin(0.5, 1).setDepth(11);
    this.token.play('p-idle');

    // 두루마리 축 (화면에 고정)
    this.add.image(0, 0, 'map-roller').setOrigin(0).setScrollFactor(0).setDepth(100);
    this.add.image(0, 360, 'map-roller').setOrigin(0, 1).setScrollFactor(0).setDepth(100);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_W, MAP_H);
    cam.scrollY = Phaser.Math.Clamp(cur.y - 250, 0, MAP_H - 360);
    cam.fadeIn(400, 12, 10, 18);

    this.createUi();
    this.drawPaths();
    this.refreshNodes();
    this.refreshSigns(false);

    // 휠 · 드래그로 지도 훑어보기
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy * 0.6, 0, MAP_H - 360);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => (this.drag = { y: p.y, scroll: cam.scrollY }));
    this.input.on('pointerup', () => (this.drag = null));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.drag && p.isDown) cam.scrollY = Phaser.Math.Clamp(this.drag.scroll - (p.y - this.drag.y), 0, MAP_H - 360);
    });
  }

  private node(id: number): MapNode {
    return journey.nodes[id];
  }

  // ── 화면 ─────────────────────────────────────────────

  private createUi(): void {
    this.ui = new UILayer(this);
    // 지도와 함께 움직이는 층 (노드 · 간판). 두루마리 축 사이 창 밖은 잘라낸다
    const view = this.ui.el('div', 'map-viewport');
    view.style.top = `${ROLLER}px`;
    view.style.height = `${360 - ROLLER * 2}px`;
    this.layer = this.ui.el('div', 'map-layer', '', view);
    this.layer.style.height = `${MAP_H}px`;

    for (const n of journey.nodes) {
      const info = NODE_INFO[n.kind];
      const b = this.ui.button(info.icon, () => this.choose(n), 'map-node', this.layer);
      b.style.left = `${n.x}px`;
      b.style.top = `${n.y}px`;
      b.style.setProperty('--ring', info.ring);
      if (n.kind === 'library' || n.kind === 'trial') {
        this.ui.el('span', 'map-node-tag jp', ROW_NAMES[n.row], b);
      }
      b.addEventListener('mouseenter', () => this.showTip(n));
      b.addEventListener('mouseleave', () => (this.tip.style.display = 'none'));
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
    hud.innerHTML = '<b>1장 · 산기슭 신사 마을</b>';
    const rows = this.ui.el('div', 'map-rows', '<span>되찾은 글자</span>', hud);
    this.rowChips = ROW_NAMES.map((r) => this.ui.el('i', 'jp', r, rows));
    this.ui.el('div', 'map-help', '빛나는 곳을 클릭해 나아가기 · 휠 / 드래그로 지도 보기');
  }

  update(): void {
    // DOM 층을 카메라와 함께 움직인다
    this.layer.style.transform = `translateY(${-Math.round(this.cameras.main.scrollY) - ROLLER}px)`;
  }

  private reachable(): number[] {
    if (this.busy) return [];
    return this.node(journey.current).next;
  }

  private refreshNodes(): void {
    const can = this.reachable();
    for (const [id, el] of this.nodeEls) {
      el.classList.toggle('visited', journey.visited.includes(id) && id !== journey.current);
      el.classList.toggle('current', id === journey.current);
      el.classList.toggle('reachable', can.includes(id));
      el.disabled = !can.includes(id);
    }
    this.rowChips.forEach((c, i) => c.classList.toggle('on', journey.learnedRows.includes(i)));
  }

  /** 길: 지나온 길은 붉게, 갈 수 있는 길은 금빛, 나머지는 옅은 먹점 */
  private drawPaths(): void {
    const g = this.paths.clear();
    const can = this.reachable();
    for (const a of journey.nodes) {
      for (const bid of a.next) {
        const b = this.node(bid);
        const walked = journey.visited.includes(a.id) && journey.visited.includes(b.id);
        const open = a.id === journey.current && can.includes(b.id);
        const color = walked ? 0xd8432e : open ? 0xf0b84a : 0x1b1626;
        const alpha = walked || open ? 1 : 0.35;
        const len = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        const steps = Math.floor(len / 7);
        // 살짝 휘어진 붓 점선
        const mx = (a.x + b.x) / 2 + (b.x - a.x) * 0.08;
        const my = (a.y + b.y) / 2;
        for (let i = 3; i < steps - 2; i++) {
          const t = i / steps;
          const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x;
          const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y;
          g.fillStyle(color, alpha).fillRect(Math.round(x) - 1, Math.round(y) - 1, open ? 3 : 2, open ? 3 : 2);
        }
      }
    }
  }

  private showTip(n: MapNode): void {
    const info = NODE_INFO[n.kind];
    const row = n.kind === 'library' || n.kind === 'trial' ? ` <span class="jp">${ROW_NAMES[n.row]}</span>행` : '';
    const title = n.title ?? `${info.name}${row}`;
    const desc = n.text ?? info.desc;
    const state = journey.visited.includes(n.id) ? '<em>지나온 곳</em>' : this.reachable().includes(n.id) ? '<em class="go">갈 수 있음</em>' : '';
    this.tip.innerHTML = `<b>${info.icon} ${title}</b>${state}<p>${desc}</p>${info.reward ? `<small>보상: ${info.reward}</small>` : ''}`;
    this.tip.style.display = '';
    this.tip.style.left = `${Phaser.Math.Clamp(n.x, 110, MAP_W - 110)}px`;
    this.tip.style.top = `${n.y + 22}px`;
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
    this.busy = true;
    this.tip.style.display = 'none';
    this.refreshNodes();
    const from = this.node(journey.current);
    const ms = (Phaser.Math.Distance.Between(from.x, from.y, n.x, n.y) / WALK) * 1000;
    this.token.play('p-walk', true);
    this.token.setFlipX(n.x < from.x);
    this.tweens.add({
      targets: [this.token, this.tokenShadow],
      x: n.x,
      y: n.y - 14,
      duration: ms,
      onUpdate: () => {
        // 걷는 동안 카메라가 따라간다
        const cam = this.cameras.main;
        cam.scrollY = Phaser.Math.Clamp(Phaser.Math.Linear(cam.scrollY, this.token.y - 250, 0.08), 0, MAP_H - 360);
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
    this.drawPaths();
    this.refreshNodes();

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
