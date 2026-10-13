import Phaser from 'phaser';
import { sheet } from './grid';
import { kotohaFrames, K2 } from '../fine/kotoha';
import { hitodamaFrames2, kasaFrames2 } from '../fine/gear';
import { strip } from '../fine/fine';
import { yamabikoHd, echoBullet, boulder } from './bossHd';
import { makiwara, ofudaShot, foxfire, stoneLantern, rock, pine, dust } from './world';

/** 32px 리마스터 텍스처 키 */
export const HD = {
  player: 'hd-player',
  hitodama: 'hd-hitodama',
  kasa: 'hd-kasa',
  makiwara: 'hd-makiwara',
  ofuda: 'hd-ofuda',
  foxfire: 'hd-foxfire',
  yamabiko: 'hd-yamabiko',
  echo: 'hd-echo',
  boulder: 'hd-boulder',
  lantern: 'hd-lantern',
  rock: 'hd-rock',
  pine: 'hd-pine',
  dust: (k: string) => `hd-dust-${k}`,
} as const;

/** 가로로 이어 붙인 캔버스를 0, 1, 2… 번호 프레임으로 잘라 등록 */
function addSheet(scene: Phaser.Scene, key: string, c: HTMLCanvasElement, frameW: number, frameH: number): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.addCanvas(key, c)!;
  for (let i = 0; i * frameW < c.width; i++) tex.add(i, 0, i * frameW, 0, frameW, frameH);
}

function addImage(scene: Phaser.Scene, key: string, c: HTMLCanvasElement): void {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, c);
}

/** 텍스처 + 애니메이션 등록 (한 번만) */
export function registerHd(scene: Phaser.Scene): void {
  // 2세대 세밀 도트 (아트 시험장에서 고른 그림)
  addSheet(scene, HD.player, strip(kotohaFrames()), 32, 32);
  addSheet(scene, HD.hitodama, strip(hitodamaFrames2()), 24, 24);
  addSheet(scene, HD.kasa, strip(kasaFrames2()), 30, 32);
  addImage(scene, HD.makiwara, makiwara().toCanvas());
  addImage(scene, HD.ofuda, ofudaShot().toCanvas());
  addImage(scene, HD.foxfire, foxfire().toCanvas());
  // 야마비코: 0 = 대기, 1 = 외침, 2 = 팔 들기
  addSheet(scene, HD.yamabiko, sheet([yamabikoHd('idle'), yamabikoHd('shout'), yamabikoHd('windup')]), 80, 80);
  addImage(scene, HD.echo, echoBullet().toCanvas());
  addImage(scene, HD.boulder, boulder().toCanvas());
  addImage(scene, HD.lantern, stoneLantern().toCanvas());
  addImage(scene, HD.rock, rock().toCanvas());
  addImage(scene, HD.pine, pine().toCanvas());
  for (const k of ['w', 'W', 'v', 'P', 'L', 'G', 'C', 'R', 'y', 'd', 'N']) addImage(scene, HD.dust(k), dust(k as never));

  const a = scene.anims;
  const mk = (key: string, frames: readonly number[], frameRate: number, repeat = -1) => {
    if (!a.exists(key)) a.create({ key, frames: a.generateFrameNumbers(HD.player, { frames: [...frames] }), frameRate, repeat });
  };
  mk('p-idle', K2.idle, 5);
  mk('p-walk', K2.run, 13);
  mk('p-cast', K2.cast, 10, 0);
  mk('p-hurt', [K2.hurt], 1, 0);
  mk('p-dash', [K2.dash], 1, 0);
  if (!a.exists('hitodama-float')) {
    a.create({ key: 'hitodama-float', frames: a.generateFrameNumbers(HD.hitodama, { frames: [0, 1, 2, 3, 4, 5] }), frameRate: 10, repeat: -1 });
  }
  if (!a.exists('kasa-hop')) {
    a.create({ key: 'kasa-hop', frames: a.generateFrameNumbers(HD.kasa, { frames: [0, 1, 2, 3, 4, 5] }), frameRate: 8, repeat: -1 });
  }
}
