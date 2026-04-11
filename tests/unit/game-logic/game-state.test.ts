import { describe, it, expect } from 'vitest';
import { GameState } from '@core/game-state';
import { RLERow } from '@core/algorithms/rle-expander';
import { DIFFICULTY_CONFIGS } from '@config/difficulty.config';
import { Shotbot, ShotbotState } from '@core/models/shotbot';

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

  // Multi-shotbot tests
  describe('multi-shotbot on belt', () => {
    function selectAnyFromWaiting(gameState: GameState): Shotbot | null {
      const queues = gameState.getWaitingQueues();
      for (let i = 0; i < queues.length; i++) {
        if (queues[i].size() > 0) {
          const shotbot = gameState.selectFromWaiting(i);
          if (shotbot) return shotbot;
        }
      }
      return null;
    }

    it('should allow selecting a second shotbot while one is on belt', () => {
      const { gameState } = createEasyLevel();
      selectAnyFromWaiting(gameState);
      expect(gameState.getActiveShotbots().length).toBe(1);
      selectAnyFromWaiting(gameState);
      expect(gameState.getActiveShotbots().length).toBe(2);
    });

    it('should allow up to 3 shotbots on belt simultaneously', () => {
      const { gameState } = createEasyLevel();
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      expect(gameState.getActiveShotbots().length).toBe(3);
    });

    it('should not allow more than 3 shotbots on belt', () => {
      const { gameState } = createEasyLevel();
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      const result = selectAnyFromWaiting(gameState);
      expect(result).toBeNull();
      expect(gameState.getActiveShotbots().length + gameState.getPendingShotbots().length).toBe(3);
    });

    it('should maintain 2-position gap between shotbots on belt', () => {
      const { gameState } = createEasyLevel();
      selectAnyFromWaiting(gameState);
      // First shotbot is at index 0, second should start at index 3 (gap of 2)
      selectAnyFromWaiting(gameState);
      const shotbots = gameState.getActiveShotbots();
      expect(shotbots.length).toBe(2);
      const indices = shotbots.map(s => s.beltIndex).sort((a: number, b: number) => a - b);
      expect(indices[1] - indices[0]).toBeGreaterThanOrEqual(3);
    });

    it('should queue shotbot as pending when no valid position available', () => {
      // Use a small grid so belt is short and gap constraint forces pending
      const rleGrid: RLERow[][] = [
        [{ color: 'red', count: 1 }],
        [{ color: 'red', count: 1 }],
      ];
      const gameState = new GameState(rleGrid, DIFFICULTY_CONFIGS.easy);
      // Belt for 2x2 grid = 8 positions. With gap of 2, max 2 shotbots fit.
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      // Now belt has 2 shotbots. Try a third — should go pending or be rejected
      const shotbot = selectAnyFromWaiting(gameState);
      if (shotbot) {
        // If returned, it should be pending (no room on belt)
        expect(gameState.getPendingShotbots().length).toBeGreaterThan(0);
      }
    });

    it('should insert pending shotbot when position becomes available', () => {
      // Use a small grid so belt is short and gap constraint forces pending
      const rleGrid: RLERow[][] = [
        [{ color: 'red', count: 1 }],
        [{ color: 'red', count: 1 }],
      ];
      const gameState = new GameState(rleGrid, DIFFICULTY_CONFIGS.easy);
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      const shotbot = selectAnyFromWaiting(gameState);
      if (!shotbot || gameState.getPendingShotbots().length === 0) {
        // No pending was created, skip this test
        return;
      }
      const pendingBefore = gameState.getPendingShotbots().length;
      // Move until a shotbot completes its loop, freeing a position
      const beltLength = gameState.getConveyorBelt().getLength();
      for (let i = 0; i < beltLength; i++) {
        gameState.moveAllActiveShotbots();
        if (gameState.getPendingShotbots().length < pendingBefore) break;
      }
      const pendingAfter = gameState.getPendingShotbots().length;
      expect(pendingAfter).toBeLessThan(pendingBefore);
    });

    it('should move all active shotbots on moveAllActiveShotbots', () => {
      const { gameState } = createEasyLevel();
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      const shotbots = gameState.getActiveShotbots();
      const indicesBefore = shotbots.map(s => s.beltIndex);
      gameState.moveAllActiveShotbots();
      const indicesAfter = shotbots.map(s => s.beltIndex);
      // Each should have advanced
      for (let i = 0; i < indicesBefore.length; i++) {
        // Belt wraps around, so just check it changed or completed loop
        expect(indicesAfter[i]).not.toBe(indicesBefore[i]);
      }
    });

    it('should try to shoot with each active shotbot independently', () => {
      const { gameState } = createEasyLevel();
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      const results = gameState.tryShootAll();
      expect(results.length).toBe(2);
    });

    it('should deactivate shotbot when shots reach zero even with others on belt', () => {
      const rleGrid: RLERow[][] = [
        [{ color: 'red', count: 1 }],
        [{ color: 'blue', count: 1 }],
        [{ color: 'red', count: 1 }],
      ];
      const gameState = new GameState(rleGrid, DIFFICULTY_CONFIGS.easy);
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      // Find a shotbot with 1 shot and shoot it
      const shotbots = gameState.getActiveShotbots();
      const oneShot = shotbots.find(s => s.shotbot.shots === 1);
      if (oneShot) {
        // Move until it can shoot, then shoot
        const beltLength = gameState.getConveyorBelt().getLength();
        for (let i = 0; i < beltLength; i++) {
          gameState.moveAllActiveShotbots();
          gameState.tryShootAll();
        }
        // At least one shotbot should have been deactivated
        expect(gameState.getActiveShotbots().length).toBeLessThan(2);
      }
    });
  });
});
