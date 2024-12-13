import { Network } from "@invariant-labs/sdk-eclipse";
import { createSnapshotForNetwork } from "../src/snap-points";
import { IPointsJson } from "../src/types";
import * as fs from "fs";
import path from "path";
import { BN } from "@coral-xyz/anchor";
import { POINTS_PER_SECOND } from "../src/math";

const testMath = async () => {
  const firstTimestamp = await createSnapshotForNetwork(Network.TEST);
  const previousPointsFirst: Record<string, IPointsJson> = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../data/points_testnet.json"),
      "utf-8"
    )
  );
  const pointsFirst: BN = Object.keys(previousPointsFirst).reduce(
    (acc, curr) =>
      acc.add(new BN(previousPointsFirst[curr].totalPoints, "hex")),
    new BN(0)
  );
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const secondTimestamp = await createSnapshotForNetwork(Network.TEST);
  const previousPointsSecond: Record<string, IPointsJson> = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../data/points_testnet.json"),
      "utf-8"
    )
  );
  const pointsSecond: BN = Object.keys(previousPointsSecond).reduce(
    (acc, curr) =>
      acc.add(new BN(previousPointsSecond[curr].totalPoints, "hex")),
    new BN(0)
  );

  const pointsDiff = pointsSecond.sub(pointsFirst);
  const expectedPointsDiff = secondTimestamp
    .sub(firstTimestamp)
    .mul(POINTS_PER_SECOND)
    .muln(10 ** 6);

  const difference = expectedPointsDiff.sub(pointsDiff);
  const percentageDiff = difference.muln(100).div(expectedPointsDiff);

  console.log("Loss:", percentageDiff.toNumber() + "%");
  console.log(
    "Expected points distributed:",
    expectedPointsDiff.toNumber() + "%"
  );
  console.log("Actual points distributed:", pointsDiff.toNumber() + "%");
};

testMath();
