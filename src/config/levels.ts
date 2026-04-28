import xPatternEasy from './levels/x-pattern-easy.json';
import squarePatternNormal from './levels/square-pattern-normal.json';
import diamondPatternNormal from './levels/diamond-pattern-normal.json';
import crossPatternNormal from './levels/cross-pattern-normal.json';
import spiralPatternHard from './levels/spiral-pattern-hard.json';
import checkerboardPatternHard from './levels/checkerboard-pattern-hard.json';
import foxExtreme from './levels/fox-extreme.json';
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
  diamondPatternNormal as LevelConfig,
  crossPatternNormal as LevelConfig,
  spiralPatternHard as LevelConfig,
  checkerboardPatternHard as LevelConfig,
  foxExtreme as LevelConfig,
];

export function getLevels(): LevelConfig[] {
  return LEVELS;
}

export function getLevelById(id: string): LevelConfig | undefined {
  return LEVELS.find((level) => level.id === id);
}
