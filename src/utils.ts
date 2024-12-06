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
  const updatedData = {};

  for (const userId in previousData) {
    const userPools = previousData[userId];

    const updatedActive = userPools.active.map((activeEntry: any) => {
      const updatedEvent = {
        ...activeEntry.event,
        id: new BN(activeEntry.event.id, "hex"),
      };
      return { event: updatedEvent };
    });

    const updatedClosed = userPools.closed.map((closedEntry: any) => {
      const updatedEvents = closedEntry.events.map((event: any) => ({
        ...event,
        id: new BN(event.id, "hex"),
      }));
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
  previousData: any,
  market: Market,
  transactionLog: string[]
) => {
  const eventsObject: any = convertJson(previousData);
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
      case InvariantEventNames.CreatePositionEvent:
        const parsedCreateEvent: CreatePositionEvent = parseEvent(decodedEvent);
        if (
          PROMOTED_POOLS.every(
            (pool) => pool.toString() !== parsedCreateEvent.pool.toString()
          )
        )
          return;

        if (!!eventsObject[parsedCreateEvent.owner.toString()]) {
          const correspondingItem = eventsObject[
            parsedCreateEvent.owner.toString()
          ].closed.find((item) => item.events[1].id.eq(parsedCreateEvent.id));
          if (correspondingItem) {
            const correspondingIndex = eventsObject[
              parsedCreateEvent.owner.toString()
            ].closed.findIndex((item) =>
              item.events[1].id.eq(parsedCreateEvent.id)
            );
            eventsObject[parsedCreateEvent.owner.toString()].closed.splice(
              correspondingIndex,
              1
            );
            eventsObject[parsedCreateEvent.owner.toString()].closed.push({
              events: [parsedCreateEvent, correspondingItem.events[1]],
            });
            return;
          }
          eventsObject[parsedCreateEvent.owner.toString()].active.push({
            event: parsedCreateEvent,
          });
          return;
        }
        eventsObject[parsedCreateEvent.owner.toString()] = {
          active: [
            {
              event: parsedCreateEvent,
            },
          ],
          closed: [],
        };
        break;
      case InvariantEventNames.RemovePositionEvent:
        //@ts-expect-error
        const parsedRemoveEvent: RemovePositionEvent = parseEvent(decodedEvent);
        if (
          PROMOTED_POOLS.every(
            (pool) => pool.toString() !== parsedRemoveEvent.pool.toString()
          )
        )
          return;
        if (!!eventsObject[parsedRemoveEvent.owner.toString()]) {
          const correspondingItem = eventsObject[
            parsedRemoveEvent.owner.toString()
          ].active.find((item) => item.event.id.eq(parsedRemoveEvent.id));

          eventsObject[parsedRemoveEvent.owner.toString()].closed.push({
            events: [correspondingItem?.event || null, parsedRemoveEvent],
          });
          if (correspondingItem) {
            const correspondingIndex = eventsObject[
              parsedRemoveEvent.owner.toString()
            ].active.findIndex((item) =>
              item.event.id.eq(parsedRemoveEvent.id)
            );
            eventsObject[parsedRemoveEvent.owner.toString()].active.splice(
              correspondingIndex,
              1
            );
          }
          return;
        }
        eventsObject[parsedRemoveEvent.owner.toString()] = {
          active: [],
          closed: [{ events: [null, parsedRemoveEvent] }],
        };
        break;
      default:
        return;
    }
  });
  return eventsObject;
};
