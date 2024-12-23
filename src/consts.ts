import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export const MAX_SIGNATURES_PER_CALL = 100;
export const PROMOTED_POOLS_TESTNET = [
  // new PublicKey("7AdV5E8NznuVjNTT8rNm1MBGn8MNuFN9y9poQVSQ6gjD"), // usdc/tts 1%
  //new PublicKey("4xLSZJwLdkQHGqgyx1E9KHvdMnj7QVKa9Pwcnp1x2mDc"), // USDC/TTS 0.05%
  new PublicKey("GTVKQs8o9D52y9SdwfAXCQSDrrCLosvsP19HgHKugpfw"), // USDC/V2 0.01%
  new PublicKey("G28wnbasJuXihJ76KgFxynsA8WCj4yJZujq9ZhTbBLQm"), // USDC/TTS 0.01%
  new PublicKey("3YnSG9bS5tp7Bp8QZK6xZKKmfrNJJK8TE8UyZq99nhxH"), // USDC/V2 0.02%
];
export const PROMOTED_POOLS_MAINNET = [
  new PublicKey("HRgVv1pyBLXdsAddq4ubSqo8xdQWRrYbvmXqEDtectce"), // ETH/USDC 0.09%
];
export const DAY = new BN(86400);
export const MAX_RETIRES = 3;
export const START_COUNT_TIMESTAMP = new BN(1734800400);
