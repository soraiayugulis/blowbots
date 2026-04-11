import { RLERow } from './algorithms/rle-expander';
import { RLEExpander } from './algorithms/rle-expander';
import { ShotbotDistributor } from './algorithms/shotbot-distributor';
import { LineOfSight } from './algorithms/line-of-sight';
import { PixelGrid } from './pixel-grid';
import { ConveyorBelt } from './conveyor-belt';
import { BoundedQueue } from './data-structures/bounded-queue';
import { Queue } from './data-structures/queue';
import { Shotbot, ShotbotState } from './models/shotbot';
import { Position } from './models/position';
import { DifficultyConfig } from '../config/difficulty.config';

export class GameState {
  private pixelGrid: PixelGrid;
  private conveyorBelt: ConveyorBelt;
  private waitingQueues: Queue<Shotbot>[];
  private usedQueue: BoundedQueue<Shotbot>;
  private activeShotbot: Shotbot | null = null;
  private activeShotbotBeltIndex: number | null = null;
  private lastShotTarget: Position | null = null;
  private score: number = 0;

  constructor(rleGrid: RLERow[][], config: DifficultyConfig) {
    this.pixelGrid = new PixelGrid(rleGrid);
    this.conveyorBelt = new ConveyorBelt(this.pixelGrid.getWidth(), this.pixelGrid.getHeight());
    this.usedQueue = new BoundedQueue<Shotbot>(config.usedQueueCapacity);

    const colorCounts = RLEExpander.countByColor(rleGrid);
    const shotbots = ShotbotDistributor.createShotbots(colorCounts, config.shotUnit);
    this.waitingQueues = ShotbotDistributor.distributeToQueues(shotbots, config.numWaitingQueues);
  }

  getPixelGrid(): PixelGrid {
    return this.pixelGrid;
  }

  getConveyorBelt(): ConveyorBelt {
    return this.conveyorBelt;
  }

  getWaitingQueues(): Queue<Shotbot>[] {
    return this.waitingQueues;
  }

  getUsedQueue(): BoundedQueue<Shotbot> {
    return this.usedQueue;
  }

  getActiveShotbot(): Shotbot | null {
    return this.activeShotbot;
  }

  getActiveShotbotBeltIndex(): number | null {
    return this.activeShotbotBeltIndex;
  }

  getScore(): number {
    return this.score;
  }

  getLastShotTarget(): Position | null {
    return this.lastShotTarget;
  }

  selectFromWaiting(queueIndex: number): Shotbot | null {
    if (queueIndex < 0 || queueIndex >= this.waitingQueues.length) {
      return null;
    }

    if (this.usedQueue.isFull()) {
      return null;
    }

    const shotbot = this.waitingQueues[queueIndex].dequeue();
    if (shotbot === null) {
      return null;
    }

    shotbot.state = ShotbotState.Moving;
    this.activeShotbot = shotbot;
    this.activeShotbotBeltIndex = 0;
    return shotbot;
  }

  selectFromUsed(): Shotbot | null {
    return this.selectFromUsedAt(0);
  }

  selectFromUsedAt(index: number): Shotbot | null {
    const shotbot = this.usedQueue.removeAt(index);
    if (shotbot === null) {
      return null;
    }

    shotbot.state = ShotbotState.Moving;
    this.activeShotbot = shotbot;
    this.activeShotbotBeltIndex = 0;
    return shotbot;
  }

  moveActiveShotbot(): void {
    if (this.activeShotbot === null || this.activeShotbotBeltIndex === null) {
      return;
    }

    const nextIndex = this.conveyorBelt.getNextIndex(this.activeShotbotBeltIndex);

    if (nextIndex === 0 && this.activeShotbotBeltIndex !== 0) {
      this.completeBeltLoop();
      return;
    }

    this.activeShotbotBeltIndex = nextIndex;
  }

  tryShoot(): boolean {
    if (this.activeShotbot === null || this.activeShotbotBeltIndex === null) {
      return false;
    }

    const beltPos = this.conveyorBelt.getPosition(this.activeShotbotBeltIndex);
    if (beltPos === null) {
      return false;
    }

    const targetPos = LineOfSight.findNearestEdgeBlock(beltPos, this.pixelGrid.getGrid());
    if (targetPos === null) {
      return false;
    }

    const targetColor = this.pixelGrid.getBlock(targetPos.x, targetPos.y);
    if (targetColor !== this.activeShotbot.color) {
      return false;
    }

    if (this.activeShotbot.shots <= 0) {
      return false;
    }

    this.pixelGrid.removeBlock(targetPos.x, targetPos.y);
    this.activeShotbot.shots--;
    this.lastShotTarget = targetPos;
    this.score++;

    if (this.activeShotbot.shots === 0) {
      this.deactivateShotbot();
    }

    return true;
  }

  isWon(): boolean {
    return this.pixelGrid.isCleared();
  }

  private deactivateShotbot(): void {
    if (this.activeShotbot === null) {
      return;
    }

    if (this.activeShotbot.shots > 0) {
      this.activeShotbot.state = ShotbotState.Used;
      this.usedQueue.enqueue(this.activeShotbot);
    }

    this.activeShotbot = null;
    this.activeShotbotBeltIndex = null;
  }

  private completeBeltLoop(): void {
    this.deactivateShotbot();
  }
}
