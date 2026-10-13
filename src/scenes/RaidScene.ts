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
import { sandboxGround, SANDBOX_W, SANDBOX_H } from '../art/hd/world';
import { createMoveKeys, readMove, MoveKeys } from '../systems/movement';
import { HitFx } from '../fx/HitFx';
import { settings } from '../systems/settings';
import { Arsenal, ArmsTarget, pickOffers } from '../combat/Arsenal';
import { ARSENAL, MAX_SLOTS, MAX_LEVEL } from '../data/arsenal';
import { basicChoices, ChoiceDef } from '../data/choices';
import { makeQuiz, makeChoices, recordAnswer, trialQueue, learnedKana } from '../systems/quiz';
import { ROWS, Kana, matchesKo } from '../data/kana';
import { HangulSyllableTyper } from '../util/hangulKeys';
import { tts } from '../systems/tts';
import { journey, finishNode, fallToCheckpoint, gainOrbs, grantBlessing, Build } from '../systems/journey';

/** 습격 한 판 길이 */
const RAID_MS = 45_000;
const PLAYER_SPEED = 120;
const xpNeed = (level: number) => 3 + level * 2;
/** 시련 연속 퀴즈: 한 문제 제한시간 · 틀렸을 때 피해 · 퀴즈 중 요괴 속도 */
const EXAM_MS = 8000;
const EXAM_HURT = 10;
const EXAM_SLOW = 0.2;
/** 맞히면 이 거리 안의 요괴가 정화된다 */
const PURIFY_R = 150;

type FoeKind = 'hitodama' | 'kasa' | 'grudge';
const FOES: Record<FoeKind, { hp: number; speed: number; damage: number; radius: number; bodyY: number }> = {
  hitodama: { hp: 30, speed: 46, damage: 8, radius: 8, bodyY: 8 },
  kasa: { hp: 60, speed: 62, damage: 12, radius: 10, bodyY: 14 },
  /** 원한 혼불 (엘리트) — 틀렸던 글자를 이마에 달고 있다 */
  grudge: { hp: 360, speed: 34, damage: 15, radius: 16, bodyY: 22 },
};

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
}

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
  private caster!: SpellCaster;
  /** 언령술을 읽는 동안 요괴가 느려진다 */
  private castSlow = false;

  constructor() {
    super('Raid');
  }

  init(data: { nodeId?: number; depth?: number; trial?: boolean; row?: number; grudge?: boolean }): void {
    this.wantGrudge = data.grudge ?? false;
    this.nodeId = data.nodeId ?? null;
    this.trial = data.trial ?? false;
    this.row = data.row ?? 0;
    // 시련은 같은 깊이의 습격보다 조금 더 거세다
    this.depth = Math.min(1, (data.depth ?? 0) + (this.trial ? 0.1 : 0));
  }

  create(): void {
    registerHd(this);
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
    // 원한 요괴: 이번 판에 가장 많이 틀린 글자 (없으면 일반 습격)
    this.grudge = null;
    if (this.wantGrudge) {
      const wrong = learnedKana().filter((k) => run.wrong[k.kana]).sort((a, b) => run.wrong[b.kana] - run.wrong[a.kana]);
      this.grudge = wrong[0] ?? null;
    }

    if (!this.textures.exists('sandbox-ground')) this.textures.addCanvas('sandbox-ground', sandboxGround());
    this.add.image(0, 0, 'sandbox-ground').setOrigin(0);
    this.placeObstacles();

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
      (t, dmg, nx, ny, crit) => this.hit(t as Foe, dmg, nx, ny, crit),
      (dirX) => {
        this.facing = dirX;
        this.casting = true;
        this.player.play('p-cast', true);
      },
      this.b.owned,
      () => this.b.mods,
    );

    const cam = this.cameras.main;
    cam.setBounds(0, 0, SANDBOX_W, SANDBOX_H);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.fadeIn(300, 12, 10, 18);

    this.keys = createMoveKeys(this);
    void tts.isAvailable().then((ok) => (this.ttsOk = ok));

    this.ui = new UILayer(this);
    this.levelPanel = new LevelUpPanel(this.ui);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.levelPanel.close());
    this.quizPanel = new BossQuizPanel(this.ui);
    this.createHud();
    const rowName = ROWS[this.row]?.name ?? '';
    const banner = this.grudge
      ? this.ui.el('div', 'raid-banner', `<b>💀 원한 요괴</b><span>틀렸던 글자 <em class="jp">${this.grudge.kana}</em>가 원한 혼불이 되었다 — 쓰러뜨리고 <em>읽어서</em> 정화하라</span>`)
      : this.wantGrudge
        ? this.ui.el('div', 'raid-banner', '<b>💀 원한 요괴…?</b><span>틀린 글자가 없어 원한이 생기지 않았다 · 대신 요괴들이 몰려온다! (45초)</span>')
        : this.trial
      ? this.ui.el('div', 'raid-banner', `<b>⚔️ <span class="jp">${rowName}</span> 시련</b><span>45초를 버티면 <em>시련의 문</em>이 열린다 — 그 행의 글자를 모두 맞혀라</span>`)
      : this.ui.el('div', 'raid-banner', '<b>👹 습격!</b><span>45초 동안 버텨라 · 무기는 자동, <em>WASD</em>로 피하기</span>');
    this.time.delayedCall(2600, () => banner.remove());

    this.castSlow = false;
    this.caster = new SpellCaster(this, this.ui, this.fx, this.player, spellsFor(journey.learnedRows), {
      blocked: () => this.state !== 'fight' || this.paused || !!this.q,
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
      slots: this.ui.el('div', 'arms-slots'),
    };
    this.updateHud();
  }

  private updateHud(): void {
    const b = this.b;
    const left = Math.max(0, Math.ceil((RAID_MS - this.elapsed) / 1000));
    const slotKey = b.owned.map((o) => `${o.id}${o.level}${o.evo ? '*' : ''}`).join(',');
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
    const slots: string[] = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      const o = b.owned[i];
      if (!o) {
        slots.push('<div class="arms-slot empty"></div>');
        continue;
      }
      const def = ARSENAL[o.id];
      const pips = Array.from({ length: MAX_LEVEL }, (_, k) => `<i class="${k < o.level ? 'on' : ''}"></i>`).join('');
      const evo = o.evo && def.evo;
      slots.push(
        `<div class="arms-slot${evo ? ' evo' : ''}" title="${evo ? def.evo!.name : def.name}"><span>${evo ? def.evo!.icon : def.icon}</span><b>${evo ? def.evo!.name : def.name}</b><em>${pips}</em></div>`,
      );
    }
    this.hud.slots.innerHTML = slots.join('');
  }

  /** 석등 · 바위 · 소나무 (발밑 충돌) */
  private placeObstacles(): void {
    const put = (key: string, x: number, y: number, rx: number, ry: number) => {
      this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
      this.obstacles.push({ cx: x, cy: y - ry, rx, ry });
    };
    let seed = 9 + (this.nodeId ?? 0) * 31;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const x = 80 + rnd() * (SANDBOX_W - 160);
      const y = 120 + rnd() * (SANDBOX_H - 200);
      if (Math.abs(x - SANDBOX_W / 2) < 200 && Math.abs(y - SANDBOX_H / 2 - 100) < 160) continue;
      const r = rnd();
      if (r < 0.35) put(HD.pine, x, y, 7, 4);
      else if (r < 0.65) put(HD.rock, x, y, 13, 6);
      else put(HD.lantern, x, y, 9, 4);
    }
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
    if (this.paused || this.state === 'dead') return;
    const dt = Math.min(rawDelta, 50);
    if (this.fx.stopped) return;

    this.caster.update(dt);
    // 입력 문제 · 언령술 입력 중엔 WASD가 한글 자판이 되므로 멈춰 선다
    if (!(this.q && !this.q.done && this.q.kind === 'type') && !this.caster.casting) this.movePlayer(time, dt);
    else this.player.play('p-idle', true);
    this.arsenal.update(dt, this.state === 'fight');
    if (this.state === 'fight') {
      this.elapsed += dt;
      const fdt = this.castSlow ? dt * 0.2 : dt;
      this.spawn(fdt);
      this.updateFoes(time, fdt);
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
      this.updateExam(dt);
    }
    this.syncElite();
    this.updateHud();
  }

  private movePlayer(time: number, dt: number): void {
    const dir = readMove(this.keys);
    const p = this.player;
    const moving = dir.x !== 0 || dir.y !== 0;
    if (moving && (this.state === 'fight' || this.state === 'exam')) {
      const step = (PLAYER_SPEED * this.b.speed * dt) / 1000;
      if (!this.blocked(p.x + dir.x * step, p.y)) p.x += dir.x * step;
      if (!this.blocked(p.x, p.y + dir.y * step)) p.y += dir.y * step;
      if (dir.x !== 0 && !this.casting) this.facing = Math.sign(dir.x);
    }
    const walking = moving && (this.state === 'fight' || this.state === 'exam');
    if (!this.casting && time >= this.invulnUntil) p.play(walking ? 'p-walk' : 'p-idle', true);
    p.setFlipX(this.facing < 0);
    p.setAlpha(time < this.invulnUntil && Math.floor(time / 70) % 2 === 0 ? 0.4 : 1);
    p.setDepth(p.y);
    this.shadow.setPosition(p.x, p.y).setDepth(p.y - 0.5);
  }

  // ── 요괴 ─────────────────────────────────────────────

  private spawn(dt: number): void {
    const t = Math.min(1, this.elapsed / RAID_MS);
    // 첫 습격은 숨 돌릴 틈이 있게, 산 정상에 가까울수록 거세게
    const interval = 900 - 400 * t - 250 * this.depth;
    const cap = Math.round(8 + 10 * t + 14 * this.depth);
    this.spawnAcc += dt;
    if (this.spawnAcc < interval) return;
    this.spawnAcc = 0;
    if (this.foes.length >= cap) return;
    // 후반엔 두세 마리씩 몰려온다
    const pack = t > 0.6 ? 2 + (Math.random() < this.depth ? 1 : 0) : 1;
    for (let i = 0; i < pack; i++) {
      const kind: FoeKind = Math.random() < 0.03 + 0.25 * t + 0.25 * this.depth ? 'kasa' : 'hitodama';
      const a = Math.random() * Math.PI * 2;
      const x = Phaser.Math.Clamp(this.player.x + Math.cos(a) * 340, 20, SANDBOX_W - 20);
      const y = Phaser.Math.Clamp(this.player.y + Math.sin(a) * 220, 40, SANDBOX_H - 20);
      if (this.blocked(x, y)) continue;
      const s = this.add.sprite(x, y, kind === 'kasa' ? HD.kasa : HD.hitodama, 0).setOrigin(0.5, kind === 'kasa' ? 1 : 0.85).setAlpha(0);
      s.play(kind === 'kasa' ? 'kasa-hop' : 'hitodama-float');
      this.tweens.add({ targets: s, alpha: 1, duration: 300 });
      const def = FOES[kind];
      this.foes.push({ sprite: s, kind, hp: def.hp * (1 + this.depth * 0.8), vx: 0, vy: 0, radius: def.radius, bodyY: def.bodyY, age: Math.random() * 1000 });
    }
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
      // 카사오바케는 콩콩 뛰며 다가온다
      const pace = f.kind === 'kasa' ? 0.25 + Math.abs(Math.sin((f.age / 333) * Math.PI)) * 1.3 : 1;
      const nx = f.sprite.x + ((dx / d) * def.speed * pace + f.vx) * sec;
      const ny = f.sprite.y + ((dy / d) * def.speed * pace + f.vy) * sec;
      if (!this.blocked(nx, f.sprite.y, 2)) f.sprite.x = nx;
      else f.vx *= -0.3;
      if (!this.blocked(f.sprite.x, ny, 2)) f.sprite.y = ny;
      else f.vy *= -0.3;
      f.vx *= 0.86;
      f.vy *= 0.86;
      f.sprite.setFlipX(dx < 0);
      f.sprite.setDepth(f.sprite.y + 2);

      if (d < 14 && time > this.invulnUntil) {
        this.invulnUntil = time + 800 * this.b.mods.invuln;
        f.vx -= (dx / d) * 220;
        f.vy -= (dy / d) * 220;
        if (settings.god || this.caster.shielded) continue;
        this.b.hp -= def.damage;
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
  private hit(f: Foe, dmg: number, nx: number, ny: number, crit: boolean): void {
    if (f.hp <= 0 || this.state !== 'fight') return;
    this.fx.number(f.sprite.x, f.sprite.y - f.bodyY - 14, dmg, crit ? 'crit' : 'normal');
    this.fx.flash(f.sprite, crit);
    this.fx.spark(f.sprite.x - nx * 6, f.sprite.y - f.bodyY - ny * 6, crit ? 'G' : 'L');
    if (crit) {
      this.fx.hitStop(55);
      this.cameras.main.shake(70, 0.003);
    }
    const knock = (crit ? 260 : 170) * (f.kind === 'kasa' ? 0.7 : 1) * this.b.mods.knockback;
    f.vx += nx * knock;
    f.vy += ny * knock;
    this.fx.dust(f.sprite.x, f.sprite.y, nx, ny, crit ? 7 : 4, f.kind === 'kasa' ? 'w' : 'P');
    f.hp -= dmg;
    if (f.kind === 'grudge') {
      this.syncElite();
      if (f.hp <= 0) this.startGrudgeQuiz(f);
      return;
    }
    if (f.hp <= 0) this.kill(f);
  }

  private kill(f: Foe, xp = true): void {
    this.fx.burst(f.sprite.x, f.sprite.y - f.bodyY, f.kind === 'kasa' ? ['N', 'L', 'W'] : ['P', 'L', 'W'], 12);
    f.sprite.destroy();
    this.foes = this.foes.filter((x) => x !== f);
    if (!xp) return;
    this.fx.hitStop(35);
    this.kills++;
    this.gainXp(f.kind === 'kasa' ? 2 : 1);
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
    this.paused = on;
    this.time.paused = on;
    if (on) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.ui.root.classList.toggle('dimmed', on);
  }

  private levelUp(): void {
    this.pendingLevels--;
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
    this.pendingLevels = 0;
    this.queue = trialQueue();
    this.examTotal = this.queue.length;
    this.examPassed = 0;
    this.asked = Math.random() < 0.5 ? 0 : 1;
    this.hud.slots.style.display = 'none';
    this.cameras.main.flash(300, 255, 230, 160);
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
    if (this.sys.isPaused() || this.state !== 'exam') return;
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
    const max = FOES.grudge.hp * (1 + this.depth * 0.8);
    this.elite = { sprite: s, kind: 'grudge', hp: max, vx: 0, vy: 0, radius: FOES.grudge.radius, bodyY: FOES.grudge.bodyY, age: 0 };
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
    this.eliteBar.style.width = `${(Math.max(0, e.hp) / (FOES.grudge.hp * (1 + this.depth * 0.8))) * 100}%`;
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
    this.elite.hp = FOES.grudge.hp * (1 + this.depth * 0.8) * 0.5;
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
