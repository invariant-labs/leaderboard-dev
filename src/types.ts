import { BN } from "@coral-xyz/anchor";
import {
  CreatePositionEvent,
  PoolStructure,
  RemovePositionEvent,
  Tick,
} from "@invariant-labs/sdk-eclipse/lib/market";
import { PublicKey } from "@solana/web3.js";

export interface IActive {
  event: CreatePositionEvent;
  secondsPerLiquidityInside: BN;
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
export interface IConfig {
  lastTxHash: string;
  lastSnapTimestamp: number;
}
export interface IPoolAndTicks {
  pool: PublicKey;
  poolStructure: PoolStructure;
  ticks: Tick[];
}
