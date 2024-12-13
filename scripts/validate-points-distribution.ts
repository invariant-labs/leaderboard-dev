import { Network } from "@invariant-labs/sdk-eclipse";
import { createSnapshotForNetwork } from "../src/snap-points";
import { IPointsJson } from "../src/types";
import * as fs from "fs";
import path from "path";
import { BN } from "@coral-xyz/anchor";
import { POINTS_DENOMINATOR, POINTS_PER_SECOND } from "../src/math";

const validatePointsDistribution = async () => {
  const firstTimestamp = await createSnapshotForNetwork(Network.TEST);
  const previousPoints: Record<string, IPointsJson> = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../data/points_testnet.json"),
      "utf-8"
    )
  );
  const previousPointsSum: BN = Object.keys(previousPoints).reduce(
    (acc, curr) => acc.add(new BN(previousPoints[curr].totalPoints, "hex")),
    new BN(0)
  );
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const secondTimestamp = await createSnapshotForNetwork(Network.TEST);
  const currentPoints: Record<string, IPointsJson> = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../data/points_testnet.json"),
      "utf-8"
    )
  );
  const currentPointsSum: BN = Object.keys(currentPoints).reduce(
    (acc, curr) => acc.add(new BN(currentPoints[curr].totalPoints, "hex")),
    new BN(0)
  );

  const pointsDiff = currentPointsSum.sub(previousPointsSum);
  const expectedPointsDiff = secondTimestamp
    .sub(firstTimestamp)
    .mul(POINTS_PER_SECOND)
    .muln(POINTS_DENOMINATOR);

  const difference = expectedPointsDiff.sub(pointsDiff);
  const percentageDiff = difference.muln(100).div(expectedPointsDiff);

  console.log("Loss:", percentageDiff.toNumber() + "%");
  console.log(
    "Expected points distributed:",
    expectedPointsDiff.toNumber() + "%"
  );
  console.log("Actual points distributed:", pointsDiff.toNumber() + "%");
};

validatePointsDistribution();
