import { describe, it, expect } from 'vitest';
import { BoundedQueue } from '@core/data-structures/bounded-queue';

describe('BoundedQueue', () => {
  it('should enqueue when not full', () => {
    const queue = new BoundedQueue<number>(3);
    expect(queue.enqueue(1)).toBe(true);
    expect(queue.size()).toBe(1);
  });

  it('should not enqueue when full', () => {
    const queue = new BoundedQueue<number>(2);
    queue.enqueue(1);
    queue.enqueue(2);
    expect(queue.enqueue(3)).toBe(false);
    expect(queue.size()).toBe(2);
  });

  it('should dequeue in FIFO order', () => {
    const queue = new BoundedQueue<number>(5);
    queue.enqueue(10);
    queue.enqueue(20);
    queue.enqueue(30);
    expect(queue.dequeue()).toBe(10);
    expect(queue.dequeue()).toBe(20);
    expect(queue.dequeue()).toBe(30);
  });

  it('should return null when dequeuing empty queue', () => {
    const queue = new BoundedQueue<number>(3);
    expect(queue.dequeue()).toBeNull();
  });

  it('should peek without removing', () => {
    const queue = new BoundedQueue<number>(5);
    queue.enqueue(42);
    expect(queue.peek()).toBe(42);
    expect(queue.size()).toBe(1);
  });

  it('should return null when peeking empty queue', () => {
    const queue = new BoundedQueue<number>(3);
    expect(queue.peek()).toBeNull();
  });

  it('should return isFull correctly', () => {
    const queue = new BoundedQueue<number>(2);
    expect(queue.isFull()).toBe(false);
    queue.enqueue(1);
    expect(queue.isFull()).toBe(false);
    queue.enqueue(2);
    expect(queue.isFull()).toBe(true);
  });

  it('should return isEmpty correctly', () => {
    const queue = new BoundedQueue<number>(3);
    expect(queue.isEmpty()).toBe(true);
    queue.enqueue(1);
    expect(queue.isEmpty()).toBe(false);
    queue.dequeue();
    expect(queue.isEmpty()).toBe(true);
  });

  it('should allow enqueue after dequeue freed space', () => {
    const queue = new BoundedQueue<number>(2);
    queue.enqueue(1);
    queue.enqueue(2);
    queue.dequeue();
    expect(queue.enqueue(3)).toBe(true);
    expect(queue.size()).toBe(2);
  });
});
