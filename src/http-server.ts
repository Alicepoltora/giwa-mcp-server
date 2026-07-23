import http from "http";
import { createGiwaMcpServer } from "./server.js";

const PORT = parseInt(process.env.PORT || "3200", 10);
const rpcUrl = process.env.GIWA_RPC_URL;
const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const explorerApiUrl = process.env.BLOCKSCOUT_API_URL;

const mcpServer = createGiwaMcpServer({
  rpcUrl,
  privateKey: privateKey && privateKey.startsWith("0x") ? privateKey : undefined,
  explorerApiUrl,
});

const tools = [
  // EVM Core
  { name: "giwa_get_balance", description: "Get native ETH balance", params: ["address"], category: "EVM" },
  { name: "giwa_get_token_balance", description: "Get ERC-20 token balance", params: ["address", "token"], category: "EVM" },
  { name: "giwa_get_transaction", description: "Get transaction details", params: ["hash"], category: "EVM" },
  { name: "giwa_get_block", description: "Get block info", params: ["blockNumber"], category: "EVM" },
  { name: "giwa_get_latest_block", description: "Get latest block number", params: [], category: "EVM" },
  { name: "giwa_read_contract", description: "Read contract data", params: ["address", "abi", "functionName", "args"], category: "EVM" },
  { name: "giwa_write_contract", description: "Write to contract (needs key)", params: ["address", "abi", "functionName", "args", "value"], category: "EVM" },
  { name: "giwa_estimate_gas", description: "Estimate gas", params: ["to", "value", "data"], category: "EVM" },
  { name: "giwa_transfer_eth", description: "Send ETH (needs key)", params: ["to", "amount"], category: "EVM" },
  { name: "giwa_transfer_erc20", description: "Send tokens (needs key)", params: ["token", "to", "amount"], category: "EVM" },
  { name: "giwa_multicall", description: "Batch contract reads", params: ["calls"], category: "EVM" },
  { name: "giwa_get_logs", description: "Get event logs", params: ["address", "fromBlock", "toBlock"], category: "EVM" },
  // Flashblocks
  { name: "giwa_flashblocks_call", description: "Flashblocks call (~200ms)", params: ["to", "data"], category: "Flashblocks" },
  { name: "giwa_flashblocks_get_balance", description: "Flashblocks balance (pending)", params: ["address"], category: "Flashblocks" },
  { name: "giwa_flashblocks_get_logs", description: "Flashblocks logs (pending)", params: ["address", "fromBlock", "toBlock"], category: "Flashblocks" },
  { name: "giwa_flashblocks_simulate", description: "Flashblocks simulate (~200ms)", params: ["from", "to", "data", "value"], category: "Flashblocks" },
  { name: "giwa_flashblocks_estimate_gas", description: "Flashblocks gas estimate", params: ["from", "to", "data", "value"], category: "Flashblocks" },
  // Dojang
  { name: "giwa_dojang_get_attestation", description: "Get Dojang attestation", params: ["uid"], category: "Dojang" },
  { name: "giwa_dojang_is_valid", description: "Check attestation validity", params: ["uid"], category: "Dojang" },
  { name: "giwa_dojang_list_schemas", description: "List Dojang schemas", params: [], category: "Dojang" },
  { name: "giwa_dojang_attest", description: "Create attestation (needs key)", params: ["schema", "recipient", "data", "revocable"], category: "Dojang" },
  // UP ID
  { name: "giwa_upid_resolve", description: "Resolve UP ID name", params: ["name"], category: "UP ID" },
  { name: "giwa_upid_reverse", description: "Reverse resolve address", params: ["address"], category: "UP ID" },
  { name: "giwa_upid_get_text", description: "Get UP ID text record", params: ["name", "key"], category: "UP ID" },
  { name: "giwa_upid_get_contenthash", description: "Get UP ID contenthash", params: ["name"], category: "UP ID" },
  // DeFi
  { name: "giwa_get_token_info", description: "Get token info", params: ["address"], category: "DeFi" },
  { name: "giwa_get_weth_balance", description: "Get WETH balance", params: ["address"], category: "DeFi" },
  { name: "giwa_get_allowance", description: "Check token allowance", params: ["token", "owner", "spender"], category: "DeFi" },
  { name: "giwa_get_price_redstone", description: "Get price (RedStone)", params: ["token"], category: "DeFi" },
  { name: "giwa_get_price_pyth", description: "Get price (Pyth)", params: ["priceId"], category: "DeFi" },
  { name: "giwa_list_known_contracts", description: "List known contracts", params: [], category: "DeFi" },
  // AA
  { name: "giwa_aa_get_nonce", description: "Get AA nonce", params: ["sender", "key", "version"], category: "AA" },
  { name: "giwa_aa_get_deposit", description: "Get AA deposit info", params: ["account", "version"], category: "AA" },
  { name: "giwa_aa_estimate_userop_gas", description: "Estimate UserOp gas", params: ["sender", "callData", "initCode"], category: "AA" },
  { name: "giwa_aa_build_userop", description: "Build UserOperation", params: ["sender", "target", "value", "data", "initCode"], category: "AA" },
  { name: "giwa_aa_list_entrypoints", description: "List EntryPoints", params: [], category: "AA" },
  // Bridge
  { name: "giwa_bridge_deposit_eth", description: "Deposit ETH L1→L2", params: ["amount"], category: "Bridge" },
  { name: "giwa_bridge_withdraw_eth", description: "Withdraw ETH L2→L1", params: ["amount", "to"], category: "Bridge" },
  { name: "giwa_bridge_estimate_time", description: "Estimate bridge time", params: ["direction"], category: "Bridge" },
  { name: "giwa_bridge_get_status", description: "Check bridge tx status", params: ["txHash"], category: "Bridge" },
  { name: "giwa_bridge_list_tokens", description: "List bridgeable tokens", params: [], category: "Bridge" },
  // Faucet
  { name: "giwa_faucet_info", description: "Get faucet info", params: [], category: "Faucet" },
  { name: "giwa_faucet_check_balance", description: "Check address balance", params: ["address"], category: "Faucet" },
  { name: "giwa_faucet_drip", description: "Request testnet ETH", params: ["address"], category: "Faucet" },
  // AI Agent
  { name: "giwa_agent_create_wallet", description: "Create agent wallet", params: [], category: "Agent" },
  { name: "giwa_agent_generate_mnemonic", description: "Generate mnemonic", params: ["wordCount"], category: "Agent" },
  { name: "giwa_agent_get_portfolio", description: "Get full portfolio", params: ["address"], category: "Agent" },
  { name: "giwa_agent_get_tx_history", description: "Get tx history", params: ["address", "limit"], category: "Agent" },
  { name: "giwa_agent_get_token_transfers", description: "Get token transfers", params: ["address", "contractAddress", "limit"], category: "Agent" },
  { name: "giwa_agent_execute_strategy", description: "Execute multi-step strategy", params: ["steps"], category: "Agent" },
  { name: "giwa_agent_estimate_strategy_cost", description: "Estimate strategy cost", params: ["steps"], category: "Agent" },
  // NFT
  { name: "giwa_nft_get_info", description: "Get NFT metadata", params: ["contract", "tokenId"], category: "NFT" },
  { name: "giwa_nft_get_owner", description: "Get NFT owner", params: ["contract", "tokenId"], category: "NFT" },
  { name: "giwa_nft_get_collection", description: "Get NFTs in collection", params: ["owner", "contract"], category: "NFT" },
  { name: "giwa_nft_detect_standard", description: "Detect ERC-721/1155", params: ["contract"], category: "NFT" },
  { name: "giwa_nft_transfer", description: "Transfer NFT (needs key)", params: ["contract", "tokenId", "to"], category: "NFT" },
  { name: "giwa_nft_get_contract_info", description: "Get NFT collection info", params: ["contract"], category: "NFT" },
  // Dev Tools
  { name: "giwa_verify_contract", description: "Verify contract source", params: ["contractAddress", "sourceCode", "contractName", "compilerVersion"], category: "Dev" },
  { name: "giwa_get_contract_source", description: "Get verified source code", params: ["address"], category: "Dev" },
  { name: "giwa_decode_tx_input", description: "Decode tx calldata", params: ["data", "abi", "contractAddress"], category: "Dev" },
  { name: "giwa_decode_event_log", description: "Decode event log", params: ["topics", "data", "abi"], category: "Dev" },
  { name: "giwa_simulate_transaction", description: "Simulate transaction", params: ["from", "to", "value", "data"], category: "Dev" },
  { name: "giwa_get_storage_slot", description: "Read storage slot", params: ["address", "slot"], category: "Dev" },
  { name: "giwa_get_bytecode", description: "Get contract bytecode", params: ["address"], category: "Dev" },
  { name: "giwa_get_transaction_receipt", description: "Get tx receipt + logs", params: ["hash"], category: "Dev" },
  // Analytics
  { name: "giwa_get_chain_stats", description: "Get chain statistics", params: [], category: "Analytics" },
  { name: "giwa_get_token_holders", description: "Get top token holders", params: ["contractAddress", "limit"], category: "Analytics" },
  { name: "giwa_get_token_transfers", description: "Get token transfers", params: ["contractAddress", "limit"], category: "Analytics" },
  { name: "giwa_get_address_details", description: "Get address details", params: ["address"], category: "Analytics" },
  { name: "giwa_get_block_range", description: "Get block range stats", params: ["fromBlock", "toBlock"], category: "Analytics" },
  { name: "giwa_get_pending_transactions", description: "Get pending txs", params: [], category: "Analytics" },
];

function generateHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GIWA MCP Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'SF Mono', 'Fira Code', monospace; background: #0a0a0a; color: #e0e0e0; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; background: linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { color: #888; margin-bottom: 2rem; font-size: 1.1rem; }
    .badge { display: inline-block; background: #1a1a2e; border: 1px solid #333; border-radius: 6px; padding: 0.3rem 0.8rem; margin: 0.2rem; font-size: 0.85rem; color: #a78bfa; }
    .section { margin: 2rem 0; }
    .section h2 { color: #a78bfa; margin-bottom: 1rem; font-size: 1.3rem; border-bottom: 1px solid #222; padding-bottom: 0.5rem; }
    .tool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1rem; }
    .tool-card { background: #111; border: 1px solid #222; border-radius: 8px; padding: 1.2rem; cursor: pointer; transition: all 0.2s; }
    .tool-card:hover { border-color: #6366f1; transform: translateY(-2px); box-shadow: 0 4px 20px rgba(99,102,241,0.15); }
    .tool-card h3 { color: #c4b5fd; font-size: 0.95rem; margin-bottom: 0.3rem; }
    .tool-card p { color: #888; font-size: 0.85rem; }
    .tool-card .params { color: #666; font-size: 0.8rem; margin-top: 0.5rem; }
    .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 100; justify-content: center; align-items: center; }
    .modal-overlay.active { display: flex; }
    .modal { background: #111; border: 1px solid #333; border-radius: 12px; padding: 2rem; width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto; }
    .modal h2 { color: #a78bfa; margin-bottom: 1rem; }
    .modal label { display: block; color: #888; margin: 0.5rem 0 0.3rem; font-size: 0.85rem; }
    .modal input, .modal textarea { width: 100%; background: #0a0a0a; border: 1px solid #333; border-radius: 6px; padding: 0.7rem; color: #e0e0e0; font-family: inherit; font-size: 0.9rem; margin-bottom: 0.8rem; }
    .modal input:focus, .modal textarea:focus { outline: none; border-color: #6366f1; }
    .btn { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 6px; padding: 0.7rem 1.5rem; cursor: pointer; font-family: inherit; font-size: 0.9rem; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
    .btn-secondary { background: #222; color: #a78bfa; }
    .result { background: #0a0a0a; border: 1px solid #222; border-radius: 6px; padding: 1rem; margin-top: 1rem; white-space: pre-wrap; font-size: 0.85rem; color: #a78bfa; max-height: 400px; overflow-y: auto; }
    .result.error { border-color: #ef4444; color: #ef4444; }
    .loading { color: #666; }
    .stats { display: flex; gap: 2rem; margin: 1.5rem 0; flex-wrap: wrap; }
    .stat { background: #111; border: 1px solid #222; border-radius: 8px; padding: 1rem 1.5rem; }
    .stat-value { font-size: 1.8rem; color: #a78bfa; font-weight: bold; }
    .stat-label { color: #666; font-size: 0.8rem; margin-top: 0.3rem; }
    .network-info { background: #111; border: 1px solid #222; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; }
    .network-info table { width: 100%; }
    .network-info td { padding: 0.4rem 0; }
    .network-info td:first-child { color: #666; width: 140px; }
    .network-info td:last-child { color: #a78bfa; }
    .install-block { background: #111; border: 1px solid #222; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; }
    .install-block code { color: #a78bfa; background: #0a0a0a; padding: 0.2rem 0.5rem; border-radius: 4px; }
    .copy-btn { background: none; border: 1px solid #333; color: #888; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem; float: right; }
    .copy-btn:hover { border-color: #6366f1; color: #a78bfa; }
    footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #222; color: #555; font-size: 0.8rem; text-align: center; }
    footer a { color: #6366f1; text-decoration: none; }
    @media (max-width: 768px) { .tool-grid { grid-template-columns: 1fr; } .stats { flex-direction: column; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>GIWA MCP Server</h1>
    <p class="subtitle">Model Context Protocol server for GIWA blockchain — OP Stack L2 by Upbit</p>
    <div>
      <span class="badge">Chain ID 91342</span>
      <span class="badge">OP Stack</span>
      <span class="badge">Flashblocks</span>
      <span class="badge">30+ Tools</span>
      <span class="badge">ERC-4337</span>
      <span class="badge">EAS/Dojang</span>
    </div>

    <div class="stats">
      <div class="stat"><div class="stat-value">${tools.length}</div><div class="stat-label">MCP Tools</div></div>
      <div class="stat"><div class="stat-value">12</div><div class="stat-label">Categories</div></div>
      <div class="stat"><div class="stat-value">~200ms</div><div class="stat-label">Flashblocks</div></div>
      <div class="stat"><div class="stat-value">1s</div><div class="stat-label">Block Time</div></div>
    </div>

    <div class="section">
      <h2>Network</h2>
      <div class="network-info">
        <table>
          <tr><td>Network</td><td>GIWA Sepolia (testnet)</td></tr>
          <tr><td>Chain ID</td><td>91342</td></tr>
          <tr><td>RPC</td><td>https://sepolia-rpc.giwa.io</td></tr>
          <tr><td>Flashblocks RPC</td><td>https://sepolia-rpc-flashblocks.giwa.io</td></tr>
          <tr><td>Explorer</td><td>https://sepolia-explorer.giwa.io</td></tr>
          <tr><td>Bridge</td><td>https://sepolia-bridge.giwa.io</td></tr>
          <tr><td>Faucet</td><td>https://faucet.giwa.io</td></tr>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>Quick Start</h2>
      <div class="install-block">
        <button class="copy-btn" onclick="navigator.clipboard.writeText('npx giwa-mcp-server')">copy</button>
        <p style="color:#888;margin-bottom:0.5rem">Run with npx:</p>
        <code>npx giwa-mcp-server</code>
      </div>
      <div class="install-block">
        <button class="copy-btn" onclick="navigator.clipboard.writeText(JSON.stringify({mcpServers:{giwa:{command:'npx',args:['giwa-mcp-server'],env:{GIWA_RPC_URL:'https://sepolia-rpc.giwa.io'}}}},null,2))">copy</button>
        <p style="color:#888;margin-bottom:0.5rem">Claude Desktop config:</p>
        <code style="white-space:pre">{
  "mcpServers": {
    "giwa": {
      "command": "npx",
      "args": ["giwa-mcp-server"],
      "env": {
        "GIWA_RPC_URL": "https://sepolia-rpc.giwa.io"
      }
    }
  }
}</code>
      </div>
    </div>

    <div class="section">
      <h2>Tools — Try It Live (${tools.length} tools)</h2>
      ${(() => {
        const categories: Record<string, typeof tools> = {};
        tools.forEach(t => { const cat = (t as any).category || "Other"; if (!categories[cat]) categories[cat] = []; categories[cat].push(t); });
        return Object.entries(categories).map(([cat, catTools]) => `
          <h3 style="color:#6366f1;margin:1.5rem 0 0.8rem;font-size:1.1rem">${cat} (${catTools.length})</h3>
          <div class="tool-grid">
            ${catTools.map(t => `
            <div class="tool-card" onclick="openTool('${t.name}', ${JSON.stringify(t.params)})">
              <h3>${t.name}</h3>
              <p>${t.description}</p>
              ${t.params.length ? `<div class="params">params: ${t.params.join(', ')}</div>` : '<div class="params">no params</div>'}
            </div>`).join('')}
          </div>`).join('');
      })()}
    </div>

    <div class="section">
      <h2>API Endpoint</h2>
      <div class="install-block">
        <p style="color:#888;margin-bottom:0.5rem">POST /api/tools/:toolName</p>
        <code>curl -X POST https://giwa.gogettest.online/api/tools/giwa_get_balance \\
  -H "Content-Type: application/json" \\
  -d '{"address": "0x..."}'</code>
      </div>
    </div>

    <footer>
      <p>GIWA MCP Server &mdash; <a href="https://github.com/Alicepoltora/giwa-mcp-server">GitHub</a> &mdash; <a href="https://giwa.io">giwa.io</a></p>
    </footer>
  </div>

  <div class="modal-overlay" id="modal">
    <div class="modal">
      <h2 id="modal-title"></h2>
      <div id="modal-params"></div>
      <button class="btn" onclick="executeTool()" id="exec-btn">Execute</button>
      <button class="btn btn-secondary" onclick="closeModal()" style="margin-left:0.5rem">Close</button>
      <div class="result" id="result" style="display:none"></div>
    </div>
  </div>

  <script>
    let currentTool = null;
    function openTool(name, params) {
      currentTool = name;
      document.getElementById('modal-title').textContent = name;
      const paramsDiv = document.getElementById('modal-params');
      paramsDiv.innerHTML = params.length
        ? params.map(p => '<label>' + p + '</label><input id="param-' + p + '" placeholder="' + p + '" />').join('')
        : '<p style="color:#666">No parameters required</p>';
      document.getElementById('result').style.display = 'none';
      document.getElementById('modal').classList.add('active');
    }
    function closeModal() { document.getElementById('modal').classList.remove('active'); }
    async function executeTool() {
      const resultDiv = document.getElementById('result');
      const btn = document.getElementById('exec-btn');
      resultDiv.style.display = 'block';
      resultDiv.className = 'result';
      resultDiv.textContent = 'Loading...';
      btn.disabled = true;
      try {
        const params = {};
        document.querySelectorAll('#modal-params input').forEach(i => {
          if (i.value) {
            const key = i.id.replace('param-', '');
            try { params[key] = JSON.parse(i.value); } catch { params[key] = i.value; }
          }
        });
        const resp = await fetch('/api/tools/' + currentTool, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
        const data = await resp.json();
        resultDiv.textContent = JSON.stringify(data, null, 2);
        if (data.error) resultDiv.classList.add('error');
      } catch (e) { resultDiv.textContent = 'Error: ' + e.message; resultDiv.classList.add('error'); }
      btn.disabled = false;
    }
    document.getElementById('modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(generateHTML());
    return;
  }

  if (req.method === "GET" && req.url === "/api/tools") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(tools));
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", network: "GIWA Sepolia", chainId: 91342, tools: tools.length }));
    return;
  }

  if (req.method === "POST" && req.url?.startsWith("/api/tools/")) {
    const toolName = req.url.replace("/api/tools/", "");
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const params = body ? JSON.parse(body) : {};
      const result = await (mcpServer as any)._registeredTools?.[toolName]?.callback?.(params)
        || await callToolDirect(mcpServer, toolName, params);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (e: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

async function callToolDirect(mcp: any, toolName: string, params: any) {
  const tools = mcp._registeredTools || {};
  const tool = tools[toolName];
  if (!tool) throw new Error(`Tool ${toolName} not found`);
  const handler = tool.callback || tool.handler;
  if (!handler) throw new Error(`No handler for ${toolName}`);
  return await handler(params);
}

server.listen(PORT, () => {
  console.log(`GIWA MCP HTTP Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT}`);
});
