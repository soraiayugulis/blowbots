export class BoundedQueue<T> {
  private items: T[] = [];
  private readonly capacity: number;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error('Capacity must be at least 1');
    }
    this.capacity = capacity;
  }

  enqueue(item: T): boolean {
    if (this.isFull()) {
      return false;
    }
    this.items.push(item);
    return true;
  }

  dequeue(): T | null {
    if (this.isEmpty()) {
      return null;
    }
    return this.items.shift() ?? null;
  }

  peek(): T | null {
    if (this.isEmpty()) {
      return null;
    }
    return this.items[0];
  }

  isFull(): boolean {
    return this.items.length >= this.capacity;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }

  getCapacity(): number {
    return this.capacity;
  }
}
