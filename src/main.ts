import Phaser from 'phaser';
import './style.css';
import { GAME_W, GAME_H, fitStage } from './stage';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { SandboxScene } from './scenes/SandboxScene';
import { BossLabScene } from './scenes/BossLabScene';
import { MapScene } from './scenes/MapScene';
import { loadProfile, profile } from './systems/profile';
import { journey } from './systems/journey';
import { LibraryScene } from './scenes/LibraryScene';
import { RaidScene } from './scenes/RaidScene';
import { KonScene } from './scenes/KonScene';
import { PrologueScene } from './scenes/PrologueScene';
import { VisitScene } from './scenes/VisitScene';
import { BossScene } from './scenes/BossScene';
import { EndingScene } from './scenes/EndingScene';
import { SettingsPanel } from './ui/SettingsPanel';
import { loadSettings } from './systems/settings';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0c0a12',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
  scene: [BootScene, TitleScene, MapScene, PrologueScene, LibraryScene, RaidScene, KonScene, VisitScene, BossScene, EndingScene, SandboxScene, BossLabScene],
});

fitStage(game);
loadSettings();
loadProfile();
new SettingsPanel(game);

// 개발 중 콘솔에서 상태를 확인할 수 있도록 노출
// 개발 중 확인용 (콘솔에서 game · journey · profile)
if (import.meta.env.DEV) Object.assign(window, { game, journey, profile });
