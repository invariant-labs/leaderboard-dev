import { Market } from "@invariant-labs/sdk-eclipse";
import {
  Connection,
  PublicKey,
  ConfirmedSignatureInfo,
  ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { PROMOTED_POOLS } from "./consts";
import { BN } from "@coral-xyz/anchor";
import { IPositions } from "./types";
import {
  calculatePointsForClosedPosition,
  calculatePointsForOpenPosition,
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
      };
      return { event: updatedEvent, points: activeEntry.points };
    });

    const updatedClosed = userPools.closed.map((closedEntry: any) => {
      if (!!closedEntry.events[0]) return closedEntry;

      const closeEvent = {
        ...closedEntry.events[1],
        id: new BN(closedEntry.events[1].id, "hex"),
      };
      const updatedEvents = [null, closeEvent];
      return { events: updatedEvents, points: closedEntry.points };
    });

    updatedData[userId] = {
      active: updatedActive,
      closed: updatedClosed,
    };
  }
  return updatedData;
};

export const isPromotedPool = (pool: PublicKey) =>
  PROMOTED_POOLS.some(
    (promotedPool) => promotedPool.toString() === pool.toString()
  );

export const processCreatePositionEvent = async (
  event: CreatePositionEvent,
  eventsObject: Record<string, IPositions>,
  market: Market
) => {
  const { pool, owner, id } = event;
  if (!isPromotedPool(pool)) return;

  const ownerKey = owner.toString();
  const ownerData = eventsObject[ownerKey] || { active: [], closed: [] };

  const correspondingItemIndex = ownerData.closed.findIndex((item) =>
    item.events[1].id.eq(id)
  );

  if (correspondingItemIndex >= 0) {
    const correspondingItem = ownerData.closed[correspondingItemIndex];
    ownerData.closed.splice(correspondingItemIndex, 1);
    ownerData.closed.push({
      events: [event, correspondingItem.events[1]],
      points: calculatePointsForClosedPosition(correspondingItem.events[1]),
    });
  } else {
    const points = await calculatePointsForOpenPosition(event, market);
    ownerData.active.push({
      event,
      points: points,
    });
  }

  eventsObject[ownerKey] = ownerData;
};

export const processRemovePositionEvent = (
  event: RemovePositionEvent,
  eventsObject: Record<string, IPositions>
) => {
  const { pool, owner, id } = event;
  if (!isPromotedPool(pool)) return;

  const ownerKey = owner.toString();
  const ownerData = eventsObject[ownerKey] || { active: [], closed: [] };

  const correspondingItemIndex = ownerData.active.findIndex((item) =>
    item.event.id.eq(id)
  );

  const correspondingEvent =
    correspondingItemIndex >= 0
      ? ownerData.active.splice(correspondingItemIndex, 1)[0]?.event
      : null;

  ownerData.closed.push({
    events: [correspondingEvent, event],
    points: calculatePointsForClosedPosition(event),
  });

  eventsObject[ownerKey] = ownerData;
};
