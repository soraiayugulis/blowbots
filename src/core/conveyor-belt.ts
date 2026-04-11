import { Position } from './models/position';

export class ConveyorBelt {
  private positions: Position[];

  constructor(gridWidth: number, gridHeight: number) {
    this.positions = this.generatePerimeter(gridWidth, gridHeight);
  }

  getPositions(): Position[] {
    return this.positions;
  }

  getPosition(index: number): Position | null {
    if (index < 0 || index >= this.positions.length) {
      return null;
    }
    return this.positions[index];
  }

  getNextIndex(currentIndex: number): number {
    return (currentIndex + 1) % this.positions.length;
  }

  isCompleteLoop(startIndex: number, currentIndex: number): boolean {
    return startIndex === currentIndex;
  }

  getLength(): number {
    return this.positions.length;
  }

  private generatePerimeter(width: number, height: number): Position[] {
    const positions: Position[] = [];

    // Top edge: left to right (y = -1)
    for (let x = 0; x < width; x++) {
      positions.push(new Position(x, -1));
    }

    // Right edge: top to bottom (x = width)
    for (let y = 0; y < height; y++) {
      positions.push(new Position(width, y));
    }

    // Bottom edge: right to left (y = height)
    for (let x = width - 1; x >= 0; x--) {
      positions.push(new Position(x, height));
    }

    // Left edge: bottom to top (x = -1)
    for (let y = height - 1; y >= 0; y--) {
      positions.push(new Position(-1, y));
    }

    return positions;
  }
}
