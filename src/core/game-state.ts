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

export interface ActiveShotbotEntry {
  shotbot: Shotbot;
  beltIndex: number;
  startIndex: number;
}

export interface ShootResult {
  shotbot: Shotbot;
  didShoot: boolean;
  target: Position | null;
}

export class GameState {
  private pixelGrid: PixelGrid;
  private conveyorBelt: ConveyorBelt;
  private waitingQueues: Queue<Shotbot>[];
  private usedQueue: BoundedQueue<Shotbot>;
  private activeEntries: ActiveShotbotEntry[] = [];
  private pendingShotbots: Shotbot[] = [];
  private lastShotTarget: Position | null = null;
  private score: number = 0;

  private static readonly MAX_ACTIVE_SHOTBOTS = 3;
  private static readonly MIN_GAP = 2; // minimum positions between shotbots

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

  // Legacy single-shotbot accessors (for backward compat)
  getActiveShotbot(): Shotbot | null {
    return this.activeEntries.length > 0 ? this.activeEntries[0].shotbot : null;
  }

  getActiveShotbotBeltIndex(): number | null {
    return this.activeEntries.length > 0 ? this.activeEntries[0].beltIndex : null;
  }

  getActiveShotbots(): ActiveShotbotEntry[] {
    return this.activeEntries;
  }

  getPendingShotbots(): Shotbot[] {
    return this.pendingShotbots;
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

  selectFromUsed(): Shotbot | null {
    return this.selectFromUsedAt(0);
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
    const startIndex = this.findNextAvailablePosition();
    if (startIndex !== null) {
      this.activeEntries.push({ shotbot, beltIndex: startIndex, startIndex });
    } else {
      this.pendingShotbots.push(shotbot);
    }
  }

  private findNextAvailablePosition(): number | null {
    const beltLength = this.conveyorBelt.getLength();
    const occupied = new Set(this.activeEntries.map(e => e.beltIndex));

    for (let pos = 0; pos < beltLength; pos++) {
      if (this.isPositionAvailable(pos, occupied)) {
        return pos;
      }
    }
    return null;
  }

  private isPositionAvailable(pos: number, occupied: Set<number>): boolean {
    const beltLength = this.conveyorBelt.getLength();
    // Check pos itself and MIN_GAP positions ahead and behind
    for (let offset = -GameState.MIN_GAP; offset <= GameState.MIN_GAP; offset++) {
      const checkPos = ((pos + offset) % beltLength + beltLength) % beltLength;
      if (occupied.has(checkPos)) {
        return false;
      }
    }
    return true;
  }

  private tryPlacePending(): void {
    const toPlace: Shotbot[] = [];
    const remaining: Shotbot[] = [];

    for (const shotbot of this.pendingShotbots) {
      const pos = this.findNextAvailablePosition();
      if (pos !== null && this.activeEntries.length < GameState.MAX_ACTIVE_SHOTBOTS) {
        this.activeEntries.push({ shotbot, beltIndex: pos, startIndex: pos });
        toPlace.push(shotbot);
      } else {
        remaining.push(shotbot);
      }
    }
    this.pendingShotbots = remaining;
  }

  moveActiveShotbot(): void {
    // Legacy: move first active shotbot only
    if (this.activeEntries.length === 0) return;
    this.moveSingleEntry(this.activeEntries[0]);
  }

  moveAllActiveShotbots(): void {
    // Move all active shotbots
    const toRemove: number[] = [];

    for (let i = 0; i < this.activeEntries.length; i++) {
      const entry = this.activeEntries[i];
      const nextIndex = this.conveyorBelt.getNextIndex(entry.beltIndex);

      if (nextIndex === 0 && entry.beltIndex !== 0) {
        // Completed loop
        toRemove.push(i);
      } else {
        entry.beltIndex = nextIndex;
      }
    }

    // Remove completed shotbots (reverse order to preserve indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.deactivateEntry(this.activeEntries[toRemove[i]]);
      this.activeEntries.splice(toRemove[i], 1);
    }

    // Try to place pending shotbots
    this.tryPlacePending();
  }

  private moveSingleEntry(entry: ActiveShotbotEntry): void {
    const nextIndex = this.conveyorBelt.getNextIndex(entry.beltIndex);

    if (nextIndex === 0 && entry.beltIndex !== 0) {
      this.deactivateEntry(entry);
      const idx = this.activeEntries.indexOf(entry);
      if (idx !== -1) this.activeEntries.splice(idx, 1);
      this.tryPlacePending();
      return;
    }

    entry.beltIndex = nextIndex;
  }

  tryShoot(): boolean {
    // Legacy: shoot with first active shotbot
    if (this.activeEntries.length === 0) return false;
    return this.tryShootEntry(this.activeEntries[0]).didShoot;
  }

  tryShootAll(): boolean[] {
    return this.tryShootAllWithTargets().map(r => r.didShoot);
  }

  tryShootAllWithTargets(): ShootResult[] {
    const results: ShootResult[] = [];
    const toRemove: number[] = [];

    for (let i = 0; i < this.activeEntries.length; i++) {
      const entry = this.activeEntries[i];
      const shootResult = this.tryShootEntry(entry);
      results.push({ shotbot: entry.shotbot, didShoot: shootResult.didShoot, target: shootResult.target });

      if (shootResult.didShoot && entry.shotbot.shots === 0) {
        toRemove.push(i);
      }
    }

    // Remove depleted shotbots (reverse order)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.deactivateEntry(this.activeEntries[toRemove[i]]);
      this.activeEntries.splice(toRemove[i], 1);
    }

    this.tryPlacePending();
    return results;
  }

  private tryShootEntry(entry: ActiveShotbotEntry): { didShoot: boolean; target: Position | null } {
    const beltPos = this.conveyorBelt.getPosition(entry.beltIndex);
    if (beltPos === null) {
      return { didShoot: false, target: null };
    }

    const targetPos = LineOfSight.findNearestEdgeBlock(beltPos, this.pixelGrid.getGrid());
    if (targetPos === null) {
      return { didShoot: false, target: null };
    }

    const targetColor = this.pixelGrid.getBlock(targetPos.x, targetPos.y);
    if (targetColor !== entry.shotbot.color) {
      return { didShoot: false, target: null };
    }

    if (entry.shotbot.shots <= 0) {
      return { didShoot: false, target: null };
    }

    this.pixelGrid.removeBlock(targetPos.x, targetPos.y);
    entry.shotbot.shots--;
    this.lastShotTarget = targetPos;
    this.score++;

    return { didShoot: true, target: targetPos };
  }

  isWon(): boolean {
    return this.pixelGrid.isCleared();
  }

  private deactivateEntry(entry: ActiveShotbotEntry): void {
    if (entry.shotbot.shots > 0) {
      entry.shotbot.state = ShotbotState.Used;
      this.usedQueue.enqueue(entry.shotbot);
    }
  }

}
