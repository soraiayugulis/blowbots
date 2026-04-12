import { describe, it, expect } from 'vitest';
import { LineOfSight } from '@core/algorithms/line-of-sight';
import { Position } from '@core/models/position';
import { Color } from '@core/models/color';

describe('LineOfSight', () => {
  describe('findNearestEdgeBlockOfColor', () => {
    it('should find matching color block at edge from top', () => {
      const grid: (Color | null)[][] = [
        ['red', 'red', 'red'],
        ['red', 'blue', 'red'],
        ['red', 'red', 'red'],
      ];
      const beltPos = new Position(0, -1);
      const result = LineOfSight.findNearestEdgeBlockOfColor(beltPos, grid, 'red');
      expect(result).not.toBeNull();
      expect(result!.x).toBe(0);
      expect(result!.y).toBe(0);
    });

    it('should return null when first block is wrong color (blocks LOS)', () => {
      const grid: (Color | null)[][] = [
        ['blue' as Color, 'blue' as Color, 'blue' as Color],
        ['red' as Color, 'red' as Color, 'red' as Color],
        ['red' as Color, 'red' as Color, 'red' as Color],
      ];
      const beltPos = new Position(0, -1);
      const result = LineOfSight.findNearestEdgeBlockOfColor(beltPos, grid, 'red');
      expect(result).toBeNull();
    });

    it('should find matching color block when first block matches', () => {
      const grid: (Color | null)[][] = [
        ['blue' as Color, 'blue' as Color, 'blue' as Color],
        ['red' as Color, 'red' as Color, 'red' as Color],
        ['red' as Color, 'red' as Color, 'red' as Color],
      ];
      const beltPos = new Position(0, -1);
      const result = LineOfSight.findNearestEdgeBlockOfColor(beltPos, grid, 'blue');
      expect(result).not.toBeNull();
      expect(result!.x).toBe(0);
      expect(result!.y).toBe(0);
    });

    it('should find block from right side', () => {
      const grid: (Color | null)[][] = [
        ['red', 'red', 'red'],
        ['red', 'blue', 'red'],
        ['red', 'red', 'red'],
      ];
      const beltPos = new Position(3, 1);
      const result = LineOfSight.findNearestEdgeBlockOfColor(beltPos, grid, 'red');
      expect(result).not.toBeNull();
      expect(result!.x).toBe(2);
      expect(result!.y).toBe(1);
    });

    it('should find block from bottom', () => {
      const grid: (Color | null)[][] = [
        ['red', 'red', 'red'],
        ['red', 'blue', 'red'],
        ['red', 'red', 'red'],
      ];
      const beltPos = new Position(1, 3);
      const result = LineOfSight.findNearestEdgeBlockOfColor(beltPos, grid, 'red');
      expect(result).not.toBeNull();
      expect(result!.x).toBe(1);
      expect(result!.y).toBe(2);
    });

    it('should find block from left side', () => {
      const grid: (Color | null)[][] = [
        ['red', 'red', 'red'],
        ['red', 'blue', 'red'],
        ['red', 'red', 'red'],
      ];
      const beltPos = new Position(-1, 1);
      const result = LineOfSight.findNearestEdgeBlockOfColor(beltPos, grid, 'red');
      expect(result).not.toBeNull();
      expect(result!.x).toBe(0);
      expect(result!.y).toBe(1);
    });

    it('should return null when no block in line of sight', () => {
      const grid: (Color | null)[][] = [
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ];
      const beltPos = new Position(0, -1);
      const result = LineOfSight.findNearestEdgeBlockOfColor(beltPos, grid, 'red');
      expect(result).toBeNull();
    });

    it('should skip null cells and find deeper matching block', () => {
      const grid: (Color | null)[][] = [
        [null, null, null],
        ['red' as Color, 'blue' as Color, 'red' as Color],
        ['red' as Color, 'red' as Color, 'red' as Color],
      ];
      const beltPos = new Position(0, -1);
      const result = LineOfSight.findNearestEdgeBlockOfColor(beltPos, grid, 'red');
      expect(result).not.toBeNull();
      expect(result!.x).toBe(0);
      expect(result!.y).toBe(1);
    });

    it('should return null when deeper block is wrong color', () => {
      const grid: (Color | null)[][] = [
        [null, null, null],
        ['blue' as Color, 'blue' as Color, 'blue' as Color],
        ['red' as Color, 'red' as Color, 'red' as Color],
      ];
      const beltPos = new Position(0, -1);
      const result = LineOfSight.findNearestEdgeBlockOfColor(beltPos, grid, 'red');
      expect(result).toBeNull();
    });
  });
});
