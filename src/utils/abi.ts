import { type Abi, type Address } from "viem";

const abiCache = new Map<string, Abi>();

export async function fetchAbi(
  explorerApiUrl: string,
  address: Address
): Promise<Abi> {
  const cacheKey = `${explorerApiUrl}:${address.toLowerCase()}`;
  if (abiCache.has(cacheKey)) {
    return abiCache.get(cacheKey)!;
  }

  const url = `${explorerApiUrl}?module=contract&action=getabi&address=${address}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "1" || !data.result) {
    throw new Error(`Failed to fetch ABI for ${address}: ${data.message || data.result}`);
  }

  const abi: Abi = JSON.parse(data.result);
  abiCache.set(cacheKey, abi);
  return abi;
}

export function parseAbi(abiJson: string): Abi {
  return JSON.parse(abiJson) as Abi;
}
