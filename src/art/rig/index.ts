import Phaser from 'phaser';
import type { BossId } from '../../data/chapters';
import { BossRig } from './BossRig';
import { TenguRig } from './tenguRig';
import { OniRig } from './oniRig';
import { KappaRig } from './kappaRig';
import { YamabikoRig } from './yamabikoRig';

export { BossRig };

/** 장 보스 리그 (아직 리그가 없는 보스는 null → 예전 스프라이트) */
export function makeBossRig(id: BossId, scene: Phaser.Scene, x: number, y: number): BossRig | null {
  switch (id) {
    case 'tengu':
      return new TenguRig(scene, x, y);
    case 'oni':
      return new OniRig(scene, x, y);
    case 'kappa':
      return new KappaRig(scene, x, y);
    case 'yamabiko':
      return new YamabikoRig(scene, x, y);
    default:
      return null;
  }
}
