import { z } from "zod";
import { type PublicClient, type Address, type Hex, type Abi, decodeFunctionData, decodeEventLog, formatEther } from "viem";

const EXPLORER_API = "https://sepolia-explorer.giwa.io/api";

export function registerDevTools(mcpServer: any, publicClient: PublicClient) {
  mcpServer.tool(
    "giwa_verify_contract",
    "Verify contract source code on Blockscout (submit source + ABI)",
    {
      contractAddress: z.string().describe("Deployed contract address"),
      sourceCode: z.string().describe("Solidity source code"),
      contractName: z.string().describe("Contract name"),
      compilerVersion: z.string().describe("Solidity compiler version (e.g., v0.8.20+commit.a1b79de6)"),
      optimizationUsed: z.string().optional().describe("Optimization: '1' or '0' (default: '0')"),
      runs: z.string().optional().describe("Optimizer runs (default: '200')"),
    },
    async ({ contractAddress, sourceCode, contractName, compilerVersion, optimizationUsed = "0", runs = "200" }: { contractAddress: string; sourceCode: string; contractName: string; compilerVersion: string; optimizationUsed?: string; runs?: string }) => {
      try {
        const formData = new URLSearchParams();
        formData.append("module", "contract");
        formData.append("action", "verify");
        formData.append("contractaddress", contractAddress);
        formData.append("sourceCode", sourceCode);
        formData.append("contractname", contractName);
        formData.append("compilerversion", compilerVersion);
        formData.append("optimizationUsed", optimizationUsed);
        formData.append("runs", runs);
        const resp = await fetch(EXPLORER_API, { method: "POST", body: formData });
        const data = await resp.json();
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: data.status === "1", contractAddress, message: data.message, result: data.result }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, note: "You can also verify manually at https://sepolia-explorer.giwa.io" }, null, 2) }] };
      }
    }
  );

  mcpServer.tool(
    "giwa_get_contract_source",
    "Get verified source code of a contract from Blockscout",
    {
      address: z.string().describe("Contract address"),
    },
    async ({ address }: { address: string }) => {
      try {
        const resp = await fetch(`${EXPLORER_API}?module=contract&action=getsourcecode&address=${address}`);
        const data = await resp.json();
        if (data.status === "1" && data.result?.[0]) {
          const contract = data.result[0];
          return { content: [{ type: "text" as const, text: JSON.stringify({ address, contractName: contract.ContractName, compilerVersion: contract.CompilerVersion, sourceCode: contract.SourceCode, abi: contract.ABI, optimizationUsed: contract.OptimizationUsed, runs: contract.Runs, verified: contract.SourceCode !== "" }, null, 2) }] };
        }
        return { content: [{ type: "text" as const, text: JSON.stringify({ address, verified: false, message: "Contract not verified" }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }, null, 2) }] };
      }
    }
  );

  mcpServer.tool(
    "giwa_decode_tx_input",
    "Decode transaction calldata using contract ABI",
    {
      data: z.string().describe("Transaction calldata (0x...)"),
      abi: z.string().optional().describe("Contract ABI as JSON (optional, will try to fetch from Blockscout)"),
      contractAddress: z.string().optional().describe("Contract address (to fetch ABI from Blockscout)"),
    },
    async ({ data, abi, contractAddress }: { data: string; abi?: string; contractAddress?: string }) => {
      try {
        let contractAbi: Abi;
        if (abi) {
          contractAbi = JSON.parse(abi) as Abi;
        } else if (contractAddress) {
          const resp = await fetch(`${EXPLORER_API}?module=contract&action=getsourcecode&address=${contractAddress}`);
          const sourceData = await resp.json();
          if (sourceData.result?.[0]?.ABI && sourceData.result[0].ABI !== "Contract source code not verified") {
            contractAbi = JSON.parse(sourceData.result[0].ABI) as Abi;
          } else {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Contract not verified. Provide ABI manually." }, null, 2) }] };
          }
        } else {
          const selector = data.slice(0, 10);
          const knownSelectors: Record<string, string> = {
            "0xa9059cbb": "transfer(address,uint256)",
            "0x23b872dd": "transferFrom(address,address,uint256)",
            "0x095ea7b3": "approve(address,uint256)",
            "0x70a08231": "balanceOf(address)",
            "0x18160ddd": "totalSupply()",
            "0x06fdde03": "name()",
            "0x95d89b41": "symbol()",
            "0x313ce567": "decimals()",
          };
          const signature = knownSelectors[selector];
          if (signature) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ selector, function: signature, note: "Known selector matched. Provide ABI for full decode." }, null, 2) }] };
          }
          return { content: [{ type: "text" as const, text: JSON.stringify({ selector, error: "Unknown selector. Provide ABI or contractAddress." }, null, 2) }] };
        }
        const decoded = decodeFunctionData({ abi: contractAbi, data: data as Hex });
        return { content: [{ type: "text" as const, text: JSON.stringify({ functionName: decoded.functionName, args: decoded.args?.map((a: any) => typeof a === "bigint" ? a.toString() : a) }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }, null, 2) }] };
      }
    }
  );

  mcpServer.tool(
    "giwa_decode_event_log",
    "Decode event log data using contract ABI",
    {
      topics: z.array(z.string()).describe("Log topics array"),
      data: z.string().describe("Log data (0x...)"),
      abi: z.string().describe("Contract ABI as JSON"),
    },
    async ({ topics, data, abi }: { topics: string[]; data: string; abi: string }) => {
      try {
        const contractAbi = JSON.parse(abi) as Abi;
        const decoded = decodeEventLog({ abi: contractAbi, data: data as Hex, topics: topics as [Hex, ...Hex[]] });
        return { content: [{ type: "text" as const, text: JSON.stringify({ eventName: decoded.eventName, args: decoded.args }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }, null, 2) }] };
      }
    }
  );

  mcpServer.tool(
    "giwa_simulate_transaction",
    "Simulate a transaction without sending it (dry run)",
    {
      from: z.string().describe("From address"),
      to: z.string().describe("To address"),
      value: z.string().optional().describe("ETH value"),
      data: z.string().optional().describe("Calldata (0x...)"),
    },
    async ({ from, to, value, data }: { from: string; to: string; value?: string; data?: string }) => {
      try {
        const txObj: any = { from: from as Address, to: to as Address };
        if (value) txObj.value = BigInt(Math.floor(parseFloat(value) * 1e18));
        if (data) txObj.data = data as Hex;
        const gas = await publicClient.estimateGas(txObj);
        const gasPrice = await publicClient.getGasPrice();
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, estimatedGas: gas.toString(), gasPrice: gasPrice.toString(), estimatedCostEth: formatEther(gas * gasPrice), note: "Simulation passed. Transaction should succeed." }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: e.message, note: "Simulation failed. Transaction would revert." }, null, 2) }] };
      }
    }
  );

  mcpServer.tool(
    "giwa_get_storage_slot",
    "Read a storage slot from a contract",
    {
      address: z.string().describe("Contract address"),
      slot: z.string().describe("Storage slot (decimal or hex)"),
    },
    async ({ address, slot }: { address: string; slot: string }) => {
      const slotHex = slot.startsWith("0x") ? slot : `0x${BigInt(slot).toString(16)}`;
      const value = await publicClient.getStorageAt({ address: address as Address, slot: slotHex as Hex });
      return { content: [{ type: "text" as const, text: JSON.stringify({ address, slot: slotHex, value, decimal: value ? BigInt(value).toString() : null }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_get_bytecode",
    "Get deployed bytecode of a contract",
    {
      address: z.string().describe("Contract address"),
    },
    async ({ address }: { address: string }) => {
      const bytecode = await publicClient.getBytecode({ address: address as Address });
      return { content: [{ type: "text" as const, text: JSON.stringify({ address, bytecodeLength: bytecode ? bytecode.length / 2 - 1 : 0, bytecode: bytecode || "0x" }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_get_transaction_receipt",
    "Get detailed transaction receipt with logs",
    {
      hash: z.string().describe("Transaction hash"),
    },
    async ({ hash }: { hash: string }) => {
      const receipt = await publicClient.getTransactionReceipt({ hash: hash as Hex });
      return { content: [{ type: "text" as const, text: JSON.stringify({ hash: receipt.transactionHash, status: receipt.status, blockNumber: receipt.blockNumber.toString(), gasUsed: receipt.gasUsed.toString(), effectiveGasPrice: receipt.effectiveGasPrice.toString(), from: receipt.from, to: receipt.to, contractAddress: receipt.contractAddress, logs: receipt.logs.map(l => ({ address: l.address, topics: l.topics, data: l.data })), logsCount: receipt.logs.length }, null, 2) }] };
    }
  );
}
