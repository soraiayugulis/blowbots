import { Position } from '../models/position';
import { Color } from '../models/color';

export class LineOfSight {
  static hasLineOfSight(
    beltPos: Position,
    blockPos: Position,
    grid: (Color | null)[][]
  ): boolean {
    const direction = this.getDirection(beltPos, blockPos);
    if (!direction) return false;

    let current = beltPos.add(direction);
    while (!current.equals(blockPos)) {
      if (!this.isInBounds(current, grid)) {
        return false;
      }
      if (grid[current.y][current.x] !== null) {
        return false;
      }
      current = current.add(direction);
    }
    return true;
  }

  static findNearestEdgeBlock(
    beltPos: Position,
    grid: (Color | null)[][]
  ): Position | null {
    const direction = this.getInwardDirection(beltPos, grid);
    if (!direction) return null;

    let current = beltPos.add(direction);
    while (this.isInBounds(current, grid)) {
      if (grid[current.y][current.x] !== null) {
        return current;
      }
      current = current.add(direction);
    }
    return null;
  }

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
      if (cell !== null && cell === color) {
        return current;
      }
      // Skip empty cells and wrong-color blocks — keep looking for own color
      current = current.add(direction);
    }
    return null;
  }

  private static getDirection(from: Position, to: Position): Position | null {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    if (dx !== 0 && dy !== 0) return null;
    if (dx === 0 && dy === 0) return null;
    return new Position(dx, dy);
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
