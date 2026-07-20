import {
  type PublicClient,
  type WalletClient,
  formatEther,
  formatUnits,
  parseAbi,
  type Address,
  type Hex,
  type Hash,
} from "viem";

export function registerEvmTools(
  mcpServer: any,
  publicClient: PublicClient,
  getWallet: () => WalletClient | null,
  explorerApiUrl: string
) {
  mcpServer.tool(
    "giwa_get_balance",
    "Get native ETH balance of an address on GIWA",
    {
      address: { type: "string", description: "Wallet address (0x...)" },
    },
    async ({ address }: { address: string }) => {
      const balance = await publicClient.getBalance({
        address: address as Address,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                address,
                balance_wei: balance.toString(),
                balance_eth: formatEther(balance),
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
    "giwa_get_token_balance",
    "Get ERC-20 token balance for an address on GIWA",
    {
      address: { type: "string", description: "Wallet address" },
      token: { type: "string", description: "ERC-20 token contract address" },
    },
    async ({ address, token }: { address: string; token: string }) => {
      const [balance, decimals, symbol] = await Promise.all([
        publicClient.readContract({
          address: token as Address,
          abi: parseAbi([
            "function balanceOf(address) view returns (uint256)",
          ]),
          functionName: "balanceOf",
          args: [address as Address],
        }),
        publicClient.readContract({
          address: token as Address,
          abi: parseAbi(["function decimals() view returns (uint8)"]),
          functionName: "decimals",
        }),
        publicClient.readContract({
          address: token as Address,
          abi: parseAbi(["function symbol() view returns (string)"]),
          functionName: "symbol",
        }),
      ]);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                address,
                token,
                symbol,
                balance_raw: (balance as bigint).toString(),
                balance_formatted: formatUnits(balance as bigint, decimals as number),
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
    "giwa_get_transaction",
    "Get transaction details by hash on GIWA",
    {
      hash: { type: "string", description: "Transaction hash (0x...)" },
    },
    async ({ hash }: { hash: string }) => {
      const tx = await publicClient.getTransaction({
        hash: hash as Hash,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: formatEther(tx.value),
                gas: tx.gas.toString(),
                gasPrice: tx.gasPrice?.toString(),
                nonce: tx.nonce,
                blockNumber: tx.blockNumber?.toString(),
                status: "confirmed",
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
    "giwa_get_block",
    "Get block information by number or 'latest' on GIWA",
    {
      blockNumber: {
        type: "string",
        description: "Block number or 'latest'",
      },
    },
    async ({ blockNumber }: { blockNumber: string }) => {
      const block =
        blockNumber === "latest"
          ? await publicClient.getBlock()
          : await publicClient.getBlock({
              blockNumber: BigInt(blockNumber),
            });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                number: block.number?.toString(),
                hash: block.hash,
                timestamp: block.timestamp.toString(),
                parentHash: block.parentHash,
                gasUsed: block.gasUsed.toString(),
                gasLimit: block.gasLimit.toString(),
                transactions: block.transactions.length,
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
    "giwa_get_latest_block",
    "Get the latest block number on GIWA",
    {},
    async () => {
      const blockNumber = await publicClient.getBlockNumber();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { latestBlock: blockNumber.toString() },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "giwa_read_contract",
    "Read data from a smart contract on GIWA (view/pure functions)",
    {
      address: { type: "string", description: "Contract address" },
      abi: {
        type: "string",
        description: "Contract ABI as JSON string",
      },
      functionName: { type: "string", description: "Function name to call" },
      args: {
        type: "array",
        items: { type: "string" },
        description: "Function arguments",
      },
    },
    async ({
      address,
      abi,
      functionName,
      args,
    }: {
      address: string;
      abi: string;
      functionName: string;
      args?: string[];
    }) => {
      const parsedAbi = parseAbi(abi as unknown as readonly string[]);
      const result = await publicClient.readContract({
        address: address as Address,
        abi: parsedAbi,
        functionName,
        args: args || [],
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                contract: address,
                function: functionName,
                result:
                  typeof result === "bigint"
                    ? result.toString()
                    : result,
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
    "giwa_write_contract",
    "Write data to a smart contract on GIWA (requires PRIVATE_KEY env)",
    {
      address: { type: "string", description: "Contract address" },
      abi: {
        type: "string",
        description: "Contract ABI as JSON string",
      },
      functionName: { type: "string", description: "Function name" },
      args: {
        type: "array",
        items: { type: "string" },
        description: "Function arguments",
      },
      value: {
        type: "string",
        description: "ETH value to send (in ETH, optional)",
      },
    },
    async ({
      address,
      abi,
      functionName,
      args,
      value,
    }: {
      address: string;
      abi: string;
      functionName: string;
      args?: string[];
      value?: string;
    }) => {
      const wallet = getWallet();
      if (!wallet) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: PRIVATE_KEY not set. Cannot write to contracts.",
            },
          ],
        };
      }

      const parsedAbi = parseAbi(abi as unknown as readonly string[]);
      const { request } = await publicClient.simulateContract({
        address: address as Address,
        abi: parsedAbi,
        functionName,
        args: args || [],
        value: value ? BigInt(Math.floor(parseFloat(value) * 1e18)) : undefined,
        account: wallet.account!,
      });

      const hash = await wallet.writeContract(request);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                txHash: hash,
                contract: address,
                function: functionName,
                explorer: `https://sepolia-explorer.giwa.io/tx/${hash}`,
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
    "giwa_estimate_gas",
    "Estimate gas for a transaction on GIWA",
    {
      to: { type: "string", description: "Recipient address" },
      value: {
        type: "string",
        description: "Amount in ETH to send",
      },
      data: {
        type: "string",
        description: "Calldata (0x..., optional)",
      },
    },
    async ({
      to,
      value,
      data,
    }: {
      to: string;
      value?: string;
      data?: string;
    }) => {
      const gas = await publicClient.estimateGas({
        to: to as Address,
        value: value ? BigInt(Math.floor(parseFloat(value) * 1e18)) : undefined,
        data: data as Hex | undefined,
      });

      const gasPrice = await publicClient.getGasPrice();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                gas: gas.toString(),
                gasPrice: gasPrice.toString(),
                gasPriceGwei: formatUnits(gasPrice, 9),
                estimatedCostEth: formatEther(gas * gasPrice),
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
    "giwa_transfer_eth",
    "Send ETH to an address on GIWA (requires PRIVATE_KEY)",
    {
      to: { type: "string", description: "Recipient address" },
      amount: { type: "string", description: "Amount in ETH" },
    },
    async ({ to, amount }: { to: string; amount: string }) => {
      const wallet = getWallet();
      if (!wallet) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: PRIVATE_KEY not set.",
            },
          ],
        };
      }

      const value = BigInt(Math.floor(parseFloat(amount) * 1e18));
      const hash = await wallet.sendTransaction({
        account: wallet.account!,
        to: to as Address,
        value,
        chain: wallet.chain,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                txHash: hash,
                from: wallet.account!.address,
                to,
                amount,
                explorer: `https://sepolia-explorer.giwa.io/tx/${hash}`,
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
    "giwa_transfer_erc20",
    "Send ERC-20 tokens to an address on GIWA (requires PRIVATE_KEY)",
    {
      token: { type: "string", description: "Token contract address" },
      to: { type: "string", description: "Recipient address" },
      amount: { type: "string", description: "Amount (human-readable)" },
    },
    async ({
      token,
      to,
      amount,
    }: {
      token: string;
      to: string;
      amount: string;
    }) => {
      const wallet = getWallet();
      if (!wallet) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: PRIVATE_KEY not set.",
            },
          ],
        };
      }

      const decimals = (await publicClient.readContract({
        address: token as Address,
        abi: parseAbi(["function decimals() view returns (uint8)"]),
        functionName: "decimals",
      })) as number;

      const rawAmount = BigInt(
        Math.floor(parseFloat(amount) * 10 ** decimals)
      );

      const { request } = await publicClient.simulateContract({
        address: token as Address,
        abi: parseAbi([
          "function transfer(address to, uint256 amount) returns (bool)",
        ]),
        functionName: "transfer",
        args: [to as Address, rawAmount],
        account: wallet.account!,
      });

      const hash = await wallet.writeContract(request);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                txHash: hash,
                token,
                to,
                amount,
                explorer: `https://sepolia-explorer.giwa.io/tx/${hash}`,
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
    "giwa_multicall",
    "Batch multiple contract read calls in a single request on GIWA",
    {
      calls: {
        type: "array",
        items: {
          type: "object",
          properties: {
            address: { type: "string" },
            abi: { type: "string" },
            functionName: { type: "string" },
            args: { type: "array", items: { type: "string" } },
          },
        },
        description: "Array of contract calls to batch",
      },
    },
    async ({
      calls,
    }: {
      calls: Array<{
        address: string;
        abi: string;
        functionName: string;
        args?: string[];
      }>;
    }) => {
      const contracts = calls.map((call) => ({
        address: call.address as Address,
        abi: parseAbi(call.abi as unknown as readonly string[]),
        functionName: call.functionName,
        args: call.args || [],
      }));

      const results = await publicClient.multicall({
        contracts: contracts as any,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              results.map((r, i) => ({
                call: calls[i].functionName,
                contract: calls[i].address,
                result:
                  r.status === "success"
                    ? typeof r.result === "bigint"
                      ? r.result.toString()
                      : r.result
                    : `Error: ${r.error?.message}`,
              })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "giwa_get_logs",
    "Get event logs from GIWA blockchain",
    {
      address: {
        type: "string",
        description: "Contract address to filter logs",
      },
      fromBlock: {
        type: "string",
        description: "Start block number (or 'earliest')",
      },
      toBlock: {
        type: "string",
        description: "End block number (or 'latest')",
      },
      topic0: {
        type: "string",
        description: "Event signature hash (optional)",
      },
    },
    async ({
      address,
      fromBlock,
      toBlock,
      topic0,
    }: {
      address?: string;
      fromBlock?: string;
      toBlock?: string;
      topic0?: string;
    }) => {
      const logs = await publicClient.getLogs({
        address: address ? (address as Address) : undefined,
        fromBlock: fromBlock === "earliest" ? 0n : fromBlock ? BigInt(fromBlock) : undefined,
        toBlock: toBlock === "latest" ? undefined : toBlock ? BigInt(toBlock) : undefined,
        events: topic0 ? [{ type: 'event', name: 'Event', inputs: [] }] : undefined,
      } as any);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: logs.length,
                logs: logs.slice(0, 50).map((log) => ({
                  blockNumber: log.blockNumber?.toString(),
                  transactionHash: log.transactionHash,
                  address: log.address,
                  topics: log.topics,
                  data: log.data,
                })),
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
