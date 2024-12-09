import {
  CreatePositionEvent,
  RemovePositionEvent,
} from "@invariant-labs/sdk-eclipse/lib/market";

export interface IActive {
  event: CreatePositionEvent;
  points: number;
}
export interface IClosed {
  events: [CreatePositionEvent | null, RemovePositionEvent];
  points: number;
}
export interface IPositions {
  active: IActive[];
  closed: IClosed[];
}
