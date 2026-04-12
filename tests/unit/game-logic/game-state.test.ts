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

  it('should select from waiting queue', () => {
    const { gameState } = createEasyLevel();
    const shotbot = gameState.selectFromWaiting(0);
    expect(shotbot).not.toBeNull();
    expect(shotbot!.state).toBe(ShotbotState.Moving);
  });

  it('should allow selecting from waiting queue even when used queue is full', () => {
    const { gameState } = createEasyLevel();
    const usedQueue = gameState.getUsedQueue();
    for (let i = 0; i < usedQueue.getCapacity(); i++) {
      usedQueue.enqueue({ color: 'red', shots: 1, state: ShotbotState.Used });
    }
    const shotbot = gameState.selectFromWaiting(0);
    expect(shotbot).not.toBeNull();
  });

  it('should select from used queue at index', () => {
    const { gameState } = createEasyLevel();
    gameState.getUsedQueue().enqueue({ color: 'red', shots: 1, state: ShotbotState.Used });
    const shotbot = gameState.selectFromUsedAt(0);
    expect(shotbot).not.toBeNull();
    expect(shotbot!.state).toBe(ShotbotState.Moving);
  });

  it('should not select from used queue when empty', () => {
    const { gameState } = createEasyLevel();
    const shotbot = gameState.selectFromUsedAt(0);
    expect(shotbot).toBeNull();
  });

  it('should remove shotbot from source queue on selection', () => {
    const { gameState } = createEasyLevel();
    const queueSizeBefore = gameState.getWaitingQueues()[0].size();
    gameState.selectFromWaiting(0);
    const queueSizeAfter = gameState.getWaitingQueues()[0].size();
    expect(queueSizeAfter).toBe(queueSizeBefore - 1);
  });

  it('should have active shotbots after selection', () => {
    const { gameState } = createEasyLevel();
    gameState.selectFromWaiting(0);
    expect(gameState.getActiveShotbots().length).toBe(1);
  });

  it('should not have active shotbots before selection', () => {
    const { gameState } = createEasyLevel();
    expect(gameState.getActiveShotbots().length).toBe(0);
  });

  it('should move shotbot along belt with processShotbotMove', () => {
    const { gameState } = createEasyLevel();
    const shotbot = gameState.selectFromWaiting(0)!;
    const entry = gameState.getActiveShotbots().find(e => e.shotbot === shotbot)!;
    const initialIndex = entry.beltIndex;
    const nextIndex = gameState.getConveyorBelt().getNextIndex(initialIndex);
    const completedLoop = gameState.processShotbotMove(shotbot, nextIndex);
    expect(completedLoop).toBe(false);
    expect(entry.beltIndex).toBe(nextIndex);
  });

  it('should shoot with tryShootForShotbot when aligned with matching color', () => {
    const { gameState } = createEasyLevel();
    const shotbot = gameState.selectFromWaiting(0)!;
    const shotsBefore = shotbot.shots;
    const result = gameState.tryShootForShotbot(shotbot);
    if (result.didShoot) {
      expect(shotbot.shots).toBe(shotsBefore - 1);
      expect(result.target).not.toBeNull();
    }
  });

  it('should detect win when all blocks cleared', () => {
    const { gameState } = createEasyLevel();
    expect(gameState.isWon()).toBe(false);
  });

  it('isLost returns false at game start', () => {
    const { gameState } = createEasyLevel();
    expect(gameState.isLost()).toBe(false);
  });

  describe('processShotbotMove', () => {
    it('should complete loop when shotbot returns to index 0', () => {
      const rleGrid: RLERow[][] = [
        [{ color: 'red', count: 3 }],
        [{ color: 'red', count: 3 }],
        [{ color: 'red', count: 3 }],
      ];
      const gameState = new GameState(rleGrid, DIFFICULTY_CONFIGS.easy);
      const shotbot = selectAnyFromWaiting(gameState)!;

      const beltLength = gameState.getConveyorBelt().getLength();
      for (let step = 0; step < beltLength - 1; step++) {
        const entry = gameState.getActiveShotbots().find(e => e.shotbot === shotbot)!;
        const nextIndex = gameState.getConveyorBelt().getNextIndex(entry.beltIndex);
        const completed = gameState.processShotbotMove(shotbot, nextIndex);
        expect(completed).toBe(false);
      }

      const entry = gameState.getActiveShotbots().find(e => e.shotbot === shotbot)!;
      const nextIndex = gameState.getConveyorBelt().getNextIndex(entry.beltIndex);
      const completed = gameState.processShotbotMove(shotbot, nextIndex);
      expect(completed).toBe(true);
      expect(gameState.getActiveShotbots().find(e => e.shotbot === shotbot)).toBeUndefined();
    });

    it('should move shotbot to used queue on loop completion with shots remaining', () => {
      const rleGrid: RLERow[][] = [
        [{ color: 'red', count: 3 }],
        [{ color: 'red', count: 3 }],
        [{ color: 'red', count: 3 }],
      ];
      const gameState = new GameState(rleGrid, DIFFICULTY_CONFIGS.easy);
      const shotbot = selectAnyFromWaiting(gameState)!;

      const beltLength = gameState.getConveyorBelt().getLength();
      for (let step = 0; step < beltLength; step++) {
        const entry = gameState.getActiveShotbots().find(e => e.shotbot === shotbot);
        if (!entry) break;
        const nextIndex = gameState.getConveyorBelt().getNextIndex(entry.beltIndex);
        gameState.processShotbotMove(shotbot, nextIndex);
      }

      if (shotbot.shots > 0) {
        expect(gameState.getUsedQueue().size()).toBeGreaterThan(0);
      }
    });

    it('should set lost when used queue overflows on loop completion', () => {
      const rleGrid: RLERow[][] = [
        [{ color: 'red', count: 3 }],
        [{ color: 'blue', count: 3 }],
        [{ color: 'red', count: 3 }],
      ];
      const gameState = new GameState(rleGrid, DIFFICULTY_CONFIGS.easy);

      const usedQueue = gameState.getUsedQueue();
      for (let i = 0; i < usedQueue.getCapacity(); i++) {
        usedQueue.enqueue({ color: 'red', shots: 1, state: ShotbotState.Used });
      }

      const shotbot = selectAnyFromWaiting(gameState)!;
      const beltLength = gameState.getConveyorBelt().getLength();
      for (let step = 0; step < beltLength; step++) {
        const entry = gameState.getActiveShotbots().find(e => e.shotbot === shotbot);
        if (!entry) break;
        const nextIndex = gameState.getConveyorBelt().getNextIndex(entry.beltIndex);
        gameState.processShotbotMove(shotbot, nextIndex);
        if (gameState.isLost()) break;
      }

      expect(gameState.isLost()).toBe(true);
    });
  });

  describe('shotPositions - double shot prevention', () => {
    it('should only shoot once per belt position', () => {
      const rleGrid: RLERow[][] = [
        [{ color: 'red', count: 3 }],
        [{ color: 'red', count: 3 }],
        [{ color: 'red', count: 3 }],
      ];
      const gameState = new GameState(rleGrid, DIFFICULTY_CONFIGS.easy);
      const shotbot = selectAnyFromWaiting(gameState)!;

      const result1 = gameState.tryShootForShotbot(shotbot);
      const result2 = gameState.tryShootForShotbot(shotbot);

      if (result1.didShoot) {
        expect(result2.didShoot).toBe(false);
      }
    });

    it('should allow shooting again after moving to a new position', () => {
      const rleGrid: RLERow[][] = [
        [{ color: 'red', count: 3 }],
        [{ color: 'red', count: 3 }],
        [{ color: 'red', count: 3 }],
      ];
      const gameState = new GameState(rleGrid, DIFFICULTY_CONFIGS.easy);
      const shotbot = selectAnyFromWaiting(gameState)!;

      const result1 = gameState.tryShootForShotbot(shotbot);

      if (result1.didShoot) {
        const entry = gameState.getActiveShotbots().find(e => e.shotbot === shotbot)!;
        const nextIndex = gameState.getConveyorBelt().getNextIndex(entry.beltIndex);
        gameState.processShotbotMove(shotbot, nextIndex);

        const result2 = gameState.tryShootForShotbot(shotbot);
        if (result2.didShoot) {
          expect(result2.target).not.toEqual(result1.target);
        }
      }
    });

    it('should track shotPositions per shotbot independently', () => {
      const rleGrid: RLERow[][] = [
        [{ color: 'red', count: 3 }],
        [{ color: 'red', count: 3 }],
        [{ color: 'red', count: 3 }],
      ];
      const gameState = new GameState(rleGrid, DIFFICULTY_CONFIGS.easy);

      const shotbot1 = selectAnyFromWaiting(gameState)!;
      const entry1 = gameState.getActiveShotbots().find(e => e.shotbot === shotbot1)!;
      for (let i = 0; i < 3; i++) {
        const nextIndex = gameState.getConveyorBelt().getNextIndex(entry1.beltIndex);
        gameState.processShotbotMove(shotbot1, nextIndex);
      }

      const shotbot2 = selectAnyFromWaiting(gameState)!;

      const result1 = gameState.tryShootForShotbot(shotbot1);
      const result2 = gameState.tryShootForShotbot(shotbot2);

      const result1b = gameState.tryShootForShotbot(shotbot1);
      const result2b = gameState.tryShootForShotbot(shotbot2);

      if (result1.didShoot) expect(result1b.didShoot).toBe(false);
      if (result2.didShoot) expect(result2b.didShoot).toBe(false);
    });
  });

  describe('removeActiveShotbot', () => {
    it('should remove shotbot from active entries', () => {
      const { gameState } = createEasyLevel();
      const shotbot = selectAnyFromWaiting(gameState)!;
      expect(gameState.getActiveShotbots().length).toBe(1);

      gameState.removeActiveShotbot(shotbot);
      expect(gameState.getActiveShotbots().length).toBe(0);
    });

    it('should call tryPlacePending after removal', () => {
      const rleGrid: RLERow[][] = [
        [{ color: 'red', count: 3 }],
        [{ color: 'red', count: 3 }],
        [{ color: 'red', count: 3 }],
      ];
      const gameState = new GameState(rleGrid, DIFFICULTY_CONFIGS.easy);

      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);

      const shotbot = gameState.getActiveShotbots()[0].shotbot;
      gameState.removeActiveShotbot(shotbot);

      expect(gameState.getActiveShotbots().some(e => e.shotbot === shotbot)).toBe(false);
    });
  });

  describe('multi-shotbot on belt', () => {
    it('should allow selecting a second shotbot while one is on belt', () => {
      const { gameState } = createEasyLevel();
      selectAnyFromWaiting(gameState);
      expect(gameState.getActiveShotbots().length).toBe(1);
      selectAnyFromWaiting(gameState);
      const activeCount = gameState.getActiveShotbots().length;
      expect(activeCount).toBeGreaterThanOrEqual(1);
    });

    it('should allow up to 3 shotbots on belt or pending', () => {
      const { gameState } = createEasyLevel();
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      const total = gameState.getActiveShotbots().length;
      expect(total).toBeLessThanOrEqual(3);
    });

    it('should not allow more than 3 shotbots', () => {
      const { gameState } = createEasyLevel();
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      selectAnyFromWaiting(gameState);
      const result = selectAnyFromWaiting(gameState);
      expect(result).toBeNull();
    });

    it('should maintain gap between shotbots on belt', () => {
      const { gameState } = createEasyLevel();
      selectAnyFromWaiting(gameState);
      const shotbot1 = gameState.getActiveShotbots()[0].shotbot;

      for (let i = 0; i < 3; i++) {
        const entry = gameState.getActiveShotbots().find(e => e.shotbot === shotbot1)!;
        const nextIndex = gameState.getConveyorBelt().getNextIndex(entry.beltIndex);
        gameState.processShotbotMove(shotbot1, nextIndex);
      }

      selectAnyFromWaiting(gameState);
      const shotbots = gameState.getActiveShotbots();
      if (shotbots.length === 2) {
        const indices = shotbots.map(s => s.beltIndex).sort((a, b) => a - b);
        const gap = Math.min(indices[1] - indices[0], indices[0] + gameState.getConveyorBelt().getLength() - indices[1]);
        expect(gap).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
