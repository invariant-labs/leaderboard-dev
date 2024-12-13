import { VercelRequest, VercelResponse } from "@vercel/node";
import ECLIPSE_TESTNET_DATA from "../../data/points_testnet.json";
import ECLIPSE_MAINNET_DATA from "../../data/points_mainnet.json";
import { IPointsHistoryJson, IPointsJson } from "../../src/types";
import { BN } from "@coral-xyz/anchor";

interface IData {
  user: {
    rank: number;
    address: string;
    points: BN;
    last24hPoints: BN;
    positions: number;
  } | null;
  leaderboard: {
    rank: number;
    address: string;
    points: BN;
    last24hPoints: BN;
    positions: number;
  }[];
}

export default function (req: VercelRequest, res: VercelResponse) {
  // @ts-expect-error
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  // res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  const { net, address } = req.query;

  // Extract pagination parameters from query
  const offset = Number(req.query.offset) || 0;
  const size = Number(req.query.size) || undefined;

  const pubkey = address as string;
  let currentData: Record<string, IPointsJson>;

  if (net === "eclipse-testnet") {
    currentData = ECLIPSE_TESTNET_DATA as Record<string, IPointsJson>;
  } else if (net === "eclipse-mainnet") {
    currentData = ECLIPSE_MAINNET_DATA as Record<string, IPointsJson>;
  } else {
    return res.status(400).send("INVALID NETWORK");
  }

  const rank: Record<string, number> = {};
  const last24HoursPoints: Record<string, BN> = {};
  const sortedKeys = Object.keys(currentData).sort((a, b) =>
    new BN(currentData[b].totalPoints, "hex").sub(
      new BN(currentData[a].totalPoints, "hex")
    )
  );

  sortedKeys.forEach((key, index) => {
    rank[key] = index + 1;
    last24HoursPoints[key] = currentData[key].points24HoursHistory.reduce(
      (acc: BN, curr: IPointsHistoryJson) => acc.add(new BN(curr.diff, "hex")),
      new BN(0)
    );
  });

  const userData =
    address && currentData[pubkey]
      ? {
          rank: rank[pubkey],
          last24hPoints: last24HoursPoints[pubkey],
          points: new BN(currentData[pubkey].totalPoints, "hex"),
          address: pubkey,
          positions: currentData[pubkey].positionsAmount,
        }
      : null;
  const finalData: IData = {
    user: userData ? { ...userData } : null,
    leaderboard: Object.keys(currentData)
      .map((key) => {
        return {
          address: key,
          rank: rank[key],
          last24hPoints: last24HoursPoints[key],
          points: new BN(currentData[key].totalPoints, "hex"),
          positions: currentData[key].positionsAmount,
        };
      })
      .slice(offset, size),
  };

  res.json(finalData);
}
