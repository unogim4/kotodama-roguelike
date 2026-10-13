import Phaser from 'phaser';
import { ARSENAL, ArmsId, Owned, MAX_SLOTS, MAX_LEVEL } from '../data/arsenal';
import { HD } from '../art/hd/register';
import type { ChoiceDef } from '../data/choices';
import { baseMods, Mods } from '../data/blessings';

/** 무기가 때릴 수 있는 대상 */
export interface ArmsTarget {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  radius: number;
  /** 몸통 중심이 발보다 얼마나 위인지 */
  bodyY: number;
  /** 무기별로 같은 대상을 다시 때릴 수 있는 시각 (여우불) */
  lastHitBy?: Partial<Record<ArmsId, number>>;
}

/** 맞힘 처리는 장면이 정한다 (피해 · 숫자 · 넉백 · 처치) */
export type ArmsHit = (t: ArmsTarget, damage: number, dirX: number, dirY: number, crit: boolean, weapon: ArmsId) => void;

interface Shot {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  pierce: number;
  hit: Set<ArmsTarget>;
}

const CRIT_CHANCE = 0.15;
const CRIT_MULT = 2.2;

/**
 * 여러 무기를 동시에 운용 (부적 · 여우불 · 방울).
 * 부적을 던질 때는 onCast로 장면에 알려 언령사의 시전 모션을 재생한다.
 */
export class Arsenal {
  private acc: Partial<Record<ArmsId, number>> = {};
  private shots: Shot[] = [];
  private orbs: Phaser.GameObjects.Image[] = [];
  private orbAngle = 0;
  /** 여우불 폭풍: 퍼졌다 돌아오는 주기 (ms) */
  private stormT = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.GameObjects.Sprite,
    private readonly targets: () => ArmsTarget[],
    private readonly onHit: ArmsHit,
    private readonly onCast: (dirX: number) => void,
    /** 장착 무기 — 한 판의 빌드를 그대로 넘기면 강화가 이어진다 */
    readonly owned: Owned[] = [{ id: 'ofuda', level: 1 }],
    /** 가호 수치 (부적 피해 · 강타 · 여우불) */
    private readonly mods: () => Mods = baseMods,
  ) {}

  private evo(id: ArmsId): boolean {
    return this.owned.some((o) => o.id === id && o.evo);
  }

  level(id: ArmsId): number {
    return this.owned.find((o) => o.id === id)?.level ?? 0;
  }

  private stats(id: ArmsId) {
    return ARSENAL[id].levels[this.level(id) - 1];
  }

  private roll(base: number): [number, boolean] {
    const crit = Math.random() < CRIT_CHANCE + this.mods().crit;
    return [base * (crit ? CRIT_MULT : 1) * Phaser.Math.FloatBetween(0.9, 1.1), crit];
  }

  /** 레벨업 선택지: 가진 무기 강화 + (빈 칸이 있으면) 해금된 새 무기 */
  offers(unlocked: ArmsId[], blessings: string[] = []): ChoiceDef[] {
    return armsOffers(this.owned, unlocked, blessings);
  }

  levelUp(id: ArmsId): void {
    levelUpArms(this.owned, id);
  }

  update(dt: number, active: boolean): void {
    for (const o of this.owned) {
      if (o.id === 'kitsunebi') continue;
      const s = this.stats(o.id);
      this.acc[o.id] = (this.acc[o.id] ?? 0) + dt;
      if (!active || (this.acc[o.id] ?? 0) < s.cooldownMs) continue;
      if (o.id === 'ofuda') {
        if (this.throwOfuda()) this.acc.ofuda = 0;
      } else if (o.id === 'tsurugi') {
        if (this.slash()) this.acc.tsurugi = 0;
      } else {
        this.acc.suzu = 0;
        for (let i = 0; i < s.count; i++) this.scene.time.delayedCall(i * 220, () => this.ring());
      }
    }
    this.updateShots(dt);
    this.updateOrbs(dt, active);
  }

  // ── 부적 ─────────────────────────────────────────────

  private throwOfuda(): boolean {
    const s = this.stats('ofuda');
    const p = this.player;
    const list = this.targets()
      .map((t) => ({ t, d: Phaser.Math.Distance.Between(p.x, p.y - 16, t.sprite.x, t.sprite.y - t.bodyY) }))
      .filter((x) => x.d < s.range)
      .sort((a, b) => a.d - b.d);
    if (list.length === 0) return false;
    const first = list[0].t;
    const dirX = first.sprite.x >= p.x ? 1 : -1;
    this.onCast(dirX);
    // 시전 모션의 '뻗기' 프레임에 맞춰 손에서 날아간다
    this.scene.time.delayedCall(70, () => {
      const sun = this.evo('ofuda');
      for (let i = 0; i < s.count + (sun ? 1 : 0); i++) {
        const t = list[i % list.length].t;
        const hx = p.x + dirX * 13;
        const hy = p.y - 15;
        const spread = i >= list.length ? (i - list.length + 1) * 0.18 * (i % 2 ? 1 : -1) : 0;
        const a = Phaser.Math.Angle.Between(hx, hy, t.sprite.x, t.sprite.y - t.bodyY) + spread;
        const img = this.scene.add.image(hx, hy, HD.ofuda).setRotation(a + Math.PI / 2).setDepth(4500);
        // 일륜 부적: 금빛으로 빛나며 끝없이 관통
        if (sun) img.setTint(0xffe39a).setScale(1.35);
        this.shots.push({ img, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, life: 950, pierce: sun ? 99 : s.pierce, hit: new Set() });
      }
    });
    return true;
  }

  private updateShots(dt: number): void {
    const s = this.level('ofuda') ? this.stats('ofuda') : null;
    for (const shot of this.shots) {
      shot.img.x += (shot.vx * dt) / 1000;
      shot.img.y += (shot.vy * dt) / 1000;
      shot.life -= dt;
      if (shot.life <= 0 || !s) continue;
      for (const t of this.targets()) {
        if (shot.hit.has(t)) continue;
        if (Phaser.Math.Distance.Between(shot.img.x, shot.img.y, t.sprite.x, t.sprite.y - t.bodyY) < t.radius + 5) {
          shot.hit.add(t);
          const d = Math.hypot(shot.vx, shot.vy) || 1;
          const [dmg, crit] = this.roll(s.damage * this.mods().ofudaDmg);
          this.onHit(t, dmg, shot.vx / d, shot.vy / d, crit, 'ofuda');
          if (this.evo('ofuda')) this.sunBurst(t.sprite.x, t.sprite.y - t.bodyY, dmg * 0.5, t);
          if (shot.pierce-- <= 0) {
            shot.life = 0;
            break;
          }
        }
      }
    }
    this.shots = this.shots.filter((x) => {
      if (x.life > 0) return true;
      x.img.destroy();
      return false;
    });
  }

  /** 일륜 부적: 맞은 자리의 작은 빛 폭발 (주변 요괴에게 절반 피해) */
  private sunBurst(x: number, y: number, dmg: number, except: ArmsTarget): void {
    const ring = this.scene.add.circle(x, y, 6, 0xffe39a, 0.55).setDepth(4400);
    this.scene.tweens.add({ targets: ring, radius: 30, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    for (const t of [...this.targets()]) {
      if (t === except) continue;
      const dx = t.sprite.x - x;
      const dy = t.sprite.y - t.bodyY - y;
      const d = Math.hypot(dx, dy);
      if (d < 30 + t.radius) this.onHit(t, Math.round(dmg), dx / (d || 1), dy / (d || 1), false, 'ofuda');
    }
  }

  // ── 신검 ─────────────────────────────────────────────

  /** 가장 가까운 요괴 쪽으로 반원 베기 (Lv4부터 반대쪽도) — 벨 대상이 없으면 false */
  private slash(): boolean {
    const s = this.stats('tsurugi');
    const p = this.player;
    const cx = p.x;
    const cy = p.y - 14;
    const near = this.targets()
      .map((t) => ({ t, d: Phaser.Math.Distance.Between(cx, cy, t.sprite.x, t.sprite.y - t.bodyY) }))
      .filter((x) => x.d < s.range + x.t.radius)
      .sort((a, b) => a.d - b.d)[0];
    if (!near) return false;
    const base = Phaser.Math.Angle.Between(cx, cy, near.t.sprite.x, near.t.sprite.y - near.t.bodyY);
    this.onCast(near.t.sprite.x >= p.x ? 1 : -1);
    for (let k = 0; k < s.count; k++) {
      const a = base + k * Math.PI;
      this.scene.time.delayedCall(60 + k * 140, () => {
        // 은빛 반원 궤적
        const g = this.scene.add.graphics().setDepth(4600);
        const st = { t: 0 };
        this.scene.tweens.add({
          targets: st,
          t: 1,
          duration: 160,
          onUpdate: () => {
            g.clear();
            g.lineStyle(5, 0xfffaf0, 0.9 * (1 - st.t * 0.5));
            g.beginPath();
            g.arc(cx, cy, s.range * (0.7 + st.t * 0.3), a - Math.PI / 2, a - Math.PI / 2 + Math.PI * Math.min(1, st.t * 1.6), false);
            g.strokePath();
            g.lineStyle(2, 0x8fd8ff, 0.8 * (1 - st.t));
            g.beginPath();
            g.arc(cx, cy, s.range * 0.55, a - Math.PI / 2, a - Math.PI / 2 + Math.PI * Math.min(1, st.t * 1.6), false);
            g.strokePath();
          },
          onComplete: () => g.destroy(),
        });
        for (const t of [...this.targets()]) {
          const dx = t.sprite.x - cx;
          const dy = t.sprite.y - t.bodyY - cy;
          const d = Math.hypot(dx, dy);
          if (d > s.range + t.radius) continue;
          // 베는 방향 쪽 반원 안에 있는지
          const diff = Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - a);
          if (Math.abs(diff) > Math.PI / 2 + 0.2) continue;
          const [dmg, crit] = this.roll(s.damage);
          this.onHit(t, dmg, dx / (d || 1), dy / (d || 1), crit, 'tsurugi');
        }
      });
    }
    return true;
  }

  // ── 방울 ─────────────────────────────────────────────

  private ring(): void {
    const s = this.stats('suzu');
    const p = this.player;
    const cx = p.x;
    const cy = p.y - 12;
    for (const t of [...this.targets()]) {
      const dx = t.sprite.x - cx;
      const dy = t.sprite.y - t.bodyY - cy;
      const d = Math.hypot(dx, dy);
      if (d <= s.range + t.radius) {
        const [dmg, crit] = this.roll(s.damage);
        this.onHit(t, dmg, dx / (d || 1), dy / (d || 1), crit, 'suzu');
      }
    }
    const g = this.scene.add.graphics().setDepth(4400);
    const st = { r: 6, a: 1 };
    this.scene.tweens.add({
      targets: st,
      r: s.range,
      a: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        g.clear();
        g.lineStyle(4, 0xf0b84a, st.a * 0.35).strokeEllipse(cx, cy, st.r * 2 + 3, st.r * 1.5 + 3);
        g.lineStyle(2, 0xfffaf0, st.a).strokeEllipse(cx, cy, st.r * 2, st.r * 1.5);
      },
      onComplete: () => g.destroy(),
    });
  }

  // ── 여우불 ───────────────────────────────────────────

  private updateOrbs(dt: number, active: boolean): void {
    if (!this.level('kitsunebi')) return;
    const base = this.stats('kitsunebi');
    const m = this.mods();
    const storm = this.evo('kitsunebi');
    // 여우불 폭풍: 4초마다 1.2초 동안 바깥으로 퍼졌다 돌아온다
    this.stormT = (this.stormT + dt) % 4000;
    const burst = storm && this.stormT < 1200 ? Math.sin((this.stormT / 1200) * Math.PI) * 1.4 : 0;
    const s = {
      ...base,
      count: base.count + m.foxCount,
      range: base.range * m.foxRange * (1 + burst),
      damage: base.damage * (storm ? 1.3 : 1),
    };
    while (this.orbs.length < s.count) this.orbs.push(this.scene.add.image(0, 0, HD.foxfire));
    if (storm) this.orbs.forEach((o) => o.setScale(1.5));
    this.orbAngle += (dt / 1300) * Math.PI * 2 * (1 + (this.level('kitsunebi') >= 4 ? 0.25 : 0));
    const p = this.player;
    const now = this.scene.time.now;
    this.orbs.forEach((orb, k) => {
      const a = this.orbAngle + (Math.PI * 2 * k) / this.orbs.length;
      orb.setPosition(p.x + Math.cos(a) * s.range, p.y - 14 + Math.sin(a) * s.range * 0.7);
      orb.setDepth(orb.y + 14);
      if (!active) return;
      for (const t of [...this.targets()]) {
        t.lastHitBy ??= {};
        if (now - (t.lastHitBy.kitsunebi ?? 0) < s.cooldownMs) continue;
        const dx = t.sprite.x - orb.x;
        const dy = t.sprite.y - t.bodyY - orb.y;
        if (Math.hypot(dx, dy) < t.radius + 8) {
          t.lastHitBy.kitsunebi = now;
          const ox = t.sprite.x - p.x;
          const oy = t.sprite.y - p.y;
          const od = Math.hypot(ox, oy) || 1;
          const [dmg, crit] = this.roll(s.damage);
          this.onHit(t, dmg, ox / od, oy / od, crit, 'kitsunebi');
        }
      }
    });
  }
}

/** 무기 강화 · 새 무기 선택지 (전투 밖 — 찻집 등에서도 쓴다) */
export function armsOffers(owned: Owned[], unlocked: ArmsId[], blessings: string[] = []): ChoiceDef[] {
  const list: ChoiceDef[] = [];
  // 진화: Lv5 + 짝 가호 → 금빛 카드
  for (const o of owned) {
    const evo = ARSENAL[o.id].evo;
    if (!evo || o.evo || o.level < MAX_LEVEL || !blessings.includes(evo.blessing)) continue;
    list.push({ id: `evo-${o.id}`, name: `진화: ${evo.name}`, desc: evo.desc, icon: evo.icon, special: 'evo', apply: () => (o.evo = true) });
  }
  for (const o of owned) {
    if (o.level >= MAX_LEVEL) continue;
    const def = ARSENAL[o.id];
    const next = def.levels[o.level];
    list.push({ id: `arms-${o.id}`, name: `${def.name} Lv${o.level + 1}`, desc: next.note, icon: def.icon, apply: () => levelUpArms(owned, o.id) });
  }
  if (owned.length < MAX_SLOTS) {
    for (const id of unlocked) {
      if (owned.some((o) => o.id === id)) continue;
      const def = ARSENAL[id];
      list.push({ id: `arms-${id}`, name: `새 무기: ${def.name}`, desc: def.desc, icon: def.icon, apply: () => levelUpArms(owned, id) });
    }
  }
  return list;
}

/** 진화 카드는 반드시 맨 앞에, 나머지는 섞어서 n장 */
export function pickOffers(all: ChoiceDef[], n: number): ChoiceDef[] {
  const evo = all.filter((c) => c.special === 'evo');
  const rest = all.filter((c) => c.special !== 'evo').sort(() => Math.random() - 0.5);
  return [...evo, ...rest].slice(0, n);
}

export function levelUpArms(owned: Owned[], id: ArmsId): void {
  const o = owned.find((x) => x.id === id);
  if (o) o.level = Math.min(MAX_LEVEL, o.level + 1);
  else if (owned.length < MAX_SLOTS) owned.push({ id, level: 1 });
}
