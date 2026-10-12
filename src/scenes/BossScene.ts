import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { BossQuizPanel } from '../ui/BossQuizPanel';
import { wrongChips } from '../ui/wrongChips';
import { HD, registerHd } from '../art/hd/register';
import { summitGround, echoTile, SUMMIT_W, SUMMIT_H, ARENA } from '../art/hd/summit';
import { createMoveKeys, readMove, MoveKeys } from '../systems/movement';
import { HitFx } from '../fx/HitFx';
import { settings } from '../systems/settings';
import { Arsenal, ArmsTarget } from '../combat/Arsenal';
import { BossPatterns, PatternId } from '../combat/BossPatterns';
import { journey, fallToCheckpoint, Build } from '../systems/journey';
import { learnedKana, recordAnswer } from '../systems/quiz';
import { run } from '../systems/run';
import { Kana, matchesKo } from '../data/kana';
import { HangulSyllableTyper } from '../util/hangulKeys';
import { tts } from '../systems/tts';

const PLAYER_SPEED = 120;
/** 무기로 깎는 양을 보고 정한 체력 (페이즈마다 30~40초) */
const BOSS_MAX = 5000;
/** 페이즈별 체력 바닥 — 무기로는 이 아래로 못 깎고 다음 페이즈로 */
const FLOOR: Record<number, number> = { 1: 0.6, 2: 0.3, 3: 0.1 };
const PHASE_NAME: Record<number, string> = { 1: '1페이즈 · 메아리 외침', 2: '2페이즈 · 메아리 바닥', 3: '3페이즈 · 언령 대결', 4: '발악 · 마지막 메아리' };
/** 퀴즈 사이 간격 (전투 시간) · 제한시간 */
const QUIZ_GAP = 7000;
const QUIZ_MS = 8000;
const RAGE_MS = 5000;
const RAGE_STEPS = 5;
/** 퀴즈 피해 · 회복 (최대 체력 비율) */
const QUIZ_HIT = 0.1;
/** 퀴즈 중 슬로우 */
const SLOW = 0.2;
const COMMON: PatternId[] = ['slam', 'dash3', 'sweep', 'burst', 'spiral', 'aimed', 'fan'];
const UNIQUE: PatternId[] = ['echoRing', 'boulder'];

type QKind = 'shout' | 'floor' | 'type' | 'pick';
interface Quiz {
  kind: QKind;
  answer: Kana;
  choices: Kana[];
  left: number;
  limit: number;
  done: boolean;
  /** 메아리 바닥: 같은 돌판 위에 가만히 선 시간 */
  stand: number;
  standTile: number;
}

interface Tile {
  img: Phaser.GameObjects.Image;
  label: HTMLElement;
  kana: Kana;
}

interface TempObstacle {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  until: number;
}

/**
 * 👺 1장 보스 · 야마비코 (산 정상).
 * 무기로 깎고 피지컬 패턴을 피하며, 7초마다 언령 집중 퀴즈 (맞히면 -10%, 틀리면 +10%).
 * 1 메아리 외침(소리 → 글자) · 2 메아리 바닥(글자 돌판 위에 서기) · 3 언령 대결(입력 / 고르기) · 발악 5문제 연속.
 */
export class BossScene extends Phaser.Scene {
  private b!: Build;
  private keys!: MoveKeys;
  private fx!: HitFx;
  private ui!: UILayer;
  private panel!: BossQuizPanel;
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private boss!: Phaser.GameObjects.Sprite;
  private bossShadow!: Phaser.GameObjects.Ellipse;
  private bossTarget!: ArmsTarget;
  private arsenal!: Arsenal;
  private patterns!: BossPatterns;
  private obstacles: TempObstacle[] = [];
  private typer = new HangulSyllableTyper();
  private bossHp = BOSS_MAX;
  private phase = 1;
  private state: 'intro' | 'fight' | 'quiz' | 'rage' | 'won' | 'dead' = 'intro';
  private quizAcc = 0;
  private quiz: Quiz | null = null;
  private tiles: Tile[] = [];
  private rageStep = 0;
  private idleMs = 2000;
  private invulnUntil = 0;
  private casting = false;
  private facing = 1;
  private ttsOk = false;
  private stats = { total: 0, correct: 0 };
  /** 장면 시간 배율과 상관없이 흐르는 예약 (퀴즈 결과 표시 등) */
  private timers: { left: number; fn: () => void }[] = [];
  private hud!: { hp: HTMLElement; hpText: HTMLElement; boss: HTMLElement; phase: HTMLElement };
  private onKey!: (e: KeyboardEvent) => void;

  constructor() {
    super('Boss');
  }

  create(): void {
    registerHd(this);
    this.fx = new HitFx(this);
    this.b = journey.build;
    this.obstacles = [];
    this.bossHp = BOSS_MAX;
    this.phase = 1;
    this.state = 'intro';
    this.quizAcc = 0;
    this.quiz = null;
    this.tiles = [];
    this.timers = [];
    this.idleMs = 2000;
    this.casting = false;
    this.stats = { total: 0, correct: 0 };
    run.chapter = 2;

    if (!this.textures.exists('summit')) this.textures.addCanvas('summit', summitGround());
    if (!this.textures.exists('echo-tile')) this.textures.addCanvas('echo-tile', echoTile());
    this.add.image(0, 0, 'summit').setOrigin(0);

    this.bossShadow = this.add.ellipse(SUMMIT_W / 2, 300, 64, 18, 0x000000, 0.35);
    this.boss = this.add.sprite(SUMMIT_W / 2, 300, HD.yamabiko, 0).setOrigin(0.5, 1);
    const core = this.add.image(SUMMIT_W / 2, 260, HD.dust('w')).setVisible(false);
    this.bossTarget = { sprite: core, radius: 26, bodyY: 0 };

    this.shadow = this.add.ellipse(SUMMIT_W / 2, 470, 18, 6, 0x000000, 0.3);
    this.player = this.add.sprite(SUMMIT_W / 2, 470, HD.player, 0).setOrigin(0.5, 1);
    this.player.play('p-idle');
    this.player.on(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + 'p-cast', () => (this.casting = false));

    this.arsenal = new Arsenal(
      this,
      this.player,
      () => (this.state === 'fight' ? [this.bossTarget] : []),
      (_t, dmg, _nx, _ny, crit) => this.hitBoss(dmg, crit),
      (dirX) => {
        this.facing = dirX;
        this.casting = true;
        this.player.play('p-cast', true);
      },
      this.b.owned,
      () => this.b.mods,
    );

    this.patterns = new BossPatterns({
      scene: this,
      fx: this.fx,
      boss: this.boss,
      shadow: this.bossShadow,
      player: this.player,
      bounds: ARENA,
      hurt: (dmg, fx, fy) => this.hurtPlayer(dmg, fx, fy),
      addObstacle: (x, y, rx, ry, ms) => this.obstacles.push({ cx: x, cy: y, rx, ry, until: this.time.now + ms }),
    });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, SUMMIT_W, SUMMIT_H);
    cam.startFollow(this.player, true, 0.1, 0.1);
    cam.fadeIn(500, 12, 10, 18);

    this.keys = createMoveKeys(this);
    void tts.isAvailable().then((ok) => (this.ttsOk = ok));
    this.createHud();
    this.onKey = (e) => this.handleKey(e);
    window.addEventListener('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', this.onKey);
      this.panel.close();
      this.setSlow(false);
      speechSynthesis.cancel();
    });

    const banner = this.ui.el('div', 'raid-banner', '<b>👺 야마비코</b><span>산 정상의 메아리 요괴 — 빼앗긴 목소리를 되찾아라</span>');
    this.after(2400, () => {
      banner.remove();
      this.state = 'fight';
    });
  }

  private createHud(): void {
    this.ui = new UILayer(this);
    const left = this.ui.el('div', 'raid-hud-left');
    const bar = this.ui.el('div', 'bar hp', '', left);
    const hp = this.ui.el('i', '', '', bar);
    const hpText = this.ui.el('span', '', '', bar);
    const bossHud = this.ui.el('div', 'boss-hud');
    this.ui.el('div', 'boss-name', '야마비코 <span class="jp">山彦</span>', bossHud);
    const bb = this.ui.el('div', 'bar boss', '', bossHud);
    const boss = this.ui.el('i', '', '', bb);
    for (const f of [0.6, 0.3, 0.1]) this.ui.el('span', 'mark', '', bb).style.left = `${f * 100}%`;
    const phase = this.ui.el('div', 'boss-phase', '', bossHud);
    this.panel = new BossQuizPanel(this.ui);
    this.hud = { hp, hpText, boss, phase };
    this.updateHud();
  }

  private updateHud(): void {
    this.hud.hp.style.width = `${(Math.max(0, this.b.hp) / this.b.maxHp) * 100}%`;
    this.hud.hpText.textContent = `${Math.max(0, Math.ceil(this.b.hp))} / ${this.b.maxHp}`;
    this.hud.boss.style.width = `${(this.bossHp / BOSS_MAX) * 100}%`;
    this.hud.phase.textContent = PHASE_NAME[this.phase];
  }

  // ── 시간 ─────────────────────────────────────────────

  /** 슬로우와 상관없이 실제 시간으로 흐르는 예약 */
  private after(ms: number, fn: () => void): void {
    this.timers.push({ left: ms, fn });
  }

  private setSlow(on: boolean): void {
    this.time.timeScale = on ? SLOW : 1;
    this.tweens.timeScale = on ? SLOW : 1;
  }

  // ── 매 프레임 ─────────────────────────────────────────

  update(time: number, rawDelta: number): void {
    const dt = Math.min(rawDelta, 50);
    for (const t of [...this.timers]) {
      t.left -= dt;
      if (t.left <= 0) {
        this.timers.splice(this.timers.indexOf(t), 1);
        t.fn();
      }
    }
    if (this.state === 'dead' || this.state === 'won') return;
    if (this.fx.stopped) return;
    const slow = this.state === 'quiz' || this.state === 'rage';
    const sdt = slow ? dt * SLOW : dt;
    this.obstacles = this.obstacles.filter((o) => o.until > time);

    const typing = this.quiz && !this.quiz.done && this.quiz.kind === 'type';
    if (!typing) this.movePlayer(time, dt);
    else this.player.play('p-idle', true);
    this.arsenal.update(dt, this.state === 'fight');
    this.patterns.update(sdt);
    if (this.state === 'fight') this.bossBrain(dt);
    this.bossTarget.sprite.setPosition(this.boss.x, this.boss.y - 40);
    this.boss.setDepth(this.boss.y);
    this.bossShadow.setDepth(this.boss.y - 1);
    if (this.state !== 'intro') this.contact(time);

    if (this.state === 'fight') {
      this.quizAcc += dt;
      if (this.quizAcc >= QUIZ_GAP && !this.patterns.busy) {
        this.quizAcc = 0;
        this.startQuiz();
      }
    }
    if (this.quiz && !this.quiz.done) this.updateQuiz(dt);
    this.syncTiles();
    this.updateHud();
  }

  /** 패턴 사이엔 다가오고, 페이즈에 맞는 패턴을 고른다 */
  private bossBrain(dt: number): void {
    if (this.patterns.busy) return;
    const b = this.boss;
    const dx = this.player.x - b.x;
    const dy = this.player.y - 60 - b.y;
    const d = Math.hypot(dx, dy);
    if (d > 90) {
      b.x += (dx / d) * 40 * (dt / 1000);
      b.y += (dy / d) * 40 * (dt / 1000);
      this.bossShadow.setPosition(b.x, b.y);
    }
    b.setFlipX(dx < 0);
    this.idleMs -= dt;
    if (this.idleMs > 0) return;
    const pool = this.phase === 1 ? COMMON : Math.random() < 0.45 ? UNIQUE : COMMON;
    const id = pool[Math.floor(Math.random() * pool.length)];
    void this.patterns.run(id).then(() => (this.idleMs = this.phase >= 3 ? 700 : 1300));
  }

  // ── 피해 ─────────────────────────────────────────────

  private hitBoss(dmg: number, crit: boolean): void {
    if (this.state !== 'fight') return;
    this.fx.number(this.boss.x + Phaser.Math.Between(-14, 14), this.boss.y - 70, dmg, crit ? 'crit' : 'boss');
    this.boss.setTintFill(0xffffff);
    this.time.delayedCall(45, () => this.boss.clearTint());
    if (crit) this.fx.hitStop(40);
    this.damageBoss(dmg);
  }

  /** 페이즈 바닥 아래로는 깎이지 않고, 바닥에 닿으면 다음 페이즈 */
  private damageBoss(dmg: number): void {
    const floor = (FLOOR[this.phase] ?? 0) * BOSS_MAX;
    this.bossHp = Math.max(floor, this.bossHp - dmg);
    if (this.bossHp <= floor && this.phase <= 3) this.nextPhase();
  }

  private nextPhase(): void {
    if (this.phase === 3) {
      this.startRage();
      return;
    }
    this.phase++;
    this.quizAcc = QUIZ_GAP - 1500;
    this.cameras.main.flash(300, 230, 200, 255);
    this.boss.setTexture(HD.yamabiko, 1);
    this.time.delayedCall(500, () => this.boss.setTexture(HD.yamabiko, 0));
    const msg = this.phase === 2 ? '메아리 고리 · 바위 던지기를 쓰기 시작한다 — 퀴즈: 들리는 글자의 돌판 위에 서라!' : '모든 메아리가 빨라진다 — 퀴즈: 글자를 읽어 입력하거나 골라라!';
    const banner = this.ui.el('div', 'raid-banner', `<b>${PHASE_NAME[this.phase]}</b><span>${msg}</span>`);
    this.after(2600, () => banner.remove());
  }

  private hurtPlayer(dmg: number, fromX: number, fromY: number): void {
    const now = this.time.now;
    if (now < this.invulnUntil || this.state === 'dead' || this.state === 'won') return;
    this.invulnUntil = now + 900 * this.b.mods.invuln;
    const p = this.player;
    this.fx.number(p.x, p.y - 36, dmg, 'hurt');
    p.play('p-hurt', true);
    this.fx.flash(p);
    this.cameras.main.shake(120, 0.006);
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    const tx = Phaser.Math.Clamp(p.x + (dx / d) * 26, ARENA.x, ARENA.x + ARENA.w);
    const ty = Phaser.Math.Clamp(p.y + (dy / d) * 18, ARENA.y, ARENA.y + ARENA.h);
    this.tweens.add({ targets: p, x: tx, y: ty, duration: 150, ease: 'Cubic.easeOut' });
    if (settings.god) return;
    this.b.hp -= dmg;
    if (this.b.hp <= 0) this.die();
  }

  private contact(time: number): void {
    if (time < this.invulnUntil) return;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y - 8, this.boss.x, this.boss.y - 26) < 30) this.hurtPlayer(10, this.boss.x, this.boss.y - 10);
  }

  private blocked(x: number, y: number): boolean {
    if (x < ARENA.x || y < ARENA.y || x > ARENA.x + ARENA.w || y > ARENA.y + ARENA.h) return true;
    return this.obstacles.some((o) => {
      const dx = (x - o.cx) / (o.rx + 5);
      const dy = (y - o.cy) / (o.ry + 3);
      return dx * dx + dy * dy < 1;
    });
  }

  private movePlayer(time: number, dt: number): void {
    const dir = readMove(this.keys);
    const p = this.player;
    const moving = (dir.x !== 0 || dir.y !== 0) && this.state !== 'intro';
    if (moving) {
      const step = (PLAYER_SPEED * this.b.speed * dt) / 1000;
      if (!this.blocked(p.x + dir.x * step, p.y)) p.x += dir.x * step;
      if (!this.blocked(p.x, p.y + dir.y * step)) p.y += dir.y * step;
      if (dir.x !== 0 && !this.casting) this.facing = Math.sign(dir.x);
    }
    if (!this.casting && time >= this.invulnUntil - 600) p.play(moving ? 'p-walk' : 'p-idle', true);
    p.setFlipX(this.facing < 0);
    p.setAlpha(time < this.invulnUntil && Math.floor(time / 70) % 2 === 0 ? 0.4 : 1);
    p.setDepth(p.y);
    this.shadow.setPosition(p.x, p.y).setDepth(p.y - 0.5);
  }

  // ── 언령 집중 퀴즈 ────────────────────────────────────

  /** 1장 글자 전부에서, 틀렸던 글자일수록 자주 */
  private pickKana(avoidNoType = false): Kana {
    const all = learnedKana().filter((k) => !avoidNoType || !k.noType);
    const w = all.map((k) => 1 + (run.wrong[k.kana] ?? 0) * 2);
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < all.length; i++) if ((r -= w[i]) <= 0) return all[i];
    return all[all.length - 1];
  }

  /** 보기: 1장 글자 전체에서 고르게 섞는다 (같은 발음은 빼고) */
  private choicesFor(answer: Kana, n: number): Kana[] {
    const pool = learnedKana()
      .filter((k) => k !== answer && k.ko !== answer.ko)
      .sort(() => Math.random() - 0.5);
    const picked: Kana[] = [];
    for (const k of pool) if (picked.length < n - 1 && !picked.some((p) => p.ko === k.ko)) picked.push(k);
    return [answer, ...picked].sort(() => Math.random() - 0.5);
  }

  private limit(base: number): number {
    return base + this.b.mods.quizTime * 1000;
  }

  private startQuiz(kind?: QKind): void {
    if (this.state === 'fight') this.state = 'quiz';
    this.setSlow(true);
    const k: QKind = kind ?? (this.phase === 1 ? 'shout' : this.phase === 2 ? 'floor' : Math.random() < 0.5 ? 'type' : 'pick');
    const answer = this.pickKana(k === 'type');
    const choices = this.choicesFor(answer, k === 'floor' ? 4 : 5);
    const limit = this.limit(this.state === 'rage' ? RAGE_MS : QUIZ_MS);
    this.quiz = { kind: k, answer, choices, left: limit, limit, done: false, stand: 0, standTile: -1 };
    this.typer = new HangulSyllableTyper();
    const title = this.state === 'rage' ? `👺 마지막 메아리 ${this.rageStep + 1} / ${RAGE_STEPS}` : '👺 언령 집중 — 시간이 느려졌다';
    // 음성이 없으면 외친 소리를 글로 보여 준다
    const replay = this.ttsOk ? ' <small>Space 다시 듣기</small>' : ` <b>「${answer.ko}!」</b>`;
    const kanaChoices = choices.map((c) => ({ html: `<span class="jp">${c.kana}</span>`, correct: c === answer }));
    const pick = (i: number) => this.resolve(choices[i] === answer, i);
    if (k === 'shout' || k === 'floor') {
      this.shout(answer);
      if (k === 'shout') this.panel.show({ title, prompt: `야마비코가 외친 글자는?${replay}`, choices: kanaChoices }, pick);
      else {
        this.placeTiles(choices);
        this.panel.show({ title, prompt: `외친 소리의 글자가 새겨진 <b>돌판 위에 서라!</b> <small>WASD</small>${replay}` });
      }
    } else if (k === 'type') {
      this.panel.show({ title, big: { text: answer.kana, jp: true }, prompt: '발음을 한글로 입력 <small>한/영 상관없이 · 입력 중엔 멈춰 선다</small>', typing: true });
    } else {
      this.panel.show({ title, big: { text: answer.ko, jp: false }, prompt: '이 발음의 글자를 고르세요', choices: kanaChoices }, pick);
    }
  }

  /** 야마비코가 글자를 외친다 (일본어 음성이 없으면 말풍선에 한글로) */
  private shout(kana: Kana): void {
    this.boss.setTexture(HD.yamabiko, 1);
    this.after(700, () => this.state !== 'won' && this.boss.setTexture(HD.yamabiko, 0));
    this.cameras.main.shake(150, 0.003);
    if (this.ttsOk) void tts.speak(kana.kana, 0.9);
    const cam = this.cameras.main;
    const bubble = this.ui.el('div', 'boss-bubble', this.ttsOk ? '♪ ! ♪' : `「${kana.ko}!」`);
    // 보스가 화면 밖이어도 말풍선은 화면 안에
    const bx = Phaser.Math.Clamp(this.boss.x - cam.worldView.x + 40, 60, 580);
    const by = Phaser.Math.Clamp(this.boss.y - 96 - cam.worldView.y, 90, 300);
    this.ui.place(bubble, bx, by);
    this.after(this.ttsOk ? 900 : 2600, () => bubble.remove());
  }

  private placeTiles(choices: Kana[]): void {
    const p = this.player;
    const spots: [number, number][] = [[-78, -46], [78, -46], [-78, 46], [78, 46]];
    this.tiles = choices.map((kana, i) => {
      const x = Phaser.Math.Clamp(p.x + spots[i][0], ARENA.x + 30, ARENA.x + ARENA.w - 30);
      const y = Phaser.Math.Clamp(p.y + spots[i][1], ARENA.y + 20, ARENA.y + ARENA.h - 10);
      const img = this.add.image(x, y, 'echo-tile').setDepth(1);
      const label = this.ui.el('div', 'echo-label jp', kana.kana);
      return { img, label, kana };
    });
    this.syncTiles();
  }

  private syncTiles(): void {
    const cam = this.cameras.main;
    for (const t of this.tiles) this.ui.place(t.label, t.img.x - cam.worldView.x, t.img.y - 2 - cam.worldView.y);
  }

  private tileUnderPlayer(): number {
    return this.tiles.findIndex((t) => Math.hypot((this.player.x - t.img.x) / 24, (this.player.y - t.img.y) / 12) < 1);
  }

  private clearTiles(): void {
    this.tiles.forEach((t) => {
      t.img.destroy();
      t.label.remove();
    });
    this.tiles = [];
  }

  private updateQuiz(dt: number): void {
    const q = this.quiz!;
    q.left -= dt;
    this.panel.setTime(q.left / q.limit);
    this.panel.setBehind(this.player.y - this.cameras.main.worldView.y > 250);
    if (q.kind === 'floor') {
      const tile = this.tileUnderPlayer();
      const still = readMove(this.keys);
      if (tile >= 0 && tile === q.standTile && still.x === 0 && still.y === 0) q.stand += dt;
      else q.stand = 0;
      q.standTile = tile;
      this.tiles.forEach((t, i) => t.img.setTint(i === tile ? 0xfff2c8 : 0xffffff));
      // 소리를 들을 시간(1.2초)이 지난 뒤, 같은 돌판에 0.5초 서 있으면 확정
      if ((q.stand >= 500 && q.limit - q.left > 1200) || q.left <= 0) {
        const ok = tile >= 0 && this.tiles[tile].kana === q.answer;
        this.tiles.forEach((t) => t.img.setTint(t.kana === q.answer ? 0x9be3b0 : 0xd8432e));
        this.resolve(ok, -1, tile < 0 ? '돌판 위에 서지 못했다!' : undefined);
      }
      return;
    }
    if (q.left <= 0) this.resolve(false, -1, '시간 초과!');
  }

  private handleKey(e: KeyboardEvent): void {
    if (this.sys.isPaused()) return;
    const q = this.quiz;
    if (!q || q.done) return;
    if (q.kind === 'type') {
      const handled = this.typer.handle(
        e,
        (preview) => this.panel.setTyped(preview),
        (syl) => this.resolve(matchesKo(q.answer, syl), -1, matchesKo(q.answer, syl) ? undefined : `입력: ${syl}`),
      );
      if (handled) e.preventDefault();
      return;
    }
    if (e.key === ' ' && (q.kind === 'shout' || q.kind === 'floor') && this.ttsOk) void tts.speak(q.answer.kana, 0.9);
    const n = Number(e.key);
    if (n >= 1 && n <= q.choices.length && (q.kind === 'shout' || q.kind === 'pick')) this.panel.pick(n - 1);
  }

  /** 맞힘 → 보스 -10% / 틀림 → 보스 +10% (발악 중 틀리면 3페이즈로 되돌아간다) */
  private resolve(ok: boolean, picked: number, note?: string): void {
    const q = this.quiz;
    if (!q || q.done) return;
    q.done = true;
    recordAnswer(q.answer, ok);
    this.stats.total++;
    if (ok) this.stats.correct++;
    const ans = `<span class="jp">${q.answer.kana}</span> <b>[${q.answer.ko}]</b>`;
    this.panel.feedback(ok, ok ? `정답! ${ans} — 메아리가 되돌아간다` : `${note ? `${note} ` : ''}정답은 ${ans}`, picked);
    if (!ok && this.ttsOk) void tts.speak(q.answer.kana);
    const rage = this.state === 'rage';
    if (ok) {
      this.boss.setTintFill(0xf0b84a);
      this.after(120, () => this.boss.clearTint());
      this.fx.burst(this.boss.x, this.boss.y - 40, ['G', 'L', 'W'], 14);
      if (!rage) {
        this.fx.number(this.boss.x, this.boss.y - 86, Math.round(QUIZ_HIT * BOSS_MAX), 'crit');
        this.damageBoss(QUIZ_HIT * BOSS_MAX);
      }
    } else {
      this.bossHp = Math.min(BOSS_MAX, this.bossHp + QUIZ_HIT * BOSS_MAX);
      this.fx.number(this.boss.x, this.boss.y - 86, Math.round(QUIZ_HIT * BOSS_MAX), 'heal');
      this.cameras.main.shake(150, 0.004);
    }
    this.after(ok ? 900 : 1700, () => {
      this.panel.close();
      this.clearTiles();
      this.quiz = null;
      if (this.state === 'won' || this.state === 'dead') return;
      if (rage) {
        if (!ok) {
          // 발악 실패 — 체력을 되찾고 3페이즈로
          this.state = 'fight';
          this.setSlow(false);
          this.phase = 3;
          this.quizAcc = 0;
          const banner = this.ui.el('div', 'raid-banner', '<b>메아리가 되살아났다!</b><span>다시 깎아서 마지막 메아리를 끊어라</span>');
          this.after(2200, () => banner.remove());
          return;
        }
        this.rageStep++;
        if (this.rageStep >= RAGE_STEPS) this.win();
        else this.startQuiz(Math.random() < 0.5 ? 'type' : 'pick');
        return;
      }
      if (this.state === 'quiz') this.state = 'fight';
      this.setSlow(false);
    });
  }

  /** 체력 10% — 패턴이 멈추고 5문제 연속 (모두 맞혀야 쓰러진다) */
  private startRage(): void {
    this.phase = 4;
    this.state = 'rage';
    this.rageStep = 0;
    this.cameras.main.flash(400, 255, 120, 120);
    this.boss.setTexture(HD.yamabiko, 2);
    const banner = this.ui.el('div', 'raid-banner', `<b>${PHASE_NAME[4]}</b><span>메아리 ${RAGE_STEPS}개를 연속으로 맞혀라 — 하나라도 틀리면 되살아난다</span>`);
    this.after(1800, () => {
      banner.remove();
      this.startQuiz(Math.random() < 0.5 ? 'type' : 'pick');
    });
  }

  // ── 끝 ───────────────────────────────────────────────

  private win(): void {
    this.state = 'won';
    this.setSlow(false);
    this.bossHp = 0;
    this.updateHud();
    this.fx.hitStop(120);
    this.cameras.main.flash(800, 255, 255, 255);
    this.cameras.main.shake(600, 0.01);
    this.boss.setTexture(HD.yamabiko, 0).setTint(0xb8b4c4);
    this.tweens.add({ targets: this.boss, y: this.boss.y + 6, scaleY: 0.9, duration: 600 });
    const banner = this.ui.el('div', 'raid-banner', `<b>야마비코가 무릎을 꿇었다</b><span>퀴즈 ${this.stats.correct} / ${this.stats.total} 정답</span>`);
    this.time.delayedCall(2200, () => {
      banner.remove();
      this.cameras.main.fadeOut(600, 12, 10, 18);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Ending', { correct: this.stats.correct, total: this.stats.total }));
    });
  }

  private die(): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.setSlow(false);
    this.panel.close();
    this.clearTiles();
    this.b.hp = 0;
    this.updateHud();
    this.player.play('p-hurt', true);
    this.time.delayedCall(700, () => {
      this.ui.root.classList.add('dimmed');
      const panel = this.ui.el('div', 'panel fade-in defeat');
      this.ui.el('h2', '', '쓰러졌다…', panel);
      this.ui.el('p', '', '<b>마지막으로 통과한 시련</b>에서 다시 시작한다.<br><small>되찾은 글자는 그대로 · 무기와 레벨은 처음부터</small>', panel);
      wrongChips(this.ui, panel);
      const btns = this.ui.el('div', 'row', '', panel);
      btns.style.marginBottom = '0';
      this.ui.button('다시 일어서기', () => {
        fallToCheckpoint();
        this.scene.start('ChapterMap');
      }, 'primary', btns);
    });
  }
}
