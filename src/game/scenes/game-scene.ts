import Phaser from 'phaser';
import { GameState } from '@core/game-state';
import { LevelConfig } from '@config/levels';
import { DifficultyConfig } from '@config/difficulty.config';
import { Shotbot } from '@core/models/shotbot';
import { Position } from '@core/models/position';

const COLOR_MAP: Record<string, number> = {
  red: 0xe94560,
  blue: 0x4a90d9,
  green: 0x16c79a,
  yellow: 0xf5a623,
  purple: 0x9b59b6,
  orange: 0xe67e22,
  black: 0x222222,
  white: 0xf0f0f0,
  brown: 0x8b4513,
};

const MAX_BLOCK_SIZE = 50;
const BELT_PADDING = 35;
const SHOTBOT_RADIUS = 14;
const TOP_BAR_H = 50;
const BOTTOM_PANEL_H = 40;
const SIDE_PANEL_W = 110;
const RIGHT_PANEL_W = 160;
const BELT_STEP_MS = 600;
const BELT_SPEED_PPS = 0.15;
const QUEUE_BOT_SIZE = 18;
const QUEUE_BOT_SPACING = 28;
const USED_BOT_SIZE = 28;
const USED_BOT_SPACING = 30;

const EDGE_PADDING_RATIO = 0.03;
const SAFE_ZONE = 10;
const BELT_CLEARANCE = 90;

const BLOCK_MARGIN = 4;

const USED_PANEL_X = 55;
const USED_PANEL_WIDTH = 90;
const USED_PANEL_HEIGHT_RATIO = 0.45;

const HITBOX_PADDING = 10;
const HITBOX_Y_OFFSET = 5;

const HOVER_SCALE_FACTOR = 1.06;
const USED_HOVER_SCALE_FACTOR = 1.15;

const LOCKED_SHOTBOT_OPACITY = 0.35;

const LOCK_ICON_Y_OFFSET = 4;

const PARTICLE_ANGLE_VARIATION = 0.5;
const PARTICLE_MIN_DISTANCE = 25;
const PARTICLE_MAX_DISTANCE = 35;
const PARTICLE_MIN_SIZE = 3;
const PARTICLE_MAX_SIZE = 5;
const CELEBRATION_PARTICLE_MIN_SIZE = 3;
const CELEBRATION_PARTICLE_MAX_SIZE = 4;
const EXPLOSION_PARTICLE_COUNT = 10;

const FLASH_RADIUS_RATIO = 0.5;

const TEXT_SCALE_FACTOR = 1.08;

const CELEBRATION_PARTICLE_START_Y = -20;
const CELEBRATION_PARTICLE_COUNT = 20;

function makeDiamondPoints(radius: number): number[] {
  const topX = 0, topY = -radius;
  const rightX = radius, rightY = 0;
  const bottomX = 0, bottomY = radius;
  const leftX = -radius, leftY = 0;
  return [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY];
}

export class GameScene extends Phaser.Scene {
  private gameState!: GameState;
  private currentLevel!: LevelConfig;
  private currentConfig!: DifficultyConfig;
  private blockContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private beltTimer: Phaser.Time.TimerEvent | null = null;
  private isBeltRunning: boolean = false;
  private scoreText!: Phaser.GameObjects.Text;
  private shotsText!: Phaser.GameObjects.Text;
  private activeShotbotContainers: Map<Shotbot, Phaser.GameObjects.Container> = new Map();
  private shotbotScreenPositions: Map<Shotbot, { x: number; y: number }> = new Map();
  private activeShotbotTweens: Map<Shotbot, Phaser.Tweens.Tween> = new Map();
  private queueContainers: Phaser.GameObjects.Container[] = [];
  private usedQueueContainer!: Phaser.GameObjects.Container;
  private usedQueueLabel!: Phaser.GameObjects.Text;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private blockSize: number = MAX_BLOCK_SIZE;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { level: LevelConfig; config: DifficultyConfig }): void {
    this.currentLevel = data.level;
    this.currentConfig = data.config;
    this.gameState = new GameState(data.level.grid, data.config);
    this.blockContainers.clear();
    this.queueContainers = [];
    this.activeShotbotContainers.clear();
    this.shotbotScreenPositions.clear();
    this.beltTimer = null;
    this.isBeltRunning = false;
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const grid = this.gameState.getPixelGrid();

    const sidePanelW = SIDE_PANEL_W;
    const usableW = width - sidePanelW - RIGHT_PANEL_W - BELT_PADDING * 2;
    const usableH = height - TOP_BAR_H - BOTTOM_PANEL_H - BELT_CLEARANCE * 2 - SAFE_ZONE * 2;
    const blockSize = Math.min(
      MAX_BLOCK_SIZE,
      Math.floor(usableW / grid.getWidth()),
      Math.floor(usableH / grid.getHeight())
    );
    this.blockSize = blockSize;

    const totalGridW = grid.getWidth() * blockSize;
    const totalGridH = grid.getHeight() * blockSize;
    const spaceBetweenBars = height - TOP_BAR_H - BOTTOM_PANEL_H - SAFE_ZONE * 2;
    this.gridOffsetX = sidePanelW / 2 + (width - RIGHT_PANEL_W - sidePanelW / 2 - totalGridW) / 2 + 30;
    this.gridOffsetY = TOP_BAR_H + SAFE_ZONE + BELT_CLEARANCE + (spaceBetweenBars - BELT_CLEARANCE * 2 - totalGridH) / 2;

    const edgePadding = Math.max(width * EDGE_PADDING_RATIO, 15);

    this.add.rectangle(width / 2, TOP_BAR_H / 2, width, TOP_BAR_H, 0x0f0f23, 0.9).setDepth(20);
    this.scoreText = this.add.text(width - edgePadding, TOP_BAR_H / 2, 'Score: 0', {
      fontSize: '18px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(1, 0.5).setDepth(21);
    this.shotsText = this.add.text(width / 2, TOP_BAR_H / 2, '', {
      fontSize: '16px', color: '#f5a623', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(21);
    const backText = this.add.text(edgePadding, TOP_BAR_H / 2, '< Back', {
      fontSize: '16px', color: '#666666', fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setDepth(21).setInteractive({ useHandCursor: true });
    backText.on('pointerdown', () => {
      this.stopBeltTimer();
      this.scene.start('WelcomeScene');
    });

    this.drawBeltStartMarker();
    this.renderGrid();

    this.renderWaitingQueues();
    this.renderUsedQueue();
  }

  private gridToScreen(gx: number, gy: number): { x: number; y: number } {
    return {
      x: this.gridOffsetX + gx * this.blockSize + this.blockSize / 2,
      y: this.gridOffsetY + gy * this.blockSize + this.blockSize / 2,
    };
  }

  private beltToScreen(bx: number, by: number): { x: number; y: number } {
    const grid = this.gameState.getPixelGrid();
    const gridW = grid.getWidth();
    const gridH = grid.getHeight();

    let offsetX = 0;
    let offsetY = 0;

    if (bx < 0) offsetX = -BELT_PADDING;
    else if (bx >= gridW) offsetX = BELT_PADDING;

    if (by < 0) offsetY = -BELT_PADDING;
    else if (by >= gridH) offsetY = BELT_PADDING;

    return {
      x: this.gridOffsetX + bx * this.blockSize + this.blockSize / 2 + offsetX,
      y: this.gridOffsetY + by * this.blockSize + this.blockSize / 2 + offsetY,
    };
  }

  private drawBeltStartMarker(): void {
    const belt = this.gameState.getConveyorBelt();
    const positions = belt.getPositions();
    const grid = this.gameState.getPixelGrid();

    const g = this.add.graphics();
    g.setDepth(2);

    const topLeft = this.beltToScreen(-1, -1);
    const bottomRight = this.beltToScreen(grid.getWidth(), grid.getHeight());
    g.lineStyle(20, 0x3a3a5c, 0.5);
    g.strokeRect(
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y
    );

    const startScreen = this.beltToScreen(positions[0].x, positions[0].y);
    g.fillStyle(0x16c79a, 0.9);
    g.fillCircle(startScreen.x, startScreen.y, 10);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(startScreen.x, startScreen.y, 4);

    const startLabel = this.add.text(startScreen.x, startScreen.y + 18, 'START', {
      fontSize: '9px', color: '#16c79a', fontFamily: 'monospace',
    }).setOrigin(0.5);
    startLabel.setDepth(22);
  }

  private renderGrid(): void {
    const grid = this.gameState.getPixelGrid();
    for (let y = 0; y < grid.getHeight(); y++) {
      for (let x = 0; x < grid.getWidth(); x++) {
        const color = grid.getBlock(x, y);
        if (color !== null) {
          const screen = this.gridToScreen(x, y);
          const container = this.add.container(screen.x, screen.y);
          container.setDepth(5);
          const rect = this.add.rectangle(0, 0, this.blockSize - BLOCK_MARGIN, this.blockSize - BLOCK_MARGIN, COLOR_MAP[color] ?? 0xffffff);
          rect.setStrokeStyle(2, 0x000000, 0.15);
          container.add(rect);
          this.blockContainers.set(`${x},${y}`, container);
        }
      }
    }
  }

  private renderWaitingQueues(): void {
    const { width, height } = this.cameras.main;
    const queues = this.gameState.getWaitingQueues();
    const numQueues = queues.length;

    const panelCenterX = width - RIGHT_PANEL_W / 2;
    const panelCenterY = height / 2;
    const panelH = height * USED_PANEL_HEIGHT_RATIO;

    this.add.rectangle(panelCenterX, panelCenterY, RIGHT_PANEL_W, panelH, 0x0f0f23, 0.9).setDepth(15);
    this.add.text(panelCenterX, panelCenterY - panelH / 2 - 10, 'WAITING', {
      fontSize: '10px', color: '#777777', fontFamily: 'monospace',
    }).setOrigin(0.5, 1).setDepth(16);

    const colW = RIGHT_PANEL_W / numQueues;
    const colStartY = panelCenterY - panelH / 2 + 30;
    this.queueContainers = [];

    for (let d = 1; d < numQueues; d++) {
      const divX = width - RIGHT_PANEL_W + colW * d;
      const divTop = panelCenterY - panelH / 2;
      const divBottom = panelCenterY + panelH / 2;
      const g = this.add.graphics().setDepth(16);
      g.lineStyle(1, 0x3a3a5c, 0.8);
      g.beginPath();
      g.moveTo(divX, divTop + 8);
      g.lineTo(divX, divBottom - 8);
      g.strokePath();
    }

    queues.forEach((_queue, index) => {
      const colCenterX = width - RIGHT_PANEL_W + colW * index + colW / 2;
      const container = this.add.container(colCenterX, colStartY);
      container.setDepth(16);
      this.queueContainers.push(container);
      this.redrawQueue(index);
    });
  }

  private renderUsedQueue(): void {
    const { height } = this.cameras.main;
    const usedX = USED_PANEL_X;
    const usedCenterY = height / 2;
    const panelWidth = USED_PANEL_WIDTH;

    const usedPanelH = height * USED_PANEL_HEIGHT_RATIO;
    this.add.rectangle(usedX, usedCenterY, panelWidth, usedPanelH, 0x0f0f23, 0.9)
      .setDepth(15);

    this.usedQueueLabel = this.add.text(usedX, usedCenterY - usedPanelH / 2 - 10, 'USED', {
      fontSize: '10px', color: '#777777', fontFamily: 'monospace',
    }).setOrigin(0.5, 1).setDepth(16);

    this.usedQueueContainer = this.add.container(usedX, usedCenterY + 10);
    this.usedQueueContainer.setDepth(16);
    this.redrawUsedQueue();
  }

  private redrawQueue(queueIndex: number): void {
    const container = this.queueContainers[queueIndex];
    if (!container) return;
    container.removeAll(true);

    const queue = this.gameState.getWaitingQueues()[queueIndex];
    const tempItems: Shotbot[] = [];
    while (queue.size() > 0) {
      const item = queue.dequeue();
      if (item) tempItems.push(item);
    }
    for (const item of tempItems) queue.enqueue(item);

    for (let i = 0; i < tempItems.length; i++) {
      const shotbot = tempItems[i];
      const botY = i * QUEUE_BOT_SPACING;
      const isFirst = i === 0;
      this.addQueueBot(container, 0, botY, shotbot, isFirst);
    }

    if (tempItems.length > 0) {
      const totalH = tempItems.length * QUEUE_BOT_SPACING + HITBOX_PADDING;
      container.setInteractive(
        new Phaser.Geom.Rectangle(-QUEUE_BOT_SIZE / 2 - HITBOX_Y_OFFSET, -HITBOX_PADDING, QUEUE_BOT_SIZE + HITBOX_PADDING, totalH),
        Phaser.Geom.Rectangle.Contains
      );
      container.off('pointerdown');
      container.on('pointerdown', () => this.selectFromWaiting(queueIndex));
      container.off('pointerover');
      container.off('pointerout');
      container.on('pointerover', () => {
        this.tweens.add({ targets: container, scaleY: HOVER_SCALE_FACTOR, scaleX: HOVER_SCALE_FACTOR, duration: 80 });
      });
      container.on('pointerout', () => {
        this.tweens.add({ targets: container, scaleY: 1, scaleX: 1, duration: 80 });
      });
    } else {
      container.disableInteractive();
    }
  }

  private redrawUsedQueue(): void {
    this.usedQueueContainer.removeAll(true);
    const usedQueue = this.gameState.getUsedQueue();
    const tempItems: Shotbot[] = [];
    while (usedQueue.size() > 0) {
      const item = usedQueue.dequeue();
      if (item) tempItems.push(item);
    }
    for (const item of tempItems) usedQueue.enqueue(item);

    for (let i = 0; i < tempItems.length; i++) {
      const shotbot = tempItems[i];
      const botY = (i - (tempItems.length - 1) / 2) * USED_BOT_SPACING;
      this.addUsedBot(this.usedQueueContainer, 0, botY, shotbot, i);
    }

    if (this.usedQueueLabel) {
      this.usedQueueLabel.setText(`USED (${tempItems.length}/${usedQueue.getCapacity()})`);
    }

    this.usedQueueContainer.disableInteractive();
  }

  private addQueueBot(
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    shotbot: Shotbot, isFirst: boolean
  ): void {
    const color = COLOR_MAP[shotbot.color] ?? 0xffffff;
    const botSize = QUEUE_BOT_SIZE;
    const inner = this.add.container(x, y);

    if (isFirst) {
      const diamond = this.add.polygon(0, 0, makeDiamondPoints(botSize / 2), color);
      diamond.setStrokeStyle(2, 0xffffff, 1);
      const label = this.add.text(0, 0, `${shotbot.shots}`, {
        fontSize: '11px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);
      inner.add([diamond, label]);
    } else {
      const diamond = this.add.polygon(0, 0, makeDiamondPoints(botSize / 2), color, LOCKED_SHOTBOT_OPACITY);
      diamond.setStrokeStyle(1, 0x444444, 0.5);
      const label = this.add.text(0, 0, `${shotbot.shots}`, {
        fontSize: '10px', color: '#666666', fontFamily: 'monospace',
      }).setOrigin(0.5, 0.5);
      const lock = this.add.text(0, -botSize / 2 - LOCK_ICON_Y_OFFSET, '\u{1F512}', {
        fontSize: '8px', color: '#555555',
      }).setOrigin(0.5);
      inner.add([diamond, label, lock]);
    }

    container.add(inner);
  }

  private addUsedBot(
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    shotbot: Shotbot,
    index: number
  ): void {
    const color = COLOR_MAP[shotbot.color] ?? 0xffffff;
    const botSize = USED_BOT_SIZE;
    const inner = this.add.container(x, y);

    const diamond = this.add.polygon(0, 0, makeDiamondPoints(botSize / 2), color);
    diamond.setStrokeStyle(2, 0xffffff, 0.9);
    const label = this.add.text(0, 0, `${shotbot.shots}`, {
      fontSize: '12px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    inner.add([diamond, label]);

    inner.setSize(botSize, botSize);
    inner.setInteractive(
      new Phaser.Geom.Circle(0, 0, botSize / 2),
      Phaser.Geom.Circle.Contains
    );
    inner.on('pointerdown', () => this.selectFromUsedAt(index));
    inner.on('pointerover', () => {
      this.tweens.add({ targets: inner, scaleX: USED_HOVER_SCALE_FACTOR, scaleY: USED_HOVER_SCALE_FACTOR, duration: 80 });
    });
    inner.on('pointerout', () => {
      this.tweens.add({ targets: inner, scaleX: 1, scaleY: 1, duration: 80 });
    });

    container.add(inner);
  }

  private selectFromWaiting(queueIndex: number): void {
    const shotbot = this.gameState.selectFromWaiting(queueIndex);
    if (shotbot) {
      const isActive = this.gameState.getActiveShotbots().some(e => e.shotbot === shotbot);
      if (isActive) {
        this.spawnActiveShotbot(shotbot);
      }
      this.startBeltMovement();
      this.redrawAllQueues();
    }
  }

  private selectFromUsedAt(index: number): void {
    const shotbot = this.gameState.selectFromUsedAt(index);
    if (shotbot) {
      const isActive = this.gameState.getActiveShotbots().some(e => e.shotbot === shotbot);
      if (isActive) {
        this.spawnActiveShotbot(shotbot);
      }
      this.startBeltMovement();
      this.redrawAllQueues();
    }
  }

  private spawnActiveShotbot(shotbot: Shotbot): void {
    const entry = this.gameState.getActiveShotbots().find(e => e.shotbot === shotbot);
    if (!entry) return;
    const beltPos = this.gameState.getConveyorBelt().getPosition(entry.beltIndex);
    if (!beltPos) return;
    const screen = this.beltToScreen(beltPos.x, beltPos.y);

    const oldContainer = this.activeShotbotContainers.get(shotbot);
    if (oldContainer) oldContainer.destroy();

    const color = COLOR_MAP[shotbot.color] ?? 0xffffff;
    const container = this.add.container(screen.x, screen.y);
    container.setDepth(10);
    this.activeShotbotContainers.set(shotbot, container);
    this.shotbotScreenPositions.set(shotbot, { x: screen.x, y: screen.y });

    const body = this.add.polygon(0, 0, makeDiamondPoints(SHOTBOT_RADIUS), color);
    body.setStrokeStyle(3, 0xffffff, 0.9);

    const shotsLabel = this.add.text(0, 0, `${shotbot.shots}`, {
      fontSize: '13px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    container.add([body, shotsLabel]);

    this.updateShotsDisplay();

    this.startShotbotMovement(shotbot);
  }

  private startShotbotMovement(shotbot: Shotbot): void {
    if (this.activeShotbotTweens.has(shotbot)) {
      return;
    }

    const belt = this.gameState.getConveyorBelt();
    const entry = this.gameState.getActiveShotbots().find(e => e.shotbot === shotbot);
    if (!entry) return;

    const container = this.activeShotbotContainers.get(shotbot);
    if (!container) return;

    const currentPos = belt.getPosition(entry.beltIndex);
    if (!currentPos) return;
    const nextIndex = belt.getNextIndex(entry.beltIndex);
    const nextPos = belt.getPosition(nextIndex);
    if (!nextPos) return;

    const currentScreen = this.beltToScreen(currentPos.x, currentPos.y);
    const nextScreen = this.beltToScreen(nextPos.x, nextPos.y);

    const distance = Math.sqrt(
      Math.pow(nextScreen.x - currentScreen.x, 2) +
      Math.pow(nextScreen.y - currentScreen.y, 2)
    );

    const speed = BELT_SPEED_PPS;
    const duration = distance / speed;

    const tween = this.tweens.add({
      targets: container,
      x: nextScreen.x,
      y: nextScreen.y,
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        this.activeShotbotTweens.delete(shotbot);
        tween.remove();

        this.shotbotScreenPositions.set(shotbot, { x: nextScreen.x, y: nextScreen.y });

        const completedLoop = this.gameState.processShotbotMove(shotbot, nextIndex);

        if (completedLoop) {
          this.removeShotbotContainer(shotbot);
          this.redrawAllQueues();
          if (this.gameState.isLost()) {
            this.stopBeltTimer();
            this.shotsText.setText('');
            this.time.delayedCall(500, () => this.showLostScreen());
          }
          return;
        }

        const shootResult = this.gameState.tryShootForShotbot(shotbot);
        if (shootResult.didShoot && shootResult.target) {
          this.showShootEffectForShotbot(shotbot, shootResult.target);
          const shotsLabel = container.getAt(1) as Phaser.GameObjects.Text;
          if (shotsLabel) shotsLabel.setText(`${shotbot.shots}`);
          if (shotbot.shots === 0) {
            this.gameState.removeActiveShotbot(shotbot);
            this.updateScoreDisplay();
            this.updateShotsDisplay();
          }
        }

        if (this.gameState.isWon()) {
          this.stopBeltTimer();
          this.shotsText.setText('');
          this.time.delayedCall(500, () => this.showWinScreen());
          return;
        }
        if (this.gameState.isLost()) {
          this.stopBeltTimer();
          this.shotsText.setText('');
          this.time.delayedCall(500, () => this.showLostScreen());
          return;
        }

        if (shotbot.shots === 0) {
          this.removeShotbotContainer(shotbot);
          return;
        }

        this.startShotbotMovement(shotbot);
      },
    });
    this.activeShotbotTweens.set(shotbot, tween);
  }

  private startBeltMovement(): void {
    if (this.isBeltRunning) return;
    this.isBeltRunning = true;
    this.beltTimer = this.time.addEvent({
      delay: BELT_STEP_MS,
      callback: this.onBeltStep,
      callbackScope: this,
      loop: true,
    });
  }

  private stopBeltTimer(): void {
    this.isBeltRunning = false;
    if (this.beltTimer) {
      this.beltTimer.destroy();
      this.beltTimer = null;
    }
  }

  private removeShotbotContainer(shotbot: Shotbot): void {
    const container = this.activeShotbotContainers.get(shotbot);
    if (container) {
      this.tweens.add({
        targets: container,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 250, ease: 'Cubic.easeIn',
        onComplete: () => { container.destroy(); },
      });
      this.activeShotbotContainers.delete(shotbot);
      this.shotbotScreenPositions.delete(shotbot);
    }
  }

  private addButtonHoverEffects(button: Phaser.GameObjects.Text): void {
    button.on('pointerover', () => {
      this.tweens.add({ targets: button, scaleX: 1.05, scaleY: 1.05, duration: 80 });
    });
    button.on('pointerout', () => {
      this.tweens.add({ targets: button, scaleX: 1, scaleY: 1, duration: 80 });
    });
  }

  private addPulsingTextAnimation(text: Phaser.GameObjects.Text): void {
    this.tweens.add({
      targets: text,
      scaleX: TEXT_SCALE_FACTOR, scaleY: TEXT_SCALE_FACTOR, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  private onBeltStep(): void {
    if (this.gameState.isLost() || this.gameState.isWon()) {
      this.stopBeltTimer();
      return;
    }

    this.gameState.tryPlacePending();

    const activeShotbots = this.gameState.getActiveShotbots();

    for (const shotbot of this.activeShotbotContainers.keys()) {
      if (!activeShotbots.some(e => e.shotbot === shotbot)) {
        this.removeShotbotContainer(shotbot);
      }
    }

    for (const entry of activeShotbots) {
      if (!this.activeShotbotContainers.has(entry.shotbot)) {
        this.spawnActiveShotbot(entry.shotbot);
      }
    }

    this.updateScoreDisplay();
    this.updateShotsDisplay();
    this.redrawAllQueues();

    if (this.gameState.isWon()) {
      this.stopBeltTimer();
      this.shotsText.setText('');
      this.time.delayedCall(500, () => this.showWinScreen());
    }
  }

  private showShootEffectForShotbot(shotbot: Shotbot, target: Position): void {
    const screenPos = this.shotbotScreenPositions.get(shotbot) ?? { x: 0, y: 0 };

    const from = {
      x: screenPos.x,
      y: screenPos.y,
    };
    const to = this.gridToScreen(target.x, target.y);
    const color = COLOR_MAP[shotbot.color] ?? 0xffffff;

    const line = this.add.graphics();
    line.setDepth(5);
    line.lineStyle(4, color, 0.9);
    line.lineBetween(from.x, from.y, to.x, to.y);

    this.tweens.add({
      targets: line,
      alpha: 0, duration: 200,
      onComplete: () => { line.destroy(); },
    });

    this.showExplosion(to.x, to.y, color);

    const whiteDot = this.add.circle(to.x, to.y, 8, 0xffffff, 0.95);
    whiteDot.setDepth(8);
    this.tweens.add({
      targets: whiteDot,
      alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 150,
      ease: 'Cubic.easeOut',
      onComplete: () => { whiteDot.destroy(); },
    });

    const key = `${target.x},${target.y}`;
    const blockContainer = this.blockContainers.get(key);
    if (blockContainer) {
      this.tweens.add({
        targets: blockContainer,
        alpha: 0, scaleX: 0, scaleY: 0,
        duration: 200,
        onComplete: () => { blockContainer.destroy(); },
      });
      this.blockContainers.delete(key);
    }

    const container = this.activeShotbotContainers.get(shotbot);
    if (container) {
      this.tweens.add({
        targets: container,
        scaleX: 0.8, scaleY: 0.8, duration: 60, yoyo: true, ease: 'Quad.easeOut',
      });
    }
  }

  private showExplosion(x: number, y: number, color: number): void {
    for (let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / EXPLOSION_PARTICLE_COUNT + (Math.random() - 0.5) * PARTICLE_ANGLE_VARIATION;
      const distance = PARTICLE_MIN_DISTANCE + Math.random() * (PARTICLE_MAX_DISTANCE - PARTICLE_MIN_DISTANCE);
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance;
      const size = PARTICLE_MIN_SIZE + Math.random() * (PARTICLE_MAX_SIZE - PARTICLE_MIN_SIZE);
      const particle = this.add.circle(x, y, size, color);
      particle.setDepth(8);
      this.tweens.add({
        targets: particle,
        x: px, y: py,
        alpha: 0, scaleX: 0.1, scaleY: 0.1,
        duration: 300 + Math.random() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => { particle.destroy(); },
      });
    }

    const flash = this.add.circle(x, y, this.blockSize * FLASH_RADIUS_RATIO, 0xffffff, 0.5);
    flash.setDepth(7);
    this.tweens.add({
      targets: flash,
      alpha: 0, scaleX: 2, scaleY: 2,
      duration: 250,
      onComplete: () => { flash.destroy(); },
    });
  }

  private redrawAllQueues(): void {
    const queues = this.gameState.getWaitingQueues();
    for (let i = 0; i < queues.length; i++) {
      this.redrawQueue(i);
    }
    this.redrawUsedQueue();
  }

  private updateScoreDisplay(): void {
    this.scoreText.setText(`Score: ${this.gameState.getScore()}`);
  }

  private updateShotsDisplay(): void {
    const entries = this.gameState.getActiveShotbots();
    if (entries.length > 0) {
      const totalShots = entries.reduce((sum, e) => sum + e.shotbot.shots, 0);
      this.shotsText.setText(`\u25C9 Shots: ${totalShots} (${entries.length} bots)`);
    } else {
      this.shotsText.setText('');
    }
  }

  private showWinScreen(): void {
    const { width, height } = this.cameras.main;
    const score = this.gameState.getScore();

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);
    overlay.setDepth(20);

    const congrats = this.add.text(width / 2, height * 0.25, 'CONGRATULATIONS!', {
      fontSize: '40px', color: '#16c79a', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);
    this.addPulsingTextAnimation(congrats);

    this.add.text(width / 2, height * 0.35, this.currentLevel.name, {
      fontSize: '22px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(21);

    this.add.text(width / 2, height * 0.45, `Score: ${score}`, {
      fontSize: '32px', color: '#f5a623', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);

    const replayBtn = this.add.text(width / 2, height * 0.6, 'REPLAY', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      backgroundColor: '#16c79a',
      padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

    this.addButtonHoverEffects(replayBtn);
    replayBtn.on('pointerdown', () => {
      this.scene.start('GameScene', { level: this.currentLevel, config: this.currentConfig });
    });

    const menuBtn = this.add.text(width / 2, height * 0.72, 'MENU', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      backgroundColor: '#4a4a7a',
      padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

    this.addButtonHoverEffects(menuBtn);
    menuBtn.on('pointerdown', () => {
      this.scene.start('WelcomeScene');
    });

    for (let i = 0; i < CELEBRATION_PARTICLE_COUNT; i++) {
      const px = Math.random() * width;
      const py = CELEBRATION_PARTICLE_START_Y;
      const colors = [0x16c79a, 0xf5a623, 0xe94560, 0x4a90d9];
      const c = colors[Math.floor(Math.random() * colors.length)];
      const particle = this.add.circle(px, py, CELEBRATION_PARTICLE_MIN_SIZE + Math.random() * (CELEBRATION_PARTICLE_MAX_SIZE - CELEBRATION_PARTICLE_MIN_SIZE), c);
      particle.setDepth(22);
      this.tweens.add({
        targets: particle,
        y: height + 20,
        x: px + (Math.random() - 0.5) * 100,
        angle: Math.random() * 360,
        duration: 2000 + Math.random() * 2000,
        delay: Math.random() * 1000,
        repeat: -1,
        onRepeat: () => {
          particle.x = Math.random() * width;
          particle.y = CELEBRATION_PARTICLE_START_Y;
        },
      });
    }
  }

  private showLostScreen(): void {
    const { width, height } = this.cameras.main;
    const score = this.gameState.getScore();

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);
    overlay.setDepth(20);

    const gameOver = this.add.text(width / 2, height * 0.25, 'GAME OVER', {
      fontSize: '40px', color: '#e94560', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);
    this.addPulsingTextAnimation(gameOver);

    this.add.text(width / 2, height * 0.35, this.currentLevel.name, {
      fontSize: '22px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(21);

    this.add.text(width / 2, height * 0.45, `Score: ${score}`, {
      fontSize: '32px', color: '#f5a623', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);

    const replayBtn = this.add.text(width / 2, height * 0.6, 'REPLAY', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      backgroundColor: '#e94560',
      padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

    this.addButtonHoverEffects(replayBtn);
    replayBtn.on('pointerdown', () => {
      this.scene.start('GameScene', { level: this.currentLevel, config: this.currentConfig });
    });

    const menuBtn = this.add.text(width / 2, height * 0.72, 'MENU', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      backgroundColor: '#4a4a7a',
      padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

    this.addButtonHoverEffects(menuBtn);
    menuBtn.on('pointerdown', () => {
      this.scene.start('WelcomeScene');
    });
  }
}
