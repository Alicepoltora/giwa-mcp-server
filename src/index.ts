#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGiwaMcpServer } from "./server.js";

async function main() {
  const rpcUrl = process.env.GIWA_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  const explorerApiUrl = process.env.BLOCKSCOUT_API_URL;

  const server = createGiwaMcpServer({
    rpcUrl,
    privateKey: privateKey && privateKey.startsWith("0x") ? privateKey : undefined,
    explorerApiUrl,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("GIWA MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
