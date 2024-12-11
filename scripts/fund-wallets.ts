import { PublicKey } from "@solana/web3.js";

const USDC_MINT = new PublicKey(0);
const TTS_MINT = new PublicKey(1);
const USDC_AMOUNT = 100000000;
const TTS_AMOUNT = 100000000;
const ETH_AMOUNT = 100000000;

const main = async () => {
  console.log("Funding wallets...");
  console.log("USDC mint:", USDC_MINT.toBase58());
  console.log("TTS mint:", TTS_MINT.toBase58());
  console.log("USDC amount:", USDC_AMOUNT);
  console.log("TTS amount:", TTS_AMOUNT);
  console.log("ETH amount:", ETH_AMOUNT);
  console.log("Funded wallets!");
};

main();
