import { Color } from './models/color';
import { RLEExpander, RLERow } from './algorithms/rle-expander';

export class PixelGrid {
  private grid: (Color | null)[][];

  constructor(rleGrid: RLERow[][]) {
    this.grid = RLEExpander.expand(rleGrid);
  }

  getWidth(): number {
    return this.grid[0]?.length ?? 0;
  }

  getHeight(): number {
    return this.grid.length;
  }

  getBlock(x: number, y: number): Color | null {
    if (!this.isInBounds(x, y)) {
      return null;
    }
    return this.grid[y][x];
  }

  removeBlock(x: number, y: number): void {
    if (this.isInBounds(x, y)) {
      this.grid[y][x] = null;
    }
  }

  countByColor(): Map<Color, number> {
    const counts = new Map<Color, number>();
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell !== null) {
          counts.set(cell, (counts.get(cell) ?? 0) + 1);
        }
      }
    }
    return counts;
  }

  isCleared(): boolean {
    return this.countRemaining() === 0;
  }

  getGrid(): (Color | null)[][] {
    return this.grid;
  }

  private countRemaining(): number {
    let count = 0;
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell !== null) {
          count++;
        }
      }
    }
    return count;
  }

  private isInBounds(x: number, y: number): boolean {
    return y >= 0 && y < this.grid.length && x >= 0 && x < (this.grid[y]?.length ?? 0);
  }
}
