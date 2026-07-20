import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

let publicClient: PublicClient | null = null;
let walletClient: WalletClient | null = null;

export function getPublicClient(chain: Chain, rpcUrl?: string): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl || chain.rpcUrls.default.http[0]),
    });
  }
  return publicClient;
}

export function getWalletClient(
  chain: Chain,
  privateKey: `0x${string}`,
  rpcUrl?: string
): WalletClient {
  if (!walletClient) {
    const account = privateKeyToAccount(privateKey);
    walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl || chain.rpcUrls.default.http[0]),
    });
  }
  return walletClient;
}

export async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[] = []
): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
  }
  return data.result;
}
