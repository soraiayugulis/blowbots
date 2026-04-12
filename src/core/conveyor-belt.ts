import { Position } from './models/position';

const STEPS_PER_EDGE_MULTIPLIER = 2; // multiplier for steps per edge calculation
const BELT_EDGE_OFFSET = 1; // offset for belt edge positions

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

  getLength(): number {
    return this.positions.length;
  }

  private generatePerimeter(width: number, height: number): Position[] {
    const positions: Position[] = [];

    const stepsPerEdge = Math.max(width, height) * STEPS_PER_EDGE_MULTIPLIER;

    for (let i = 0; i <= stepsPerEdge; i++) {
      const x = -BELT_EDGE_OFFSET + (width + BELT_EDGE_OFFSET) * (i / stepsPerEdge);
      positions.push(new Position(Math.round(x), -BELT_EDGE_OFFSET));
    }

    for (let i = 1; i <= stepsPerEdge; i++) {
      const y = -BELT_EDGE_OFFSET + (height + BELT_EDGE_OFFSET) * (i / stepsPerEdge);
      positions.push(new Position(width, Math.round(y)));
    }

    for (let i = 1; i <= stepsPerEdge; i++) {
      const x = width - (width + BELT_EDGE_OFFSET) * (i / stepsPerEdge);
      positions.push(new Position(Math.round(x), height));
    }

    for (let i = 1; i < stepsPerEdge; i++) {
      const y = height - (height + BELT_EDGE_OFFSET) * (i / stepsPerEdge);
      positions.push(new Position(-BELT_EDGE_OFFSET, Math.round(y)));
    }

    // Deduplicate positions rounded to the same coordinates
    const unique: Position[] = [];
    const seen = new Set<string>();
    for (const pos of positions) {
      const key = `${pos.x},${pos.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(pos);
      }
    }
    return unique;
  }
}
