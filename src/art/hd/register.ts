import Phaser from 'phaser';
import { sheet } from './grid';
import { playerFrames, PLAYER_FRAMES } from './player';
import { yamabikoHd, echoBullet, boulder } from './bossHd';
import { hitodamaFrames, kasaFrames, makiwara, ofudaShot, foxfire, stoneLantern, rock, pine, dust } from './world';

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
  addSheet(scene, HD.player, sheet(playerFrames()), 32, 32);
  addSheet(scene, HD.hitodama, sheet(hitodamaFrames()), 24, 24);
  addSheet(scene, HD.kasa, sheet(kasaFrames()), 28, 32);
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
  mk('p-idle', PLAYER_FRAMES.idle, 2.5);
  mk('p-walk', PLAYER_FRAMES.walk, 9);
  mk('p-cast', PLAYER_FRAMES.cast, 14, 0);
  mk('p-hurt', PLAYER_FRAMES.hurt, 1, 0);
  if (!a.exists('hitodama-float')) {
    a.create({ key: 'hitodama-float', frames: a.generateFrameNumbers(HD.hitodama, { frames: [0, 1] }), frameRate: 4, repeat: -1 });
  }
  if (!a.exists('kasa-hop')) {
    a.create({ key: 'kasa-hop', frames: a.generateFrameNumbers(HD.kasa, { frames: [0, 1] }), frameRate: 3, repeat: -1 });
  }
}
