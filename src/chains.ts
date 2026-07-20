import { defineChain } from "viem";

export const giwaSepolia = defineChain({
  id: 91342,
  name: "GIWA Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia-rpc.giwa.io"],
    },
    flashblocks: {
      http: ["https://sepolia-rpc-flashblocks.giwa.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "GIWA Explorer",
      url: "https://sepolia-explorer.giwa.io",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
    permit2: {
      address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    },
    entryPoint06: {
      address: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    },
    entryPoint07: {
      address: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    },
  },
  testnet: true,
});

export const CHAINS = {
  giwa: giwaSepolia,
} as const;

export type ChainKey = keyof typeof CHAINS;

export function getChain(key: ChainKey = "giwa") {
  return CHAINS[key];
}
