import { Color } from '../models/color';

export interface RLERow {
  color: Color;
  count: number;
}

export class RLEExpander {
  static expand(rleGrid: RLERow[][]): (Color | null)[][] {
    return rleGrid.map((row) => {
      const expanded: (Color | null)[] = [];
      for (const segment of row) {
        for (let i = 0; i < segment.count; i++) {
          expanded.push(segment.color);
        }
      }
      return expanded;
    });
  }

  static countByColor(rleGrid: RLERow[][]): Map<Color, number> {
    const counts = new Map<Color, number>();
    for (const row of rleGrid) {
      for (const segment of row) {
        const current = counts.get(segment.color) ?? 0;
        counts.set(segment.color, current + segment.count);
      }
    }
    return counts;
  }
}
