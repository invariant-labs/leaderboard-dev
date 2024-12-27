import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { IWallet, Market, Network, Pair } from "@invariant-labs/sdk-eclipse";
import { PublicKey, Keypair } from "@solana/web3.js";
import fs from "fs";

require("dotenv").config();

const provider = AnchorProvider.local("https://eclipse.helius-rpc.com", {
  commitment: "confirmed",
});

const connection = provider.connection;

const POOL = new PublicKey("FvVsbwsbGVo6PVfimkkPhpcRfBrRitiV946nMNNuz7f9"); // ETH/tETH 0.01%

const main = async () => {
  const market = await Market.build(
    Network.TEST,
    provider.wallet as IWallet,
    connection
  );

  const poolState = await market.getPoolByAddress(POOL);
  const pair = new Pair(poolState.tokenX, poolState.tokenY, {
    fee: poolState.fee,
    tickSpacing: poolState.tickSpacing,
  });

  const latestTxHash = await getLatestTxHash(market.program.programId);

  const [allPositions, allTicks] = await Promise.all([
    market.getPositionsForPool(POOL),
    market.getAllTicks(pair),
  ]);

  const recentTxHash = await getLatestTxHash(market.program.programId);

  if (recentTxHash !== latestTxHash) {
    throw new Error("State inconsistency");
  }

  fs.writeFileSync(`./scripts/positions_${POOL}`, JSON.stringify(allPositions));
  fs.writeFileSync(`./scripts/ticks_${POOL}`, JSON.stringify(allTicks));
};

const getLatestTxHash = async (programId: PublicKey) => {
  const [signature] = await connection.getSignaturesForAddress(
    programId,
    { limit: 1 },
    "confirmed"
  );
  return signature.signature;
};
main();
