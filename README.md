# @loomal/mcp

Identity infrastructure for AI agents — email, credentials, and TOTP in one place.

## Quick Start

```json
{
  "mcpServers": {
    "loomal": {
      "command": "npx",
      "args": ["-y", "@loomal/mcp"],
      "env": {
        "LOOMAL_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

Get your API key from [console.loomal.ai](https://console.loomal.ai).

## Examples

```
> Send an onboarding email to the new client
> Check my inbox and reply to the latest message
> Store my Stripe API key in the vault
> Get the TOTP code for my AWS account
> Delete the test thread I created earlier
```

## Tools

### Identity

| Tool | Description |
|------|-------------|
| `mail.whoami` | Get identity info — name, email, scopes |

### Email

| Tool | Description |
|------|-------------|
| `mail.send` | Send email |
| `mail.reply` | Reply to a message |
| `mail.list_messages` | List inbox messages |
| `mail.get_message` | Get a specific message |
| `mail.update_labels` | Update message labels |
| `mail.delete_message` | Delete a message |
| `mail.list_threads` | List conversation threads |
| `mail.get_thread` | Get a full thread |
| `mail.delete_thread` | Delete a thread |

### Vault

| Tool | Description |
|------|-------------|
| `vault.list` | List stored credentials |
| `vault.get` | Get a decrypted credential |
| `vault.totp` | Generate a TOTP code (response includes `backupCodesRemaining`) |
| `vault.totp_use_backup` | Atomically consume one TOTP backup code |
| `vault.store` | Store or update a credential (generic — any type) |
| `vault.storeApiKey` | Store an API key (single secret or OAuth client+secret pair) |
| `vault.storeCard` | Store a payment card — encrypted at rest, vault does not process payments |
| `vault.storeShippingAddress` | Store a shipping / mailing address |
| `vault.delete` | Delete a credential |

## Multiple Identities

Each identity is its own MCP server instance:

```json
{
  "mcpServers": {
    "sales-agent": {
      "command": "npx",
      "args": ["-y", "@loomal/mcp"],
      "env": { "LOOMAL_API_KEY": "loid-sales-key" }
    },
    "support-agent": {
      "command": "npx",
      "args": ["-y", "@loomal/mcp"],
      "env": { "LOOMAL_API_KEY": "loid-support-key" }
    }
  }
}
```

## Docs

[docs.loomal.ai](https://docs.loomal.ai)

## License

MIT
