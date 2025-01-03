import {
  Network,
  Market,
  getMarketAddress,
  IWallet,
  InvariantEventNames,
  parseEvent,
  Pair,
} from "@invariant-labs/sdk-eclipse";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import {
  DAY,
  MAX_SIGNATURES_PER_CALL,
  PROMOTED_POOLS_TESTNET,
  PROMOTED_POOLS_MAINNET,
  FULL_SNAP_START_TX_HASH_MAINNET,
  FULL_SNAP_START_TX_HASH_TESTNET,
} from "./consts";
import {
  fetchAllSignatures,
  fetchTransactionLogs,
  processStillOpen,
  processNewOpen,
  processNewClosed,
  processNewOpenClosed,
  retryOperation,
} from "./utils";
import {
  IActive,
  ILastSnapData,
  IPoints,
  IPointsJson,
  IPoolAndTicks,
  IPositions,
  IPromotedPool,
} from "./types";
import {
  CreatePositionEvent,
  PoolStructure,
  RemovePositionEvent,
  Tick,
} from "@invariant-labs/sdk-eclipse/lib/market";
import { getTimestampInSeconds, POINTS_DENOMINATOR } from "./math";

// eslint-disable-next-line @typescript-eslint/no-var-requires
require("dotenv").config();

export const createSnapshotForNetwork = async (network: Network) => {
  let provider: AnchorProvider;
  let eventsSnapFilename: string;
  let pointsFileName: string;
  let PROMOTED_POOLS: IPromotedPool[];
  let poolsFileName: string;
  let lastSnapDataFile: string;
  let FULL_SNAP_START_TX_HASH: string;
  switch (network) {
    case Network.MAIN:
      provider = AnchorProvider.local("https://eclipse.helius-rpc.com");
      eventsSnapFilename = path.join(
        __dirname,
        "../data/events_snap_mainnet.json"
      );
      pointsFileName = path.join(__dirname, "../data/points_mainnet.json");
      poolsFileName = path.join(
        __dirname,
        "../data/pools_last_tx_hashes_mainnet.json"
      );
      lastSnapDataFile = path.join(
        __dirname,
        "../data/last_snap_data_mainnet.json"
      );
      PROMOTED_POOLS = PROMOTED_POOLS_MAINNET;
      FULL_SNAP_START_TX_HASH = FULL_SNAP_START_TX_HASH_MAINNET;
      break;
    case Network.TEST:
      provider = AnchorProvider.local(
        "https://testnet.dev2.eclipsenetwork.xyz"
      );
      eventsSnapFilename = path.join(
        __dirname,
        "../data/events_snap_testnet.json"
      );
      pointsFileName = path.join(__dirname, "../data/points_testnet.json");
      poolsFileName = path.join(
        __dirname,
        "../data/pools_last_tx_hashes_testnet.json"
      );
      lastSnapDataFile = path.join(
        __dirname,
        "../data/last_snap_data_testnet.json"
      );
      PROMOTED_POOLS = PROMOTED_POOLS_TESTNET;
      FULL_SNAP_START_TX_HASH = FULL_SNAP_START_TX_HASH_TESTNET;
      break;
    default:
      throw new Error("Unknown network");
  }

  const connection = provider.connection;
  const programId = new PublicKey(getMarketAddress(network));

  const market = Market.build(
    network,
    provider.wallet as IWallet,
    connection,
    programId
  );

  const previousPools: Record<string, string | undefined> = JSON.parse(
    fs.readFileSync(poolsFileName, "utf-8")
  );

  const eventsObject: Record<string, IPositions> = JSON.parse(
    fs.readFileSync(eventsSnapFilename, "utf-8")
  );

  const newPoolsFile = {};
  const sigs = (
    await Promise.all(
      PROMOTED_POOLS.map(({ address }) => {
        const refAddr = market.getEventOptAccount(address).address;
        const previousTxHash =
          previousPools[address.toString()] ?? FULL_SNAP_START_TX_HASH;
        return retryOperation(
          fetchAllSignatures(connection, refAddr, previousTxHash)
        ).then((signatures) => {
          if (signatures.length > 0) {
            newPoolsFile[address.toString()] = signatures[0];
          } else {
            newPoolsFile[address.toString()] = previousTxHash;
          }
          return signatures;
        });
      })
    )
  ).flat();

  const txLogs = await retryOperation(
    fetchTransactionLogs(connection, sigs, MAX_SIGNATURES_PER_CALL)
  );

  const finalLogs = txLogs.flat();

  const eventLogs: string[] = [];

  finalLogs.map((log, index) => {
    if (
      log.startsWith("Program data:") &&
      finalLogs[index + 1].startsWith(
        `Program ${market.program.programId.toBase58()}`
      )
    )
      eventLogs.push(log.split("Program data: ")[1]);
  });

  const decodedEvents = eventLogs
    .map((log) => market.eventDecoder.decode(log))
    .filter((decodedEvent) => !!decodedEvent);

  const { newOpen, newClosed, newOpenClosed } = decodedEvents.reduce<{
    newOpen: CreatePositionEvent[];
    newClosed: [IActive, RemovePositionEvent][];
    newOpenClosed: [CreatePositionEvent | null, RemovePositionEvent][];
  }>(
    (acc, curr) => {
      if (curr.name === InvariantEventNames.CreatePositionEvent) {
        const event = parseEvent(curr) as CreatePositionEvent;
        const owner = event.owner.toString();
        if (
          !!eventsObject[owner] &&
          eventsObject[owner].active.some(
            (entry) =>
              entry.event.pool.toString() === event.pool.toString() &&
              new BN(entry.event.id, "hex").eq(event.id)
          )
        )
          return acc;
        const correspondingItemIndex = acc.newOpenClosed.findIndex(
          (item) =>
            item[1].id.eq(event.id) &&
            item[1].pool.toString() === event.pool.toString()
        );
        if (correspondingItemIndex >= 0) {
          const correspondingItem = acc.newOpenClosed[correspondingItemIndex];
          acc.newOpenClosed.splice(correspondingItemIndex, 1);
          acc.newOpenClosed.push([event, correspondingItem[1]]);
          return acc;
        }
        acc.newOpen.push(event);
        return acc;
      } else if (curr.name === InvariantEventNames.RemovePositionEvent) {
        const event = parseEvent(curr) as RemovePositionEvent;
        const ownerKey = event.owner.toString();
        const ownerData = eventsObject[ownerKey] || {
          active: [],
          closed: [],
        };
        const correspondingItemIndex = acc.newOpen.findIndex(
          (item) =>
            item.id.eq(event.id) &&
            item.pool.toString() === event.pool.toString()
        );
        if (correspondingItemIndex >= 0) {
          const correspondingItem = acc.newOpen[correspondingItemIndex];
          acc.newOpen.splice(correspondingItemIndex, 1);
          acc.newOpenClosed.push([correspondingItem, event]);
          return acc;
        }
        const correspondingItemIndexPreviousData = ownerData.active.findIndex(
          (item) =>
            new BN(item.event.id, "hex").eq(event.id) &&
            item.event.pool.toString() === event.pool.toString()
        );

        if (correspondingItemIndexPreviousData >= 0) {
          const correspondingItem =
            ownerData.active[correspondingItemIndexPreviousData];
          acc.newClosed.push([
            {
              event: {
                ...correspondingItem.event,
                id: new BN(correspondingItem.event.id, "hex"),
                owner: new PublicKey(correspondingItem.event.owner),
                pool: new PublicKey(correspondingItem.event.pool),
                liquidity: new BN(correspondingItem.event.liquidity, "hex"),
                currentTimestamp: new BN(
                  correspondingItem.event.currentTimestamp,
                  "hex"
                ),
                secondsPerLiquidityInsideInitial: new BN(
                  correspondingItem.event.secondsPerLiquidityInsideInitial,
                  "hex"
                ),
              },
              points: new BN(correspondingItem.points, "hex"),
            },
            event,
          ]);
          return acc;
        }
        acc.newOpenClosed.push([null, event]);
        return acc;
      }
      return acc;
    },
    { newOpen: [], newClosed: [], newOpenClosed: [] }
  );

  const stillOpen: IActive[] = [];

  Object.values(eventsObject).forEach((positions) =>
    positions.active.forEach((activeEntry) => {
      const hasBeenClosed = newClosed.some(
        (newClosedEntry) =>
          newClosedEntry[0].event.id.eq(new BN(activeEntry.event.id, "hex")) &&
          newClosedEntry[0].event.pool.toString() ===
            activeEntry.event.pool.toString()
      );
      if (!hasBeenClosed) {
        stillOpen.push({
          event: {
            ...activeEntry.event,
            id: new BN(activeEntry.event.id, "hex"),
            owner: new PublicKey(activeEntry.event.owner),
            pool: new PublicKey(activeEntry.event.pool),
            liquidity: new BN(activeEntry.event.liquidity, "hex"),
            currentTimestamp: new BN(activeEntry.event.currentTimestamp, "hex"),
            secondsPerLiquidityInsideInitial: new BN(
              activeEntry.event.secondsPerLiquidityInsideInitial,
              "hex"
            ),
          },
          points: new BN(activeEntry.points, "hex"),
        });
      }
    })
  );

  const poolsWithTicks: IPoolAndTicks[] = await Promise.all(
    PROMOTED_POOLS.map(async ({ address, pointsPerSecond }) => {
      const poolStructure: PoolStructure = await retryOperation(
        market.getPoolByAddress(address)
      );
      const ticks: Tick[] = await retryOperation(
        market.getAllTicks(
          new Pair(poolStructure.tokenX, poolStructure.tokenY, {
            fee: poolStructure.fee,
            tickSpacing: poolStructure.tickSpacing,
          })
        )
      );

      return {
        pool: address,
        poolStructure: poolStructure,
        ticks,
        pointsPerSecond,
      };
    })
  );

  const currentTimestamp = getTimestampInSeconds();

  const updatedStillOpen = processStillOpen(
    stillOpen,
    poolsWithTicks,
    currentTimestamp
  );

  const updatedNewOpen = processNewOpen(
    newOpen,
    poolsWithTicks,
    currentTimestamp
  );

  const updatedNewClosed = processNewClosed(newClosed, poolsWithTicks);

  const updatedNewOpenClosed = processNewOpenClosed(
    newOpenClosed,
    poolsWithTicks
  );

  Object.keys(eventsObject).forEach((key) => {
    eventsObject[key].active = [];
  });
  updatedStillOpen.forEach((entry) => {
    const ownerKey = entry.event.owner.toString();
    if (!eventsObject[ownerKey]) {
      eventsObject[ownerKey] = { active: [], closed: [] };
    }
    eventsObject[ownerKey].active.push(entry);
  });
  updatedNewOpen.forEach((entry) => {
    const ownerKey = entry.event.owner.toString();
    if (!eventsObject[ownerKey]) {
      eventsObject[ownerKey] = { active: [], closed: [] };
    }
    eventsObject[ownerKey].active.push(entry);
  });
  updatedNewClosed.forEach((entry) => {
    const ownerKey = entry.events[1].owner.toString();
    if (!eventsObject[ownerKey]) {
      eventsObject[ownerKey] = { active: [], closed: [] };
    }
    eventsObject[ownerKey].closed.push(entry);
  });
  updatedNewOpenClosed.forEach((entry) => {
    const ownerKey = entry.events[1].owner.toString();
    if (!eventsObject[ownerKey]) {
      eventsObject[ownerKey] = { active: [], closed: [] };
    }
    eventsObject[ownerKey].closed.push(entry);
  });

  const previousPoints: Record<string, IPointsJson> = JSON.parse(
    fs.readFileSync(pointsFileName, "utf-8")
  );
  const points: Record<string, IPoints> = Object.keys(eventsObject).reduce(
    (acc, curr) => {
      const prev24HoursHistory = previousPoints[curr]?.points24HoursHistory;
      if (prev24HoursHistory) {
        prev24HoursHistory.forEach((item, idx) => {
          if (new BN(item.timestamp, "hex").add(DAY).lt(currentTimestamp)) {
            prev24HoursHistory.splice(idx, 1);
          }
        });
      }
      const previousTotalPoints: BN =
        new BN(previousPoints[curr]?.totalPoints, "hex") ?? new BN(0);

      const pointsForOpen: BN[] = eventsObject[curr].active.map(
        (entry) => entry.points
      );
      const pointsForClosed: BN[] = eventsObject[curr].closed.map(
        (entry) => entry.points
      );

      const totalPoints = pointsForOpen
        .concat(pointsForClosed)
        .reduce((sum, point) => sum.add(new BN(point, "hex")), new BN(0));

      acc[curr] = {
        totalPoints,
        positionsAmount: eventsObject[curr].active.length,
        points24HoursHistory: prev24HoursHistory
          ? [
              ...prev24HoursHistory,
              {
                diff: totalPoints.sub(previousTotalPoints),
                timestamp: currentTimestamp,
              },
            ]
          : [
              {
                diff: totalPoints.sub(previousTotalPoints),
                timestamp: currentTimestamp,
              },
            ],
      };
      return acc;
    },
    {}
  );

  const lastSnapData: ILastSnapData = JSON.parse(
    fs.readFileSync(lastSnapDataFile, "utf-8")
  );

  const { lastSnapTimestamp } = lastSnapData;

  const snapTimeDifference: BN = currentTimestamp.sub(
    new BN(lastSnapTimestamp, "hex")
  );

  const areActivePositionsInPools = PROMOTED_POOLS.map((pool) => {
    return {
      pointsPerSecond: pool.pointsPerSecond,
      hasActiveEntry: Object.keys(eventsObject).some((key) =>
        eventsObject[key].active.some(
          (entry) => entry.event.pool.toString() === pool.address.toString()
        )
      ),
    };
  });

  const lastPointsThatShouldHaveBeenDistributed: BN =
    areActivePositionsInPools.reduce((acc, curr) => {
      if (curr.hasActiveEntry) {
        return acc.add(snapTimeDifference.mul(curr.pointsPerSecond));
      }
      return acc;
    }, new BN(0));

  const lastPointsDistributed = Object.keys(points)
    .reduce((acc, curr) => {
      const pointsToAdd = points[curr].points24HoursHistory.find(
        (item) => item.timestamp === currentTimestamp
      )!.diff;
      return acc.add(pointsToAdd);
    }, new BN(0))
    .div(POINTS_DENOMINATOR);

  const snapData = {
    lastSnapTimestamp: currentTimestamp,
    lastPointsDistributed,
    lastPointsThatShouldHaveBeenDistributed,
  };

  fs.writeFileSync(lastSnapDataFile, JSON.stringify(snapData, null, 2));
  fs.writeFileSync(poolsFileName, JSON.stringify(newPoolsFile, null, 2));
  fs.writeFileSync(eventsSnapFilename, JSON.stringify(eventsObject, null, 2));
  fs.writeFileSync(pointsFileName, JSON.stringify(points, null, 2));
};

// createSnapshotForNetwork(Network.TEST).then(
//   () => {
//     console.log("Eclipse: Testnet snapshot done!");
//   },
//   (err) => {
//     console.log(err);
//   }
// );

createSnapshotForNetwork(Network.MAIN).then(
  () => {
    console.log("Eclipse: Mainnet snapshot done!");
  },
  (err) => {
    console.log(err);
  }
);
