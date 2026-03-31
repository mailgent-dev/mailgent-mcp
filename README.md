# mailgent-mcp

Identity infrastructure for AI agents — email, credentials, and TOTP in one place.

## Quick Start

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
| `vault.totp` | Generate a TOTP code |
| `vault.store` | Store or update a credential |
| `vault.delete` | Delete a credential |

## Multiple Identities

Each identity is its own MCP server instance:

```json
{
  "mcpServers": {
    "sales-agent": {
      "command": "npx",
      "args": ["-y", "mailgent-mcp"],
      "env": { "MAILGENT_API_KEY": "mgent-sales-key" }
    },
    "support-agent": {
      "command": "npx",
      "args": ["-y", "mailgent-mcp"],
      "env": { "MAILGENT_API_KEY": "mgent-support-key" }
    }
  }
}
```

## Docs

[docs.mailgent.dev](https://docs.mailgent.dev)

## License

MIT
