import { describe, it, expect } from 'vitest';
import { RLEExpander } from '@core/algorithms/rle-expander';
import { Color } from '@core/models/color';

interface RLERow {
  color: Color;
  count: number;
}

describe('RLEExpander', () => {
  it('should expand single row with single segment', () => {
    const rleGrid: RLERow[][] = [
      [{ color: 'red', count: 3 }],
    ];
    const result = RLEExpander.expand(rleGrid);
    expect(result).toEqual([['red', 'red', 'red']]);
  });

  it('should expand multi row rle', () => {
    const rleGrid: RLERow[][] = [
      [{ color: 'red', count: 3 }],
      [{ color: 'blue', count: 3 }],
    ];
    const result = RLEExpander.expand(rleGrid);
    expect(result).toEqual([
      ['red', 'red', 'red'],
      ['blue', 'blue', 'blue'],
    ]);
  });

  it('should handle multiple segments in row', () => {
    const rleGrid: RLERow[][] = [
      [
        { color: 'red', count: 1 },
        { color: 'blue', count: 1 },
        { color: 'red', count: 1 },
      ],
    ];
    const result = RLEExpander.expand(rleGrid);
    expect(result).toEqual([['red', 'blue', 'red']]);
  });

  it('should calculate correct dimensions', () => {
    const rleGrid: RLERow[][] = [
      [{ color: 'red', count: 3 }],
      [
        { color: 'red', count: 1 },
        { color: 'blue', count: 1 },
        { color: 'red', count: 1 },
      ],
      [{ color: 'red', count: 3 }],
    ];
    const expanded = RLEExpander.expand(rleGrid);
    expect(expanded.length).toBe(3);
    expect(expanded[0].length).toBe(3);
  });

  it('should retrieve block by coordinates', () => {
    const rleGrid: RLERow[][] = [
      [{ color: 'red', count: 3 }],
      [
        { color: 'red', count: 1 },
        { color: 'blue', count: 1 },
        { color: 'red', count: 1 },
      ],
      [{ color: 'red', count: 3 }],
    ];
    const expanded = RLEExpander.expand(rleGrid);
    expect(expanded[1][1]).toBe('blue');
    expect(expanded[0][0]).toBe('red');
  });

  it('should count blocks per color correctly', () => {
    const rleGrid: RLERow[][] = [
      [{ color: 'red', count: 3 }],
      [
        { color: 'red', count: 1 },
        { color: 'blue', count: 1 },
        { color: 'red', count: 1 },
      ],
      [{ color: 'red', count: 3 }],
    ];
    const counts = RLEExpander.countByColor(rleGrid);
    expect(counts.get('red')).toBe(8);
    expect(counts.get('blue')).toBe(1);
  });

  it('should handle empty grid', () => {
    const rleGrid: RLERow[][] = [];
    const result = RLEExpander.expand(rleGrid);
    expect(result).toEqual([]);
  });
});
