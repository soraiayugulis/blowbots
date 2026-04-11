export class Position {
  constructor(public readonly x: number, public readonly y: number) {}

  equals(other: Position): boolean {
    return this.x === other.x && this.y === other.y;
  }

  add(other: Position): Position {
    return new Position(this.x + other.x, this.y + other.y);
  }

  subtract(other: Position): Position {
    return new Position(this.x - other.x, this.y - other.y);
  }
}
