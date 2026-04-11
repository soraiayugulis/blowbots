import { describe, it, expect } from 'vitest';
import { LineOfSight } from '@core/algorithms/line-of-sight';
import { Position } from '@core/models/position';
import { Color } from '@core/models/color';

describe('LineOfSight', () => {
  it('should have line of sight when path is clear', () => {
    const grid: (Color | null)[][] = [
      ['red', 'red', 'red'],
      ['red', 'blue', 'red'],
      ['red', 'red', 'red'],
    ];
    const beltPos = new Position(0, -1);
    const blockPos = new Position(0, 0);
    expect(LineOfSight.hasLineOfSight(beltPos, blockPos, grid)).toBe(true);
  });

  it('should not have line of sight when path is blocked', () => {
    const grid: (Color | null)[][] = [
      ['red', 'red', 'red'],
      ['red', 'blue', 'red'],
      ['red', 'red', 'red'],
    ];
    const beltPos = new Position(0, -1);
    const blockPos = new Position(0, 2);
    expect(LineOfSight.hasLineOfSight(beltPos, blockPos, grid)).toBe(false);
  });

  it('should have line of sight when inner block is removed', () => {
    const grid: (Color | null)[][] = [
      [null, null, null],
      [null, 'blue', 'red'],
      ['red', 'red', 'red'],
    ];
    const beltPos = new Position(0, -1);
    const blockPos = new Position(0, 2);
    expect(LineOfSight.hasLineOfSight(beltPos, blockPos, grid)).toBe(true);
  });

  it('should have line of sight from right side', () => {
    const grid: (Color | null)[][] = [
      ['red', 'red', 'red'],
      ['red', 'blue', 'red'],
      ['red', 'red', 'red'],
    ];
    const beltPos = new Position(3, 1);
    const blockPos = new Position(2, 1);
    expect(LineOfSight.hasLineOfSight(beltPos, blockPos, grid)).toBe(true);
  });

  it('should not have line of sight from right side when blocked', () => {
    const grid: (Color | null)[][] = [
      ['red', 'red', 'red'],
      ['red', 'blue', 'red'],
      ['red', 'red', 'red'],
    ];
    const beltPos = new Position(3, 1);
    const blockPos = new Position(0, 1);
    expect(LineOfSight.hasLineOfSight(beltPos, blockPos, grid)).toBe(false);
  });

  it('should have line of sight from bottom', () => {
    const grid: (Color | null)[][] = [
      ['red', 'red', 'red'],
      ['red', 'blue', 'red'],
      ['red', 'red', 'red'],
    ];
    const beltPos = new Position(1, 3);
    const blockPos = new Position(1, 2);
    expect(LineOfSight.hasLineOfSight(beltPos, blockPos, grid)).toBe(true);
  });

  it('should have line of sight when adjacent', () => {
    const grid: (Color | null)[][] = [
      ['red', 'red', 'red'],
      ['red', 'blue', 'red'],
      ['red', 'red', 'red'],
    ];
    const beltPos = new Position(0, -1);
    const blockPos = new Position(0, 0);
    expect(LineOfSight.hasLineOfSight(beltPos, blockPos, grid)).toBe(true);
  });

  it('should find nearest edge block in line of sight', () => {
    const grid: (Color | null)[][] = [
      ['red', 'red', 'red'],
      ['red', 'blue', 'red'],
      ['red', 'red', 'red'],
    ];
    const beltPos = new Position(0, -1);
    const nearest = LineOfSight.findNearestEdgeBlock(beltPos, grid);
    expect(nearest).not.toBeNull();
    expect(nearest!.x).toBe(0);
    expect(nearest!.y).toBe(0);
  });

  it('should find inner block when outer is removed', () => {
    const grid: (Color | null)[][] = [
      [null, null, null],
      ['red', 'blue', 'red'],
      ['red', 'red', 'red'],
    ];
    const beltPos = new Position(0, -1);
    const nearest = LineOfSight.findNearestEdgeBlock(beltPos, grid);
    expect(nearest).not.toBeNull();
    expect(nearest!.x).toBe(0);
    expect(nearest!.y).toBe(1);
  });

  it('should return null when no block in line of sight', () => {
    const grid: (Color | null)[][] = [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ];
    const beltPos = new Position(0, -1);
    const nearest = LineOfSight.findNearestEdgeBlock(beltPos, grid);
    expect(nearest).toBeNull();
  });
});
