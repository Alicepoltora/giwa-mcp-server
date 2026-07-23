import { z } from "zod";

const FAUCET_URL = "https://faucet.giwa.io";
const NODIT_FAUCET_URL = "https://faucet.lambda256.io/giwa-sepolia";

export function registerFaucetTools(mcpServer: any) {
  mcpServer.tool(
    "giwa_faucet_info",
    "Get information about available GIWA faucets and their limits",
    {},
    async () => {
      return { content: [{ type: "text" as const, text: JSON.stringify({ faucets: [{ name: "Official GIWA Faucet", url: FAUCET_URL, amount: "0.005 ETH", cooldown: "24 hours", note: "Requires GitHub account" }, { name: "Nodit Faucet", url: NODIT_FAUCET_URL, amount: "0.01 ETH", cooldown: "24 hours", note: "Lambda256/Nodit provider" }], instructions: "Open faucet URL in browser, connect wallet or paste address, claim testnet ETH" }, null, 2) }] };
    }
  );

  mcpServer.tool(
    "giwa_faucet_check_balance",
    "Check if an address has received faucet funds recently",
    {
      address: z.string().describe("Wallet address to check"),
    },
    async ({ address }: { address: string }) => {
      try {
        const resp = await fetch(`https://sepolia-rpc.giwa.io`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }),
        });
        const data = await resp.json();
        const balance = BigInt(data.result);
        const ethBalance = Number(balance) / 1e18;
        return { content: [{ type: "text" as const, text: JSON.stringify({ address, balanceWei: balance.toString(), balanceEth: ethBalance.toFixed(6), hasFunds: ethBalance > 0, note: ethBalance === 0 ? "Address has no funds. Visit faucet to claim testnet ETH." : "Address has funds available." }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }, null, 2) }] };
      }
    }
  );

  mcpServer.tool(
    "giwa_faucet_drip",
    "Attempt to request testnet ETH from the GIWA faucet API",
    {
      address: z.string().describe("Wallet address to receive ETH"),
    },
    async ({ address }: { address: string }) => {
      try {
        const resp = await fetch(`${FAUCET_URL}/api/drip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        const data = await resp.json();
        return { content: [{ type: "text" as const, text: JSON.stringify({ success: resp.ok, address, response: data, note: resp.ok ? "ETH sent! Check your balance." : "Faucet request failed. You may have reached the daily limit." }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message, note: "If API fails, try the web faucet at https://faucet.giwa.io" }, null, 2) }] };
      }
    }
  );
}
