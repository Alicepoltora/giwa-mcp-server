import { z } from "zod";
import { type PublicClient, type WalletClient, type Address, type Hex, type Abi, formatEther, formatUnits, parseAbi, encodeFunctionData } from "viem";
import { generatePrivateKey, privateKeyToAccount, generateMnemonic, english } from "viem/accounts";

const ERC20_ABI = parseAbi(["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)", "function symbol() view returns (string)", "function name() view returns (string)"]);
const ERC721_ABI = parseAbi(["function balanceOf(address) view returns (uint256)", "function tokenOfOwnerByIndex(address, uint256) view returns (uint256)", "function tokenURI(uint256) view returns (string)", "function name() view returns (string)", "function symbol() view returns (string)"]);
const ERC1155_ABI = parseAbi(["function balanceOf(address, uint256) view returns (uint256)", "function uri(uint256) view returns (string)"]);
const EXPLORER_API = "https://sepolia-explorer.giwa.io/api";

const KNOWN_TOKENS: Record<string, { address: string; decimals: number; symbol: string }> = {
  WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18, symbol: "WETH" },
};

export function registerAgentTools(mcpServer: any, publicClient: PublicClient, getWallet: () => WalletClient | null) {
  mcpServer.tool(
    "giwa_agent_create_wallet",
    "Create a new wallet for an AI agent. Returns address and private key (STORE SECURELY).",
    {},
    async () => {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      return { content: [{ type: "text" as const, text: JSON.stringify({ address: account.address, privateKey, warning: "STORE THE PRIVATE KEY SECURELY. It will NOT be shown again. Use it to set PRIVATE_KEY env var." }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_agent_generate_mnemonic",
    "Generate a BIP-39 mnemonic phrase for agent wallet backup",
    { wordCount: z.enum(["12", "24"]).optional().describe("Number of words (12 or 24, default: 12)") },
    async ({ wordCount = "12" }: { wordCount?: string }) => {
      const strength = wordCount === "24" ? 256 : 128;
      const mnemonic = generateMnemonic(english, strength);
      return { content: [{ type: "text" as const, text: JSON.stringify({ mnemonic, wordCount: parseInt(wordCount), warning: "WRITE DOWN AND STORE SECURELY. Anyone with this phrase can access your funds." }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_agent_get_portfolio",
    "Get complete portfolio for an address: ETH + known token balances",
    {
      address: z.string().describe("Wallet address"),
    },
    async ({ address }: { address: string }) => {
      const ethBalance = await publicClient.getBalance({ address: address as Address });
      const tokens: any[] = [];
      for (const [symbol, token] of Object.entries(KNOWN_TOKENS)) {
        try {
          const balance = (await publicClient.readContract({ address: token.address as Address, abi: ERC20_ABI, functionName: "balanceOf", args: [address as Address] })) as bigint;
          if (balance > 0n) {
            tokens.push({ symbol, address: token.address, balanceRaw: balance.toString(), balanceFormatted: formatUnits(balance, token.decimals) });
          }
        } catch {}
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ address, eth: { wei: ethBalance.toString(), formatted: formatEther(ethBalance) }, tokens, totalAssets: tokens.length + 1 }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_agent_get_tx_history",
    "Get transaction history for an address from Blockscout",
    {
      address: z.string().describe("Wallet address"),
      limit: z.string().optional().describe("Max transactions to return (default: 20)"),
    },
    async ({ address, limit = "20" }: { address: string; limit?: string }) => {
      try {
        const resp = await fetch(`${EXPLORER_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc`);
        const data = await resp.json();
        const txs = (data.result || []).map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: formatEther(BigInt(tx.value || "0")),
          gasUsed: tx.gasUsed,
          status: tx.txreceipt_status === "1" ? "success" : "failed",
          timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
          method: tx.functionName || "transfer",
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify({ address, count: txs.length, transactions: txs }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }, null, 2) }] };
      }
    }
  );

  mcpServer.tool(
    "giwa_agent_get_token_transfers",
    "Get ERC-20 token transfer history for an address",
    {
      address: z.string().describe("Wallet address"),
      contractAddress: z.string().optional().describe("Filter by specific token contract"),
      limit: z.string().optional().describe("Max transfers (default: 20)"),
    },
    async ({ address, contractAddress, limit = "20" }: { address: string; contractAddress?: string; limit?: string }) => {
      try {
        let url = `${EXPLORER_API}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc`;
        if (contractAddress) url += `&contractaddress=${contractAddress}`;
        const resp = await fetch(url);
        const data = await resp.json();
        const transfers = (data.result || []).map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: formatUnits(BigInt(tx.value || "0"), parseInt(tx.tokenDecimal || "18")),
          tokenName: tx.tokenName,
          tokenSymbol: tx.tokenSymbol,
          contractAddress: tx.contractAddress,
          timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify({ address, count: transfers.length, transfers }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }, null, 2) }] };
      }
    }
  );

  mcpServer.tool(
    "giwa_agent_execute_strategy",
    "Execute a multi-step DeFi strategy in one call (requires PRIVATE_KEY)",
    {
      steps: z.array(z.object({
        target: z.string().describe("Contract address"),
        value: z.string().optional().describe("ETH value (in ETH)"),
        data: z.string().describe("Encoded calldata (0x...)"),
        description: z.string().describe("Human-readable step description"),
      })).describe("Array of transaction steps to execute sequentially"),
    },
    async ({ steps }: { steps: Array<{ target: string; value?: string; data: string; description: string }> }) => {
      const wallet = getWallet();
      if (!wallet) return { content: [{ type: "text" as const, text: "Error: PRIVATE_KEY not set." }] };
      const results: any[] = [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        try {
          const hash = await wallet.sendTransaction({
            account: wallet.account!,
            to: step.target as Address,
            value: step.value ? BigInt(Math.floor(parseFloat(step.value) * 1e18)) : undefined,
            data: step.data as Hex,
            chain: wallet.chain,
          });
          results.push({ step: i + 1, description: step.description, txHash: hash, status: "sent", explorer: `https://sepolia-explorer.giwa.io/tx/${hash}` });
        } catch (e: any) {
          results.push({ step: i + 1, description: step.description, error: e.message, status: "failed" });
          break;
        }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ totalSteps: steps.length, executed: results.length, results }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_agent_estimate_strategy_cost",
    "Estimate gas cost for a multi-step strategy",
    {
      steps: z.array(z.object({
        target: z.string(),
        value: z.string().optional(),
        data: z.string(),
        description: z.string(),
      })).describe("Array of strategy steps"),
    },
    async ({ steps }: { steps: Array<{ target: string; value?: string; data: string; description: string }> }) => {
      const gasPrice = await publicClient.getGasPrice();
      let totalGas = 0n;
      const estimates: any[] = [];
      for (let i = 0; i < steps.length; i++) {
        try {
          const stepValue = steps[i].value;
          const gas = await publicClient.estimateGas({
            to: steps[i].target as Address,
            value: stepValue ? BigInt(Math.floor(parseFloat(stepValue) * 1e18)) : undefined,
            data: (steps[i].data || "0x") as Hex,
          } as any);
          totalGas += gas;
          estimates.push({ step: i + 1, description: steps[i].description, gas: gas.toString(), costEth: formatEther(gas * gasPrice) });
        } catch (e: any) {
          estimates.push({ step: i + 1, description: steps[i].description, error: e.message });
        }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ steps: estimates, totalGas: totalGas.toString(), totalCostEth: formatEther(totalGas * gasPrice), gasPriceGwei: formatUnits(gasPrice, 9) }, null, 2) }] };
    }
  );
}
