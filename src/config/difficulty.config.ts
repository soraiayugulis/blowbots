export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  name: Difficulty;
  gridSize: number;
  shotUnit: number;
  numWaitingQueues: number;
  usedQueueCapacity: number;
  beltSpeed: number;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    name: 'easy',
    gridSize: 3,
    shotUnit: 2,
    numWaitingQueues: 3,
    usedQueueCapacity: 3,
    beltSpeed: 1000,
  },
  normal: {
    name: 'normal',
    gridSize: 5,
    shotUnit: 5,
    numWaitingQueues: 3,
    usedQueueCapacity: 3,
    beltSpeed: 1000,
  },
  hard: {
    name: 'hard',
    gridSize: 10,
    shotUnit: 10,
    numWaitingQueues: 4,
    usedQueueCapacity: 3,
    beltSpeed: 1000,
  },
};
