import { RLERow } from './algorithms/rle-expander';
import { ShotbotDistributor } from './algorithms/shotbot-distributor';
import { LineOfSight } from './algorithms/line-of-sight';
import { PixelGrid } from './pixel-grid';
import { ConveyorBelt } from './conveyor-belt';
import { BoundedQueue } from './data-structures/bounded-queue';
import { Queue } from './data-structures/queue';
import { Shotbot, ShotbotState } from './models/shotbot';
import { Position } from './models/position';
import { DifficultyConfig } from '../config/difficulty.config';

export interface ActiveShotbotEntry {
  shotbot: Shotbot;
  beltIndex: number;
  startIndex: number;
  shotPositions: Set<number>;
}

export class GameState {
  private pixelGrid: PixelGrid;
  private conveyorBelt: ConveyorBelt;
  private waitingQueues: Queue<Shotbot>[];
  private usedQueue: BoundedQueue<Shotbot>;
  private activeEntries: ActiveShotbotEntry[] = [];
  private pendingShotbots: Shotbot[] = [];
  private score: number = 0;
  private lost: boolean = false;

  private static readonly MAX_ACTIVE_SHOTBOTS = 3;
  private static readonly MIN_GAP = 2;

  constructor(rleGrid: RLERow[][], config: DifficultyConfig) {
    this.pixelGrid = new PixelGrid(rleGrid);
    this.conveyorBelt = new ConveyorBelt(this.pixelGrid.getWidth(), this.pixelGrid.getHeight());
    this.usedQueue = new BoundedQueue<Shotbot>(config.usedQueueCapacity);

    const colorCounts = this.pixelGrid.countByColor();
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

  getActiveShotbots(): ActiveShotbotEntry[] {
    return this.activeEntries;
  }

  getScore(): number {
    return this.score;
  }

  selectFromWaiting(queueIndex: number): Shotbot | null {
    if (queueIndex < 0 || queueIndex >= this.waitingQueues.length) {
      return null;
    }

    if (this.activeEntries.length + this.pendingShotbots.length >= GameState.MAX_ACTIVE_SHOTBOTS) {
      return null;
    }

    const shotbot = this.waitingQueues[queueIndex].dequeue();
    if (shotbot === null) {
      return null;
    }

    shotbot.state = ShotbotState.Moving;
    this.placeOnBelt(shotbot);
    return shotbot;
  }

  selectFromUsedAt(index: number): Shotbot | null {
    if (this.activeEntries.length + this.pendingShotbots.length >= GameState.MAX_ACTIVE_SHOTBOTS) {
      return null;
    }

    const shotbot = this.usedQueue.removeAt(index);
    if (shotbot === null) {
      return null;
    }

    shotbot.state = ShotbotState.Moving;
    this.placeOnBelt(shotbot);
    return shotbot;
  }

  private placeOnBelt(shotbot: Shotbot): void {
    const occupied = new Set(this.activeEntries.map(e => e.beltIndex));
    if (this.isPositionAvailable(0, occupied)) {
      this.activeEntries.push({ shotbot, beltIndex: 0, startIndex: 0, shotPositions: new Set() });
    } else {
      this.pendingShotbots.push(shotbot);
    }
  }

  private isPositionAvailable(pos: number, occupied: Set<number>): boolean {
    const beltLength = this.conveyorBelt.getLength();
    for (let offset = -GameState.MIN_GAP; offset <= GameState.MIN_GAP; offset++) {
      const checkPos = ((pos + offset) % beltLength + beltLength) % beltLength;
      if (occupied.has(checkPos)) {
        return false;
      }
    }
    return true;
  }

  tryPlacePending(): void {
    const remaining: Shotbot[] = [];

    for (const shotbot of this.pendingShotbots) {
      if (this.activeEntries.length >= GameState.MAX_ACTIVE_SHOTBOTS) {
        remaining.push(shotbot);
        continue;
      }
      const occupied = new Set(this.activeEntries.map(e => e.beltIndex));
      if (this.isPositionAvailable(0, occupied)) {
        this.activeEntries.push({ shotbot, beltIndex: 0, startIndex: 0, shotPositions: new Set() });
      } else {
        remaining.push(shotbot);
      }
    }
    this.pendingShotbots = remaining;
  }

  private tryShootEntry(entry: ActiveShotbotEntry): { didShoot: boolean; target: Position | null } {
    if (entry.shotPositions.has(entry.beltIndex)) {
      return { didShoot: false, target: null };
    }

    const beltPos = this.conveyorBelt.getPosition(entry.beltIndex);
    if (beltPos === null) {
      return { didShoot: false, target: null };
    }

    const targetPos = LineOfSight.findNearestEdgeBlockOfColor(beltPos, this.pixelGrid.getGrid(), entry.shotbot.color);
    if (targetPos === null) {
      return { didShoot: false, target: null };
    }

    if (entry.shotbot.shots <= 0) {
      return { didShoot: false, target: null };
    }

    this.pixelGrid.removeBlock(targetPos.x, targetPos.y);
    entry.shotbot.shots--;
    entry.shotPositions.add(entry.beltIndex);
    this.score++;

    return { didShoot: true, target: targetPos };
  }

  isWon(): boolean {
    return this.pixelGrid.isCleared();
  }

  isLost(): boolean {
    return this.lost;
  }

  private deactivateEntry(entry: ActiveShotbotEntry): boolean {
    if (entry.shotbot.shots > 0) {
      entry.shotbot.state = ShotbotState.Used;
      const enqueued = this.usedQueue.enqueue(entry.shotbot);
      if (!enqueued) {
        this.lost = true;
        return false;
      }
    }
    return true;
  }

  processShotbotMove(shotbot: Shotbot, nextBeltIndex: number): boolean {
    const entry = this.activeEntries.find(e => e.shotbot === shotbot);
    if (!entry) return false;

    const completedLoop = nextBeltIndex === 0 && entry.beltIndex !== 0;

    if (completedLoop) {
      const deactivated = this.deactivateEntry(entry);
      const idx = this.activeEntries.indexOf(entry);
      if (idx !== -1) this.activeEntries.splice(idx, 1);
      if (!deactivated) {
        return true;
      }
      this.tryPlacePending();
      return true;
    }

    entry.beltIndex = nextBeltIndex;
    return false;
  }

  tryShootForShotbot(shotbot: Shotbot): { didShoot: boolean; target: Position | null } {
    const entry = this.activeEntries.find(e => e.shotbot === shotbot);
    if (!entry) return { didShoot: false, target: null };
    return this.tryShootEntry(entry);
  }

  removeActiveShotbot(shotbot: Shotbot): void {
    const idx = this.activeEntries.findIndex(e => e.shotbot === shotbot);
    if (idx !== -1) {
      this.activeEntries.splice(idx, 1);
      this.tryPlacePending();
    }
  }

}
