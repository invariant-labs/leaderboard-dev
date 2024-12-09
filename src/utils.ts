import {
  Connection,
  PublicKey,
  ConfirmedSignatureInfo,
  ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { PROMOTED_POOLS } from "./consts";
import { BN } from "@coral-xyz/anchor";
import { IActive, IClosed, IPoolAndTicks, IPositions } from "./types";
import {
  calculatePointsToDistribute,
  calculateReward,
  calculateSecondsPerLiquidityInside,
} from "./math";
import {
  CreatePositionEvent,
  RemovePositionEvent,
} from "@invariant-labs/sdk-eclipse/lib/market";

export const fetchAllSignatures = async (
  connection: Connection,
  programId: PublicKey,
  lastTxHash: string | undefined
) => {
  const allSignatures: ConfirmedSignatureInfo[] = [];
  let beforeTxHash: string | undefined = undefined;
  let done: boolean = false;

  while (!done) {
    const signatures = await connection.getSignaturesForAddress(
      programId,
      { before: beforeTxHash, until: lastTxHash },
      "confirmed"
    );

    if (signatures.length === 0) {
      done = true;
      break;
    }

    allSignatures.push(...signatures);
    if (lastTxHash === undefined) {
      done = true;
      break;
    }
    if (signatures[signatures.length - 1].signature === lastTxHash) {
      done = true;
    } else {
      beforeTxHash = signatures[signatures.length - 1].signature;
    }
  }

  return allSignatures.map((signatureInfo) => signatureInfo.signature);
};

export const processParsedTransactions = (
  parsedTransactions: (ParsedTransactionWithMeta | null)[]
) => {
  return parsedTransactions
    .filter((tx) => tx?.meta?.logMessages && tx.transaction.signatures[0])
    .map((tx) => {
      return tx!.meta!.logMessages!;
    });
};

export const fetchTransactionLogs = async (
  connection: Connection,
  signatures: string[],
  batchSize: number
) => {
  const batchCount = Math.ceil(signatures.length / batchSize);
  const batchedSignatures = new Array(batchCount).fill(0);

  return (
    await Promise.all(
      batchedSignatures.map(async (_, idx) => {
        const batchSignatures = signatures.slice(
          idx * batchSize,
          (idx + 1) * batchSize
        );
        return processParsedTransactions(
          await connection.getParsedTransactions(batchSignatures, "confirmed")
        );
      })
    )
  ).flat();
};

export const convertJson = (previousData: any) => {
  const updatedData: Record<string, IPositions> = {};

  for (const userId in previousData) {
    const userPools = previousData[userId];

    const updatedActive = userPools.active.map((activeEntry: any) => {
      const updatedEvent = {
        ...activeEntry.event,
        id: new BN(activeEntry.event.id, "hex"),
        owner: new PublicKey(activeEntry.event.owner),
        pool: new PublicKey(activeEntry.event.pool),
        liquidity: new BN(activeEntry.event.liquidity, "hex"),
        currentTimestamp: new BN(activeEntry.event.currentTimestamp, "hex"),
      };
      return { event: updatedEvent, points: new BN(activeEntry.points, "hex") };
    });

    updatedData[userId] = {
      active: updatedActive,
      closed: userPools.closed,
    };
  }
  return updatedData;
};

export const isPromotedPool = (pool: PublicKey) =>
  PROMOTED_POOLS.some(
    (promotedPool) => promotedPool.toString() === pool.toString()
  );

export const processStillOpen = (
  stillOpen: IActive[],
  poolsWithTicks: IPoolAndTicks[],
  currentTimestamp: BN,
  lastSnapTimestamp: BN
) => {
  const updatedStillOpen: IActive[] = [];

  stillOpen.forEach((entry) => {
    const desiredPoolWithTicks = poolsWithTicks.find(
      (poolWithTicks) =>
        poolWithTicks.pool.toString() === entry.event.pool.toString()
    )!;
    const upperTick = desiredPoolWithTicks.ticks.find(
      (tick) => tick.index === entry.event.upperTick
    )!;
    const lowerTick = desiredPoolWithTicks.ticks.find(
      (tick) => tick.index === entry.event.lowerTick
    )!;
    const poolStructure = desiredPoolWithTicks.poolStructure;
    updatedStillOpen.push({
      event: entry.event,
      points: calculateReward(
        entry.event.liquidity,
        entry.points,
        calculateSecondsPerLiquidityInside(
          upperTick.index,
          lowerTick.index,
          poolStructure.currentTickIndex,
          upperTick.secondsPerLiquidityOutside,
          lowerTick.secondsPerLiquidityOutside,
          poolStructure.secondsPerLiquidityGlobal
        ),
        calculatePointsToDistribute(lastSnapTimestamp, currentTimestamp),
        currentTimestamp.sub(lastSnapTimestamp)
      ),
    });
  });

  return updatedStillOpen;
};

export const processNewOpen = (
  newOpen: CreatePositionEvent[],
  poolsWithTicks: IPoolAndTicks[],
  currentTimestamp: BN,
  lastSnapTimestamp: BN
) => {
  const updatedNewOpen: IActive[] = [];

  newOpen.forEach((entry) => {
    const desiredPoolWithTicks = poolsWithTicks.find(
      (poolWithTicks) => poolWithTicks.pool.toString() === entry.pool.toString()
    )!;
    const upperTick = desiredPoolWithTicks.ticks.find(
      (tick) => tick.index === entry.upperTick
    )!;
    const lowerTick = desiredPoolWithTicks.ticks.find(
      (tick) => tick.index === entry.lowerTick
    )!;
    const poolStructure = desiredPoolWithTicks.poolStructure;
    updatedNewOpen.push({
      event: entry,
      points: calculateReward(
        entry.liquidity,
        new BN(0),
        calculateSecondsPerLiquidityInside(
          upperTick.index,
          lowerTick.index,
          poolStructure.currentTickIndex,
          upperTick.secondsPerLiquidityOutside,
          lowerTick.secondsPerLiquidityOutside,
          poolStructure.secondsPerLiquidityGlobal
        ),
        calculatePointsToDistribute(entry.currentTimestamp, currentTimestamp),
        currentTimestamp.sub(entry.currentTimestamp)
      ),
    });
  });

  return updatedNewOpen;
};

export const processNewClosed = (
  newClosed: [IActive, RemovePositionEvent][],
  currentTimestamp: BN,
  lastSnapTimestamp: BN
) => {
  const updatedNewClosed: IClosed[] = [];

  newClosed.forEach((entry) => {
    updatedNewClosed.push({
      events: [entry[0].event, entry[1]],
      points: calculateReward(
        entry[1].liquidity,
        entry[0].points,
        calculateSecondsPerLiquidityInside(
          entry[1].upperTick,
          entry[1].lowerTick,
          entry[1].currentTick,
          entry[1].upperTickSecondsPerLiquidityOutside,
          entry[1].lowerTickSecondsPerLiquidityOutside,
          entry[1].poolSecondsPerLiquidityGlobal
        ),
        calculatePointsToDistribute(
          lastSnapTimestamp,
          entry[1].currentTimestamp
        ),
        entry[1].currentTimestamp.sub(lastSnapTimestamp)
      ),
    });
  });

  return updatedNewClosed;
};

export const processNewOpenClosed = (
  newOpenClosed: [CreatePositionEvent | null, RemovePositionEvent][],
  currentTimestamp: BN,
  lastSnapTimestamp: BN
) => {
  const updatedNewOpenClosed: IClosed[] = [];

  newOpenClosed.forEach((entry) => {
    updatedNewOpenClosed.push({
      events: [entry[0], entry[1]],
      points: calculateReward(
        entry[1].liquidity,
        new BN(0),
        calculateSecondsPerLiquidityInside(
          entry[1].upperTick,
          entry[1].lowerTick,
          entry[1].currentTick,
          entry[1].upperTickSecondsPerLiquidityOutside,
          entry[1].lowerTickSecondsPerLiquidityOutside,
          entry[1].poolSecondsPerLiquidityGlobal
        ),
        calculatePointsToDistribute(
          entry[0]?.currentTimestamp ?? new BN(0),
          entry[1].currentTimestamp
        ),
        entry[1].currentTimestamp.sub(entry[0]?.currentTimestamp ?? new BN(0))
      ),
    });
  });

  return updatedNewOpenClosed;
};
