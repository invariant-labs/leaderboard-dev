import {
  Network,
  Market,
  Pair,
  getMarketAddress,
  IWallet,
} from "@invariant-labs/sdk-eclipse";
import { PoolStructure } from "@invariant-labs/sdk-eclipse/lib/market";
import { AnchorProvider } from "@coral-xyz/anchor";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import fs from "fs";

// eslint-disable-next-line @typescript-eslint/no-var-requires
require("dotenv").config();

export const createSnapshotForNetwork = async (network: Network) => {
  let provider: AnchorProvider;
  let fileName: string;

  switch (network) {
    case Network.DEV:
      provider = AnchorProvider.local(
        "https://staging-rpc.dev2.eclipsenetwork.xyz"
      );
      fileName = "../data/eclipse/devnet.json";
      break;
    case Network.TEST:
      provider = AnchorProvider.local(
        "https://testnet.dev2.eclipsenetwork.xyz"
      );
      fileName = "../data/eclipse/testnet.json";
      break;
    case Network.MAIN:
      provider = AnchorProvider.local("https://eclipse.helius-rpc.com");
      fileName = "../data/eclipse/mainnet.json";
      break;
    default:
      throw new Error("Unknown network");
  }

  const connection = provider.connection;

  const market = Market.build(
    network,
    provider.wallet as IWallet,
    connection,
    new PublicKey(getMarketAddress(network))
  );

  console.log("Market Address:", market.program.programId.toBase58());
};

// createSnapshotForNetwork(Network.DEV).then(
//   () => {
//     console.log("Eclipse: Devnet snapshot done!");
//   },
//   (err) => {
//     console.log(err);
//   }
// );

createSnapshotForNetwork(Network.TEST).then(
  () => {
    console.log("Eclipse: Testnet snapshot done!");
  },
  (err) => {
    console.log(err);
  }
);

// createSnapshotForNetwork(Network.MAIN).then(
//   () => {
//     console.log("Eclipse: Mainnet snapshot done!");
//   },
//   (err) => {
//     console.log(err);
//   }
// );
