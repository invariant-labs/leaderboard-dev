import {
  CreatePositionEvent,
  Market,
  PoolStructure,
  RemovePositionEvent,
  Tick,
} from "@invariant-labs/sdk-eclipse/lib/market";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const MAX_U128 = new BN("340282366920938463463374607431768211455");
const SECONDS_PER_LIQUIDITY_DECIMAL = 24;
const LIQUIDITY_DECIMAL = 6;
const LIQUIDITY_DENOMINATOR = new BN(10).pow(new BN(LIQUIDITY_DECIMAL));
const SECONDS_PER_LIQUIDITY_DENOMINATOR = new BN(10).pow(
  new BN(SECONDS_PER_LIQUIDITY_DECIMAL)
);

export const POINTS_PER_SECONDS = new BN(1000);

export const calculateReward = (
  liquidity: BN,
  secondsPerLiquidityInsideInitial: BN,
  secondsPerLiquidityInside: BN
): BN => {
  const secondsInside = wrappingSub(
    secondsPerLiquidityInside,
    secondsPerLiquidityInsideInitial
  )
    .mul(liquidity)
    .div(SECONDS_PER_LIQUIDITY_DENOMINATOR)
    .div(LIQUIDITY_DENOMINATOR);

  const points = POINTS_PER_SECONDS.mul(secondsInside);

  return points;
};

export const calculateSecondsPerLiquidityGlobal = (
  currentSecondsPerLiquidityGlobal: BN,
  liquidity: BN,
  lastTimestamp: BN
): BN => {
  const now = getTimestampInSeconds();
  const deltaTime = now
    .sub(lastTimestamp)
    .mul(SECONDS_PER_LIQUIDITY_DENOMINATOR);
  const newSecondsPerLiquidityGlobal = wrappingAdd(
    currentSecondsPerLiquidityGlobal,
    deltaTime.div(liquidity)
  );
  return newSecondsPerLiquidityGlobal;
};

export const calculateSecondsPerLiquidityInside = (
  upperTick: number,
  lowerTick: number,
  currentTick: number,
  upperTickSecondsPerLiquidityOutside: BN,
  lowerTickSecondsPerLiquidityOutside: BN,
  poolSecondsPerLiquidityGlobal: BN
): BN => {
  const currentAboveLower = currentTick >= lowerTick;
  const currentBelowUpper = currentTick < upperTick;

  let secondsPerLiquidityBelow, secondsPerLiquidityAbove;

  if (currentAboveLower) {
    secondsPerLiquidityBelow = lowerTickSecondsPerLiquidityOutside;
  } else {
    secondsPerLiquidityBelow = wrappingSub(
      poolSecondsPerLiquidityGlobal,
      lowerTickSecondsPerLiquidityOutside
    );
  }

  if (currentBelowUpper) {
    secondsPerLiquidityAbove = upperTickSecondsPerLiquidityOutside;
  } else {
    secondsPerLiquidityAbove = wrappingSub(
      poolSecondsPerLiquidityGlobal,
      upperTickSecondsPerLiquidityOutside
    );
  }

  return wrappingSub(
    wrappingSub(poolSecondsPerLiquidityGlobal, secondsPerLiquidityBelow),
    secondsPerLiquidityAbove
  );
};

const getTimestampInSeconds = (): BN => {
  return new BN(Math.floor(Date.now() / 1000));
};

const wrappingSub = (a: BN, b: BN): BN => {
  if (b.gt(a)) {
    return MAX_U128.sub(b.sub(a)).add(1);
  } else {
    return a.sub(b);
  }
};

const wrappingAdd = (a: BN, b: BN): BN => {
  if (b.gt(MAX_U128.sub(a))) {
    return b.sub(MAX_U128.sub(a)).sub(1);
  } else {
    return a.add(b);
  }
};

export const calculatePointsForClosedPosition = (
  event: RemovePositionEvent
) => {
  const {
    upperTick,
    liquidity,
    lowerTick,
    poolSecondsPerLiquidityGlobal,
    upperTickSecondsPerLiquidityOutside,
    lowerTickSecondsPerLiquidityOutside,
    currentTick,
  } = event;
  const secondsPerLiquidityInside = calculateSecondsPerLiquidityInside(
    upperTick,
    lowerTick,
    currentTick,
    upperTickSecondsPerLiquidityOutside,
    lowerTickSecondsPerLiquidityOutside,
    poolSecondsPerLiquidityGlobal
  );
  const reward = calculateReward(
    liquidity,
    new BN(0),
    secondsPerLiquidityInside
  );
  return reward;
};

export const calculatePointsForOpenPosition = (
  event: CreatePositionEvent,
  pool: PoolStructure,
  upperTick: Tick,
  lowerTick: Tick
) => {
  const secondsPerLiquidityGlobal = calculateSecondsPerLiquidityGlobal(
    pool.secondsPerLiquidityGlobal,
    pool.liquidity,
    pool.lastTimestamp
  );

  const secondsPerLiquidityInside = calculateSecondsPerLiquidityInside(
    event.upperTick,
    event.lowerTick,
    pool.currentTickIndex,
    upperTick.secondsPerLiquidityOutside,
    lowerTick.secondsPerLiquidityOutside,
    secondsPerLiquidityGlobal
  );
  const reward = calculateReward(
    event.liquidity,
    new BN(0),
    secondsPerLiquidityInside
  );
  return reward;
};
