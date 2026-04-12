import Phaser from 'phaser';
import { WelcomeScene } from './game/scenes/welcome-scene';
import { GameScene } from './game/scenes/game-scene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: document.body,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 600,
  },
  scene: [WelcomeScene, GameScene],
};

const game = new Phaser.Game(config);

// Ensure Phaser resizes when the window resizes
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
