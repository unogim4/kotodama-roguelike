import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { LevelUpPanel } from '../ui/LevelUpPanel';
import { BossQuizPanel } from '../ui/BossQuizPanel';
import { pickCard } from '../ui/Cards';
import { SpellCaster } from '../combat/Spells';
import { spellsFor } from '../data/spells';
import { GODS, rollBlessings } from '../data/blessings';
import { run } from '../systems/run';
import { wrongChips } from '../ui/wrongChips';
import { HD, registerHd } from '../art/hd/register';
import { SANDBOX_W, SANDBOX_H } from '../art/hd/world';
import { buildArena, ArenaInfo } from '../art/hd/raidArena';
import { Lighting, LightSrc } from '../fx/Lighting';
import { Ambient } from '../fx/Ambient';
import { createMoveKeys, readMove, MoveKeys } from '../systems/movement';
import { HitFx } from '../fx/HitFx';
import { CamFx, popText } from '../fx/CamFx';
import { settings } from '../systems/settings';
import { Arsenal, ArmsTarget, pickOffers } from '../combat/Arsenal';
import { basicChoices, ChoiceDef } from '../data/choices';
import { makeQuiz, makeChoices, recordAnswer, trialQueue, learnedKana } from '../systems/quiz';
import { ROWS, Kana, matchesKo } from '../data/kana';
import { HangulSyllableTyper } from '../util/hangulKeys';
import { tts } from '../systems/tts';
import { sfx } from '../systems/sfx';
import { Fine, strip } from '../art/fine/fine';
import { YOKAI_ART, emberArt } from '../art/fine/yokai';
import { FOE_DEFS, SPAWNS, FoeKind, xpNeed } from '../data/foes';
import { journey, finishNode, fallToCheckpoint, gainOrbs, grantBlessing, knownRows, Build } from '../systems/journey';

/** 습격 한 판 길이 */
const RAID_MS = 45_000;
const PLAYER_SPEED = 120;
/** 시련 연속 퀴즈: 한 문제 제한시간 · 틀렸을 때 피해 · 퀴즈 중 요괴 속도 */
const EXAM_MS = 8000;
const EXAM_HURT = 10;
const EXAM_SLOW = 0.2;
/** 맞히면 이 거리 안의 요괴가 정화된다 */
const PURIFY_R = 150;

const FOES = FOE_DEFS;
/** 글자 요괴를 읽는 제한시간 · 정화 폭발 반경 */
const MOJI_MS = 6000;
const MOJI_BLAST = 130;

interface Obstacle {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface Foe extends ArmsTarget {
  kind: FoeKind;
  hp: number;
  vx: number;
  vy: number;
  age: number;
  /** 맞고 비틀거리는 시간 (ms) — 이동을 멈춘다 */
  stun?: number;
  /** 행동 상태 (돌진 · 내려치기): 걷기 → 예고 → 공격 → 쉼 */
  st?: 'walk' | 'wind' | 'act' | 'rest';
  stT?: number;
  dir?: { x: number; y: number };
  /** 불씨 쏘는 간격 */
  shotT?: number;
  /** 예고 그림 */
  tele?: Phaser.GameObjects.Graphics;
  /** 글자 요괴: 달고 있는 글자 · 이마 위 글씨 */
  kana?: Kana;
  tag?: HTMLElement;
}

/** 초칭오바케의 불씨 */
interface Ember {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
}

/** 처치하면 떨어지는 혼백 구슬 — 주워야 경험치 */
interface Soul {
  img: Phaser.GameObjects.Image;
  xp: number;
  vx: number;
  vy: number;
  age: number;
  pull: boolean;
}

/** 혼백 구슬이 끌려오기 시작하는 거리 */
const MAGNET = 56;
/** 이 시간 안에 다음 처치를 하면 연속 처치 */
const COMBO_MS = 1500;

type State = 'fight' | 'exam' | 'cleared' | 'dead';

/** 시련 문제 한 개: type = 글자를 보고 한글 입력, pick = 소리(또는 한글)를 보고 글자 고르기 */
interface ExamQ {
  kana: Kana;
  kind: 'type' | 'pick';
  choices: Kana[];
  left: number;
  done: boolean;
}

/**
 * 👹 습격 (리마스터) — 지도의 습격 노드.
 * 몰려오는 요괴를 45초 버틴다. 레벨업 = 언령 집중(퀴즈 → 강화).
 * 빌드(무기 · 레벨 · 체력)는 한 판 내내 이어진다. 버티면 언령 구슬 + 강화 1개, 쓰러지면 마지막 시련 지점부터.
 *
 * ⚔️ 시련 모드 — 45초를 버티면 시련의 문이 열리고 연속 퀴즈 (이번 행 전부 + 복습 2자).
 * 요괴는 아주 느리게 계속 다가온다. 맞히면 주변 요괴 정화, 틀리면 그 글자는 맨 뒤로 + 체력 -10.
 */
export class RaidScene extends Phaser.Scene {
  private nodeId: number | null = null;
  /** 지도에서 얼마나 깊이 들어왔는지 0~1 (뒤로 갈수록 거세다) */
  private depth = 0;
  private b!: Build;
  private keys!: MoveKeys;
  private fx!: HitFx;
  private ui!: UILayer;
  private levelPanel!: LevelUpPanel;
  private arsenal!: Arsenal;
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private obstacles: Obstacle[] = [];
  private foes: Foe[] = [];
  private spawnAcc = 0;
  private elapsed = 0;
  private kills = 0;
  private casting = false;
  private invulnUntil = 0;
  private facing = 1;
  private paused = false;
  private pendingLevels = 0;
  private state: State = 'fight';
  private ttsOk = false;
  private hud!: { hp: HTMLElement; hpText: HTMLElement; xp: HTMLElement; lv: HTMLElement; clock: HTMLElement; orbs: HTMLElement; slots: HTMLElement };
  private hudKey = '';
  private trial = false;
  private row = 0;
  private quizPanel!: BossQuizPanel;
  private typer = new HangulSyllableTyper();
  private queue: Kana[] = [];
  private examTotal = 0;
  private examPassed = 0;
  /** 낸 문제 수 (입력 · 고르기를 번갈아 내는 데 쓴다) */
  private asked = 0;
  private q: ExamQ | null = null;
  private sealEls: HTMLElement[] = [];
  /** 원한 요괴 모드: 이 글자의 원한 혼불을 정화하면 끝 */
  private grudge: Kana | null = null;
  private wantGrudge = false;
  private elite: Foe | null = null;
  private eliteTag: HTMLElement | null = null;
  private eliteBar: HTMLElement | null = null;
  private souls: Soul[] = [];
  private embers: Ember[] = [];
  private lighting!: Lighting;
  private ambient!: Ambient;
  private lamps: LightSrc[] = [];
  /** 다음 글자 요괴까지 · 지금 읽고 있는 글자 요괴 */
  private mojiT = 8000;
  private mojiQ: { foe: Foe; left: number; limit: number; done: boolean } | null = null;
  /** 잇탄모멘에 감겨 느려진 시각까지 */
  private wrapUntil = 0;
  private combo = 0;
  private comboT = 0;
  private comboEl: HTMLElement | null = null;
  private lowHpEl: HTMLElement | null = null;
  private camfx!: CamFx;
  /** 마지막으로 '회피!'가 뜬 시각 (대시 한 번에 한 번) */
  private dodgeAt = 0;
  private caster!: SpellCaster;
  /** 언령술을 읽는 동안 요괴가 느려진다 */
  private castSlow = false;

  constructor() {
    super('Raid');
  }

  /** 들어온 방식 (스매시 컷이면 페이드 없이 바로) */
  private cut: string | undefined;

  init(data: { nodeId?: number; depth?: number; trial?: boolean; row?: number; grudge?: boolean; cut?: string }): void {
    this.cut = data.cut;
    this.wantGrudge = data.grudge ?? false;
    this.nodeId = data.nodeId ?? null;
    this.trial = data.trial ?? false;
    this.row = data.row ?? 0;
    // 시련은 같은 깊이의 습격보다 조금 더 거세다
    this.depth = Math.min(1, (data.depth ?? 0) + (this.trial ? 0.1 : 0));
  }

  create(): void {
    registerHd(this);
    // 장면을 다시 시작해도 시계 · 트윈이 멈춘 채 남지 않게
    this.time.paused = false;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.tweens.resumeAll();
    this.fx = new HitFx(this);
    this.b = journey.build;
    this.obstacles = [];
    this.foes = [];
    this.spawnAcc = 0;
    this.elapsed = 0;
    this.kills = 0;
    this.casting = false;
    this.invulnUntil = 0;
    this.paused = false;
    this.pendingLevels = 0;
    this.state = 'fight';
    this.hudKey = '';
    this.q = null;
    this.queue = [];
    this.sealEls = [];
    this.examPassed = 0;
    this.elite = null;
    this.eliteTag = null;
    this.eliteBar = null;
    this.souls = [];
    this.embers = [];
    this.mojiT = 8000;
    this.mojiQ = null;
    this.wrapUntil = 0;
    this.registerYokai();
    this.combo = 0;
    this.comboT = 0;
    if (!this.textures.exists('soul')) this.textures.addCanvas('soul', new Fine(7, 7).stamp(['.ljl.', 'ljijl', 'jiiij', 'ljijl', '.ljl.'], 1, 1).canvas());
    // 원한 요괴: 이번 판에 가장 많이 틀린 글자 (없으면 일반 습격)
    this.grudge = null;
    if (this.wantGrudge) {
      const wrong = learnedKana().filter((k) => run.wrong[k.kana]).sort((a, b) => run.wrong[b.kana] - run.wrong[a.kana]);
      this.grudge = wrong[0] ?? null;
    }

    // 장마다 다른 싸움터 (바닥 · 소품 · 어둠 · 분위기 입자)
    const arena = buildArena(this, journey.chapter, 9 + (this.nodeId ?? 0) * 31);
    this.add.image(0, 0, arena.ground).setOrigin(0);
    this.placeProps(arena);

    const sx = SANDBOX_W / 2;
    const sy = SANDBOX_H / 2 + 120;
    this.shadow = this.add.ellipse(sx, sy, 18, 6, 0x000000, 0.3);
    this.player = this.add.sprite(sx, sy, HD.player, 0).setOrigin(0.5, 1);
    this.player.play('p-idle');
    this.player.on(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + 'p-cast', () => (this.casting = false));

    this.arsenal = new Arsenal(
      this,
      this.player,
      () => this.foes,
      (t, dmg, nx, ny, crit, _w, kb) => this.hit(t as Foe, dmg, nx, ny, crit, kb),
      () => {},
      this.b.owned,
      () => this.b.mods,
      { blocked: (x, y) => this.blocked(x, y), inputBlocked: () => this.paused || !!this.q || !!this.caster?.casting || !!this.mojiQ },
    );

    const cam = this.cameras.main;
    cam.setBounds(0, 0, SANDBOX_W, SANDBOX_H);
    this.camfx = new CamFx(this, this.player, () => this.arsenal.aimAngle);
    if (this.cut === 'smash') {
      cam.shake(260, 0.01);
      this.camfx.punch(0.1);
    } else cam.fadeIn(300, 12, 10, 18);

    this.keys = createMoveKeys(this);
    void tts.isAvailable().then((ok) => (this.ttsOk = ok));

    this.ui = new UILayer(this);
    this.levelPanel = new LevelUpPanel(this.ui);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.levelPanel.close());
    this.quizPanel = new BossQuizPanel(this.ui);
    this.createHud();
    this.comboEl = this.ui.el('div', 'raid-combo');
    this.lowHpEl = this.ui.el('div', 'low-hp');
    const rowName = ROWS[this.row]?.name ?? '';
    const banner = this.grudge
      ? this.ui.el('div', 'raid-banner', `<b>💀 원한 요괴</b><span>틀렸던 글자 <em class="jp">${this.grudge.kana}</em>가 원한 혼불이 되었다 — 쓰러뜨리고 <em>읽어서</em> 정화하라</span>`)
      : this.wantGrudge
        ? this.ui.el('div', 'raid-banner', '<b>💀 원한 요괴…?</b><span>틀린 글자가 없어 원한이 생기지 않았다 · 대신 요괴들이 몰려온다! (45초)</span>')
        : this.trial
      ? this.ui.el('div', 'raid-banner', `<b>⚔️ <span class="jp">${rowName}</span> 시련</b><span>45초를 버티면 <em>시련의 문</em>이 열린다 — 그 행의 글자를 모두 맞혀라</span>`)
      : this.ui.el('div', 'raid-banner', '<b>👹 습격!</b><span>45초 동안 버텨라 · <em>마우스</em>로 조준(공격은 자동) · <em>WASD</em>로 피하기</span>');
    this.time.delayedCall(2600, () => banner.remove());

    this.castSlow = false;
    this.caster = new SpellCaster(this, this.ui, this.fx, this.player, spellsFor(knownRows()), {
      blocked: () => this.state !== 'fight' || this.paused || !!this.q || !!this.mojiQ,
      slow: (on) => (this.castSlow = on),
      aim: () => this.aimSpell(),
      areaHit: (x, y, r, dmg) => {
        for (const f of [...this.foes]) {
          const dx = f.sprite.x - x;
          const dy = (f.sprite.y - y) / 0.62;
          const d = Math.hypot(dx, dy);
          if (d < r + f.radius) this.hit(f, dmg, dx / (d || 1), dy / (d || 1), true);
        }
      },
      extraTime: () => this.b.mods.quizTime,
    });

    const onKey = (e: KeyboardEvent) => this.onKey(e);
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      this.quizPanel.close();
    });
  }

  private createHud(): void {
    const left = this.ui.el('div', 'raid-hud-left');
    const hpBar = this.ui.el('div', 'bar hp', '', left);
    const hp = this.ui.el('i', '', '', hpBar);
    const hpText = this.ui.el('span', '', '', hpBar);
    const orbs = this.ui.el('div', 'raid-orbs', '', left);
    const xpBar = this.ui.el('div', 'bar xp raid-xp');
    this.hud = {
      hp,
      hpText,
      orbs,
      xp: this.ui.el('i', '', '', xpBar),
      lv: this.ui.el('div', 'raid-lv raid-lv-left'),
      clock: this.ui.el('div', 'raid-clock'),
      slots: this.ui.el('div', 'arms-hands'),
    };
    this.updateHud();
  }

  private updateHud(): void {
    const b = this.b;
    const left = Math.max(0, Math.ceil((RAID_MS - this.elapsed) / 1000));
    const slotKey = this.arsenal.hudKey();
    const key = `${Math.ceil(b.hp)}|${b.maxHp}|${b.xp}|${b.level}|${left}|${b.orbs}|${slotKey}|${this.state}`;
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.hud.hp.style.width = `${(Math.max(0, b.hp) / b.maxHp) * 100}%`;
    this.hud.hpText.textContent = `${Math.max(0, Math.ceil(b.hp))} / ${b.maxHp}`;
    this.hud.orbs.innerHTML = `🔮 언령 구슬 <b>${b.orbs}</b>`;
    this.hud.xp.style.width = `${(b.xp / xpNeed(b.level)) * 100}%`;
    this.hud.lv.textContent = `Lv ${b.level}`;
    this.hud.clock.textContent = this.grudge
      ? '원한을 풀어라'
      : this.state === 'exam' || (this.state === 'cleared' && this.trial)
        ? '시련의 문'
        : `0:${String(left).padStart(2, '0')}`;
    this.hud.clock.classList.toggle('hurry', left <= 10 && this.state === 'fight');
    this.hud.slots.innerHTML = this.arsenal.hudHtml();
  }

  /** 석등 · 바위 · 소나무 (발밑 충돌) */
  /** 소품 · 연못 · 석등 불빛 */
  private placeProps(arena: ArenaInfo): void {
    this.lamps = [];
    for (const p of arena.props) {
      this.add.image(p.x, p.y, p.key).setOrigin(0.5, 1).setDepth(p.y);
      if (p.col) this.obstacles.push({ cx: p.x, cy: p.y - p.col.ry, rx: p.col.rx, ry: p.col.ry });
      if (p.light) this.lamps.push({ x: p.x, y: p.y - 22, r: p.light.r, color: p.light.color });
    }
    for (const w of arena.ponds) this.obstacles.push({ cx: w.x, cy: w.y, rx: w.rx * 0.94, ry: w.ry * 0.9 });
    this.lighting = new Lighting(this, arena.dark.color, arena.dark.alpha, () => this.lightSources());
    this.ambient = new Ambient(this, arena.ambient, arena.dark.alpha > 0);
    const fxp = (this.cameras.main as unknown as { postFX?: Phaser.GameObjects.Components.FX }).postFX;
    if (fxp && this.game.renderer.type === Phaser.WEBGL) fxp.addVignette(0.5, 0.5, 0.9, 0.28);
  }

  /** 빛나는 것들: 코토하 · 석등 · 초칭오바케 · 불씨 · 혼백 · 글자 요괴 · 반딧불 */
  private lightSources(): LightSrc[] {
    const p = this.player;
    const out: LightSrc[] = [{ x: p.x, y: p.y - 14, r: 110 }, ...this.lamps];
    for (const f of this.foes) {
      if (f.kind === 'chochin') out.push({ x: f.sprite.x, y: f.sprite.y - 16, r: 56, color: 0xffc070 });
      else if (f.kind === 'moji') out.push({ x: f.sprite.x, y: f.sprite.y - 14, r: 40, color: 0xf0b84a, i: 0.8 });
      else if (f.st === 'wind') out.push({ x: f.sprite.x, y: f.sprite.y - 8, r: 46, color: 0xff6040, i: 0.7 });
      else if (f.kind === 'grudge') out.push({ x: f.sprite.x, y: f.sprite.y - 22, r: 70, color: 0xb08aff });
    }
    for (const e of this.embers) out.push({ x: e.img.x, y: e.img.y, r: 24, color: 0xffa040 });
    for (const s of this.souls) out.push({ x: s.img.x, y: s.img.y, r: 18, color: 0xc9b8f0, i: 0.7 });
    return out.concat(this.ambient.lights());
  }

  private blocked(x: number, y: number, pad = 5): boolean {
    if (x < 12 || y < 24 || x > SANDBOX_W - 12 || y > SANDBOX_H - 6) return true;
    return this.obstacles.some((o) => {
      const dx = (x - o.cx) / (o.rx + pad);
      const dy = (y - o.cy) / (o.ry + pad * 0.6);
      return dx * dx + dy * dy < 1;
    });
  }

  // ── 매 프레임 ─────────────────────────────────────────

  update(time: number, rawDelta: number): void {
    // 카메라 · 시간 연출은 실제 시간으로 (멈춤 중에도 흐림은 움직인다)
    this.camfx.update(Math.min(rawDelta, 50));
    this.ambient.update(Math.min(rawDelta, 50) * (this.paused ? 0 : 1));
    this.lighting.update(Math.min(rawDelta, 50));
    if (this.paused || this.state === 'dead') return;
    const ts = this.camfx.timeScale;
    this.time.timeScale = ts;
    this.tweens.timeScale = ts;
    const dt = Math.min(rawDelta, 50) * ts;
    if (dt <= 0) return;
    if (this.fx.stopped) return;

    this.caster.update(dt);
    // 입력 문제 · 언령술 입력 중엔 WASD가 한글 자판이 되므로 멈춰 선다
    if (!(this.q && !this.q.done && this.q.kind === 'type') && !this.caster.casting && !this.mojiQ) this.movePlayer(time, dt);
    else this.player.play('p-idle', true);
    this.arsenal.update(dt, this.state === 'fight');
    if (this.state === 'fight') {
      this.elapsed += dt;
      const fdt = this.castSlow ? dt * 0.2 : dt;
      const mdt = this.mojiQ ? fdt * 0.15 : fdt;
      this.spawn(mdt);
      this.updateFoes(time, mdt);
      this.updateEmbers(mdt);
      this.updateMoji(dt, mdt);
      this.updateSouls(dt);
      if (this.grudge) {
        // 원한 요괴는 시간이 아니라 원한 혼불을 정화해야 끝난다
        if (!this.elite && this.elapsed > 2500) this.spawnElite();
        if (this.pendingLevels > 0) this.levelUp();
      } else if (this.elapsed >= RAID_MS) {
        if (this.trial) this.startExam();
        else this.clear();
      } else if (this.pendingLevels > 0) this.levelUp();
    } else if (this.state === 'exam') {
      this.spawn(dt * 0.35);
      this.updateFoes(time, dt * EXAM_SLOW);
      this.updateSouls(dt);
      this.updateExam(dt);
    }
    this.syncElite();
    this.updateHud();
    this.updateCombo(dt);
  }

  private movePlayer(time: number, dt: number): void {
    const dir = readMove(this.keys);
    const p = this.player;
    if (this.arsenal.dashing) {
      // 대시 · 도약 중엔 무기가 몸을 움직인다
      p.setDepth(p.y);
      this.shadow.setPosition(p.x, p.y).setDepth(p.y - 0.5);
      return;
    }
    const moving = dir.x !== 0 || dir.y !== 0;
    if (moving && (this.state === 'fight' || this.state === 'exam')) {
      const wrapped = this.time.now < this.wrapUntil ? 0.5 : 1;
      const step = (PLAYER_SPEED * this.b.speed * wrapped * dt) / 1000;
      if (!this.blocked(p.x + dir.x * step, p.y)) p.x += dir.x * step;
      if (!this.blocked(p.x, p.y + dir.y * step)) p.y += dir.y * step;
    }
    const walking = moving && (this.state === 'fight' || this.state === 'exam');
    if (!this.casting && time >= this.invulnUntil) p.play(walking ? 'p-walk' : 'p-idle', true);
    this.facing = this.arsenal.facing;
    p.setFlipX(this.facing < 0);
    p.setAlpha(time < this.invulnUntil && Math.floor(time / 70) % 2 === 0 ? 0.4 : 1);
    p.setDepth(p.y);
    this.shadow.setPosition(p.x, p.y).setDepth(p.y - 0.5);
  }

  // ── 요괴 ─────────────────────────────────────────────

  /** 요괴 그림 · 애니메이션 (장별 새 요괴 + 불씨) */
  private registerYokai(): void {
    for (const y of YOKAI_ART) {
      if (!this.textures.exists(y.key)) {
        const frames = y.frames();
        const tex = this.textures.addCanvas(y.key, strip(frames))!;
        frames.forEach((_, i) => tex.add(i, 0, i * y.w, 0, y.w, y.h));
      }
      if (!this.anims.exists(y.key)) this.anims.create({ key: y.key, frames: this.anims.generateFrameNumbers(y.key, { frames: [0, 1, 2, 3] }), frameRate: 8, repeat: -1 });
    }
    if (!this.textures.exists('ember')) this.textures.addCanvas('ember', emberArt());
  }

  /** 무리로 몰려온다 — 장마다 다른 요괴, 뒤로 갈수록 많이 · 자주 */
  private spawn(dt: number): void {
    const t = Math.min(1, this.elapsed / RAID_MS);
    const interval = Math.max(90, 380 - 180 * t - 120 * this.depth);
    const cap = Math.round(30 + 30 * t + 30 * this.depth);
    this.spawnAcc += dt;
    if (this.spawnAcc < interval) return;
    this.spawnAcc = 0;
    if (this.foes.length >= cap) return;
    const table = SPAWNS[journey.chapter] ?? SPAWNS[1];
    const weights = table.map((e) => e.w0 + (e.w1 - e.w0) * t);
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    const entry = table.find((_, i) => (r -= weights[i]) <= 0) ?? table[0];
    const n = Phaser.Math.Between(entry.pack[0], entry.pack[1]) + (t > 0.7 && Math.random() < 0.5 ? 1 : 0);
    // 화면 밖 한 자리에서 무리로
    const a = Math.random() * Math.PI * 2;
    const cx = this.player.x + Math.cos(a) * 340;
    const cy = this.player.y + Math.sin(a) * 220;
    for (let i = 0; i < n && this.foes.length < cap + 6; i++) {
      const x = Phaser.Math.Clamp(cx + Phaser.Math.Between(-30, 30), 20, SANDBOX_W - 20);
      const y = Phaser.Math.Clamp(cy + Phaser.Math.Between(-24, 24), 40, SANDBOX_H - 20);
      if (this.blocked(x, y)) continue;
      this.addFoe(entry.kind, x, y);
    }
  }

  private addFoe(kind: FoeKind, x: number, y: number): Foe {
    const def = FOES[kind];
    const s = this.add.sprite(x, y, def.tex, 0).setOrigin(0.5, def.originY).setAlpha(0);
    if (def.anim) s.play({ key: def.anim, startFrame: Phaser.Math.Between(0, 3) % (s.anims.animationManager.get(def.anim)?.frames.length ?? 1) });
    this.tweens.add({ targets: s, alpha: 1, duration: 260 });
    const f: Foe = { sprite: s, kind, hp: def.hp * (1 + this.depth * 0.8), vx: 0, vy: 0, radius: def.radius, bodyY: def.bodyY, age: Math.random() * 1000, st: 'walk', stT: 0, shotT: 1500 + Math.random() * 1500 };
    this.foes.push(f);
    return f;
  }

  /** 요괴 행동 — [x 방향, y 방향, 빠르기 배율] */
  private behave(f: Foe, ai: string, ux: number, uy: number, d: number, dt: number): [number, number, number] {
    const s = f.sprite as Phaser.GameObjects.Sprite;
    switch (ai) {
      case 'hop': {
        // 공중(2~4프레임)에서만 앞으로
        const hop = Number(s.frame.name);
        return [ux, uy, hop >= 2 && hop <= 4 ? 1.5 : 0.1];
      }
      case 'ranged': {
        // 거리를 두고 떠다니며 불씨를 쏜다
        f.shotT = (f.shotT ?? 2000) - dt;
        if (f.shotT <= 0 && d < 260) {
          f.shotT = 2400 + Math.random() * 800;
          this.shootEmber(f, ux, uy);
        }
        const side = Math.sin(f.age / 700);
        if (d > 150) return [ux, uy, 1];
        if (d < 105) return [-ux, -uy, 0.8];
        return [-uy * side, ux * side, 0.6];
      }
      case 'dasher':
        return this.dasher(f, ux, uy, d, dt);
      case 'tank':
        return this.tank(f, ux, uy, d, dt);
      case 'wave': {
        // 물결치며 날아온다 (옆으로 흔들림)
        const w = Math.sin(f.age / 180) * 0.9;
        return [ux - uy * w, uy + ux * w, 1];
      }
      case 'chase':
        // 코다마 · 코갓파는 살짝 흔들리며
        if (f.kind === 'kodama' || f.kind === 'kogappa') {
          const w = Math.sin(f.age / 140 + f.radius) * 0.5;
          return [ux - uy * w, uy + ux * w, 1];
        }
        return [ux, uy, 1];
      default:
        return [ux, uy, 1];
    }
  }

  /** 카와우소 · 카마이타치: 다가와 몸을 낮추고(예고선) → 일직선 돌진 → 숨 고르기 */
  private dasher(f: Foe, ux: number, uy: number, d: number, dt: number): [number, number, number] {
    const s = f.sprite as Phaser.GameObjects.Sprite;
    f.stT = (f.stT ?? 0) - dt;
    if (f.st === 'walk') {
      s.setFrame(Math.floor(f.age / 120) % 2);
      if (d < 150 && f.stT <= 0) {
        f.st = 'wind';
        f.stT = 620;
        f.dir = { x: ux, y: uy };
        s.setFrame(2);
        f.tele = this.add.graphics().setDepth(3);
      }
      // 카마이타치는 지그재그로 다가온다
      const z = f.kind === 'kamaitachi' ? Math.sin(f.age / 160) * 1.1 : 0;
      return [ux - uy * z, uy + ux * z, 1];
    }
    if (f.st === 'wind') {
      const g = f.tele!;
      const k = 1 - Math.max(0, f.stT) / 620;
      const len = 150;
      g.clear();
      g.lineStyle(10, 0xd8432e, 0.15 + k * 0.2).lineBetween(s.x, s.y - 4, s.x + f.dir!.x * len, s.y - 4 + f.dir!.y * len);
      g.lineStyle(2, 0xff8a7a, 0.5 + Math.sin(k * 30) * 0.3).lineBetween(s.x, s.y - 4, s.x + f.dir!.x * len * k, s.y - 4 + f.dir!.y * len * k);
      s.setFlipX(f.dir!.x < 0);
      if (f.stT <= 0) {
        f.st = 'act';
        f.stT = 480;
        s.setFrame(3);
        g.destroy();
        f.tele = undefined;
      }
      return [0, 0, 0];
    }
    if (f.st === 'act') {
      if (f.stT <= 0) {
        f.st = 'rest';
        f.stT = 900;
      }
      if (Math.random() < dt / 40) this.fx.dust(s.x, s.y, -f.dir!.x, -f.dir!.y, 1, 'w');
      return [f.dir!.x, f.dir!.y, 5.2];
    }
    // 숨 고르기
    s.setFrame(0);
    if (f.stT <= 0) {
      f.st = 'walk';
      f.stT = 600;
    }
    return [ux, uy, 0.3];
  }

  /** 꼬마 오니: 천천히 다가와 몽둥이를 들어 올리고(예고 원) → 내려치기 */
  private tank(f: Foe, ux: number, uy: number, d: number, dt: number): [number, number, number] {
    const s = f.sprite as Phaser.GameObjects.Sprite;
    f.stT = (f.stT ?? 0) - dt;
    const R = 38;
    if (f.st === 'walk') {
      s.setFrame(Math.floor(f.age / 260) % 2);
      if (d < 52 && f.stT <= 0) {
        f.st = 'wind';
        f.stT = 720;
        f.dir = { x: s.x + ux * 22, y: s.y + uy * 14 };
        s.setFrame(2);
        f.tele = this.add.graphics().setDepth(3);
      }
      return [ux, uy, 1];
    }
    if (f.st === 'wind') {
      const k = 1 - Math.max(0, f.stT) / 720;
      const g = f.tele!;
      g.clear();
      g.fillStyle(0xd8432e, 0.16).fillEllipse(f.dir!.x, f.dir!.y, R * 2, R * 1.24);
      g.fillStyle(0xd8432e, 0.34).fillEllipse(f.dir!.x, f.dir!.y, R * 2 * k, R * 1.24 * k);
      g.lineStyle(2, 0xff8a7a, 0.6 + Math.sin(k * 30) * 0.3).strokeEllipse(f.dir!.x, f.dir!.y, R * 2, R * 1.24);
      if (f.stT <= 0) {
        f.st = 'act';
        f.stT = 500;
        s.setFrame(3);
        g.destroy();
        f.tele = undefined;
        this.cameras.main.shake(140, 0.007);
        sfx('boom');
        this.fx.dust(f.dir!.x, f.dir!.y, 0, -1, 10, 'y');
        const p = this.player;
        const ex = (p.x - f.dir!.x) / R;
        const ey = (p.y - f.dir!.y) / (R * 0.62);
        if (ex * ex + ey * ey <= 1 && this.time.now > this.invulnUntil && !this.arsenal.invuln && !settings.god && !this.caster.shielded) {
          this.invulnUntil = this.time.now + 800 * this.b.mods.invuln;
          this.b.hp -= FOES.kooni.damage;
          sfx('hurt');
          p.play('p-hurt', true);
          this.fx.flash(p);
          this.fx.number(p.x, p.y - 34, FOES.kooni.damage, 'hurt');
          if (this.b.hp <= 0) this.die();
        }
      }
      return [0, 0, 0];
    }
    if (f.st === 'act') {
      if (f.stT <= 0) {
        f.st = 'walk';
        f.stT = 1300;
      }
      return [0, 0, 0];
    }
    f.st = 'walk';
    return [ux, uy, 1];
  }

  // ── 초칭오바케의 불씨 ─────────────────────────────────

  private shootEmber(f: Foe, ux: number, uy: number): void {
    const s = f.sprite;
    const img = this.add.image(s.x, s.y - f.bodyY, 'ember').setDepth(4500);
    this.embers.push({ img, vx: ux * 115, vy: uy * 115, life: 3200 });
    s.setTintFill(0xffe39a);
    this.time.delayedCall(80, () => s.active && s.clearTint());
  }

  private clearEmbers(): void {
    for (const e of this.embers) e.img.destroy();
    this.embers = [];
  }

  private updateEmbers(dt: number): void {
    const p = this.player;
    const sec = dt / 1000;
    for (const e of this.embers) {
      e.img.x += e.vx * sec;
      e.img.y += e.vy * sec;
      e.img.setRotation(e.img.rotation + sec * 8);
      e.life -= dt;
      if (e.life > 0 && Phaser.Math.Distance.Between(e.img.x, e.img.y, p.x, p.y - 12) < 9) {
        e.life = 0;
        if (this.time.now > this.invulnUntil && !this.arsenal.invuln && !settings.god && !this.caster.shielded) {
          this.invulnUntil = this.time.now + 800 * this.b.mods.invuln;
          this.b.hp -= 7;
          sfx('hurt');
          p.play('p-hurt', true);
          this.fx.flash(p);
          this.fx.number(p.x, p.y - 34, 7, 'hurt');
          if (this.b.hp <= 0) this.die();
        }
      }
    }
    this.embers = this.embers.filter((e) => {
      if (e.life > 0 && this.state === 'fight') return true;
      e.img.destroy();
      return false;
    });
  }

  // ── 글자 요괴: 무기로는 안 죽는다 — 가까이서 F(또는 클릭)로 읽으면 정화 폭발 ──

  private updateMoji(realDt: number, dt: number): void {
    const cam = this.cameras.main;
    for (const f of this.foes) {
      if (f.kind !== 'moji' || !f.tag) continue;
      this.ui.place(f.tag, (f.sprite.x - cam.worldView.x) * cam.zoom, (f.sprite.y - 30 - cam.worldView.y) * cam.zoom);
      const near = Phaser.Math.Distance.Between(f.sprite.x, f.sprite.y, this.player.x, this.player.y) < 110;
      f.tag.classList.toggle('near', near);
    }
    if (this.mojiQ) {
      const q = this.mojiQ;
      if (!q.done) {
        q.left -= realDt;
        this.quizPanel.setTime(q.left / q.limit);
        if (q.left <= 0) this.resolveMoji(false, '시간 초과!');
      }
      return;
    }
    // 이따금 하나씩 (읽을 수 있는 글자가 있을 때)
    this.mojiT -= dt;
    if (this.mojiT > 0 || this.foes.some((f) => f.kind === 'moji') || this.grudge) return;
    this.mojiT = 13000 + Math.random() * 5000;
    const pool = learnedKana().filter((k) => !k.noType);
    if (pool.length === 0) return;
    const kana = pool[Math.floor(Math.random() * pool.length)];
    const a = Math.random() * Math.PI * 2;
    const x = Phaser.Math.Clamp(this.player.x + Math.cos(a) * 220, 40, SANDBOX_W - 40);
    const y = Phaser.Math.Clamp(this.player.y + Math.sin(a) * 140, 60, SANDBOX_H - 30);
    const f = this.addFoe('moji', x, y);
    f.kana = kana;
    f.tag = this.ui.el('div', 'moji-tag jp clickable', kana.kana);
    f.tag.addEventListener('click', () => this.startMoji(f));
    f.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', (ptr: Phaser.Input.Pointer) => ptr.leftButtonDown() && this.startMoji(f));
    popText(this, x, y - 40, '글자 요괴!', '#f0b84a');
  }

  /** F 키: 가장 가까운 글자 요괴 */
  private tryMoji(): void {
    const near = this.foes
      .filter((f) => f.kind === 'moji')
      .sort((a, b) => Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, this.player.x, this.player.y) - Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, this.player.x, this.player.y))[0];
    if (near) this.startMoji(near);
  }

  private startMoji(f: Foe): void {
    if (this.mojiQ || this.state !== 'fight' || this.paused || this.caster.casting || !f.kana || !this.foes.includes(f)) return;
    if (Phaser.Math.Distance.Between(f.sprite.x, f.sprite.y, this.player.x, this.player.y) > 140) {
      popText(this, this.player.x, this.player.y - 36, '더 가까이!', '#ffb0a0');
      return;
    }
    const limit = MOJI_MS + this.b.mods.quizTime * 1000;
    this.mojiQ = { foe: f, left: limit, limit, done: false };
    this.typer = new HangulSyllableTyper();
    this.player.play('p-idle', true);
    this.camfx.focusOn(0.5);
    this.camfx.punch(0.04);
    this.quizPanel.show({ title: '✒️ 글자 요괴 — 읽어서 정화하라', big: { text: f.kana.kana, jp: true }, prompt: '발음을 한글로 입력 <small>맞히면 주변 요괴까지 정화 폭발</small>', typing: true });
  }

  private resolveMoji(ok: boolean, note?: string): void {
    const q = this.mojiQ;
    if (!q || q.done) return;
    q.done = true;
    const f = q.foe;
    const kana = f.kana!;
    recordAnswer(kana, ok);
    const ans = `<span class="jp">${kana.kana}</span> <b>[${kana.ko}]</b>`;
    this.quizPanel.feedback(ok, ok ? `정화! ${ans}` : `${note ? `${note} ` : ''}정답은 ${ans}`);
    if (!ok && this.ttsOk) void tts.speak(kana.kana);
    this.time.delayedCall(ok ? 450 : 1100, () => {
      this.quizPanel.close();
      this.camfx.focusOn(0);
      this.mojiQ = null;
      if (!this.foes.includes(f)) return;
      const x = f.sprite.x;
      const y = f.sprite.y - f.bodyY;
      f.tag?.remove();
      if (ok) {
        // 정화 폭발: 둘레의 요괴가 한꺼번에 사라진다
        this.camfx.punch(0.09);
        this.camfx.slowmo(0.35, 220, 400);
        this.cameras.main.flash(160, 255, 236, 180);
        sfx('boom');
        const ring = this.add.circle(x, y, 10, 0xffe39a, 0.35).setStrokeStyle(3, 0xfffaf0).setDepth(4600);
        this.tweens.add({ targets: ring, radius: MOJI_BLAST, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
        f.hp = 0;
        this.kill(f);
        for (const g of [...this.foes]) {
          if (g.kind === 'grudge' || g.kind === 'moji') continue;
          if (Phaser.Math.Distance.Between(g.sprite.x, g.sprite.y, x, y) < MOJI_BLAST) {
            g.hp = 0;
            this.kill(g);
          }
        }
        this.dropSoul(x, y + 8, 4);
      } else {
        // 틀리면 먹물이 터진다
        this.fx.burst(x, y, ['N', 'P', 'd'], 18);
        this.foes = this.foes.filter((g) => g !== f);
        f.sprite.destroy();
        const p = this.player;
        if (Phaser.Math.Distance.Between(x, y, p.x, p.y - 12) < 90 && !settings.god && !this.caster.shielded) {
          this.b.hp -= 10;
          sfx('hurt');
          this.fx.flash(p);
          this.fx.number(p.x, p.y - 34, 10, 'hurt');
          if (this.b.hp <= 0) this.die();
        }
      }
    });
  }

  private updateFoes(time: number, dt: number): void {
    const p = this.player;
    const sec = dt / 1000;
    for (const f of this.foes) {
      const def = FOES[f.kind];
      f.age += dt;
      const dx = p.x - f.sprite.x;
      const dy = p.y - 6 - f.sprite.y;
      const d = Math.hypot(dx, dy) || 1;
      f.stun = Math.max(0, (f.stun ?? 0) - dt);
      // 행동마다 이번 프레임에 움직일 방향 · 빠르기
      const [mx, my, pace] = f.stun > 0 ? [0, 0, 0] : this.behave(f, def.ai, dx / d, dy / d, d, dt);
      const nx = f.sprite.x + (mx * def.speed * pace + f.vx) * sec;
      const ny = f.sprite.y + (my * def.speed * pace + f.vy) * sec;
      if (!this.blocked(nx, f.sprite.y, 2)) f.sprite.x = nx;
      else f.vx *= -0.3;
      if (!this.blocked(f.sprite.x, ny, 2)) f.sprite.y = ny;
      else f.vy *= -0.3;
      f.vx *= 0.86;
      f.vy *= 0.86;
      if (f.st !== 'act') f.sprite.setFlipX(dx < 0);
      f.sprite.setDepth(f.sprite.y + 2);

      if (d < 14 && this.arsenal.invuln && time - this.dodgeAt > 600) {
        // 대시로 요괴를 뚫고 지나갔다 — 간발의 회피
        this.dodgeAt = time;
        this.camfx.slowmo(0.3, 240, 320);
        popText(this, p.x, p.y - 36, '회피!');
      }
      if (d < 14 && time > this.invulnUntil && !this.arsenal.invuln) {
        this.invulnUntil = time + 800 * this.b.mods.invuln;
        f.vx -= (dx / d) * 220;
        f.vy -= (dy / d) * 220;
        if (settings.god || this.caster.shielded) continue;
        if (def.ai === 'wave') {
          this.wrapUntil = time + 1500;
          popText(this, p.x, p.y - 36, '감겼다!', '#f0e2c0');
        }
        this.b.hp -= def.damage;
        sfx('hurt');
        p.play('p-hurt', true);
        this.fx.flash(p);
        this.fx.number(p.x, p.y - 34, def.damage, 'hurt');
        this.cameras.main.shake(100, 0.004);
        if (this.b.hp <= 0) {
          this.die();
          return;
        }
      }
    }
    // 서로 겹치지 않게 살짝 밀어낸다
    for (let i = 0; i < this.foes.length; i++) {
      const a = this.foes[i].sprite;
      for (let j = i + 1; j < this.foes.length; j++) {
        const b = this.foes[j].sprite;
        const ddx = b.x - a.x;
        const ddy = b.y - a.y;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 > 0 && d2 < 196) {
          const d = Math.sqrt(d2);
          const push = ((14 - d) / d) * 0.5;
          a.x -= ddx * push;
          a.y -= ddy * push;
          b.x += ddx * push;
          b.y += ddy * push;
        }
      }
    }
  }

  /** 맞았다: 숫자 · 번쩍 · 넉백 + 먼지 · (강타면) 멈칫 */
  private hit(f: Foe, dmg: number, nx: number, ny: number, crit: boolean, kb = 1): void {
    if (f.hp <= 0 || this.state !== 'fight') return;
    if (f.kind === 'moji') {
      // 무기로는 안 죽는다 — 읽어야 한다
      this.fx.flash(f.sprite);
      f.vx += nx * 40;
      f.vy += ny * 40;
      if (Math.random() < 0.15) popText(this, f.sprite.x, f.sprite.y - 40, 'F로 읽어라!', '#f0b84a');
      return;
    }
    sfx(crit ? 'crit' : 'hit');
    f.stun = crit ? 220 : 130;
    this.fx.number(f.sprite.x, f.sprite.y - f.bodyY - 14, dmg, crit ? 'crit' : 'normal');
    this.fx.flash(f.sprite, crit);
    this.fx.spark(f.sprite.x - nx * 6, f.sprite.y - f.bodyY - ny * 6, crit ? 'G' : 'L');
    if (crit) {
      this.fx.hitStop(55);
      this.cameras.main.shake(70, 0.003);
      this.camfx.punch(0.025);
    }
    const knock = (crit ? 260 : 170) * FOES[f.kind].knock * this.b.mods.knockback * kb;
    f.vx += nx * knock;
    f.vy += ny * knock;
    this.fx.dust(f.sprite.x, f.sprite.y, nx, ny, crit ? 7 : 4, FOES[f.kind].burst[0]);
    f.hp -= dmg;
    if (f.kind === 'grudge') {
      this.syncElite();
      if (f.hp <= 0) this.startGrudgeQuiz(f);
      return;
    }
    if (f.hp <= 0) this.kill(f);
  }

  private kill(f: Foe, xp = true): void {
    this.foes = this.foes.filter((x) => x !== f);
    const s = f.sprite;
    const x = s.x;
    const y = s.y - f.bodyY;
    const colors = FOES[f.kind].burst;
    f.tele?.destroy();
    f.tag?.remove();
    if (!xp) {
      this.fx.burst(x, y, colors, 12);
      s.destroy();
      return;
    }
    // 하얗게 부풀었다가 터지며 혼백 구슬이 튀어나온다
    this.kills++;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = COMBO_MS;
    sfx('kill', 1 + Math.min(this.combo, 12) * 0.04);
    if (this.combo >= 5 && this.combo % 5 === 0) this.camfx.punch(0.07);
    this.fx.hitStop(this.combo >= 5 ? 50 : 35);
    if ('anims' in s) (s as Phaser.GameObjects.Sprite).anims.stop();
    s.setTintFill(0xffffff);
    this.tweens.add({
      targets: s,
      scaleX: 1.45,
      scaleY: 0.65,
      duration: 70,
      onComplete: () => {
        this.fx.burst(x, y, colors, 16);
        const ring = this.add.circle(x, y, 4, 0xffffff, 0).setStrokeStyle(2, 0xfffaf0).setDepth(y + 5);
        this.tweens.add({ targets: ring, radius: 18, alpha: 0, duration: 220, onComplete: () => ring.destroy() });
        s.destroy();
        if (FOES[f.kind].xp > 0) this.dropSoul(x, y + f.bodyY - 4, FOES[f.kind].xp);
      },
    });
  }

  private dropSoul(x: number, y: number, xp: number): void {
    const img = this.add.image(x, y - 6, 'soul').setDepth(y).setScale(xp >= 4 ? 1.8 : xp > 1 ? 1.35 : 1).setBlendMode(Phaser.BlendModes.ADD);
    const a = Math.random() * Math.PI * 2;
    this.souls.push({ img, xp, vx: Math.cos(a) * 60, vy: Math.sin(a) * 40, age: 0, pull: false });
  }

  /** 혼백 구슬: 튀어나왔다가 내려앉고, 가까이 가면 끌려와 경험치가 된다 */
  private updateSouls(dt: number): void {
    const p = this.player;
    const sec = dt / 1000;
    for (const s of this.souls) {
      s.age += dt;
      const dx = p.x - s.img.x;
      const dy = p.y - 12 - s.img.y;
      const d = Math.hypot(dx, dy) || 1;
      if (!s.pull && (d < MAGNET * this.b.mods.magnet || this.state === 'cleared')) s.pull = true;
      if (s.pull) {
        const sp = 140 + s.age * 0.35;
        s.vx = (dx / d) * sp;
        s.vy = (dy / d) * sp;
      } else {
        s.vx *= 0.9;
        s.vy *= 0.9;
      }
      s.img.x += s.vx * sec;
      s.img.y += s.vy * sec + Math.sin(s.age / 160) * 0.15;
      s.img.setAlpha(0.75 + Math.sin(s.age / 90) * 0.25);
      if (d < 10) {
        s.age = -1;
        this.gainXp(s.xp);
        sfx('soul', 1 + Math.min(this.combo, 12) * 0.05);
      }
    }
    this.souls = this.souls.filter((s) => {
      if (s.age >= 0 && s.age < 20000) return true;
      s.img.destroy();
      return false;
    });
  }

  /** 연속 처치 표시 (3마리부터) */
  private updateCombo(dt: number): void {
    if (this.comboT > 0) this.comboT -= dt;
    const el = this.comboEl;
    if (el) {
      const show = this.combo >= 3 && this.comboT > 0;
      el.style.opacity = show ? String(Math.min(1, this.comboT / 400)) : '0';
      if (show) {
        const txt = `<b>${this.combo}</b> 연속!`;
        if (el.innerHTML !== txt) {
          el.innerHTML = txt;
          el.classList.remove('pop');
          void el.offsetWidth;
          el.classList.add('pop');
        }
      }
    }
    // 체력이 30% 아래면 화면 가장자리가 붉게 뛴다
    const danger = this.b.hp > 0 && this.b.hp / this.b.maxHp < 0.3;
    this.lowHpEl?.classList.toggle('on', danger);
    this.camfx.handheld(danger && this.state === 'fight' ? 0.6 : 0);
  }

  // ── 레벨업: 퀴즈 → 무기 강화 / 새 무기 ─────────────────

  private gainXp(n: number): void {
    const b = this.b;
    b.xp += n;
    while (b.xp >= xpNeed(b.level)) {
      b.xp -= xpNeed(b.level);
      b.level++;
      this.pendingLevels++;
    }
  }

  private offers(): ChoiceDef[] {
    // 무기 강화 · 새 무기를 먼저, 모자라면 기본 강화로 (겹치지 않게)
    const n = 3 + this.b.mods.extraChoice;
    const list: ChoiceDef[] = pickOffers(this.arsenal.offers(this.b.unlocked, this.b.blessings), n);
    const basics = Phaser.Utils.Array.Shuffle(basicChoices(this.b));
    while (list.length < n && basics.length > 0) list.push(basics.shift()!);
    return list;
  }

  private freeze(on: boolean): void {
    this.camfx.focusOn(on ? 1 : 0);
    this.paused = on;
    this.time.paused = on;
    if (on) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.ui.root.classList.toggle('dimmed', on);
  }

  private levelUp(): void {
    this.pendingLevels--;
    sfx('levelup');
    this.freeze(true);
    void this.levelPanel.open(makeQuiz(this.ttsOk), this.b.level, this.offers()).then(({ upgrade }) => {
      upgrade.apply();
      if (upgrade.special === 'evo') this.celebrateEvo(upgrade);
      this.freeze(false);
      this.updateHud();
    });
  }

  // ── 시련: 연속 퀴즈 ─────────────────────────────────

  /** 45초를 버텼다 → 시련의 문이 열리고 연속 퀴즈 */
  private startExam(): void {
    this.state = 'exam';
    this.clearEmbers();
    this.mojiQ = null;
    this.pendingLevels = 0;
    this.queue = trialQueue();
    this.examTotal = this.queue.length;
    this.examPassed = 0;
    this.asked = Math.random() < 0.5 ? 0 : 1;
    this.hud.slots.style.display = 'none';
    this.cameras.main.flash(300, 255, 230, 160);
    this.camfx.focusOn(0.45);
    const seals = this.ui.el('div', 'trial-seals');
    this.sealEls = this.queue.map(() => this.ui.el('i', 'jp', '', seals));
    const banner = this.ui.el('div', 'raid-banner', `<b>시련의 문이 열렸다!</b><span>글자 <em>${this.examTotal}</em>개를 모두 맞혀라 · 요괴가 느려진다</span>`);
    this.time.delayedCall(1600, () => {
      banner.remove();
      this.nextQuestion();
    });
  }

  private nextQuestion(): void {
    if (this.state !== 'exam') return;
    const kana = this.queue.shift();
    if (!kana) {
      if (this.grudge) this.passGrudge();
      else this.passTrial();
      return;
    }
    // 입력과 고르기를 번갈아 (한글 한 음절로 못 쓰는 글자는 고르기)
    const kind: ExamQ['kind'] = this.asked++ % 2 === 0 && !kana.noType ? 'type' : 'pick';
    const q: ExamQ = { kana, kind, choices: makeChoices(kana), left: this.examMs(), done: false };
    this.q = q;
    this.typer = new HangulSyllableTyper();
    const step = `${this.examPassed + 1} / ${this.examTotal}`;
    const title = `⚔️ ${ROWS[this.row]?.name ?? ''} 시련`;
    if (kind === 'type') {
      this.quizPanel.show({ title, step, big: { text: kana.kana, jp: true }, prompt: '발음을 한글로 입력 <small>한/영 상관없이 · 입력 중엔 멈춰 선다</small>', typing: true });
      return;
    }
    const choices = q.choices.map((k) => ({ html: `<span class="jp">${k.kana}</span>`, correct: k === kana }));
    const pick = (i: number) => this.resolveExam(q.choices[i] === kana, i);
    if (this.ttsOk) {
      this.quizPanel.show({ title, step, prompt: '들리는 글자를 고르세요 <small>Space 다시 듣기 · WASD로 피하며</small>', choices }, pick);
      void tts.speak(kana.kana);
    } else {
      this.quizPanel.show({ title, step, big: { text: kana.ko, jp: false }, prompt: '이 발음의 글자를 고르세요 <small>WASD로 피하며</small>', choices }, pick);
    }
  }

  /** 문제당 제한시간 (달의 고요 가호 반영) */
  private examMs(): number {
    return EXAM_MS + this.b.mods.quizTime * 1000;
  }

  private updateExam(dt: number): void {
    const q = this.q;
    if (!q || q.done) return;
    q.left -= dt;
    this.quizPanel.setTime(q.left / this.examMs());
    this.quizPanel.setBehind(this.player.y - this.cameras.main.scrollY > 250);
    if (q.left <= 0) this.resolveExam(false, -1, '시간 초과!');
  }

  private onKey(e: KeyboardEvent): void {
    if (this.sys.isPaused()) return;
    if (this.mojiQ && !this.mojiQ.done) {
      const kana = this.mojiQ.foe.kana!;
      const handled = this.typer.handle(
        e,
        (preview) => this.quizPanel.setTyped(preview),
        (syl) => this.resolveMoji(matchesKo(kana, syl), `입력: ${syl}`),
      );
      if (handled) e.preventDefault();
      return;
    }
    if (e.code === 'KeyF' && this.state === 'fight' && !this.paused && !this.caster.casting) {
      this.tryMoji();
      return;
    }
    if (this.state !== 'exam') return;
    const q = this.q;
    if (!q || q.done) return;
    if (q.kind === 'type') {
      const handled = this.typer.handle(
        e,
        (preview) => this.quizPanel.setTyped(preview),
        (syl) => this.resolveExam(matchesKo(q.kana, syl), -1, matchesKo(q.kana, syl) ? undefined : `입력: ${syl}`),
      );
      if (handled) e.preventDefault();
      return;
    }
    if (e.key === ' ' && this.ttsOk) void tts.speak(q.kana.kana);
    const n = Number(e.key);
    if (n >= 1 && n <= q.choices.length) this.quizPanel.pick(n - 1);
  }

  /** 맞힘 → 글자가 새겨지고 주변 요괴 정화 / 틀림 → 그 글자는 맨 뒤로 + 체력 -10 */
  private resolveExam(correct: boolean, picked: number, note?: string): void {
    const q = this.q;
    if (!q || q.done || this.state !== 'exam') return;
    q.done = true;
    recordAnswer(q.kana, correct);
    const ans = `<span class="jp">${q.kana.kana}</span> <b>[${q.kana.ko}]</b>`;
    if (correct) {
      this.quizPanel.feedback(true, `정답! ${ans}`, picked);
      const seal = this.sealEls[this.examPassed];
      seal?.classList.add('on');
      if (seal) seal.textContent = q.kana.kana;
      this.examPassed++;
      this.purify();
    } else {
      this.quizPanel.feedback(false, `${note ? `${note} — ` : ''}정답은 ${ans}`, picked);
      if (this.ttsOk) void tts.speak(q.kana.kana);
      if (this.grudge) {
        // 원한 혼불이 되살아난다
        this.time.delayedCall(1300, () => this.reviveElite());
        return;
      }
      this.queue.push(q.kana);
      if (!settings.god) {
        this.b.hp -= EXAM_HURT;
        this.player.play('p-hurt', true);
        this.fx.flash(this.player);
        this.fx.number(this.player.x, this.player.y - 34, EXAM_HURT, 'hurt');
        this.cameras.main.shake(120, 0.005);
        if (this.b.hp <= 0) {
          this.time.delayedCall(500, () => this.die());
          return;
        }
      }
    }
    this.time.delayedCall(correct ? 700 : 1500, () => {
      this.quizPanel.close();
      this.q = null;
      this.nextQuestion();
    });
  }

  /** 언령이 퍼져 주변 요괴가 정화된다 */
  private purify(): void {
    const p = this.player;
    this.fx.burst(p.x, p.y - 16, ['G', 'L', 'W'], 18);
    const ring = this.add.circle(p.x, p.y - 10, 10, 0xf0b84a, 0).setStrokeStyle(3, 0xf0b84a, 0.9).setDepth(4000);
    this.tweens.add({ targets: ring, radius: PURIFY_R, alpha: 0, duration: 450, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    for (const f of [...this.foes]) {
      if (Phaser.Math.Distance.Between(p.x, p.y, f.sprite.x, f.sprite.y) < PURIFY_R) this.kill(f, false);
    }
  }

  /** 모두 맞혔다 → 시련 통과 (체크포인트 · 다음 행) */
  private passTrial(): void {
    this.state = 'cleared';
    for (const f of [...this.foes]) this.kill(f, false);
    this.cameras.main.flash(500, 255, 230, 160);
    const orbs = gainOrbs(12 + Math.floor(this.kills / 4));
    this.updateHud();
    const banner = this.ui.el('div', 'raid-banner', `<b>시련 통과!</b><span><span class="jp">${ROWS[this.row]?.name ?? ''}</span>의 언령이 몸에 새겨졌다 · 이곳이 새 체크포인트</span>`);
    this.time.delayedCall(1800, () => {
      banner.remove();
      this.reward(orbs, '시련 통과');
    });
  }

  /** いし가 떨어질 자리: 요괴가 가장 많이 모인 곳 (없으면 앞쪽) */
  private aimSpell(): { x: number; y: number } {
    let best = { x: this.player.x + this.facing * 80, y: this.player.y };
    let most = 0;
    for (const f of this.foes) {
      const n = this.foes.filter((g) => Phaser.Math.Distance.Between(f.sprite.x, f.sprite.y, g.sprite.x, g.sprite.y) < 90).length + (f.kind === 'grudge' ? 3 : 0);
      if (n > most) {
        most = n;
        best = { x: f.sprite.x, y: f.sprite.y };
      }
    }
    return best;
  }

  // ── 💀 원한 혼불 ─────────────────────────────────────

  private spawnElite(): void {
    const a = Math.random() * Math.PI * 2;
    const x = Phaser.Math.Clamp(this.player.x + Math.cos(a) * 260, 40, SANDBOX_W - 40);
    const y = Phaser.Math.Clamp(this.player.y + Math.sin(a) * 180, 60, SANDBOX_H - 40);
    const s = this.add.sprite(x, y, HD.hitodama, 0).setOrigin(0.5, 0.85).setScale(2.2).setTint(0x9a7ad0).setAlpha(0);
    s.play('hitodama-float');
    this.tweens.add({ targets: s, alpha: 1, duration: 500 });
    const max = FOE_DEFS.grudge.hp * (1 + this.depth * 0.8);
    this.elite = { sprite: s, kind: 'grudge', hp: max, vx: 0, vy: 0, radius: FOES.grudge.radius, bodyY: FOES.grudge.bodyY, age: 0 };
    this.camfx.dutch(3, 900);
    this.camfx.punch(0.05);
    this.foes.push(this.elite);
    this.eliteTag = this.ui.el('div', 'grudge-tag jp', this.grudge!.kana);
    const hud = this.ui.el('div', 'grudge-hud', `<b>💀 원한 혼불 <span class="jp">${this.grudge!.kana}</span></b>`);
    const bar = this.ui.el('div', 'bar boss', '', hud);
    this.eliteBar = this.ui.el('i', '', '', bar);
    this.cameras.main.shake(300, 0.006);
  }

  /** 이마의 글자 · 체력 막대를 원한 혼불에 맞춘다 */
  private syncElite(): void {
    const e = this.elite;
    if (!e || !this.eliteTag || !this.eliteBar) return;
    const cam = this.cameras.main;
    this.ui.place(this.eliteTag, e.sprite.x - cam.worldView.x, e.sprite.y - 44 - cam.worldView.y);
    this.eliteBar.style.width = `${(Math.max(0, e.hp) / (FOE_DEFS.grudge.hp * (1 + this.depth * 0.8))) * 100}%`;
  }

  /** 체력을 다 깎았다 → 그 글자를 읽어야 정화된다 */
  private startGrudgeQuiz(e: Foe): void {
    if (this.state !== 'fight') return;
    e.hp = 0;
    e.vx = e.vy = 0;
    this.state = 'exam';
    this.pendingLevels = 0;
    this.queue = [this.grudge!];
    this.examTotal = 1;
    this.examPassed = 0;
    this.asked = 1; // 고르기 문제로
    this.sealEls = [];
    this.fx.flash(e.sprite, true);
    this.cameras.main.flash(250, 200, 170, 255);
    this.nextQuestion();
  }

  private reviveElite(): void {
    if (this.state !== 'exam' || !this.elite) return;
    this.quizPanel.close();
    this.q = null;
    this.elite.hp = FOE_DEFS.grudge.hp * (1 + this.depth * 0.8) * 0.5;
    this.state = 'fight';
    this.fx.burst(this.elite.sprite.x, this.elite.sprite.y - 20, ['P', 'P', 'L'], 14);
    const banner = this.ui.el('div', 'raid-banner', '<b>원한이 되살아났다!</b><span>체력의 절반으로 다시 덤벼든다</span>');
    this.time.delayedCall(1400, () => banner.remove());
  }

  /** 정화 → 남은 요괴도 흩어지고 가호 3택 */
  private passGrudge(): void {
    this.state = 'cleared';
    this.eliteTag?.remove();
    this.ui.root.querySelector('.grudge-hud')?.remove();
    for (const f of [...this.foes]) this.kill(f, false);
    this.elite = null;
    this.cameras.main.flash(500, 230, 210, 255);
    const orbs = gainOrbs(10 + Math.floor(this.kills / 4));
    this.updateHud();
    const kana = this.grudge!;
    const banner = this.ui.el('div', 'raid-banner', `<b>원한이 풀렸다</b><span><span class="jp">${kana.kana}</span> [${kana.ko}] — 이제 잊지 않을 거야 · 🔮 +${orbs}</span>`);
    this.time.delayedCall(1800, async () => {
      banner.remove();
      const list = rollBlessings(this.b.blessings);
      if (list.length === 0) return this.reward(0, '원한 정화');
      const i = await pickCard(
        this.ui,
        '신의 가호',
        '원한을 풀어 준 언령사에게 신들이 가호를 내린다',
        list.map((bl) => ({ icon: GODS[bl.god].icon, name: bl.name, desc: bl.desc, note: GODS[bl.god].name })),
      );
      grantBlessing(list[i].id);
      this.leave(true);
    });
  }

  /** 진화! — 금빛 번쩍임과 알림 */
  private celebrateEvo(u: ChoiceDef): void {
    this.cameras.main.flash(500, 255, 227, 154);
    this.fx.burst(this.player.x, this.player.y - 16, ['G', 'L', 'W'], 24);
    const banner = this.ui.el('div', 'raid-banner evo-banner', `<b>${u.icon} 진화! ${u.name.replace('진화: ', '')}</b><span>${u.desc}</span>`);
    this.time.delayedCall(2400, () => banner.remove());
    this.updateHud();
  }

  // ── 끝: 버팀 / 쓰러짐 ─────────────────────────────────

  /** 45초를 버텼다 → 남은 요괴는 흩어지고, 구슬 + 강화 1개 */
  private clear(): void {
    this.state = 'cleared';
    this.mojiQ = null;
    this.quizPanel.close();
    this.clearEmbers();
    this.camfx.slowmo(0.3, 380, 700);
    this.camfx.punch(0.05);
    for (const f of [...this.foes]) this.kill(f, false);
    this.pendingLevels = 0;
    const orbs = gainOrbs(8 + Math.floor(this.kills / 4));
    this.updateHud();
    const banner = this.ui.el('div', 'raid-banner', `<b>버텼다!</b><span>요괴들이 흩어진다 · 쓰러뜨린 요괴 <em>${this.kills}</em></span>`);
    this.time.delayedCall(1500, () => {
      banner.remove();
      this.reward(orbs);
    });
  }

  private reward(orbs: number, title = '습격 돌파'): void {
    // 남은 혼백 구슬은 모두 거둔다
    for (const s of this.souls) {
      this.gainXp(s.xp);
      s.img.destroy();
    }
    this.souls = [];
    if (this.pendingLevels > 0) {
      this.pendingLevels--;
      this.freeze(true);
      void this.levelPanel.open(makeQuiz(this.ttsOk), this.b.level, this.offers()).then(({ upgrade }) => {
        upgrade.apply();
        if (upgrade.special === 'evo') this.celebrateEvo(upgrade);
        this.freeze(false);
        this.reward(orbs, title);
      });
      return;
    }
    this.ui.root.classList.add('dimmed');
    const panel = this.ui.el('div', 'panel fade-in raid-reward');
    this.ui.el('h2', '', title, panel);
    this.ui.el('p', '', `🔮 언령 구슬 <b>+${orbs}</b> <small>(가진 구슬 ${this.b.orbs} · 찻집에서 쓴다)</small><br>강화를 하나 고르세요`, panel);
    const row = this.ui.el('div', 'lvl-upgrades', '', panel);
    this.offers().forEach((u, i) => {
      const card = this.ui.el('button', `ucard clickable${u.special === 'evo' ? ' evo' : ''}`, '', row);
      card.innerHTML = `<span class="uicon">${u.icon}</span><b>${u.name}</b><span>${u.desc}</span><small>${i + 1}</small>`;
      card.dataset.key = String(i + 1);
      card.addEventListener('click', () => pick(u));
    });
    const pick = (u: ChoiceDef) => {
      window.removeEventListener('keydown', onKey);
      u.apply();
      if (u.special === 'evo') this.celebrateEvo(u);
      this.leave(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const card = row.querySelector<HTMLButtonElement>(`[data-key="${e.key}"]`);
      card?.click();
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
  }

  private die(): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.quizPanel.close();
    this.q = null;
    this.b.hp = 0;
    this.updateHud();
    this.player.play('p-hurt', true);
    this.tweens.add({ targets: this.player, alpha: 0.3, duration: 600 });
    this.time.delayedCall(700, () => {
      this.ui.root.classList.add('dimmed');
      const panel = this.ui.el('div', 'panel fade-in defeat');
      this.ui.el('h2', '', '쓰러졌다…', panel);
      const where = journey.checkpoint >= 0 ? '마지막으로 통과한 시련' : '여정의 처음';
      this.ui.el('p', '', `<b>${where}</b>에서 다시 시작한다.<br><small>되찾은 글자는 그대로 · 무기와 레벨은 처음부터</small>`, panel);
      wrongChips(this.ui, panel);
      const btns = this.ui.el('div', 'row', '', panel);
      btns.style.marginBottom = '0';
      this.ui.button('다시 일어서기', () => {
        fallToCheckpoint();
        this.leave(false);
      }, 'primary', btns);
    });
  }

  private leave(cleared: boolean): void {
    this.cameras.main.fadeOut(400, 12, 10, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (cleared && this.nodeId !== null) finishNode(this.nodeId);
      this.scene.start('ChapterMap');
    });
  }
}
