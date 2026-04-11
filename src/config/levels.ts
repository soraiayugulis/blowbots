import xPatternEasy from './levels/x-pattern-easy.json';
import squarePatternNormal from './levels/square-pattern-normal.json';
import { RLERow } from '@core/algorithms/rle-expander';
import { Difficulty } from './difficulty.config';

export interface LevelConfig {
  id: string;
  name: string;
  difficulty: Difficulty;
  grid: RLERow[][];
}

const LEVELS: LevelConfig[] = [
  xPatternEasy as LevelConfig,
  squarePatternNormal as LevelConfig,
];

export function getLevels(): LevelConfig[] {
  return LEVELS;
}

export function getLevelById(id: string): LevelConfig | undefined {
  return LEVELS.find((level) => level.id === id);
}
