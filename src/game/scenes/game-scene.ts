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
};

const MAX_BLOCK_SIZE = 50;
const BELT_PADDING = 20; // extra pixels between grid edge and belt
const SHOTBOT_RADIUS = 20;
const TOP_BAR_H = 50;
const BOTTOM_PANEL_H = 100;
const SIDE_PANEL_W = 110; // used queue panel width
const BELT_STEP_MS = 600;
const QUEUE_BOT_SIZE = 28;
const QUEUE_BOT_SPACING = 34;
const USED_BOT_SIZE = 24;
const USED_BOT_SPACING = 30;

function makeTrianglePoints(radius: number, direction: 'up' | 'down' | 'left' | 'right' = 'up'): number[] {
  // Isosceles triangle centered at centroid (0,0), tip = face
  // No rotation needed — points are pre-oriented
  const h = radius * 1.6;
  const halfBase = radius * 0.7;
  const tipDist = h * 2 / 3;
  const baseDist = h / 3;

  let tipX = 0, tipY = 0, blX = 0, blY = 0, brX = 0, brY = 0;

  switch (direction) {
    case 'up':    // tip points up (face up)
      tipY = -tipDist; blX = -halfBase; blY = baseDist; brX = halfBase; brY = baseDist; break;
    case 'down':  // tip points down (face down)
      tipY = tipDist; blX = -halfBase; blY = -baseDist; brX = halfBase; brY = -baseDist; break;
    case 'left':  // tip points left (face left)
      tipX = -tipDist; blX = baseDist; blY = -halfBase; brX = baseDist; brY = halfBase; break;
    case 'right': // tip points right (face right)
      tipX = tipDist; blX = -baseDist; blY = -halfBase; brX = -baseDist; brY = halfBase; break;
  }

  return [tipX, tipY, blX, blY, brX, brY];
}

function faceDirection(beltX: number, beltY: number, gridW: number, gridH: number): 'up' | 'down' | 'left' | 'right' {
  if (beltY < 0) return 'down';       // top edge -> face down into grid
  if (beltY >= gridH) return 'up';    // bottom edge -> face up into grid
  if (beltX >= gridW) return 'left';  // right edge -> face left into grid
  if (beltX < 0) return 'right';     // left edge -> face right into grid
  return 'up';
}

export class GameScene extends Phaser.Scene {
  private gameState!: GameState;
  private currentLevel!: LevelConfig;
  private currentConfig!: DifficultyConfig;
  private blockContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private beltTimer: Phaser.Time.TimerEvent | null = null;
  private scoreText!: Phaser.GameObjects.Text;
  private shotsText!: Phaser.GameObjects.Text;
  private activeShotbotContainers: Map<Shotbot, Phaser.GameObjects.Container> = new Map();
  private shotbotScreenPositions: Map<Shotbot, { x: number; y: number }> = new Map();
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
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const grid = this.gameState.getPixelGrid();

    // Calculate dynamic block size so grid + belt fits between bars
    // Belt extends BELT_PADDING beyond grid on all sides
    const usableW = width - SIDE_PANEL_W - BELT_PADDING * 2;
    const usableH = height - TOP_BAR_H - BOTTOM_PANEL_H - BELT_PADDING * 2;
    const blockSize = Math.min(
      MAX_BLOCK_SIZE,
      Math.floor(usableW / grid.getWidth()),
      Math.floor(usableH / grid.getHeight())
    );
    this.blockSize = blockSize;

    const totalGridW = grid.getWidth() * blockSize;
    const totalGridH = grid.getHeight() * blockSize;
    // Center grid+belt in the space between top bar and bottom panel
    const spaceBetweenBars = height - TOP_BAR_H - BOTTOM_PANEL_H;
    this.gridOffsetX = SIDE_PANEL_W / 2 + (width - SIDE_PANEL_W / 2 - totalGridW) / 2;
    this.gridOffsetY = TOP_BAR_H + (spaceBetweenBars - totalGridH) / 2;

    // Header bar
    this.add.rectangle(width / 2, 25, width, 50, 0x0f0f23, 0.9).setDepth(20);
    this.scoreText = this.add.text(width - 30, 25, 'Score: 0', {
      fontSize: '18px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(1, 0.5).setDepth(21);
    this.shotsText = this.add.text(width / 2, 25, '', {
      fontSize: '16px', color: '#f5a623', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(21);
    const backText = this.add.text(30, 25, '< Back', {
      fontSize: '16px', color: '#666666', fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setDepth(21).setInteractive({ useHandCursor: true });
    backText.on('pointerdown', () => {
      this.stopBeltTimer();
      this.scene.start('WelcomeScene');
    });

    this.drawBeltStartMarker();
    this.renderGrid();

    // Bottom panel for waiting queues
    const panelY = height - 90;
    const panelH = 100;
    this.add.rectangle(width / 2, panelY + panelH / 2 - 10, width, panelH, 0x0f0f23, 0.9)
      .setDepth(15);
    this.add.rectangle(width / 2, panelY - 10, width, 2, 0x3a3a5c, 0.6)
      .setDepth(15);
    this.add.text(width / 2, panelY - 2, 'SELECT A SHOTBOT', {
      fontSize: '10px', color: '#555555', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(16);

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

    // Determine offset direction based on which edge the belt position is on
    let offsetX = 0;
    let offsetY = 0;

    if (bx < 0) offsetX = -BELT_PADDING;           // left edge
    else if (bx >= gridW) offsetX = BELT_PADDING;   // right edge

    if (by < 0) offsetY = -BELT_PADDING;            // top edge
    else if (by >= gridH) offsetY = BELT_PADDING;   // bottom edge

    // Corners: offset both directions
    // (handled naturally since corner positions have both x and y out of bounds)

    return {
      x: this.gridOffsetX + bx * this.blockSize + this.blockSize / 2 + offsetX,
      y: this.gridOffsetY + by * this.blockSize + this.blockSize / 2 + offsetY,
    };
  }

  private drawBeltStartMarker(): void {
    const belt = this.gameState.getConveyorBelt();
    const positions = belt.getPositions();

    // Draw belt track
    const g = this.add.graphics();
    g.setDepth(1);

    // Draw thick line segments between consecutive belt positions
    g.lineStyle(14, 0x3a3a5c, 0.5);
    for (let i = 0; i < positions.length; i++) {
      const curr = this.beltToScreen(positions[i].x, positions[i].y);
      const next = this.beltToScreen(positions[(i + 1) % positions.length].x, positions[(i + 1) % positions.length].y);
      g.lineBetween(curr.x, curr.y, next.x, next.y);
    }

    // Rounded joints at each belt position
    g.fillStyle(0x3a3a5c, 0.5);
    for (const pos of positions) {
      const screen = this.beltToScreen(pos.x, pos.y);
      g.fillCircle(screen.x, screen.y, 7);
    }

    // Green start dot
    const startScreen = this.beltToScreen(positions[0].x, positions[0].y);
    g.fillStyle(0x16c79a, 0.9);
    g.fillCircle(startScreen.x, startScreen.y, 10);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(startScreen.x, startScreen.y, 4);

    // "START" label
    this.add.text(startScreen.x, startScreen.y + 18, 'START', {
      fontSize: '9px', color: '#16c79a', fontFamily: 'monospace',
    }).setOrigin(0.5);
  }

  private renderGrid(): void {
    const grid = this.gameState.getPixelGrid();
    for (let y = 0; y < grid.getHeight(); y++) {
      for (let x = 0; x < grid.getWidth(); x++) {
        const color = grid.getBlock(x, y);
        if (color !== null) {
          const screen = this.gridToScreen(x, y);
          const container = this.add.container(screen.x, screen.y);
          const rect = this.add.rectangle(0, 0, this.blockSize - 4, this.blockSize - 4, COLOR_MAP[color] ?? 0xffffff);
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
    const panelY = height - 90;
    const spacing = width / (queues.length + 1);
    this.queueContainers = [];

    // Overall waiting area outline — groups all queues
    const outerPad = 12;
    const outerX = spacing * 1 - spacing / 2 - outerPad;
    const outerW = spacing * queues.length + spacing + outerPad * 2;
    const outerH = QUEUE_BOT_SIZE + 30 + outerPad * 2;
    const outerY = panelY + 45 - outerH / 2;
    const outerRect = this.add.rectangle(outerX + outerW / 2, outerY + outerH / 2, outerW, outerH, 0x0a0a1e, 0.6);
    outerRect.setStrokeStyle(2, 0x3a3a5c, 0.7);
    outerRect.setDepth(14);

    queues.forEach((_queue, index) => {
      const queueX = spacing * (index + 1);

      // Per-queue outline — encompasses triangle + number
      const queueW = spacing * 0.7;
      const queueH = QUEUE_BOT_SIZE * 2 + 12;
      const queueOutline = this.add.rectangle(queueX, panelY + 45, queueW, queueH, 0x0f0f23, 0.5);
      queueOutline.setStrokeStyle(1, 0x2a2a4c, 0.6);
      queueOutline.setDepth(15);

      const container = this.add.container(queueX, panelY + 45);
      container.setDepth(16);
      this.queueContainers.push(container);
      this.redrawQueue(index);
    });
  }

  private renderUsedQueue(): void {
    const { height } = this.cameras.main;
    const usedX = 55;
    const usedCenterY = height / 2;

    // Side panel
    this.add.rectangle(usedX, usedCenterY, 90, height * 0.45, 0x0f0f23, 0.9)
      .setDepth(15);
    this.add.rectangle(usedX + 45, usedCenterY - height * 0.22, 2, height * 0.45, 0x3a3a5c, 0.4)
      .setDepth(15);

    this.usedQueueLabel = this.add.text(usedX, usedCenterY - height * 0.19, 'USED', {
      fontSize: '10px', color: '#777777', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(16);

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
      const botX = (i - (tempItems.length - 1) / 2) * QUEUE_BOT_SPACING;
      const isFirst = i === 0;
      this.addQueueBot(container, botX, 0, shotbot, isFirst);
    }

    if (tempItems.length > 0) {
      const hitW = tempItems.length * QUEUE_BOT_SPACING + 10;
      container.setInteractive(
        new Phaser.Geom.Rectangle(-hitW / 2, -QUEUE_BOT_SIZE / 2 - 5, hitW, QUEUE_BOT_SIZE + 10),
        Phaser.Geom.Rectangle.Contains
      );
      container.off('pointerdown');
      container.on('pointerdown', () => this.selectFromWaiting(queueIndex));
      container.off('pointerover');
      container.off('pointerout');
      container.on('pointerover', () => {
        this.tweens.add({ targets: container, scaleY: 1.06, scaleX: 1.06, duration: 80 });
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

    // Re-enable interactive for the container
    this.usedQueueContainer.disableInteractive();
  }

  private addQueueBot(
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    shotbot: Shotbot, isFirst: boolean
  ): void {
    const color = COLOR_MAP[shotbot.color] ?? 0xffffff;
    const inner = this.add.container(x, y);

    if (isFirst) {
      // Active/selectable - full color pentagon, white border, face up
      const poly = this.add.polygon(0, 0, makeTrianglePoints(QUEUE_BOT_SIZE / 2), color);
      poly.setStrokeStyle(3, 0xffffff, 1);
      const label = this.add.text(0, 0, `${shotbot.shots}`, {
        fontSize: '13px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5);
      inner.add([poly, label]);
    } else {
      // Locked/grayed out pentagon
      const poly = this.add.polygon(0, 0, makeTrianglePoints(QUEUE_BOT_SIZE / 2), color, 0.35);
      poly.setStrokeStyle(1, 0x444444, 0.6);
      const label = this.add.text(0, 0, `${shotbot.shots}`, {
        fontSize: '13px', color: '#888888', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5);
      const lock = this.add.text(0, -QUEUE_BOT_SIZE / 2 - 4, '\u{1F512}', {
        fontSize: '8px', color: '#666666',
      }).setOrigin(0.5);
      inner.add([poly, label, lock]);
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
    const inner = this.add.container(x, y);

    const poly = this.add.polygon(0, 0, makeTrianglePoints(USED_BOT_SIZE / 2), color);
    poly.setStrokeStyle(2, 0xffffff, 0.9);
    const label = this.add.text(0, 0, `${shotbot.shots}`, {
      fontSize: '11px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);
    inner.add([poly, label]);

    inner.setSize(USED_BOT_SIZE, USED_BOT_SIZE);
    inner.setInteractive(
      new Phaser.Geom.Circle(0, 0, USED_BOT_SIZE / 2),
      Phaser.Geom.Circle.Contains
    );
    inner.on('pointerdown', () => this.selectFromUsedAt(index));
    inner.on('pointerover', () => {
      this.tweens.add({ targets: inner, scaleX: 1.15, scaleY: 1.15, duration: 80 });
    });
    inner.on('pointerout', () => {
      this.tweens.add({ targets: inner, scaleX: 1, scaleY: 1, duration: 80 });
    });

    container.add(inner);
  }

  private selectFromWaiting(queueIndex: number): void {
    const shotbot = this.gameState.selectFromWaiting(queueIndex);
    if (shotbot) {
      this.spawnActiveShotbot(shotbot);
      this.startBeltMovement();
      this.redrawAllQueues();
    }
  }

  private selectFromUsedAt(index: number): void {
    const shotbot = this.gameState.selectFromUsedAt(index);
    if (shotbot) {
      this.spawnActiveShotbot(shotbot);
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

    // Remove old container if exists
    const oldContainer = this.activeShotbotContainers.get(shotbot);
    if (oldContainer) oldContainer.destroy();

    const color = COLOR_MAP[shotbot.color] ?? 0xffffff;
    const container = this.add.container(screen.x, screen.y);
    container.setDepth(10);
    this.activeShotbotContainers.set(shotbot, container);
    this.shotbotScreenPositions.set(shotbot, { x: screen.x, y: screen.y });

    // Face direction: pre-oriented triangle, no rotation
    const grid = this.gameState.getPixelGrid();
    const dir = faceDirection(beltPos.x, beltPos.y, grid.getWidth(), grid.getHeight());

    // Glow behind
    const glow = this.add.circle(0, 0, SHOTBOT_RADIUS + 8, color, 0.25);
    // Triangle body pre-oriented toward grid
    const body = this.add.polygon(0, 0, makeTrianglePoints(SHOTBOT_RADIUS, dir), color);
    body.setStrokeStyle(3, 0xffffff, 0.9);
    // Shots label always centered inside, no rotation needed
    const shotsLabel = this.add.text(0, 0, `${shotbot.shots}`, {
      fontSize: '12px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5);

    container.add([glow, body, shotsLabel]);

    this.tweens.add({
      targets: container,
      scaleX: { from: 0.3, to: 1.2 }, scaleY: { from: 0.3, to: 1.2 },
      duration: 200, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: container,
          scaleX: 1, scaleY: 1, duration: 100,
        });
      },
    });

    this.tweens.add({
      targets: glow,
      alpha: 0.1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.updateShotsDisplay();
  }

  private startBeltMovement(): void {
    this.stopBeltTimer();
    this.beltTimer = this.time.addEvent({
      delay: BELT_STEP_MS,
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
    // Guard: stop processing if game is already over
    if (this.gameState.isLost() || this.gameState.isWon()) {
      this.stopBeltTimer();
      return;
    }

    // Track all shotbots before any state changes
    const shotbotsBeforeShoot = new Set(this.activeShotbotContainers.keys());

    const shootResults = this.gameState.tryShootAllWithTargets();

    // Show shoot effects for each shotbot that fired (using result directly,
    // since the entry may have been removed from activeShotbots if shots depleted)
    for (const result of shootResults) {
      if (result.didShoot && result.target) {
        this.showShootEffectForShotbot(result.shotbot, result.target);
      }
    }

    // Remove containers for shot-depleted shotbots (removed by tryShootAllWithTargets)
    for (const shotbot of shotbotsBeforeShoot) {
      if (!this.gameState.getActiveShotbots().some(e => e.shotbot === shotbot)) {
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
    }

    // Track shotbots before move (to detect loop-completed ones)
    const shotbotsBeforeMove = new Set(this.activeShotbotContainers.keys());

    this.gameState.moveAllActiveShotbots();

    // Remove containers for loop-completed shotbots
    for (const shotbot of shotbotsBeforeMove) {
      if (!this.gameState.getActiveShotbots().some(e => e.shotbot === shotbot)) {
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
    }

    // Spawn containers for newly placed pending shotbots
    for (const entry of this.gameState.getActiveShotbots()) {
      if (!this.activeShotbotContainers.has(entry.shotbot)) {
        this.spawnActiveShotbot(entry.shotbot);
      }
    }

    // Animate remaining shotbots to new positions
    this.animateAllShotbotsToCurrentPositions();

    this.updateScoreDisplay();
    this.updateShotsDisplay();
    this.redrawAllQueues();

    if (this.gameState.isLost()) {
      this.stopBeltTimer();
      this.shotsText.setText('');
      this.time.delayedCall(500, () => this.showLostScreen());
    } else if (this.gameState.getActiveShotbots().length === 0 && this.gameState.getPendingShotbots().length === 0) {
      this.stopBeltTimer();
      this.shotsText.setText('');

      if (this.gameState.isWon()) {
        this.time.delayedCall(500, () => this.showWinScreen());
      }
    }
  }

  private animateAllShotbotsToCurrentPositions(): void {
    const grid = this.gameState.getPixelGrid();

    for (const entry of this.gameState.getActiveShotbots()) {
      const container = this.activeShotbotContainers.get(entry.shotbot);
      if (!container) continue;

      const beltPos = this.gameState.getConveyorBelt().getPosition(entry.beltIndex);
      if (!beltPos) continue;
      const screen = this.beltToScreen(beltPos.x, beltPos.y);

      this.shotbotScreenPositions.set(entry.shotbot, { x: screen.x, y: screen.y });

      this.tweens.add({
        targets: container,
        x: screen.x, y: screen.y,
        duration: BELT_STEP_MS * 0.85,
        ease: 'Linear',
      });

      // Update triangle direction based on current belt edge
      const dir = faceDirection(beltPos.x, beltPos.y, grid.getWidth(), grid.getHeight());
      const body = container.getAt(1) as Phaser.GameObjects.Polygon;
      if (body) {
        body.setTo(makeTrianglePoints(SHOTBOT_RADIUS, dir));
      }

      // Update shots label text
      const shotsLabel = container.getAt(2) as Phaser.GameObjects.Text;
      if (shotsLabel) shotsLabel.setText(`${entry.shotbot.shots}`);
    }
  }

  private showShootEffectForShotbot(shotbot: Shotbot, target: Position): void {
    // Find the belt index from the container's current position or screen position
    const screenPos = this.shotbotScreenPositions.get(shotbot) ?? { x: 0, y: 0 };
    const grid = this.gameState.getPixelGrid();

    // Determine face direction from screen position relative to grid
    const gridCenterX = this.gridOffsetX + grid.getWidth() * this.blockSize / 2;
    const gridCenterY = this.gridOffsetY + grid.getHeight() * this.blockSize / 2;
    const dx = screenPos.x - gridCenterX;
    const dy = screenPos.y - gridCenterY;
    let dir: 'up' | 'down' | 'left' | 'right';
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? 'left' : 'right';
    } else {
      dir = dy > 0 ? 'up' : 'down';
    }
    const tipDist = SHOTBOT_RADIUS * 1.6 * 2 / 3;
    let tipOffsetX = 0, tipOffsetY = 0;
    switch (dir) {
      case 'up':    tipOffsetY = -tipDist; break;
      case 'down':  tipOffsetY = tipDist; break;
      case 'left':  tipOffsetX = -tipDist; break;
      case 'right': tipOffsetX = tipDist; break;
    }
    const from = {
      x: screenPos.x + tipOffsetX,
      y: screenPos.y + tipOffsetY,
    };
    const to = this.gridToScreen(target.x, target.y);
    const color = COLOR_MAP[shotbot.color] ?? 0xffffff;

    // Create a separate graphics object for each shot line
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

    // White dot in the center of the hit block — brief flash to represent impact
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
    const particleCount = 10;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const distance = 25 + Math.random() * 35;
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance;
      const size = 3 + Math.random() * 5;
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

    const flash = this.add.circle(x, y, this.blockSize / 2, 0xffffff, 0.5);
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

    // Dark overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);
    overlay.setDepth(20);

    // Congrats text
    const congrats = this.add.text(width / 2, height * 0.25, 'CONGRATULATIONS!', {
      fontSize: '40px', color: '#16c79a', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);
    this.tweens.add({
      targets: congrats,
      scaleX: 1.08, scaleY: 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Level name
    this.add.text(width / 2, height * 0.35, this.currentLevel.name, {
      fontSize: '22px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(21);

    // Score
    this.add.text(width / 2, height * 0.45, `Score: ${score}`, {
      fontSize: '32px', color: '#f5a623', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);

    // Replay button
    const replayBtn = this.add.text(width / 2, height * 0.6, 'REPLAY', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      backgroundColor: '#16c79a',
      padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

    replayBtn.on('pointerover', () => {
      this.tweens.add({ targets: replayBtn, scaleX: 1.05, scaleY: 1.05, duration: 80 });
    });
    replayBtn.on('pointerout', () => {
      this.tweens.add({ targets: replayBtn, scaleX: 1, scaleY: 1, duration: 80 });
    });
    replayBtn.on('pointerdown', () => {
      this.scene.start('GameScene', { level: this.currentLevel, config: this.currentConfig });
    });

    // Menu button
    const menuBtn = this.add.text(width / 2, height * 0.72, 'MENU', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      backgroundColor: '#4a4a7a',
      padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => {
      this.tweens.add({ targets: menuBtn, scaleX: 1.05, scaleY: 1.05, duration: 80 });
    });
    menuBtn.on('pointerout', () => {
      this.tweens.add({ targets: menuBtn, scaleX: 1, scaleY: 1, duration: 80 });
    });
    menuBtn.on('pointerdown', () => {
      this.scene.start('WelcomeScene');
    });

    // Celebration particles
    for (let i = 0; i < 20; i++) {
      const px = Math.random() * width;
      const py = -20;
      const colors = [0x16c79a, 0xf5a623, 0xe94560, 0x4a90d9];
      const c = colors[Math.floor(Math.random() * colors.length)];
      const particle = this.add.circle(px, py, 3 + Math.random() * 4, c);
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
          particle.y = -20;
        },
      });
    }
  }

  private showLostScreen(): void {
    const { width, height } = this.cameras.main;
    const score = this.gameState.getScore();

    // Dark overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);
    overlay.setDepth(20);

    // Game Over text
    const gameOver = this.add.text(width / 2, height * 0.25, 'GAME OVER', {
      fontSize: '40px', color: '#e94560', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);
    this.tweens.add({
      targets: gameOver,
      scaleX: 1.08, scaleY: 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Level name
    this.add.text(width / 2, height * 0.35, this.currentLevel.name, {
      fontSize: '22px', color: '#aaaaaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(21);

    // Score
    this.add.text(width / 2, height * 0.45, `Score: ${score}`, {
      fontSize: '32px', color: '#f5a623', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);

    // Replay button
    const replayBtn = this.add.text(width / 2, height * 0.6, 'REPLAY', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      backgroundColor: '#e94560',
      padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

    replayBtn.on('pointerover', () => {
      this.tweens.add({ targets: replayBtn, scaleX: 1.05, scaleY: 1.05, duration: 80 });
    });
    replayBtn.on('pointerout', () => {
      this.tweens.add({ targets: replayBtn, scaleX: 1, scaleY: 1, duration: 80 });
    });
    replayBtn.on('pointerdown', () => {
      this.scene.start('GameScene', { level: this.currentLevel, config: this.currentConfig });
    });

    // Menu button
    const menuBtn = this.add.text(width / 2, height * 0.72, 'MENU', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      backgroundColor: '#4a4a7a',
      padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerover', () => {
      this.tweens.add({ targets: menuBtn, scaleX: 1.05, scaleY: 1.05, duration: 80 });
    });
    menuBtn.on('pointerout', () => {
      this.tweens.add({ targets: menuBtn, scaleX: 1, scaleY: 1, duration: 80 });
    });
    menuBtn.on('pointerdown', () => {
      this.scene.start('WelcomeScene');
    });
  }
}
