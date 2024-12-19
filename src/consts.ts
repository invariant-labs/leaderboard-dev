import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export const MAX_SIGNATURES_PER_CALL = 100;
export const PROMOTED_POOLS_TESTNET = [
  // new PublicKey("7AdV5E8NznuVjNTT8rNm1MBGn8MNuFN9y9poQVSQ6gjD"), // usdc/tts 1%
  new PublicKey("4xLSZJwLdkQHGqgyx1E9KHvdMnj7QVKa9Pwcnp1x2mDc"), // USDC/TTS 0.05%
];
export const PROMOTED_POOLS_MAINNET = [
  new PublicKey("HRgVv1pyBLXdsAddq4ubSqo8xdQWRrYbvmXqEDtectce"), // ETH/USDC 0.09%
];
export const DAY = new BN(86400);
export const FULL_SNAP_START_TX_HASH =
  "27t2VZ4QcFyy6iVxUt3bH5u51v4oH9qj8ULgFE65T5n4g8x8WnXAkP3qtNea1ruzr3gG5796P1SppKgEjgA1NBuw";

export const MAX_RETIRES = 3;
