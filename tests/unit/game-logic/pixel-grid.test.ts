import { describe, it, expect } from 'vitest';
import { PixelGrid } from '@core/pixel-grid';
import { RLERow } from '@core/algorithms/rle-expander';

describe('PixelGrid', () => {
  function create3x3Grid(): PixelGrid {
    const rleGrid: RLERow[][] = [
      [{ color: 'red', count: 3 }],
      [
        { color: 'red', count: 1 },
        { color: 'blue', count: 1 },
        { color: 'red', count: 1 },
      ],
      [{ color: 'red', count: 3 }],
    ];
    return new PixelGrid(rleGrid);
  }

  it('should initialize from RLE grid', () => {
    const grid = create3x3Grid();
    expect(grid.getWidth()).toBe(3);
    expect(grid.getHeight()).toBe(3);
  });

  it('should get block at position', () => {
    const grid = create3x3Grid();
    expect(grid.getBlock(0, 0)).toBe('red');
    expect(grid.getBlock(1, 1)).toBe('blue');
    expect(grid.getBlock(2, 2)).toBe('red');
  });

  it('should return null for out of bounds', () => {
    const grid = create3x3Grid();
    expect(grid.getBlock(-1, 0)).toBeNull();
    expect(grid.getBlock(0, 3)).toBeNull();
    expect(grid.getBlock(3, 0)).toBeNull();
  });

  it('should remove block at position', () => {
    const grid = create3x3Grid();
    grid.removeBlock(1, 1);
    expect(grid.getBlock(1, 1)).toBeNull();
  });

  it('should count blocks per color', () => {
    const grid = create3x3Grid();
    const counts = grid.countByColor();
    expect(counts.get('red')).toBe(8);
    expect(counts.get('blue')).toBe(1);
  });

  it('should update color count after removal', () => {
    const grid = create3x3Grid();
    grid.removeBlock(1, 1);
    const counts = grid.countByColor();
    expect(counts.get('blue') ?? 0).toBe(0);
    expect(counts.get('red')).toBe(8);
  });

  it('should detect all blocks cleared', () => {
    const grid = create3x3Grid();
    expect(grid.isCleared()).toBe(false);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        grid.removeBlock(x, y);
      }
    }
    expect(grid.isCleared()).toBe(true);
  });

  it('should return total block count', () => {
    const grid = create3x3Grid();
    expect(grid.totalBlocks()).toBe(9);
  });

  it('should return remaining block count', () => {
    const grid = create3x3Grid();
    expect(grid.remainingBlocks()).toBe(9);
    grid.removeBlock(0, 0);
    expect(grid.remainingBlocks()).toBe(8);
  });
});
