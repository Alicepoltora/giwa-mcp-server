import { z } from "zod";
import { type PublicClient, type Address, formatEther, formatUnits, parseAbi, type Abi } from "viem";

const WETH_GIWA = "0x4200000000000000000000000000000000000006" as Address;
const ERC20_ABI = parseAbi(["function name() view returns (string)", "function symbol() view returns (string)", "function decimals() view returns (uint8)", "function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)", "function allowance(address owner, address spender) view returns (uint256)"]);
const REDSTONE_API = "https://api.redstone.finance";

export function registerDeFiTools(mcpServer: any, publicClient: PublicClient) {
  mcpServer.tool(
    "giwa_get_token_info",
    "Get detailed information about an ERC-20 token on GIWA",
    { address: z.string().describe("Token contract address") },
    async ({ address }: { address: string }) => {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        publicClient.readContract({ address: address as Address, abi: ERC20_ABI, functionName: "name" }),
        publicClient.readContract({ address: address as Address, abi: ERC20_ABI, functionName: "symbol" }),
        publicClient.readContract({ address: address as Address, abi: ERC20_ABI, functionName: "decimals" }),
        publicClient.readContract({ address: address as Address, abi: ERC20_ABI, functionName: "totalSupply" }),
      ]);
      return { content: [{ type: "text" as const, text: JSON.stringify({ address, name, symbol, decimals, totalSupply: formatUnits(totalSupply as bigint, decimals as number), totalSupplyRaw: (totalSupply as bigint).toString() }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_get_weth_balance",
    "Get WETH (Wrapped ETH) balance on GIWA",
    { address: z.string().describe("Wallet address") },
    async ({ address }: { address: string }) => {
      const balance = (await publicClient.readContract({ address: WETH_GIWA, abi: parseAbi(["function balanceOf(address) view returns (uint256)"]), functionName: "balanceOf", args: [address as Address] })) as bigint;
      return { content: [{ type: "text" as const, text: JSON.stringify({ address, token: "WETH", contract: WETH_GIWA, balance_wei: balance.toString(), balance_eth: formatEther(balance) }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_get_allowance",
    "Check ERC-20 token allowance on GIWA",
    {
      token: z.string().describe("Token contract address"),
      owner: z.string().describe("Owner address"),
      spender: z.string().describe("Spender address"),
    },
    async ({ token, owner, spender }: { token: string; owner: string; spender: string }) => {
      const [allowance, decimals, symbol] = await Promise.all([
        publicClient.readContract({ address: token as Address, abi: ERC20_ABI, functionName: "allowance", args: [owner as Address, spender as Address] }),
        publicClient.readContract({ address: token as Address, abi: ERC20_ABI, functionName: "decimals" }),
        publicClient.readContract({ address: token as Address, abi: ERC20_ABI, functionName: "symbol" }),
      ]);
      return { content: [{ type: "text" as const, text: JSON.stringify({ token, symbol, owner, spender, allowanceRaw: (allowance as bigint).toString(), allowanceFormatted: formatUnits(allowance as bigint, decimals as number) }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_get_price_redstone",
    "Get token price from RedStone oracle. Supports 300+ feeds including crypto, RWA, stocks.",
    { token: z.string().describe("Token symbol (e.g., 'ETH', 'BTC', 'USDC', 'AAPL', 'TSLA')") },
    async ({ token }: { token: string }) => {
      try {
        const response = await fetch(`${REDSTONE_API}/prices?symbol=${token.toUpperCase()}&provider=redstone&limit=1`);
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ token: token.toUpperCase(), price: data[0].value, timestamp: new Date(data[0].timestamp).toISOString(), source: "RedStone Oracle" }, null, 2) }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `No price data for ${token}` }, null, 2) }] };
      } catch (error) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: `Failed to fetch price for ${token}`, details: error instanceof Error ? error.message : "Unknown error" }, null, 2) }] }; }
    }
  );

  mcpServer.tool(
    "giwa_get_price_pyth",
    "Get token price from Pyth Network oracle on GIWA. 400ms update cycle.",
    { priceId: z.string().describe("Pyth price feed ID (0x...). See https://pyth.network/developers/price-feed-ids") },
    async ({ priceId }: { priceId: string }) => {
      try {
        const PYTH_ABI: Abi = [{ inputs: [{ name: "id", type: "bytes32" }], name: "getPrice", outputs: [{ name: "price", type: "int64" }, { name: "conf", type: "uint64" }, { name: "expo", type: "int32" }, { name: "publishTime", type: "uint256" }], stateMutability: "view", type: "function" }];
        const PYTH_CONTRACT = "0x2880aB155794e7179c9eE2e38200202908C17B43" as Address;
        const result = (await publicClient.readContract({ address: PYTH_CONTRACT, abi: PYTH_ABI, functionName: "getPrice", args: [priceId as `0x${string}`] })) as [bigint, bigint, number, bigint];
        const [price, conf, expo, publishTime] = result;
        const adjustedPrice = Number(price) * 10 ** expo;
        return { content: [{ type: "text" as const, text: JSON.stringify({ priceId, price: adjustedPrice, confidence: Number(conf) * 10 ** expo, exponent: expo, publishTime: new Date(Number(publishTime) * 1000).toISOString(), source: "Pyth Network (on-chain)" }, null, 2) }] };
      } catch (error) { return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Failed to fetch Pyth price", details: error instanceof Error ? error.message : "Unknown error" }, null, 2) }] }; }
    }
  );

  mcpServer.tool(
    "giwa_list_known_contracts",
    "List known pre-deployed contracts on GIWA",
    {},
    async () => {
      return { content: [{ type: "text" as const, text: JSON.stringify({ network: "GIWA Sepolia (Chain ID 91342)", contracts: { WETH: { address: "0x4200000000000000000000000000000000000006", description: "Wrapped ETH" }, Multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11", description: "Batch multiple calls" }, Permit2: { address: "0x000000000022D473030F116dDEE9F6B43aC78BA3", description: "Uniswap Permit2" }, CreateX: { address: "0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed", description: "Deterministic deployment" }, Safe: { address: "0x69f4D1788e39c87893C980c06EdF4b7f686e2938", description: "Multisig wallet" }, EAS: { address: "0x4200000000000000000000000000000000000021", description: "Ethereum Attestation Service (Dojang)" }, EntryPoint_v06: { address: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", description: "ERC-4337 EntryPoint v0.6" }, EntryPoint_v07: { address: "0x0000000071727De22E5E9d8BAf0edAc6f37da032", description: "ERC-4337 EntryPoint v0.7" }, PythOracle: { address: "0x2880aB155794e7179c9eE2e38200202908C17B43", description: "Pyth Network price oracle" }, UP_ID: { address: "0x091D00004f21eb2Fc30964A8a4995692d9b49628", description: "UPbit Web3 Names (.up.id)" }, L2StandardBridge: { address: "0x4200000000000000000000000000000000000010", description: "ETH/ERC-20 bridge to L1" }, L2CrossDomainMessenger: { address: "0x4200000000000000000000000000000000000007", description: "Cross-domain messaging" }, GasPriceOracle: { address: "0x420000000000000000000000000000000000000F", description: "L1 gas price oracle" } } }, null, 2) }] };
    }
  );
}
