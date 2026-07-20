import { z } from "zod";
import { type PublicClient, type WalletClient, type Address, type Hex, type Abi, encodeFunctionData, formatEther } from "viem";

const ENTRY_POINT_V06 = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as Address;
const ENTRY_POINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;

const ENTRY_POINT_ABI: Abi = [
  { inputs: [{ name: "sender", type: "address" }, { name: "key", type: "uint192" }], name: "getNonce", outputs: [{ name: "nonce", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ components: [{ name: "sender", type: "address" }, { name: "nonce", type: "uint256" }, { name: "initCode", type: "bytes" }, { name: "callData", type: "bytes" }, { name: "accountGasLimits", type: "bytes32" }, { name: "preVerificationGas", type: "uint256" }, { name: "gasFees", type: "bytes32" }, { name: "paymasterAndData", type: "bytes" }, { name: "signature", type: "bytes" }], name: "userOp", type: "tuple" }], name: "getUserOpHash", outputs: [{ name: "", type: "bytes32" }], stateMutability: "view", type: "function" },
  { inputs: [{ components: [{ name: "sender", type: "address" }, { name: "nonce", type: "uint256" }, { name: "initCode", type: "bytes" }, { name: "callData", type: "bytes" }, { name: "accountGasLimits", type: "bytes32" }, { name: "preVerificationGas", type: "uint256" }, { name: "gasFees", type: "bytes32" }, { name: "paymasterAndData", type: "bytes" }, { name: "signature", type: "bytes" }], name: "ops", type: "tuple[]" }, { name: "beneficiary", type: "address" }], name: "handleOps", outputs: [{ components: [{ name: "actualGasCost", type: "uint256" }, { name: "actualGasUsed", type: "uint256" }], name: "results", type: "tuple[]" }, { components: [{ name: "opIndex", type: "string" }, { name: "innerCode", type: "uint256" }, { name: "extraInfo", type: "string" }], name: "errors", type: "tuple[]" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "account", type: "address" }], name: "getDepositInfo", outputs: [{ components: [{ name: "deposit", type: "uint111" }, { name: "staked", type: "bool" }, { name: "stake", type: "uint111" }, { name: "unstakeDelaySec", type: "uint32" }, { name: "withdrawTime", type: "uint48" }], name: "", type: "tuple" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
];

const EXECUTE_ABI: Abi = [{ inputs: [{ name: "dest", type: "address" }, { name: "value", type: "uint256" }, { name: "func", type: "bytes" }], name: "execute", outputs: [], stateMutability: "nonpayable", type: "function" }];

export function registerAATools(mcpServer: any, publicClient: PublicClient, getWallet: () => WalletClient | null) {
  mcpServer.tool(
    "giwa_aa_get_nonce",
    "Get ERC-4337 account nonce from EntryPoint on GIWA",
    {
      sender: z.string().describe("Smart account address"),
      key: z.string().optional().describe("Nonce key (default: 0)"),
      version: z.string().optional().describe("EntryPoint version: 'v0.6' or 'v0.7' (default: v0.7)"),
    },
    async ({ sender, key = "0", version = "v0.7" }: { sender: string; key?: string; version?: string }) => {
      const entryPoint = version === "v0.6" ? ENTRY_POINT_V06 : ENTRY_POINT_V07;
      const nonce = (await publicClient.readContract({ address: entryPoint, abi: ENTRY_POINT_ABI, functionName: "getNonce", args: [sender as Address, BigInt(key)] })) as bigint;
      return { content: [{ type: "text" as const, text: JSON.stringify({ sender, nonce: nonce.toString(), nonceKey: key, entryPoint, version }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_aa_get_deposit",
    "Get deposit info for a smart account in EntryPoint on GIWA",
    {
      account: z.string().describe("Smart account address"),
      version: z.string().optional().describe("EntryPoint version: 'v0.6' or 'v0.7' (default: v0.7)"),
    },
    async ({ account, version = "v0.7" }: { account: string; version?: string }) => {
      const entryPoint = version === "v0.6" ? ENTRY_POINT_V06 : ENTRY_POINT_V07;
      const [depositInfo, balance] = await Promise.all([
        publicClient.readContract({ address: entryPoint, abi: ENTRY_POINT_ABI, functionName: "getDepositInfo", args: [account as Address] }),
        publicClient.readContract({ address: entryPoint, abi: ENTRY_POINT_ABI, functionName: "balanceOf", args: [account as Address] }),
      ]);
      const info = depositInfo as any;
      return { content: [{ type: "text" as const, text: JSON.stringify({ account, deposit: formatEther(info.deposit), staked: info.staked, stake: formatEther(info.stake), unstakeDelaySec: info.unstakeDelaySec.toString(), withdrawTime: new Date(Number(info.withdrawTime) * 1000).toISOString(), balance: formatEther(balance as bigint), entryPoint, version }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_aa_estimate_userop_gas",
    "Estimate gas for an ERC-4337 UserOperation on GIWA",
    {
      sender: z.string().describe("Smart account address"),
      callData: z.string().describe("Encoded call data for the UserOp (0x...)"),
      initCode: z.string().optional().describe("Init code for account deployment (0x..., optional)"),
    },
    async ({ sender, callData, initCode }: { sender: string; callData: string; initCode?: string }) => {
      const gasPrice = await publicClient.getGasPrice();
      return { content: [{ type: "text" as const, text: JSON.stringify({ sender, callData, initCode: initCode || "0x", estimatedGas: { callGasLimit: "2000000", verificationGasLimit: initCode ? "1000000" : "300000", preVerificationGas: "50000", maxFeePerGas: gasPrice.toString(), maxPriorityFeePerGas: "1000000000" }, note: "Gas limits are estimates. Use eth_estimateUserOpGas on a bundler for precise values." }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_aa_build_userop",
    "Build an ERC-4337 UserOperation structure for GIWA",
    {
      sender: z.string().describe("Smart account address"),
      target: z.string().describe("Target contract to call"),
      value: z.string().optional().describe("ETH value to send (in ETH, default: 0)"),
      data: z.string().optional().describe("Calldata for the target (0x...)"),
      initCode: z.string().optional().describe("Account init code (0x..., for first tx)"),
    },
    async ({ sender, target, value = "0", data = "0x", initCode }: { sender: string; target: string; value?: string; data?: string; initCode?: string }) => {
      const nonce = (await publicClient.readContract({ address: ENTRY_POINT_V07, abi: ENTRY_POINT_ABI, functionName: "getNonce", args: [sender as Address, 0n] })) as bigint;
      const gasPrice = await publicClient.getGasPrice();
      const callData = encodeFunctionData({ abi: EXECUTE_ABI, functionName: "execute", args: [target as Address, BigInt(Math.floor(parseFloat(value) * 1e18)), data as Hex] });
      const userOp = { sender, nonce: nonce.toString(), initCode: initCode || "0x", callData, accountGasLimits: "0x0000000000000000000000000000000000000000000000000000000000000000", preVerificationGas: "50000", gasFees: `0x${gasPrice.toString(16).padStart(64, "0")}`, paymasterAndData: "0x", signature: "0x" };
      return { content: [{ type: "text" as const, text: JSON.stringify({ userOp, entryPoint: ENTRY_POINT_V07, note: "Sign the userOp hash before submitting to bundler" }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_aa_list_entrypoints",
    "List supported ERC-4337 EntryPoint contracts on GIWA",
    {},
    async () => {
      return { content: [{ type: "text" as const, text: JSON.stringify({ entryPoints: { "v0.6": { address: ENTRY_POINT_V06, description: "EntryPoint v0.6.0 - legacy" }, "v0.7": { address: ENTRY_POINT_V07, description: "EntryPoint v0.7.0 - latest" } }, bundler: "Rundler (Alchemy fork) available in GIWA ecosystem", paymaster: "Planned - not yet deployed" }, null, 2) }] };
    }
  );
}
