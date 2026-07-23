# GIWA MCP Server

MCP (Model Context Protocol) server for the [GIWA blockchain](https://giwa.io) — an OP Stack Layer 2 by Upbit/Dunamu.

**71 tools** enabling AI agents and LLMs to interact with GIWA chain.

## Live Demo

**https://giwa.gogettest.online/** — Interactive web UI with all 71 tools

## Tool Categories (12)

### EVM Core (12 tools)
`giwa_get_balance` `giwa_get_token_balance` `giwa_get_transaction` `giwa_get_block` `giwa_get_latest_block` `giwa_read_contract` `giwa_write_contract` `giwa_estimate_gas` `giwa_transfer_eth` `giwa_transfer_erc20` `giwa_multicall` `giwa_get_logs`

### Flashblocks (5 tools)
`giwa_flashblocks_call` `giwa_flashblocks_get_balance` `giwa_flashblocks_get_logs` `giwa_flashblocks_simulate` `giwa_flashblocks_estimate_gas`

### Dojang Attestations (4 tools)
`giwa_dojang_get_attestation` `giwa_dojang_is_valid` `giwa_dojang_attest` `giwa_dojang_revoke` `giwa_dojang_list_schemas`

### UP ID (4 tools)
`giwa_upid_resolve` `giwa_upid_reverse` `giwa_upid_get_text` `giwa_upid_get_contenthash`

### DeFi / Oracles (6 tools)
`giwa_get_token_info` `giwa_get_weth_balance` `giwa_get_allowance` `giwa_get_price_redstone` `giwa_get_price_pyth` `giwa_list_known_contracts`

### Account Abstraction (5 tools)
`giwa_aa_get_nonce` `giwa_aa_get_deposit` `giwa_aa_estimate_userop_gas` `giwa_aa_build_userop` `giwa_aa_list_entrypoints`

### Bridge (5 tools)
`giwa_bridge_deposit_eth` `giwa_bridge_withdraw_eth` `giwa_bridge_estimate_time` `giwa_bridge_get_status` `giwa_bridge_list_tokens`

### Faucet (3 tools)
`giwa_faucet_info` `giwa_faucet_check_balance` `giwa_faucet_drip`

### AI Agent (7 tools)
`giwa_agent_create_wallet` `giwa_agent_generate_mnemonic` `giwa_agent_get_portfolio` `giwa_agent_get_tx_history` `giwa_agent_get_token_transfers` `giwa_agent_execute_strategy` `giwa_agent_estimate_strategy_cost`

### NFT (6 tools)
`giwa_nft_get_info` `giwa_nft_get_owner` `giwa_nft_get_collection` `giwa_nft_detect_standard` `giwa_nft_transfer` `giwa_nft_get_contract_info`

### Developer Tools (8 tools)
`giwa_verify_contract` `giwa_get_contract_source` `giwa_decode_tx_input` `giwa_decode_event_log` `giwa_simulate_transaction` `giwa_get_storage_slot` `giwa_get_bytecode` `giwa_get_transaction_receipt`

### Analytics (6 tools)
`giwa_get_chain_stats` `giwa_get_token_holders` `giwa_get_token_transfers` `giwa_get_address_details` `giwa_get_block_range` `giwa_get_pending_transactions`

## Quick Start

```bash
npx giwa-mcp-server
```

## Claude Desktop Config

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

## HTTP API

```bash
# List all tools
curl https://giwa.gogettest.online/api/tools

# Call a tool
curl -X POST https://giwa.gogettest.online/api/tools/giwa_get_balance \
  -H "Content-Type: application/json" \
  -d '{"address": "0x..."}'

# Health check
curl https://giwa.gogettest.online/health
```

## Network

| Property | Value |
|----------|-------|
| Network | GIWA Sepolia (testnet) |
| Chain ID | 91342 |
| RPC | https://sepolia-rpc.giwa.io |
| Flashblocks | https://sepolia-rpc-flashblocks.giwa.io |
| Explorer | https://sepolia-explorer.giwa.io |
| Bridge | https://sepolia-bridge.giwa.io |
| Faucet | https://faucet.giwa.io |

## License

MIT
