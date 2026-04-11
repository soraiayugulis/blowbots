import { describe, it, expect } from 'vitest';
import { ConveyorBelt } from '@core/conveyor-belt';

describe('ConveyorBelt', () => {
  it('should generate perimeter positions for 3x3 grid', () => {
    const belt = new ConveyorBelt(3, 3);
    const positions = belt.getPositions();
    expect(positions.length).toBe(12);
  });

  it('should generate perimeter positions for 5x5 grid', () => {
    const belt = new ConveyorBelt(5, 5);
    const positions = belt.getPositions();
    expect(positions.length).toBe(20);
  });

  it('should start at top-left corner outside grid', () => {
    const belt = new ConveyorBelt(3, 3);
    const positions = belt.getPositions();
    expect(positions[0]).toEqual({ x: 0, y: -1 });
  });

  it('should traverse top edge left to right', () => {
    const belt = new ConveyorBelt(3, 3);
    const positions = belt.getPositions();
    expect(positions[0]).toEqual({ x: 0, y: -1 });
    expect(positions[1]).toEqual({ x: 1, y: -1 });
    expect(positions[2]).toEqual({ x: 2, y: -1 });
  });

  it('should traverse right edge top to bottom', () => {
    const belt = new ConveyorBelt(3, 3);
    const positions = belt.getPositions();
    expect(positions[3]).toEqual({ x: 3, y: 0 });
    expect(positions[4]).toEqual({ x: 3, y: 1 });
    expect(positions[5]).toEqual({ x: 3, y: 2 });
  });

  it('should traverse bottom edge right to left', () => {
    const belt = new ConveyorBelt(3, 3);
    const positions = belt.getPositions();
    expect(positions[6]).toEqual({ x: 2, y: 3 });
    expect(positions[7]).toEqual({ x: 1, y: 3 });
    expect(positions[8]).toEqual({ x: 0, y: 3 });
  });

  it('should traverse left edge bottom to top', () => {
    const belt = new ConveyorBelt(3, 3);
    const positions = belt.getPositions();
    expect(positions[9]).toEqual({ x: -1, y: 2 });
    expect(positions[10]).toEqual({ x: -1, y: 1 });
    expect(positions[11]).toEqual({ x: -1, y: 0 });
  });

  it('should return correct next position index', () => {
    const belt = new ConveyorBelt(3, 3);
    expect(belt.getNextIndex(0)).toBe(1);
    expect(belt.getNextIndex(11)).toBe(0);
  });

  it('should detect complete loop', () => {
    const belt = new ConveyorBelt(3, 3);
    expect(belt.isCompleteLoop(0, 0)).toBe(true);
    expect(belt.isCompleteLoop(0, 5)).toBe(false);
  });

  it('should return position by index', () => {
    const belt = new ConveyorBelt(3, 3);
    const pos = belt.getPosition(0);
    expect(pos).toEqual({ x: 0, y: -1 });
  });

  it('should return null for out of bounds index', () => {
    const belt = new ConveyorBelt(3, 3);
    const pos = belt.getPosition(-1);
    expect(pos).toBeNull();
    const pos2 = belt.getPosition(12);
    expect(pos2).toBeNull();
  });
});
