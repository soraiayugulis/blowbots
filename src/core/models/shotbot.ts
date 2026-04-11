import { Color } from './color';

export enum ShotbotState {
  Waiting = 'waiting',
  Moving = 'moving',
  Used = 'used',
}

export interface Shotbot {
  color: Color;
  shots: number;
  state: ShotbotState;
}
