import {
  CreatePositionEvent,
  InvariantEventNames,
  Market,
  parseEvent,
  RemovePositionEvent,
} from "@invariant-labs/sdk-eclipse";
import {
  Connection,
  PublicKey,
  ConfirmedSignatureInfo,
  ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { PROMOTED_POOLS } from "./consts";
import { BN } from "@coral-xyz/anchor";
import { IPositions } from "./types";

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
        liquidity: new BN(activeEntry.event.liquidity, "hex"),
        currentTimestamp: new BN(activeEntry.event.currentTimestamp, "hex"),
      };
      return { event: updatedEvent };
    });

    const updatedClosed = userPools.closed.map((closedEntry: any) => {
      const openEvent = !closedEntry.events[0]
        ? closedEntry.events[0]
        : {
            ...closedEntry.events[0],
            id: new BN(closedEntry.events[0].id, "hex"),
            liquidity: new BN(closedEntry.events[0].liquidity, "hex"),
            currentTimestamp: new BN(
              closedEntry.events[0].currentTimestamp,
              "hex"
            ),
          };
      const closeEvent = {
        ...closedEntry.events[1],
        id: new BN(closedEntry.events[1].id, "hex"),
        liquidity: new BN(closedEntry.events[1].liquidity, "hex"),
        currentTimestamp: new BN(closedEntry.events[1].currentTimestamp, "hex"),
        upperTickSecondsPerLiquidityOutside: new BN(
          closedEntry.events[1].upperTickSecondsPerLiquidityOutside,
          "hex"
        ),
        lowerTickSecondsPerLiquidityOutside: new BN(
          closedEntry.events[1].lowerTickSecondsPerLiquidityOutside,
          "hex"
        ),
        poolSecondsPerLiquidityGlobal: new BN(
          closedEntry.events[1].poolSecondsPerLiquidityGlobal,
          "hex"
        ),
      };
      const updatedEvents = [openEvent, closeEvent];
      return { events: updatedEvents };
    });

    updatedData[userId] = {
      active: updatedActive,
      closed: updatedClosed,
    };
  }
  return updatedData;
};

export const extractEvents = (
  previousData: Record<string, IPositions>,
  market: Market,
  transactionLog: string[]
) => {
  const eventsObject: Record<string, IPositions> = previousData;
  const eventLogs = transactionLog.filter((log) =>
    log.startsWith("Program data:")
  );
  eventLogs.forEach((eventLog) => {
    const decodedEvent = market.eventDecoder.decode(
      eventLog.split("Program data: ")[1]
    );
    if (!decodedEvent) {
      return;
    }

    switch (decodedEvent.name) {
      case InvariantEventNames.CreatePositionEvent: {
        const parsedCreateEvent: CreatePositionEvent = parseEvent(decodedEvent);
        const { pool, owner, id } = parsedCreateEvent;
        const ownerKey = owner.toString();
        if (
          PROMOTED_POOLS.every(
            (promotedPool) => promotedPool.toString() !== pool.toString()
          )
        )
          return;

        if (!!eventsObject[ownerKey]) {
          const correspondingItem = eventsObject[ownerKey].closed.find((item) =>
            item.events[1].id.eq(id)
          );
          if (correspondingItem) {
            const correspondingIndex = eventsObject[ownerKey].closed.findIndex(
              (item) => item.events[1].id.eq(id)
            );
            eventsObject[ownerKey].closed.splice(correspondingIndex, 1);
            eventsObject[ownerKey].closed.push({
              events: [parsedCreateEvent, correspondingItem.events[1]],
            });
            return;
          }
          eventsObject[ownerKey].active.push({
            event: parsedCreateEvent,
          });
          return;
        }
        eventsObject[ownerKey] = {
          active: [
            {
              event: parsedCreateEvent,
            },
          ],
          closed: [],
        };
        break;
      }
      case InvariantEventNames.RemovePositionEvent: {
        const parsedRemoveEvent: RemovePositionEvent = parseEvent(
          decodedEvent
        ) as RemovePositionEvent;
        const { pool, owner, id } = parsedRemoveEvent;
        const ownerKey = owner.toString();
        if (
          PROMOTED_POOLS.every(
            (promotedPool) => promotedPool.toString() !== pool.toString()
          )
        )
          return;
        if (!!eventsObject[ownerKey]) {
          const correspondingItem = eventsObject[ownerKey].active.find((item) =>
            item.event.id.eq(id)
          );
          eventsObject[ownerKey].closed.push({
            events: [correspondingItem?.event || null, parsedRemoveEvent],
          });
          if (correspondingItem) {
            const correspondingIndex = eventsObject[ownerKey].active.findIndex(
              (item) => item.event.id.eq(id)
            );
            eventsObject[ownerKey].active.splice(correspondingIndex, 1);
          }
          return;
        }
        eventsObject[ownerKey] = {
          active: [],
          closed: [{ events: [null, parsedRemoveEvent] }],
        };
        break;
      }
      default:
        return;
    }
  });
  return eventsObject;
};
