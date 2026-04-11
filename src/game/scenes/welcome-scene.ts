import Phaser from 'phaser';
import { getLevels } from '@config/levels';
import { DIFFICULTY_CONFIGS } from '@config/difficulty.config';

export class WelcomeScene extends Phaser.Scene {
  private currentIndex: number = 0;
  private levelText!: Phaser.GameObjects.Text;
  private difficultyText!: Phaser.GameObjects.Text;
  private leftArrow!: Phaser.GameObjects.Text;
  private rightArrow!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'WelcomeScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.add.text(width / 2, height * 0.15, 'BLOWBOTS', {
      fontSize: '48px',
      color: '#e94560',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    this.levelText = this.add.text(width / 2, height * 0.4, '', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    this.difficultyText = this.add.text(width / 2, height * 0.5, '', {
      fontSize: '24px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    this.leftArrow = this.add.text(width * 0.2, height * 0.45, '<', {
      fontSize: '48px',
      color: '#0f3460',
      fontFamily: 'Arial',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.rightArrow = this.add.text(width * 0.8, height * 0.45, '>', {
      fontSize: '48px',
      color: '#0f3460',
      fontFamily: 'Arial',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.startButton = this.add.text(width / 2, height * 0.7, 'START', {
      fontSize: '36px',
      color: '#16c79a',
      fontFamily: 'Arial',
      backgroundColor: '#0f3460',
      padding: { x: 30, y: 15 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.leftArrow.on('pointerdown', () => this.navigateLeft());
    this.rightArrow.on('pointerdown', () => this.navigateRight());
    this.startButton.on('pointerdown', () => this.startGame());

    this.updateDisplay();
  }

  private navigateLeft(): void {
    const levels = getLevels();
    this.currentIndex = (this.currentIndex - 1 + levels.length) % levels.length;
    this.updateDisplay();
  }

  private navigateRight(): void {
    const levels = getLevels();
    this.currentIndex = (this.currentIndex + 1) % levels.length;
    this.updateDisplay();
  }

  private updateDisplay(): void {
    const levels = getLevels();
    const level = levels[this.currentIndex];
    this.levelText.setText(level.name);
    this.difficultyText.setText(level.difficulty.toUpperCase());

    const colorMap: Record<string, number> = {
      easy: 0x16c79a,
      normal: 0xf5a623,
      hard: 0xe94560,
    };
    this.difficultyText.setColor(
      '#' + (colorMap[level.difficulty] ?? 0xffffff).toString(16).padStart(6, '0')
    );
  }

  private startGame(): void {
    const levels = getLevels();
    const level = levels[this.currentIndex];
    const config = DIFFICULTY_CONFIGS[level.difficulty];
    this.scene.start('GameScene', { level, config });
  }
}
