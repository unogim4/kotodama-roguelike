import Phaser from 'phaser';
import type { BossId } from '../data/chapters';
import { settings } from '../systems/settings';
import { packReady } from './pack/tiles';
import { packBossGround } from './pack/packBossArena';
import { summitGround } from './hd/summit';
import { arenaGround } from './hd/bossArt';

/** 보스 싸움터 바닥 — 배경 설정(팩 / 코드)에 따라 만들어 두고 텍스처 키를 돌려준다 */
export function ensureBossGround(scene: Phaser.Scene, id: BossId): string {
  const pack = settings.bg === 'pack' && packReady();
  const key = pack ? `arena-pack-${id}` : id === 'yamabiko' ? 'summit' : `arena-${id}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, pack ? packBossGround(id) : id === 'yamabiko' ? summitGround() : arenaGround(id));
  return key;
}
