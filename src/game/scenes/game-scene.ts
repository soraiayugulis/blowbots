import Phaser from 'phaser';
import { GameState } from '@core/game-state';
import { LevelConfig } from '@config/levels';
import { DifficultyConfig } from '@config/difficulty.config';

const COLOR_MAP: Record<string, number> = {
  red: 0xe94560,
  blue: 0x0f3460,
  green: 0x16c79a,
  yellow: 0xf5a623,
  purple: 0x9b59b6,
  orange: 0xe67e22,
};

const BLOCK_SIZE = 40;
const BELT_SPEED_MS = 500;

export class GameScene extends Phaser.Scene {
  private gameState!: GameState;
  private blockRects: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private beltTimer: Phaser.Time.TimerEvent | null = null;
  private scoreText!: Phaser.GameObjects.Text;
  private backText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { level: LevelConfig; config: DifficultyConfig }): void {
    this.gameState = new GameState(data.level.grid, data.config);
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.add.text(width / 2, 20, 'BLOWBOTS', {
      fontSize: '24px',
      color: '#e94560',
      fontFamily: 'Arial',
    }).setOrigin(0.5, 0);

    this.scoreText = this.add.text(width - 20, 20, 'Score: 0', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial',
    }).setOrigin(1, 0);

    this.backText = this.add.text(20, 20, '< Back', {
      fontSize: '20px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });

    this.backText.on('pointerdown', () => {
      this.stopBeltTimer();
      this.scene.start('WelcomeScene');
    });

    this.renderGrid();
    this.renderWaitingQueues();
    this.renderUsedQueue();
  }

  private renderGrid(): void {
    const { width, height } = this.cameras.main;
    const grid = this.gameState.getPixelGrid();
    const gridWidth = grid.getWidth();
    const gridHeight = grid.getHeight();

    const totalGridWidth = gridWidth * BLOCK_SIZE;
    const totalGridHeight = gridHeight * BLOCK_SIZE;
    const offsetX = (width - totalGridWidth) / 2;
    const offsetY = (height - totalGridHeight) / 2;

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const color = grid.getBlock(x, y);
        if (color !== null) {
          const rect = this.add.rectangle(
            offsetX + x * BLOCK_SIZE + BLOCK_SIZE / 2,
            offsetY + y * BLOCK_SIZE + BLOCK_SIZE / 2,
            BLOCK_SIZE - 2,
            BLOCK_SIZE - 2,
            COLOR_MAP[color] ?? 0xffffff
          );
          this.blockRects.set(`${x},${y}`, rect);
        }
      }
    }
  }

  private renderWaitingQueues(): void {
    const { width, height } = this.cameras.main;
    const queues = this.gameState.getWaitingQueues();
    const queueY = height - 80;

    queues.forEach((queue, index) => {
      const queueX = width * (0.2 + index * 0.3);

      this.add.text(queueX, queueY - 30, `Queue ${index + 1}`, {
        fontSize: '14px',
        color: '#aaaaaa',
        fontFamily: 'Arial',
      }).setOrigin(0.5);

      const queueContainer = this.add.container(queueX, queueY);

      for (let i = 0; i < queue.size(); i++) {
        const shotbot = queue.peek();
        if (!shotbot) break;

        const botX = (i - queue.size() / 2) * 30;
        const botRect = this.add.rectangle(botX, 0, 25, 25, COLOR_MAP[shotbot.color] ?? 0xffffff);
        const botText = this.add.text(botX, 0, `${shotbot.shots}`, {
          fontSize: '12px',
          color: '#ffffff',
          fontFamily: 'Arial',
        }).setOrigin(0.5);
        queueContainer.add([botRect, botText]);
      }

      if (queue.size() > 0) {
        queueContainer.setInteractive(
          new Phaser.Geom.Rectangle(-queue.size() * 15, -15, queue.size() * 30, 30),
          Phaser.Geom.Rectangle.Contains
        ).setInteractive({ useHandCursor: true });

        queueContainer.on('pointerdown', () => {
          this.selectFromWaiting(index);
        });
      }
    });
  }

  private renderUsedQueue(): void {
    const { width, height } = this.cameras.main;
    const usedQueue = this.gameState.getUsedQueue();
    const queueX = width - 60;
    const queueY = height / 2;

    this.add.text(queueX, queueY - 30, 'Used', {
      fontSize: '14px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    const container = this.add.container(queueX, queueY);

    for (let i = 0; i < usedQueue.size(); i++) {
      const shotbot = usedQueue.peek();
      if (!shotbot) break;

      const botY = (i - usedQueue.size() / 2) * 30;
      const botRect = this.add.rectangle(0, botY, 25, 25, COLOR_MAP[shotbot.color] ?? 0xffffff);
      const botText = this.add.text(0, botY, `${shotbot.shots}`, {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'Arial',
      }).setOrigin(0.5);
      container.add([botRect, botText]);
    }

    if (usedQueue.size() > 0) {
      container.setInteractive(
        new Phaser.Geom.Rectangle(-15, -usedQueue.size() * 15, 30, usedQueue.size() * 30),
        Phaser.Geom.Rectangle.Contains
      ).setInteractive({ useHandCursor: true });

      container.on('pointerdown', () => {
        this.selectFromUsed();
      });
    }
  }

  private selectFromWaiting(queueIndex: number): void {
    if (this.gameState.getActiveShotbot() !== null) return;

    const shotbot = this.gameState.selectFromWaiting(queueIndex);
    if (shotbot) {
      this.startBeltMovement();
      this.refreshUI();
    }
  }

  private selectFromUsed(): void {
    if (this.gameState.getActiveShotbot() !== null) return;

    const shotbot = this.gameState.selectFromUsed();
    if (shotbot) {
      this.startBeltMovement();
      this.refreshUI();
    }
  }

  private startBeltMovement(): void {
    this.stopBeltTimer();
    this.beltTimer = this.time.addEvent({
      delay: BELT_SPEED_MS,
      callback: this.onBeltStep,
      callbackScope: this,
      loop: true,
    });
  }

  private stopBeltTimer(): void {
    if (this.beltTimer) {
      this.beltTimer.destroy();
      this.beltTimer = null;
    }
  }

  private onBeltStep(): void {
    this.gameState.tryShoot();
    this.gameState.moveActiveShotbot();

    if (this.gameState.getActiveShotbot() === null) {
      this.stopBeltTimer();
      this.refreshUI();

      if (this.gameState.isWon()) {
        this.showWinScreen();
      }
    } else {
      this.refreshUI();
    }
  }

  private refreshUI(): void {
    this.scoreText.setText(`Score: ${this.gameState.getScore()}`);
    this.updateGridDisplay();
  }

  private updateGridDisplay(): void {
    const grid = this.gameState.getPixelGrid();
    const gridData = grid.getGrid();

    for (let y = 0; y < grid.getHeight(); y++) {
      for (let x = 0; x < grid.getWidth(); x++) {
        const key = `${x},${y}`;
        const rect = this.blockRects.get(key);
        const color = gridData[y][x];

        if (color === null && rect) {
          rect.setVisible(false);
        }
      }
    }
  }

  private showWinScreen(): void {
    const { width, height } = this.cameras.main;
    this.add.text(width / 2, height / 2, 'YOU WIN!', {
      fontSize: '64px',
      color: '#16c79a',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    const restartText = this.add.text(width / 2, height / 2 + 60, 'Tap to return', {
      fontSize: '24px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restartText.on('pointerdown', () => {
      this.scene.start('WelcomeScene');
    });
  }
}
