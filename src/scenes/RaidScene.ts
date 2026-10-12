import Phaser from 'phaser';
import { UILayer } from '../ui/UILayer';
import { LevelUpPanel } from '../ui/LevelUpPanel';
import { wrongChips } from '../ui/wrongChips';
import { HD, registerHd } from '../art/hd/register';
import { sandboxGround, SANDBOX_W, SANDBOX_H } from '../art/hd/world';
import { createMoveKeys, readMove, MoveKeys } from '../systems/movement';
import { HitFx } from '../fx/HitFx';
import { settings } from '../systems/settings';
import { Arsenal, ArmsTarget } from '../combat/Arsenal';
import { ARSENAL, MAX_SLOTS, MAX_LEVEL } from '../data/arsenal';
import { basicChoices, ChoiceDef } from '../data/choices';
import { makeQuiz } from '../systems/quiz';
import { tts } from '../systems/tts';
import { journey, finishNode, fallToCheckpoint, Build } from '../systems/journey';

/** 습격 한 판 길이 */
const RAID_MS = 45_000;
const PLAYER_SPEED = 120;
const xpNeed = (level: number) => 3 + level * 2;

type FoeKind = 'hitodama' | 'kasa';
const FOES: Record<FoeKind, { hp: number; speed: number; damage: number; radius: number; bodyY: number }> = {
  hitodama: { hp: 30, speed: 46, damage: 8, radius: 8, bodyY: 8 },
  kasa: { hp: 60, speed: 62, damage: 12, radius: 10, bodyY: 14 },
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

type State = 'fight' | 'cleared' | 'dead';

/**
 * 👹 습격 (리마스터) — 지도의 습격 노드.
 * 몰려오는 요괴를 45초 버틴다. 레벨업 = 언령 집중(퀴즈 → 강화).
 * 빌드(무기 · 레벨 · 체력)는 한 판 내내 이어진다. 버티면 언령 구슬 + 강화 1개, 쓰러지면 마지막 시련 지점부터.
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

  constructor() {
    super('Raid');
  }

  init(data: { nodeId?: number; depth?: number }): void {
    this.nodeId = data.nodeId ?? null;
    this.depth = data.depth ?? 0;
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
    this.createHud();
    const banner = this.ui.el('div', 'raid-banner', '<b>👹 습격!</b><span>45초 동안 버텨라 · 무기는 자동, <em>WASD</em>로 피하기</span>');
    this.time.delayedCall(2600, () => banner.remove());
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
    const slotKey = b.owned.map((o) => `${o.id}${o.level}`).join(',');
    const key = `${Math.ceil(b.hp)}|${b.maxHp}|${b.xp}|${b.level}|${left}|${b.orbs}|${slotKey}`;
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.hud.hp.style.width = `${(Math.max(0, b.hp) / b.maxHp) * 100}%`;
    this.hud.hpText.textContent = `${Math.max(0, Math.ceil(b.hp))} / ${b.maxHp}`;
    this.hud.orbs.innerHTML = `🔮 언령 구슬 <b>${b.orbs}</b>`;
    this.hud.xp.style.width = `${(b.xp / xpNeed(b.level)) * 100}%`;
    this.hud.lv.textContent = `Lv ${b.level}`;
    this.hud.clock.textContent = `0:${String(left).padStart(2, '0')}`;
    this.hud.clock.classList.toggle('hurry', left <= 10);
    const slots: string[] = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      const o = b.owned[i];
      if (!o) {
        slots.push('<div class="arms-slot empty"></div>');
        continue;
      }
      const def = ARSENAL[o.id];
      const pips = Array.from({ length: MAX_LEVEL }, (_, k) => `<i class="${k < o.level ? 'on' : ''}"></i>`).join('');
      slots.push(`<div class="arms-slot" title="${def.name}"><span>${def.icon}</span><b>${def.name}</b><em>${pips}</em></div>`);
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

    this.movePlayer(time, dt);
    this.arsenal.update(dt, this.state === 'fight');
    if (this.state === 'fight') {
      this.elapsed += dt;
      this.spawn(dt);
      this.updateFoes(time, dt);
      if (this.elapsed >= RAID_MS) this.clear();
      else if (this.pendingLevels > 0) this.levelUp();
    }
    this.updateHud();
  }

  private movePlayer(time: number, dt: number): void {
    const dir = readMove(this.keys);
    const p = this.player;
    const moving = dir.x !== 0 || dir.y !== 0;
    if (moving && this.state === 'fight') {
      const step = (PLAYER_SPEED * this.b.speed * dt) / 1000;
      if (!this.blocked(p.x + dir.x * step, p.y)) p.x += dir.x * step;
      if (!this.blocked(p.x, p.y + dir.y * step)) p.y += dir.y * step;
      if (dir.x !== 0 && !this.casting) this.facing = Math.sign(dir.x);
    }
    if (!this.casting && time >= this.invulnUntil) p.play(moving && this.state === 'fight' ? 'p-walk' : 'p-idle', true);
    p.setFlipX(this.facing < 0);
    p.setAlpha(time < this.invulnUntil && Math.floor(time / 70) % 2 === 0 ? 0.4 : 1);
    p.setDepth(p.y);
    this.shadow.setPosition(p.x, p.y).setDepth(p.y - 0.5);
  }

  // ── 요괴 ─────────────────────────────────────────────

  private spawn(dt: number): void {
    const t = this.elapsed / RAID_MS;
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
        this.invulnUntil = time + 800;
        f.vx -= (dx / d) * 220;
        f.vy -= (dy / d) * 220;
        if (settings.god) continue;
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
    const knock = (crit ? 260 : 170) * (f.kind === 'kasa' ? 0.7 : 1);
    f.vx += nx * knock;
    f.vy += ny * knock;
    this.fx.dust(f.sprite.x, f.sprite.y, nx, ny, crit ? 7 : 4, f.kind === 'kasa' ? 'w' : 'P');
    f.hp -= dmg;
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
    const list: ChoiceDef[] = Phaser.Utils.Array.Shuffle(this.arsenal.offers(this.b.unlocked)).slice(0, 3);
    const basics = Phaser.Utils.Array.Shuffle(basicChoices(this.b));
    while (list.length < 3) list.push(basics.shift()!);
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
      this.freeze(false);
      this.updateHud();
    });
  }

  // ── 끝: 버팀 / 쓰러짐 ─────────────────────────────────

  /** 45초를 버텼다 → 남은 요괴는 흩어지고, 구슬 + 강화 1개 */
  private clear(): void {
    this.state = 'cleared';
    for (const f of [...this.foes]) this.kill(f, false);
    this.pendingLevels = 0;
    const orbs = 8 + Math.floor(this.kills / 4);
    this.b.orbs += orbs;
    this.updateHud();
    const banner = this.ui.el('div', 'raid-banner', `<b>버텼다!</b><span>요괴들이 흩어진다 · 쓰러뜨린 요괴 <em>${this.kills}</em></span>`);
    this.time.delayedCall(1500, () => {
      banner.remove();
      this.reward(orbs);
    });
  }

  private reward(orbs: number): void {
    this.ui.root.classList.add('dimmed');
    const panel = this.ui.el('div', 'panel fade-in raid-reward');
    this.ui.el('h2', '', '습격 돌파', panel);
    this.ui.el('p', '', `🔮 언령 구슬 <b>+${orbs}</b> <small>(가진 구슬 ${this.b.orbs} · 찻집에서 쓴다)</small><br>강화를 하나 고르세요`, panel);
    const row = this.ui.el('div', 'lvl-upgrades', '', panel);
    this.offers().forEach((u, i) => {
      const card = this.ui.el('button', 'ucard clickable', '', row);
      card.innerHTML = `<span class="uicon">${u.icon}</span><b>${u.name}</b><span>${u.desc}</span><small>${i + 1}</small>`;
      card.dataset.key = String(i + 1);
      card.addEventListener('click', () => pick(u));
    });
    const pick = (u: ChoiceDef) => {
      window.removeEventListener('keydown', onKey);
      u.apply();
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
    this.state = 'dead';
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
