import { z } from "zod";
import { type PublicClient, type WalletClient, type Address, type Hex, type Abi, formatEther, parseEther } from "viem";

const L2_BRIDGE = "0x4200000000000000000000000000000000000010" as Address;
const L2_MESSENGER = "0x4200000000000000000000000000000000000007" as Address;

const BRIDGE_ABI: Abi = [
  { inputs: [], name: "depositETH", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [{ name: "_l1Token", type: "address" }, { name: "_l2Token", type: "address" }, { name: "_amount", type: "uint256" }, { name: "_data", type: "bytes" }], name: "depositERC20", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "withdraw", outputs: [], stateMutability: "payable", type: "function" },
  { inputs: [{ name: "_l2Token", type: "address" }, { name: "_amount", type: "uint256" }, { name: "_data", type: "bytes" }], name: "withdrawERC20", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "_to", type: "address" }], name: "withdrawTo", outputs: [], stateMutability: "payable", type: "function" },
];

const L1_STANDARD_BRIDGE_ABI: Abi = [
  { inputs: [{ name: "_l1Token", type: "address" }, { name: "_l2Token", type: "address" }, { name: "_amount", type: "uint256" }, { name: "_minGasLimit", type: "uint32" }, { name: "_data", type: "bytes" }], name: "depositERC20", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "depositETH", outputs: [], stateMutability: "payable", type: "function" },
];

const MESSENGER_ABI: Abi = [
  { inputs: [{ name: "_target", type: "address" }, { name: "_message", type: "bytes" }, { name: "_gasLimit", type: "uint32" }], name: "sendMessage", outputs: [], stateMutability: "nonpayable", type: "function" },
];

const EXPLORER_API = "https://sepolia-explorer.giwa.io/api";

export function registerBridgeTools(mcpServer: any, publicClient: PublicClient, getWallet: () => WalletClient | null) {
  mcpServer.tool(
    "giwa_bridge_deposit_eth",
    "Deposit ETH from Ethereum L1 to GIWA L2 via the native bridge (requires PRIVATE_KEY with L1 funds)",
    {
      amount: z.string().describe("Amount of ETH to deposit"),
    },
    async ({ amount }: { amount: string }) => {
      const wallet = getWallet();
      if (!wallet) return { content: [{ type: "text" as const, text: "Error: PRIVATE_KEY not set." }] };
      const value = parseEther(amount);
      const hash = await wallet.sendTransaction({ account: wallet.account!, to: L2_BRIDGE, value, chain: wallet.chain });
      return { content: [{ type: "text" as const, text: JSON.stringify({ txHash: hash, amount, direction: "L1 → L2", from: wallet.account!.address, note: "Deposit typically confirms within 1-2 minutes on GIWA" }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_bridge_withdraw_eth",
    "Withdraw ETH from GIWA L2 back to Ethereum L1 (requires PRIVATE_KEY). Warning: withdrawal has ~7 day challenge period.",
    {
      amount: z.string().describe("Amount of ETH to withdraw"),
      to: z.string().optional().describe("Recipient address on L1 (defaults to sender)"),
    },
    async ({ amount, to }: { amount: string; to?: string }) => {
      const wallet = getWallet();
      if (!wallet) return { content: [{ type: "text" as const, text: "Error: PRIVATE_KEY not set." }] };
      const value = parseEther(amount);
      let hash: `0x${string}`;
      if (to) {
        const { request } = await publicClient.simulateContract({ address: L2_BRIDGE, abi: BRIDGE_ABI, functionName: "withdrawTo", args: [to as Address], value, account: wallet.account! });
        hash = await wallet.writeContract(request);
      } else {
        const { request } = await publicClient.simulateContract({ address: L2_BRIDGE, abi: BRIDGE_ABI, functionName: "withdraw", value, account: wallet.account! });
        hash = await wallet.writeContract(request);
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ txHash: hash, amount, direction: "L2 → L1", to: to || wallet.account!.address, note: "Withdrawal has ~7 day challenge period before funds arrive on L1", explorer: `https://sepolia-explorer.giwa.io/tx/${hash}` }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_bridge_estimate_time",
    "Estimate bridge transfer time between L1 and L2",
    {
      direction: z.enum(["l1_to_l2", "l2_to_l1"]).describe("Bridge direction"),
    },
    async ({ direction }: { direction: string }) => {
      const times: Record<string, any> = {
        l1_to_l2: { estimated: "~1-2 minutes", description: "L1→L2 deposits are fast because GIWA produces blocks every 1 second with Flashblocks preconfirmation in ~200ms" },
        l2_to_l1: { estimated: "~7 days", description: "L2→L1 withdrawals require a 7-day challenge period (standard OP Stack fault proof window)" },
      };
      return { content: [{ type: "text" as const, text: JSON.stringify({ direction, ...times[direction], bridge: "https://sepolia-bridge.giwa.io" }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_bridge_get_status",
    "Check bridge transaction status",
    {
      txHash: z.string().describe("Bridge transaction hash"),
    },
    async ({ txHash }: { txHash: string }) => {
      try {
        const resp = await fetch(`${EXPLORER_API}?module=transaction&action=gettxinfo&txhash=${txHash}`);
        const data = await resp.json();
        return { content: [{ type: "text" as const, text: JSON.stringify({ txHash, status: data.status || "unknown", blockNumber: data.blockNumber, from: data.from, to: data.to, value: data.value, source: "Blockscout API" }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ txHash, error: e.message }, null, 2) }] };
      }
    }
  );

  mcpServer.tool(
    "giwa_bridge_list_tokens",
    "List supported bridgeable tokens between Ethereum and GIWA",
    {},
    async () => {
      return { content: [{ type: "text" as const, text: JSON.stringify({ tokens: { ETH: { l1: "Native ETH", l2: "Native ETH", bridgeable: true }, WETH: { l1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", l2: "0x4200000000000000000000000000000000000006", bridgeable: true } }, bridgeUrl: "https://sepolia-bridge.giwa.io", note: "Additional ERC-20 tokens can be bridged via the Standard Bridge contract" }, null, 2) }] };
    }
  );
}
