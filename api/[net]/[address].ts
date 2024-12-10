import { VercelRequest, VercelResponse } from "@vercel/node";
import ECLIPSE_TESTNET_DATA from "../../data/points_testnet.json";
import ECLIPSE_MAINNET_DATA from "../../data/points_mainnet.json";

interface IData {
  user: {
    rank: number;
    address: string;
    points: number;
    last24hPoints: number;
    posiitons: number;
  } | null;
  leaderboard: {
    rank: number;
    address: string;
    points: number;
    last24hPoints: number;
    posiitons: number;
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

  let data: IData;

  if (net === "eclipse-testnet") {
    const sortedKeys = Object.keys(ECLIPSE_TESTNET_DATA).sort(
      (a, b) =>
        ECLIPSE_TESTNET_DATA[b].totalPoints -
        ECLIPSE_TESTNET_DATA[a].totalPoints
    );

    sortedKeys.forEach((key, index) => {
      ECLIPSE_TESTNET_DATA[key].rank = index + 1;
    });
    const testnetData: IData = {
      user: address ? ECLIPSE_TESTNET_DATA[address as string] ?? null : null,
      leaderboard: Object.keys(ECLIPSE_TESTNET_DATA).map((key) => {
        return { ...ECLIPSE_TESTNET_DATA[key], address: key };
      }),
    };
    data = testnetData;
  } else if (net === "eclipse-mainnet") {
    const sortedKeys = Object.keys(ECLIPSE_MAINNET_DATA).sort(
      (a, b) =>
        ECLIPSE_MAINNET_DATA[b].totalPoints -
        ECLIPSE_MAINNET_DATA[a].totalPoints
    );

    sortedKeys.forEach((key, index) => {
      ECLIPSE_MAINNET_DATA[key].rank = index + 1;
    });
    const mainnetData: IData = {
      user: address ? ECLIPSE_MAINNET_DATA[address as string] ?? null : null,
      leaderboard: Object.keys(ECLIPSE_MAINNET_DATA).map((key) => {
        return { ...ECLIPSE_MAINNET_DATA[key], address: key };
      }),
    };
    data = mainnetData;
  } else {
    return res.status(400).send("INVALID NETWORK");
  }

  res.json(data);
}
