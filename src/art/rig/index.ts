import Phaser from 'phaser';
import type { BossId } from '../../data/chapters';
import { settings } from '../../systems/settings';
import { BossRig } from './BossRig';
import { PackRig } from './packRig';
import { TenguRig } from './tenguRig';
import { OniRig } from './oniRig';
import { KappaRig } from './kappaRig';
import { YamabikoRig } from './yamabikoRig';

export { BossRig, PackRig };

/** 코드 리그 (부위를 따로 그려 축마다 움직인다) */
export function makeCodeRig(id: BossId, scene: Phaser.Scene, x: number, y: number): BossRig {
  switch (id) {
    case 'tengu':
      return new TenguRig(scene, x, y);
    case 'oni':
      return new OniRig(scene, x, y);
    case 'kappa':
      return new KappaRig(scene, x, y);
    default:
      return new YamabikoRig(scene, x, y);
  }
}

/**
 * 장 보스 — 설정(보스 그림)에 따라: 팩 보스(Ninja Adventure 시트를 우리 색으로) · 코드 리그 · 예전 도트(null → 장면이 80px 스프라이트를 쓴다)
 */
export function makeBossRig(id: BossId, scene: Phaser.Scene, x: number, y: number, style = settings.boss): BossRig | null {
  if (style === 'classic') return null;
  if (style === 'rig') return makeCodeRig(id, scene, x, y);
  return new PackRig(scene, x, y, id);
}
