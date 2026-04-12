import { describe, it, expect } from 'vitest';
import { ConveyorBelt } from '@core/conveyor-belt';

describe('ConveyorBelt', () => {
  it('should generate deduplicated perimeter positions for 3x3 grid', () => {
    const belt = new ConveyorBelt(3, 3);
    const positions = belt.getPositions();
    const coords = positions.map(p => `${p.x},${p.y}`);
    expect(new Set(coords).size).toBe(positions.length);
  });

  it('should generate deduplicated perimeter positions for 5x5 grid', () => {
    const belt = new ConveyorBelt(5, 5);
    const positions = belt.getPositions();
    const coords = positions.map(p => `${p.x},${p.y}`);
    expect(new Set(coords).size).toBe(positions.length);
  });

  it('should start outside grid on top edge', () => {
    const belt = new ConveyorBelt(3, 3);
    const first = belt.getPosition(0);
    expect(first).not.toBeNull();
    expect(first!.y).toBe(-1);
  });

  it('should include corners in perimeter', () => {
    const belt = new ConveyorBelt(3, 3);
    const positions = belt.getPositions();
    const coords = new Set(positions.map(p => `${p.x},${p.y}`));
    expect(coords.has('3,-1')).toBe(true);
    expect(coords.has('3,3')).toBe(true);
    expect(coords.has('-1,3')).toBe(true);
  });

  it('should return correct next position index', () => {
    const belt = new ConveyorBelt(3, 3);
    expect(belt.getNextIndex(0)).toBe(1);
    const last = belt.getLength() - 1;
    expect(belt.getNextIndex(last)).toBe(0);
  });

  it('should return position by index', () => {
    const belt = new ConveyorBelt(3, 3);
    const pos = belt.getPosition(0);
    expect(pos).not.toBeNull();
  });

  it('should return null for out of bounds index', () => {
    const belt = new ConveyorBelt(3, 3);
    expect(belt.getPosition(-1)).toBeNull();
    expect(belt.getPosition(belt.getLength())).toBeNull();
  });

  it('should have no duplicate coordinates', () => {
    const belt = new ConveyorBelt(5, 5);
    const positions = belt.getPositions();
    const coords = positions.map(p => `${p.x},${p.y}`);
    expect(coords.length).toBe(new Set(coords).size);
  });
});
