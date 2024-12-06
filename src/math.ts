import BN from "bn.js";

// 24 SECONDS PER LIQUIDITY + 6 LIQUIDITY
export const SCALE_TO_REMOVE = new BN(10).pow(new BN(30));
export const SECONDS_PER_LIQUIDITY_SCALE = new BN(10).pow(new BN(24));
export const POINTS_PER_SECONDS = new BN(1000);
const MAX_U128 = new BN("340282366920938463463374607431768211455");

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
    .div(SCALE_TO_REMOVE);

  const points = POINTS_PER_SECONDS.mul(secondsInside);

  return points;
};

export const calculateSecondsPerLiquidityGlobal = (
  currentSecondsPerLiquidityGlobal: BN,
  liquidity: BN,
  lastTimestamp: BN
): BN => {
  const now = getTimestampInSeconds();
  const deltaTime = now.sub(lastTimestamp).mul(SECONDS_PER_LIQUIDITY_SCALE);
  const newSecondsPerLiquidityGlobal = wrappingAdd(
    currentSecondsPerLiquidityGlobal,
    deltaTime.div(liquidity)
  );
  return newSecondsPerLiquidityGlobal;
};

export const calculateSecondsPerLiquidityInside = (
  upperTick: BN,
  lowerTick: BN,
  currentTick: BN,
  upperTickSecondsPerLiquidityOutside: BN,
  lowerTickSecondsPerLiquidityOutside: BN,
  poolSecondsPerLiquidityGlobal: BN
): BN => {
  const currentAboveLower = currentTick.gte(lowerTick);
  const currentBelowUpper = currentTick.lt(upperTick);

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
