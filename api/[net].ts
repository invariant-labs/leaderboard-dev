import { VercelRequest, VercelResponse } from "@vercel/node";
import ECLIPSE_TESTNET_DATA from "../data/points_testnet.json";
import ECLIPSE_MAINNET_DATA from "../data/points_mainnet.json";
import { IPoints } from "../src/types";

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

  const { net } = req.query;

  let data: Record<string, IPoints>;

  if (net === "eclipse-testnet") {
    data = ECLIPSE_TESTNET_DATA as unknown as Record<string, IPoints>;
  } else if (net === "eclipse-mainnet") {
    data = ECLIPSE_MAINNET_DATA as unknown as Record<string, IPoints>;
  } else {
    return res.status(400).send("INVALID NETWORK");
  }

  res.json(data);
}
