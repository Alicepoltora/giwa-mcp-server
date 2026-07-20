# GIWA MCP Server

MCP (Model Context Protocol) server for the [GIWA blockchain](https://giwa.io) — an OP Stack Layer 2 by Upbit/Dunamu.

Enables AI agents and LLMs to interact with GIWA chain: query balances, read/write contracts, use Flashblocks (200ms preconfirmation), manage Dojang attestations, resolve UP ID names, and more.

## Features

### Core EVM Tools
- `giwa_get_balance` — ETH balance
- `giwa_get_token_balance` — ERC-20 balance
- `giwa_get_transaction` — Transaction details
- `giwa_get_block` / `giwa_get_latest_block` — Block info
- `giwa_read_contract` / `giwa_write_contract` — Contract interaction
- `giwa_estimate_gas` — Gas estimation
- `giwa_transfer_eth` / `giwa_transfer_erc20` — Token transfers
- `giwa_multicall` — Batched contract reads
- `giwa_get_logs` — Event logs

### GIWA Flashblocks (Unique)
- `giwa_flashblocks_call` — ~200ms preconfirmed reads
- `giwa_flashblocks_get_balance` — Pending balance
- `giwa_flashblocks_get_logs` — Pending logs
- `giwa_flashblocks_simulate` — Pre-flight simulation
- `giwa_flashblocks_estimate_gas` — Pending gas estimate

### Dojang Attestations
- `giwa_dojang_get_attestation` — Fetch attestation by UID
- `giwa_dojang_is_valid` — Check validity
- `giwa_dojang_attest` — Create attestation
- `giwa_dojang_revoke` — Revoke attestation
- `giwa_dojang_list_schemas` — Known schemas

### UP ID (ENS-based naming)
- `giwa_upid_resolve` — Name → address
- `giwa_upid_reverse` — Address → name
- `giwa_upid_get_text` — Text records
- `giwa_upid_get_contenthash` — Content hash

### DeFi / Oracles
- `giwa_get_token_info` — Token metadata
- `giwa_get_weth_balance` — WETH balance
- `giwa_get_allowance` — ERC-20 allowance
- `giwa_get_price_redstone` — RedStone price feeds (300+ assets)
- `giwa_get_price_pyth` — Pyth Network prices (on-chain)
- `giwa_list_known_contracts` — Pre-deployed contracts

### Account Abstraction (ERC-4337)
- `giwa_aa_get_nonce` — Smart account nonce
- `giwa_aa_get_deposit` — EntryPoint deposit
- `giwa_aa_estimate_userop_gas` — UserOp gas estimate
- `giwa_aa_build_userop` — Build UserOperation
- `giwa_aa_list_entrypoints` — Supported entry points

## Installation

```bash
npm install giwa-mcp-server
```

Or run directly with npx:

```bash
npx giwa-mcp-server
```

## Configuration

Create a `.env` file:

```env
GIWA_RPC_URL=https://sepolia-rpc.giwa.io
PRIVATE_KEY=0x...          # Optional: for write operations
BLOCKSCOUT_API_URL=https://sepolia-explorer.giwa.io/api
```

## Usage with Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "giwa": {
      "command": "npx",
      "args": ["giwa-mcp-server"],
      "env": {
        "GIWA_RPC_URL": "https://sepolia-rpc.giwa.io"
      }
    }
  }
}
```

With private key for write operations:

```json
{
  "mcpServers": {
    "giwa": {
      "command": "npx",
      "args": ["giwa-mcp-server"],
      "env": {
        "GIWA_RPC_URL": "https://sepolia-rpc.giwa.io",
        "PRIVATE_KEY": "0xYOUR_PRIVATE_KEY"
      }
    }
  }
}
```

## Usage with Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "giwa": {
      "command": "npx",
      "args": ["giwa-mcp-server"]
    }
  }
}
```

## Development

```bash
git clone https://github.com/Alicepoltora/giwa-mcp-server.git
cd giwa-mcp-server
npm install
npm run dev
```

Build:

```bash
npm run build
npm start
```

## Network Info

| Property | Value |
|----------|-------|
| Network | GIWA Sepolia (testnet) |
| Chain ID | 91342 |
| RPC | https://sepolia-rpc.giwa.io |
| Flashblocks RPC | https://sepolia-rpc-flashblocks.giwa.io |
| Explorer | https://sepolia-explorer.giwa.io |
| Bridge | https://sepolia-bridge.giwa.io |
| Block Time | 1 second |
| Preconfirmation | ~200ms (Flashblocks) |

## Why GIWA MCP?

- **First MCP server for GIWA** — no alternatives exist
- **Flashblocks integration** — unique 200ms preconfirmation feature
- **Dojang attestations** — on-chain KYC/verification via UPbit
- **UP ID support** — GIWA's native naming system
- **ERC-4337 ready** — Account Abstraction support
- **30+ tools** — comprehensive blockchain interaction

## License

MIT
