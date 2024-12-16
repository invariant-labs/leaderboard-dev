import { VercelRequest, VercelResponse } from "@vercel/node";
import { POINTS_DECIMAL, POINTS_PER_SECOND } from "../../src/math";

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

  const config = {
    refreshTime: 30 * 60,
    pointsPerSecond: POINTS_PER_SECOND,
    pointsDecimal: POINTS_DECIMAL,
  };

  res.json(config);
}
