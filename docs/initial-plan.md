# Blowbots - Initial Plan

## Stack

- **Game Engine:** Phaser 3
- **Language:** TypeScript
- **Build Tool:** Vite
- **Testing:** Vitest
- **Platform:** Web & Mobile (Android)
- **UI:** Phaser native (no external UI framework)
- **Storage:** JSON for level configs, no persistence

## Game Mechanics

### Core Loop

1. Player selects a shotbot from a waiting queue or used queue
2. Shotbot travels along the conveyor belt around the image perimeter
3. When aligned with a block of the same color and with line of sight, the shotbot shoots
4. Shotbot decrements its shot count on each successful shot
5. After completing the belt loop:
   - If shots remain: shotbot goes to the used queue (if space available)
   - If no shots remain: shotbot is removed
6. Game is won when all blocks are cleared

### Conveyor Belt

- Runs along the entire perimeter of the image
- Size is fixed relative to the image dimensions (does not shrink when blocks are removed)
- Shotbot always faces the image while moving
- Shotbot can only shoot the nearest edge block in its line of sight
- Removed blocks leave empty space (line of sight opens up for inner blocks)
- Belt speed is constant and never changes

### Shotbot Selection

- Player can explicitly choose to select from waiting queues OR used queue
- Selection from waiting queues requires that the used queue is not full
- Only the first shotbot in each queue can be selected (FIFO)
- Used queue has a bounded capacity

### Shotbot Distribution

- Total shots per color = total blocks of that color in the image
- Shots are divided into shotbots based on `shotUnit` (configurable per difficulty)
- Remainder shots go to an extra shotbot with fewer shots
- Shotbots are shuffled and distributed evenly across waiting queues

### Win Condition

- All blocks in the image must be cleared
- Shots are always exactly sufficient (no more, no less)

## Architecture

### Design Patterns

| Pattern | Usage |
|---------|-------|
| **Configuration Object** | Centralized difficulty and game settings (no magic numbers) |
| **State** | Shotbot states: waiting, moving, used |
| **Queue (FIFO)** | Waiting queues and used queue |
| **Observer** | Phaser events for game communication |
| **Factory** | Shotbot and level creation |
| **Singleton** | GameState instance |

### Component Architecture

```
GameState
├── PixelGrid (RLE-based)
├── ConveyorBelt
├── WaitingQueues (Queue<Shotbot>[])
├── UsedShotbotsQueue (BoundedQueue<Shotbot>)
└── ShotbotSelector
```

### Data Structures

- **BoundedQueue<T>**: Generic FIFO queue with fixed capacity
- **Queue<T>**: Generic FIFO queue (unbounded)
- **RLE Grid**: Run-Length Encoding for compact image representation
- **Position**: 2D coordinate (x, y)

## Image Format: RLE (Run-Length Encoding)

```typescript
interface RLERow {
  color: Color;
  count: number;
}

interface LevelConfig {
  id: string;
  name: string;
  difficulty: Difficulty;
  grid: RLERow[][];
}
```

Example (3x3 with blue center):
```json
{
  "id": "x-pattern-easy",
  "name": "X Pattern",
  "difficulty": "easy",
  "grid": [
    [{"color": "red", "count": 3}],
    [{"color": "red", "count": 1}, {"color": "blue", "count": 1}, {"color": "red", "count": 1}],
    [{"color": "red", "count": 3}]
  ]
}
```

## Difficulty Configuration

All configurable values are centralized in a Configuration Object:

```typescript
interface DifficultyConfig {
  name: 'easy' | 'normal' | 'hard';
  gridSize: number;           // Matrix size (3, 5, 10)
  shotUnit: number;          // Shots per shotbot (2, 5, 10)
  numWaitingQueues: number;   // Number of waiting queues
  usedQueueCapacity: number;  // Used queue capacity
  beltSpeed: number;          // Constant speed (ms)
}
```

| Setting | Easy | Normal | Hard |
|---------|------|--------|------|
| gridSize | 3 | 5 | 10 |
| shotUnit | 2 | 5 | 10 |
| numWaitingQueues | 3 | 3 | 4 |
| usedQueueCapacity | 5 | 5 | 5 |
| beltSpeed | 1000 | 1000 | 1000 |

## TDD Development Plan

### Phase 1: Fundamentals & Data Structures

#### 1.1 BoundedQueue
- `should_enqueue_when_not_full`
- `should_not_enqueue_when_full`
- `should_dequeue_fifo`
- `should_peek_without_removing`
- `should_return_isFull_correctly`
- `should_return_isEmpty_correctly`

#### 1.2 RLE Grid Expansion
- `should_expand_single_row_rle`
- `should_expand_multi_row_rle`
- `should_handle_multiple_segments_in_row`
- `should_calculate_correct_dimensions`
- `should_retrieve_block_by_coordinates`

#### 1.3 Shotbot Distribution Algorithm
- `should_distribute_shots_into_shotbots`
- `should_handle_remainder_shots`
- `should_distribute_to_multiple_queues`
- `should_shuffle_shotbots_before_distribution`

#### 1.4 Line of Sight Algorithm
- `should_have_line_of_sight_when_clear`
- `should_not_have_line_of_sight_when_blocked`
- `should_check_correct_direction`
- `should_handle_edge_cases`

### Phase 2: Game Logic

#### 2.1 Shotbot Movement on Belt
- `should_move_to_next_position`
- `should_complete_belt_cycle`
- `should_shoot_when_aligned_and_same_color`
- `should_not_shoot_when_different_color`
- `should_not_shoot_when_no_line_of_sight`
- `should_decrement_shot_on_successful_shoot`
- `should_move_to_used_queue_when_shots_remain`
- `should_be_removed_when_no_shots_remain`

#### 2.2 Shotbot Selection
- `should_select_from_waiting_when_used_queue_not_full`
- `should_not_select_from_waiting_when_used_queue_full`
- `should_select_from_used_queue_explicitly`
- `should_not_select_from_used_when_empty`
- `should_remove_from_source_queue_on_selection`

#### 2.3 Pixel Grid Block Removal
- `should_remove_block_at_position`
- `should_set_block_to_null_after_removal`
- `should_update_edge_blocks_after_removal`

#### 2.4 Win Condition
- `should_detect_win_when_all_blocks_removed`
- `should_not_detect_win_when_blocks_remain`

### Phase 3: UI/UX (Phaser Scenes)

#### 3.1 Welcome Scene
- Display level name and difficulty
- Navigate with arrows (left/right)
- Start game on selection

#### 3.2 Game Scene
- Display pixel grid, waiting queues, used queue
- Handle tap/click on shotbots
- Display back button
- Return to welcome on back

### Phase 4: Integration & E2E

#### 4.1 Full Game Flow
- Complete easy level
- Complete normal level
- Verify shot count invariant

## Project Structure

```
blowbots/
├── src/
│   ├── config/
│   │   ├── difficulty.config.ts
│   │   └── levels/
│   │       ├── x-pattern-easy.json
│   │       └── square-pattern-normal.json
│   ├── core/
│   │   ├── data-structures/
│   │   │   ├── bounded-queue.ts
│   │   │   └── queue.ts
│   │   ├── models/
│   │   │   ├── shotbot.ts
│   │   │   ├── position.ts
│   │   │   └── color.ts
│   │   ├── algorithms/
│   │   │   ├── rle-expander.ts
│   │   │   ├── shotbot-distributor.ts
│   │   │   └── line-of-sight.ts
│   │   └── game-state.ts
│   ├── game/
│   │   ├── components/
│   │   │   ├── pixel-grid.ts
│   │   │   ├── conveyor-belt.ts
│   │   │   ├── shotbot-selector.ts
│   │   │   └── waiting-queues.ts
│   │   └── scenes/
│   │       ├── welcome-scene.ts
│   │       └── game-scene.ts
│   └── main.ts
├── tests/
│   ├── unit/
│   │   ├── data-structures/
│   │   │   └── bounded-queue.test.ts
│   │   ├── algorithms/
│   │   │   ├── rle-expander.test.ts
│   │   │   ├── shotbot-distributor.test.ts
│   │   │   └── line-of-sight.test.ts
│   │   └── game-logic/
│   │       ├── shotbot-movement.test.ts
│   │       ├── shotbot-selection.test.ts
│   │       └── win-condition.test.ts
│   └── integration/
│       └── game-flow.test.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Key Decisions

- **RLE format** for image data: compact, scalable to 30x30+
- **Configuration Object Pattern** for difficulty: no magic numbers, easy to extend
- **Explicit selection**: player chooses waiting or used queue (not automatic)
- **Fixed conveyor belt**: perimeter does not shrink when blocks are removed
- **Constant speed**: belt speed never changes across difficulties
- **Shot invariant**: total shots always equals total blocks (guaranteed solvable)
- **No persistence**: no save state, score is session-only
- **All code in English**, chat in Portuguese
