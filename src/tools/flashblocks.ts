import { type Chain, type Address, type Hex, formatEther, formatUnits, parseAbi } from "viem";
import { rpcCall } from "../utils/rpc.js";

export function registerFlashblocksTools(
  mcpServer: any,
  chain: Chain
) {
  const flashblocksRpc = chain.rpcUrls.flashblocks?.http[0] || chain.rpcUrls.default.http[0];

  mcpServer.tool(
    "giwa_flashblocks_call",
    "Execute eth_call with pending tag via Flashblocks RPC (~200ms preconfirmation). Unique GIWA feature for near-instant reads.",
    {
      to: { type: "string", description: "Contract address to call" },
      data: { type: "string", description: "Calldata (0x...)" },
    },
    async ({ to, data }: { to: string; data: string }) => {
      const result = await rpcCall(flashblocksRpc, "eth_call", [
        { to, data },
        "pending",
      ]);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                result,
                source: "flashblocks",
                latency: "~200ms preconfirmation",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "giwa_flashblocks_get_balance",
    "Get balance with pending state via Flashblocks (~200ms). Shows balance including unconfirmed transactions.",
    {
      address: { type: "string", description: "Wallet address" },
    },
    async ({ address }: { address: string }) => {
      const result = await rpcCall(flashblocksRpc, "eth_getBalance", [
        address,
        "pending",
      ]);
      const balance = BigInt(result as string);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                address,
                balance_wei: balance.toString(),
                balance_eth: formatEther(balance),
                source: "flashblocks (pending state)",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "giwa_flashblocks_get_logs",
    "Get logs with pending state via Flashblocks. Includes events from not-yet-mined transactions.",
    {
      address: { type: "string", description: "Contract address" },
      fromBlock: { type: "string", description: "From block number" },
      toBlock: { type: "string", description: "To block number or 'pending'" },
    },
    async ({
      address,
      fromBlock,
      toBlock,
    }: {
      address: string;
      fromBlock?: string;
      toBlock?: string;
    }) => {
      const params: any[] = [
        {
          address,
          fromBlock: fromBlock ? `0x${BigInt(fromBlock).toString(16)}` : "0x0",
          toBlock: toBlock === "pending" ? "pending" : toBlock ? `0x${BigInt(toBlock).toString(16)}` : "pending",
        },
      ];
      const logs = await rpcCall(flashblocksRpc, "eth_getLogs", params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                logs,
                source: "flashblocks (pending state)",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "giwa_flashblocks_simulate",
    "Simulate a transaction via Flashblocks with pending state (~200ms). Useful for pre-flight checks.",
    {
      from: { type: "string", description: "From address" },
      to: { type: "string", description: "To address" },
      data: { type: "string", description: "Calldata (optional)" },
      value: { type: "string", description: "Value in ETH (optional)" },
    },
    async ({
      from,
      to,
      data,
      value,
    }: {
      from: string;
      to: string;
      data?: string;
      value?: string;
    }) => {
      const txObj: any = { from, to };
      if (data) txObj.data = data;
      if (value) txObj.value = `0x${BigInt(Math.floor(parseFloat(value) * 1e18)).toString(16)}`;

      const result = await rpcCall(flashblocksRpc, "eth_simulateV1", [
        [{ ...txObj, statusOnly: false }],
        "pending",
      ]);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                simulation: result,
                source: "flashblocks",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "giwa_flashblocks_estimate_gas",
    "Estimate gas with pending state via Flashblocks (~200ms).",
    {
      from: { type: "string", description: "From address" },
      to: { type: "string", description: "To address" },
      data: { type: "string", description: "Calldata (optional)" },
      value: { type: "string", description: "Value in ETH (optional)" },
    },
    async ({
      from,
      to,
      data,
      value,
    }: {
      from: string;
      to: string;
      data?: string;
      value?: string;
    }) => {
      const txObj: any = { from, to };
      if (data) txObj.data = data;
      if (value) txObj.value = `0x${BigInt(Math.floor(parseFloat(value) * 1e18)).toString(16)}`;

      const gas = await rpcCall(flashblocksRpc, "eth_estimateGas", [
        txObj,
        "pending",
      ]);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                gas: (gas as string).toString(),
                source: "flashblocks (pending state)",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
