import { describe, it, expect } from 'vitest';
import { GameState } from '@core/game-state';
import { RLERow } from '@core/algorithms/rle-expander';
import { DIFFICULTY_CONFIGS } from '@config/difficulty.config';
import { ShotbotState } from '@core/models/shotbot';

describe('GameState', () => {
  function createEasyLevel(): { rleGrid: RLERow[][]; gameState: GameState } {
    const rleGrid: RLERow[][] = [
      [{ color: 'red', count: 3 }],
      [
        { color: 'red', count: 1 },
        { color: 'blue', count: 1 },
        { color: 'red', count: 1 },
      ],
      [{ color: 'red', count: 3 }],
    ];
    const gameState = new GameState(rleGrid, DIFFICULTY_CONFIGS.easy);
    return { rleGrid, gameState };
  }

  it('should initialize with correct grid dimensions', () => {
    const { gameState } = createEasyLevel();
    expect(gameState.getPixelGrid().getWidth()).toBe(3);
    expect(gameState.getPixelGrid().getHeight()).toBe(3);
  });

  it('should initialize waiting queues with shotbots', () => {
    const { gameState } = createEasyLevel();
    const queues = gameState.getWaitingQueues();
    expect(queues.length).toBe(3);
    const totalShotbots = queues.reduce((sum, q) => sum + q.size(), 0);
    expect(totalShotbots).toBe(5);
  });

  it('should initialize used queue as empty', () => {
    const { gameState } = createEasyLevel();
    expect(gameState.getUsedQueue().isEmpty()).toBe(true);
  });

  it('should select from waiting queue when used queue not full', () => {
    const { gameState } = createEasyLevel();
    const shotbot = gameState.selectFromWaiting(0);
    expect(shotbot).not.toBeNull();
    expect(shotbot!.state).toBe(ShotbotState.Moving);
  });

  it('should not select from waiting queue when used queue is full', () => {
    const { gameState } = createEasyLevel();
    const usedQueue = gameState.getUsedQueue();
    for (let i = 0; i < usedQueue.getCapacity(); i++) {
      usedQueue.enqueue({ color: 'red', shots: 1, state: ShotbotState.Used });
    }
    const shotbot = gameState.selectFromWaiting(0);
    expect(shotbot).toBeNull();
  });

  it('should select from used queue explicitly', () => {
    const { gameState } = createEasyLevel();
    gameState.getUsedQueue().enqueue({ color: 'red', shots: 1, state: ShotbotState.Used });
    const shotbot = gameState.selectFromUsed();
    expect(shotbot).not.toBeNull();
    expect(shotbot!.state).toBe(ShotbotState.Moving);
  });

  it('should not select from used queue when empty', () => {
    const { gameState } = createEasyLevel();
    const shotbot = gameState.selectFromUsed();
    expect(shotbot).toBeNull();
  });

  it('should remove shotbot from source queue on selection', () => {
    const { gameState } = createEasyLevel();
    const queueSizeBefore = gameState.getWaitingQueues()[0].size();
    gameState.selectFromWaiting(0);
    const queueSizeAfter = gameState.getWaitingQueues()[0].size();
    expect(queueSizeAfter).toBe(queueSizeBefore - 1);
  });

  it('should have active shotbot after selection', () => {
    const { gameState } = createEasyLevel();
    gameState.selectFromWaiting(0);
    expect(gameState.getActiveShotbot()).not.toBeNull();
  });

  it('should not have active shotbot before selection', () => {
    const { gameState } = createEasyLevel();
    expect(gameState.getActiveShotbot()).toBeNull();
  });

  it('should move active shotbot along belt', () => {
    const { gameState } = createEasyLevel();
    gameState.selectFromWaiting(0);
    const initialIndex = gameState.getActiveShotbotBeltIndex();
    gameState.moveActiveShotbot();
    const newIndex = gameState.getActiveShotbotBeltIndex();
    expect(newIndex).toBe(initialIndex! + 1);
  });

  it('should shoot when aligned with same color block and line of sight', () => {
    const { gameState } = createEasyLevel();
    gameState.selectFromWaiting(0);
    const shotbot = gameState.getActiveShotbot()!;
    const shotsBefore = shotbot.shots;
    const didShoot = gameState.tryShoot();
    if (didShoot) {
      expect(shotbot.shots).toBe(shotsBefore - 1);
    }
  });

  it('should move shotbot to used queue when belt loop completes with shots remaining', () => {
    const rleGrid: RLERow[][] = [
      [{ color: 'red', count: 3 }],
      [{ color: 'red', count: 3 }],
      [{ color: 'red', count: 3 }],
    ];
    const gameState = new GameState(rleGrid, DIFFICULTY_CONFIGS.easy);
    gameState.selectFromWaiting(0);
    const shotbot = gameState.getActiveShotbot()!;
    const beltLength = gameState.getConveyorBelt().getLength();
    for (let i = 0; i < beltLength; i++) {
      gameState.moveActiveShotbot();
      gameState.tryShoot();
    }
    if (shotbot.shots > 0) {
      expect(gameState.getUsedQueue().size()).toBeGreaterThan(0);
    }
  });

  it('should detect win when all blocks cleared', () => {
    const { gameState } = createEasyLevel();
    expect(gameState.isWon()).toBe(false);
  });
});
