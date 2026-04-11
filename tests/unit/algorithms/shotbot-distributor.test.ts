import { describe, it, expect } from 'vitest';
import { ShotbotDistributor } from '@core/algorithms/shotbot-distributor';
import { Color } from '@core/models/color';
import { Shotbot, ShotbotState } from '@core/models/shotbot';
import { Queue } from '@core/data-structures/queue';

describe('ShotbotDistributor', () => {
  it('should distribute shots into shotbots with exact division', () => {
    const colorCounts = new Map<Color, number>();
    colorCounts.set('red', 8);
    const shotbots = ShotbotDistributor.createShotbots(colorCounts, 2);
    expect(shotbots.length).toBe(4);
    shotbots.forEach((s) => {
      expect(s.shots).toBe(2);
      expect(s.color).toBe('red');
    });
  });

  it('should handle remainder shots', () => {
    const colorCounts = new Map<Color, number>();
    colorCounts.set('red', 9);
    const shotbots = ShotbotDistributor.createShotbots(colorCounts, 2);
    expect(shotbots.length).toBe(5);
    const shotsPerBot = shotbots.map((s) => s.shots).sort((a, b) => a - b);
    expect(shotsPerBot).toEqual([1, 2, 2, 2, 2]);
  });

  it('should distribute multiple colors', () => {
    const colorCounts = new Map<Color, number>();
    colorCounts.set('red', 8);
    colorCounts.set('blue', 1);
    const shotbots = ShotbotDistributor.createShotbots(colorCounts, 2);
    const redBots = shotbots.filter((s) => s.color === 'red');
    const blueBots = shotbots.filter((s) => s.color === 'blue');
    expect(redBots.length).toBe(4);
    expect(blueBots.length).toBe(1);
    expect(blueBots[0].shots).toBe(1);
  });

  it('should shuffle shotbots', () => {
    const colorCounts = new Map<Color, number>();
    colorCounts.set('red', 50);
    colorCounts.set('blue', 50);
    const shotbots = ShotbotDistributor.createShotbots(colorCounts, 10);
    const colors = shotbots.map((s) => s.color);
    const allSame = colors.every((c) => c === colors[0]);
    expect(allSame).toBe(false);
  });

  it('should distribute to multiple queues evenly', () => {
    const shotbots: Shotbot[] = [
      { color: 'red', shots: 2, state: ShotbotState.Waiting },
      { color: 'red', shots: 2, state: ShotbotState.Waiting },
      { color: 'blue', shots: 1, state: ShotbotState.Waiting },
      { color: 'red', shots: 2, state: ShotbotState.Waiting },
      { color: 'red', shots: 2, state: ShotbotState.Waiting },
    ];
    const queues = ShotbotDistributor.distributeToQueues(shotbots, 3);
    expect(queues.length).toBe(3);
    const sizes = queues.map((q) => q.size());
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(5);
  });

  it('should create shotbots with waiting state', () => {
    const colorCounts = new Map<Color, number>();
    colorCounts.set('red', 4);
    const shotbots = ShotbotDistributor.createShotbots(colorCounts, 2);
    shotbots.forEach((s) => {
      expect(s.state).toBe(ShotbotState.Waiting);
    });
  });

  it('should handle shotUnit of 1', () => {
    const colorCounts = new Map<Color, number>();
    colorCounts.set('red', 3);
    const shotbots = ShotbotDistributor.createShotbots(colorCounts, 1);
    expect(shotbots.length).toBe(3);
    shotbots.forEach((s) => {
      expect(s.shots).toBe(1);
    });
  });
});
