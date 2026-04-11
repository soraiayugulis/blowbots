import { Color } from '../models/color';
import { Shotbot, ShotbotState } from '../models/shotbot';
import { Queue } from '../data-structures/queue';

export class ShotbotDistributor {
  static createShotbots(
    colorCounts: Map<Color, number>,
    shotUnit: number
  ): Shotbot[] {
    const shotbots: Shotbot[] = [];

    for (const [color, totalShots] of colorCounts) {
      const numFullBots = Math.floor(totalShots / shotUnit);
      const remainder = totalShots % shotUnit;

      for (let i = 0; i < numFullBots; i++) {
        shotbots.push({
          color,
          shots: shotUnit,
          state: ShotbotState.Waiting,
        });
      }

      if (remainder > 0) {
        shotbots.push({
          color,
          shots: remainder,
          state: ShotbotState.Waiting,
        });
      }
    }

    return this.shuffle(shotbots);
  }

  static distributeToQueues(
    shotbots: Shotbot[],
    numQueues: number
  ): Queue<Shotbot>[] {
    const queues: Queue<Shotbot>[] = [];
    for (let i = 0; i < numQueues; i++) {
      queues.push(new Queue<Shotbot>());
    }

    shotbots.forEach((shotbot, index) => {
      queues[index % numQueues].enqueue(shotbot);
    });

    return queues;
  }

  private static shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
