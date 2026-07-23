import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { giwaSepolia, type ChainKey, getChain } from "./chains.js";
import { registerEvmTools } from "./tools/evm.js";
import { registerFlashblocksTools } from "./tools/flashblocks.js";
import { registerDojangTools } from "./tools/dojang.js";
import { registerUpIdTools } from "./tools/upid.js";
import { registerDeFiTools } from "./tools/defi.js";
import { registerAATools } from "./tools/aa.js";
import { registerBridgeTools } from "./tools/bridge.js";
import { registerFaucetTools } from "./tools/faucet.js";
import { registerAgentTools } from "./tools/agent.js";
import { registerNftTools } from "./tools/nft.js";
import { registerDevTools } from "./tools/devtools.js";
import { registerAnalyticsTools } from "./tools/analytics.js";

export interface GiwaMcpConfig {
  rpcUrl?: string;
  flashblocksRpcUrl?: string;
  privateKey?: `0x${string}`;
  explorerApiUrl?: string;
  chain?: ChainKey;
}

export function createGiwaMcpServer(config: GiwaMcpConfig = {}): McpServer {
  const chain = getChain(config.chain || "giwa");
  const rpcUrl = config.rpcUrl || chain.rpcUrls.default.http[0];
  const explorerApiUrl = config.explorerApiUrl || `${chain.blockExplorers.default.url}/api`;

  const publicClient: PublicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  let walletClient: WalletClient | null = null;
  if (config.privateKey) {
    const account = privateKeyToAccount(config.privateKey);
    walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });
  }

  const getWallet = () => walletClient;

  const mcpServer = new McpServer({
    name: "giwa-mcp-server",
    version: "2.0.0",
  });

  registerEvmTools(mcpServer, publicClient, getWallet, explorerApiUrl);
  registerFlashblocksTools(mcpServer, chain);
  registerDojangTools(mcpServer, publicClient, getWallet);
  registerUpIdTools(mcpServer, publicClient);
  registerDeFiTools(mcpServer, publicClient);
  registerAATools(mcpServer, publicClient, getWallet);
  registerBridgeTools(mcpServer, publicClient, getWallet);
  registerFaucetTools(mcpServer);
  registerAgentTools(mcpServer, publicClient, getWallet);
  registerNftTools(mcpServer, publicClient, getWallet);
  registerDevTools(mcpServer, publicClient);
  registerAnalyticsTools(mcpServer, publicClient);

  return mcpServer;
}
