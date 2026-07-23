import { z } from "zod";
import { type PublicClient, type Address, formatEther, formatUnits, parseAbi } from "viem";

const EXPLORER_API = "https://sepolia-explorer.giwa.io/api";
const ERC20_ABI = parseAbi(["function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)", "function decimals() view returns (uint8)"]);

export function registerAnalyticsTools(mcpServer: any, publicClient: PublicClient) {
  mcpServer.tool(
    "giwa_get_chain_stats",
    "Get GIWA chain statistics: latest block, gas info, network status",
    {},
    async () => {
      const [blockNumber, gasPrice, block] = await Promise.all([
        publicClient.getBlockNumber(),
        publicClient.getGasPrice(),
        publicClient.getBlock(),
      ]);
      return { content: [{ type: "text" as const, text: JSON.stringify({ network: "GIWA Sepolia", chainId: 91342, latestBlock: blockNumber.toString(), blockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(), gasPriceWei: gasPrice.toString(), gasPriceGwei: formatUnits(gasPrice, 9), gasLimit: block.gasLimit.toString(), gasUsed: block.gasUsed.toString(), gasUtilization: `${((Number(block.gasUsed) / Number(block.gasLimit)) * 100).toFixed(1)}%`, transactionsInBlock: block.transactions.length, blockTime: "1 second", preconfirmation: "~200ms (Flashblocks)" }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_get_token_holders",
    "Get top token holders from Blockscout",
    {
      contractAddress: z.string().describe("Token contract address"),
      limit: z.string().optional().describe("Max holders to return (default: 20)"),
    },
    async ({ contractAddress, limit = "20" }: { contractAddress: string; limit?: string }) => {
      try {
        const resp = await fetch(`${EXPLORER_API}?module=token&action=getTokenHolders&contractaddress=${contractAddress}&page=1&offset=${limit}`);
        const data = await resp.json();
        const decimals = (await publicClient.readContract({ address: contractAddress as Address, abi: ERC20_ABI, functionName: "decimals" }).catch(() => 18)) as number;
        const symbol = (await publicClient.readContract({ address: contractAddress as Address, abi: parseAbi(["function symbol() view returns (string)"]), functionName: "symbol" }).catch(() => "TOKEN")) as string;
        const holders = (data.result || []).map((h: any, i: number) => ({ rank: i + 1, address: h.address, balance: formatUnits(BigInt(h.value), decimals), percentage: h.value && data.totalSupply ? ((Number(h.value) / Number(data.totalSupply)) * 100).toFixed(2) + "%" : "N/A" }));
        return { content: [{ type: "text" as const, text: JSON.stringify({ token: symbol, contract: contractAddress, holdersCount: holders.length, holders }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }, null, 2) }] };
      }
    }
  );

  mcpServer.tool(
    "giwa_get_token_transfers",
    "Get recent token transfers for a contract",
    {
      contractAddress: z.string().describe("Token contract address"),
      limit: z.string().optional().describe("Max transfers (default: 20)"),
    },
    async ({ contractAddress, limit = "20" }: { contractAddress: string; limit?: string }) => {
      try {
        const resp = await fetch(`${EXPLORER_API}?module=token&action=getTokenTransfers&contractaddress=${contractAddress}&page=1&offset=${limit}&sort=desc`);
        const data = await resp.json();
        const transfers = (data.result || []).map((tx: any) => ({ hash: tx.hash, from: tx.from, to: tx.to, value: tx.value, timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(), blockNumber: tx.blockNumber }));
        return { content: [{ type: "text" as const, text: JSON.stringify({ contract: contractAddress, count: transfers.length, transfers }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }, null, 2) }] };
      }
    }
  );

  mcpServer.tool(
    "giwa_get_address_details",
    "Get detailed information about an address (balance, tx count, type)",
    {
      address: z.string().describe("Address to inspect"),
    },
    async ({ address }: { address: string }) => {
      const [balance, txCount, bytecode] = await Promise.all([
        publicClient.getBalance({ address: address as Address }),
        publicClient.getTransactionCount({ address: address as Address }),
        publicClient.getBytecode({ address: address as Address }),
      ]);
      const isContract = bytecode && bytecode !== "0x";
      return { content: [{ type: "text" as const, text: JSON.stringify({ address, balanceEth: formatEther(balance), balanceWei: balance.toString(), transactionCount: txCount, type: isContract ? "Contract" : "EOA (Externally Owned Account)", isContract, bytecodeSize: isContract ? (bytecode!.length / 2 - 1) + " bytes" : "N/A" }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_get_block_range",
    "Get blocks in a range with summary stats",
    {
      fromBlock: z.string().describe("Start block number"),
      toBlock: z.string().describe("End block number (max 100 blocks)"),
    },
    async ({ fromBlock, toBlock }: { fromBlock: string; toBlock: string }) => {
      const from = BigInt(fromBlock);
      const to = BigInt(toBlock);
      if (to - from > 100n) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Max 100 blocks per request" }, null, 2) }] };
      const blocks: any[] = [];
      let totalGas = 0n;
      let totalTx = 0;
      for (let i = from; i <= to; i++) {
        try {
          const block = await publicClient.getBlock({ blockNumber: i });
          totalGas += block.gasUsed;
          totalTx += block.transactions.length;
          blocks.push({ number: block.number.toString(), timestamp: new Date(Number(block.timestamp) * 1000).toISOString(), gasUsed: block.gasUsed.toString(), transactions: block.transactions.length });
        } catch {}
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ fromBlock: from.toString(), toBlock: to.toString(), blocksCount: blocks.length, totalTransactions: totalTx, totalGasUsed: totalGas.toString(), avgGasPerBlock: blocks.length > 0 ? (totalGas / BigInt(blocks.length)).toString() : "0", avgTxPerBlock: blocks.length > 0 ? (totalTx / blocks.length).toFixed(1) : "0", blocks }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_get_pending_transactions",
    "Get pending transactions in the mempool",
    {},
    async () => {
      try {
        const txpool = await publicClient.request({ method: "txpool_status" } as any);
        return { content: [{ type: "text" as const, text: JSON.stringify({ pending: (txpool as any)?.pending || "0", queued: (txpool as any)?.queued || "0", note: "Full mempool inspection requires node access" }, null, 2) }] };
      } catch {
        return { content: [{ type: "text" as const, text: JSON.stringify({ note: "txpool not available on public RPC. Run your own node for mempool access." }, null, 2) }] };
      }
    }
  );
}
