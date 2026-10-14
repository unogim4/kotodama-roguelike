import Phaser from 'phaser';
import type { BossId } from '../../data/chapters';
import { BossRig } from './BossRig';
import { PackRig } from './packRig';

export { BossRig, PackRig };

/** 장 보스: Ninja Adventure(CC0) 보스 시트를 우리 색으로 고친 팩 보스 */
export function makeBossRig(id: BossId, scene: Phaser.Scene, x: number, y: number): BossRig | null {
  return new PackRig(scene, x, y, id);
}
