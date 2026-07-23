import { z } from "zod";
import { type PublicClient, type WalletClient, type Address, type Hex, type Abi, parseAbi } from "viem";

const ERC721_ABI: Abi = [
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "index", type: "uint256" }], name: "tokenOfOwnerByIndex", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenId", type: "uint256" }], name: "tokenURI", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "name", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenId", type: "uint256" }], name: "ownerOf", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], name: "transferFrom", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], name: "safeTransferFrom", outputs: [], stateMutability: "nonpayable", type: "function" },
];

const ERC1155_ABI: Abi = [
  { inputs: [{ name: "account", type: "address" }, { name: "id", type: "uint256" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "id", type: "uint256" }], name: "uri", outputs: [{ name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "id", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "data", type: "bytes" }], name: "safeTransferFrom", outputs: [], stateMutability: "nonpayable", type: "function" },
];

const ERC165_ABI: Abi = [
  { inputs: [{ name: "interfaceId", type: "bytes4" }], name: "supportsInterface", outputs: [{ name: "", type: "bool" }], stateMutability: "view", type: "function" },
];

const ERC721_INTERFACE_ID = "0x80ac58cd";
const ERC1155_INTERFACE_ID = "0xd9b67a26";
const EXPLORER_API = "https://sepolia-explorer.giwa.io/api";

export function registerNftTools(mcpServer: any, publicClient: PublicClient, getWallet: () => WalletClient | null) {
  mcpServer.tool(
    "giwa_nft_get_info",
    "Get NFT metadata (ERC-721 or ERC-1155)",
    {
      contract: z.string().describe("NFT contract address"),
      tokenId: z.string().describe("Token ID"),
    },
    async ({ contract, tokenId }: { contract: string; tokenId: string }) => {
      try {
        let tokenURI: string;
        let standard = "ERC-721";
        try {
          tokenURI = (await publicClient.readContract({ address: contract as Address, abi: ERC721_ABI, functionName: "tokenURI", args: [BigInt(tokenId)] })) as string;
        } catch {
          tokenURI = (await publicClient.readContract({ address: contract as Address, abi: ERC1155_ABI, functionName: "uri", args: [BigInt(tokenId)] })) as string;
          standard = "ERC-1155";
        }
        let metadata: any = null;
        if (tokenURI.startsWith("http") || tokenURI.startsWith("ipfs://")) {
          const url = tokenURI.replace("ipfs://", "https://ipfs.io/ipfs/");
          try { metadata = await (await fetch(url)).json(); } catch {}
        }
        const owner = (await publicClient.readContract({ address: contract as Address, abi: ERC721_ABI, functionName: "ownerOf", args: [BigInt(tokenId)] }).catch(() => null)) as Address | null;
        return { content: [{ type: "text" as const, text: JSON.stringify({ contract, tokenId, standard, owner, tokenURI, metadata }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ contract, tokenId, error: e.message }, null, 2) }] };
      }
    }
  );

  mcpServer.tool(
    "giwa_nft_get_owner",
    "Get the owner of a specific NFT",
    {
      contract: z.string().describe("NFT contract address"),
      tokenId: z.string().describe("Token ID"),
    },
    async ({ contract, tokenId }: { contract: string; tokenId: string }) => {
      const owner = (await publicClient.readContract({ address: contract as Address, abi: ERC721_ABI, functionName: "ownerOf", args: [BigInt(tokenId)] })) as Address;
      return { content: [{ type: "text" as const, text: JSON.stringify({ contract, tokenId, owner }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_nft_get_collection",
    "Get all NFTs owned by an address in a specific collection",
    {
      owner: z.string().describe("Owner address"),
      contract: z.string().describe("NFT contract address"),
    },
    async ({ owner, contract }: { owner: string; contract: string }) => {
      try {
        const balance = (await publicClient.readContract({ address: contract as Address, abi: ERC721_ABI, functionName: "balanceOf", args: [owner as Address] })) as bigint;
        const count = Number(balance);
        const tokenIds: string[] = [];
        for (let i = 0; i < Math.min(count, 50); i++) {
          try {
            const tokenId = (await publicClient.readContract({ address: contract as Address, abi: ERC721_ABI, functionName: "tokenOfOwnerByIndex", args: [owner as Address, BigInt(i)] })) as bigint;
            tokenIds.push(tokenId.toString());
          } catch { break; }
        }
        return { content: [{ type: "text" as const, text: JSON.stringify({ owner, contract, totalOwned: count, tokenIds }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ owner, contract, error: e.message, note: "Contract may not support ERC-721 Enumerable" }, null, 2) }] };
      }
    }
  );

  mcpServer.tool(
    "giwa_nft_detect_standard",
    "Detect if a contract is ERC-721 or ERC-1155",
    {
      contract: z.string().describe("Contract address to check"),
    },
    async ({ contract }: { contract: string }) => {
      let isERC721 = false;
      let isERC1155 = false;
      try { isERC721 = (await publicClient.readContract({ address: contract as Address, abi: ERC165_ABI, functionName: "supportsInterface", args: [ERC721_INTERFACE_ID] })) as boolean; } catch {}
      try { isERC1155 = (await publicClient.readContract({ address: contract as Address, abi: ERC165_ABI, functionName: "supportsInterface", args: [ERC1155_INTERFACE_ID] })) as boolean; } catch {}
      let name = "", symbol = "";
      try { name = (await publicClient.readContract({ address: contract as Address, abi: ERC721_ABI, functionName: "name" })) as string; } catch {}
      try { symbol = (await publicClient.readContract({ address: contract as Address, abi: ERC721_ABI, functionName: "symbol" })) as string; } catch {}
      return { content: [{ type: "text" as const, text: JSON.stringify({ contract, name, symbol, isERC721, isERC1155, standard: isERC721 ? "ERC-721" : isERC1155 ? "ERC-1155" : "Unknown" }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_nft_transfer",
    "Transfer an NFT to another address (requires PRIVATE_KEY)",
    {
      contract: z.string().describe("NFT contract address"),
      tokenId: z.string().describe("Token ID to transfer"),
      to: z.string().describe("Recipient address"),
    },
    async ({ contract, tokenId, to }: { contract: string; tokenId: string; to: string }) => {
      const wallet = getWallet();
      if (!wallet) return { content: [{ type: "text" as const, text: "Error: PRIVATE_KEY not set." }] };
      const { request } = await publicClient.simulateContract({ address: contract as Address, abi: ERC721_ABI, functionName: "transferFrom", args: [wallet.account!.address, to as Address, BigInt(tokenId)], account: wallet.account! });
      const hash = await wallet.writeContract(request);
      return { content: [{ type: "text" as const, text: JSON.stringify({ txHash: hash, contract, tokenId, from: wallet.account!.address, to, explorer: `https://sepolia-explorer.giwa.io/tx/${hash}` }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_nft_get_contract_info",
    "Get NFT collection info (name, symbol, total supply)",
    {
      contract: z.string().describe("NFT contract address"),
    },
    async ({ contract }: { contract: string }) => {
      let name = "", symbol = "", totalSupply = "unknown";
      try { name = (await publicClient.readContract({ address: contract as Address, abi: ERC721_ABI, functionName: "name" })) as string; } catch {}
      try { symbol = (await publicClient.readContract({ address: contract as Address, abi: ERC721_ABI, functionName: "symbol" })) as string; } catch {}
      try { totalSupply = ((await publicClient.readContract({ address: contract as Address, abi: ERC721_ABI, functionName: "totalSupply" })) as bigint).toString(); } catch {}
      return { content: [{ type: "text" as const, text: JSON.stringify({ contract, name, symbol, totalSupply }, null, 2) }] };
    }
  );
}
