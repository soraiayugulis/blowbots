import { Position } from '../models/position';
import { Color } from '../models/color';

export class LineOfSight {
  static findNearestEdgeBlockOfColor(
    beltPos: Position,
    grid: (Color | null)[][],
    color: Color
  ): Position | null {
    const direction = this.getInwardDirection(beltPos, grid);
    if (!direction) return null;

    let current = beltPos.add(direction);
    while (this.isInBounds(current, grid)) {
      const cell = grid[current.y][current.x];
      if (cell !== null) {
        // First block in line of sight — shoot only if it matches our color
        if (cell === color) {
          return current;
        }
        // Wrong-color block blocks line of sight
        return null;
      }
      current = current.add(direction);
    }
    return null;
  }

  private static getInwardDirection(
    beltPos: Position,
    grid: (Color | null)[][]
  ): Position | null {
    const gridHeight = grid.length;
    const gridWidth = grid[0]?.length ?? 0;

    if (beltPos.y < 0) return new Position(0, 1);
    if (beltPos.y >= gridHeight) return new Position(0, -1);
    if (beltPos.x < 0) return new Position(1, 0);
    if (beltPos.x >= gridWidth) return new Position(-1, 0);
    return null;
  }

  private static isInBounds(pos: Position, grid: (Color | null)[][]): boolean {
    return (
      pos.y >= 0 &&
      pos.y < grid.length &&
      pos.x >= 0 &&
      pos.x < (grid[pos.y]?.length ?? 0)
    );
  }
}
