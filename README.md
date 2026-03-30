# mailgent-mcp

MCP server for [Mailgent](https://mailgent.dev) — Identity infrastructure for AI agents.

## Setup

Add to your MCP client config:

```json
{
  "mcpServers": {
    "mailgent": {
      "command": "npx",
      "args": ["-y", "mailgent-mcp"],
      "env": {
        "MAILGENT_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

Get your API key from [console.mailgent.dev](https://console.mailgent.dev).

## Compatible Clients

- Claude Code
- Claude Desktop
- Cursor
- Any MCP-compatible client

## Available Tools

### Mail

| Tool | Description |
|------|-------------|
| `mail.whoami` | Get identity info |
| `mail.send` | Send email |
| `mail.reply` | Reply to email |
| `mail.list_messages` | List inbox messages |
| `mail.get_message` | Get specific message |
| `mail.update_labels` | Update message labels |
| `mail.list_threads` | List threads |
| `mail.get_thread` | Get thread with messages |

### Vault

| Tool | Description |
|------|-------------|
| `vault.list` | List credentials (metadata) |
| `vault.get` | Get decrypted credential |
| `vault.totp` | Get TOTP 6-digit code |
| `vault.store` | Store credential |
| `vault.delete` | Delete credential |

## Multiple Identities

Use separate MCP server instances per identity:

```json
{
  "mcpServers": {
    "mailgent-sales": {
      "command": "npx",
      "args": ["-y", "mailgent-mcp"],
      "env": {
        "MAILGENT_API_KEY": "mgent-sales-key"
      }
    },
    "mailgent-support": {
      "command": "npx",
      "args": ["-y", "mailgent-mcp"],
      "env": {
        "MAILGENT_API_KEY": "mgent-support-key"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAILGENT_API_KEY` | Yes | — | Your Mailgent API key |
| `MAILGENT_API_URL` | No | `https://api.mailgent.dev` | API base URL |

## Documentation

- [Docs](https://docs.mailgent.dev)
- [MCP Setup Guide](https://docs.mailgent.dev/docs/mcp/setup)
- [API Reference](https://docs.mailgent.dev/docs/api-reference/authentication)

## License

MIT
