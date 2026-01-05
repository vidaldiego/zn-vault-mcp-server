# ZN-Vault MCP Server

MCP (Model Context Protocol) server for ZN-Vault secrets management. Enables AI assistants like Claude, Cursor, and other MCP-compatible tools to securely access secrets from your vault.

## Installation

```bash
npm install -g @zincapp/znvault-mcp-server
```

Or run directly with npx:

```bash
npx @zincapp/znvault-mcp-server
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ZNVAULT_URL` | Yes | Vault server URL (e.g., `https://vault.example.com`) |
| `ZNVAULT_API_KEY` | Yes | API key for authentication |
| `ZNVAULT_INSECURE` | No | Set to `true` to skip TLS verification |

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "znvault": {
      "command": "npx",
      "args": ["@zincapp/znvault-mcp-server"],
      "env": {
        "ZNVAULT_URL": "https://vault.example.com",
        "ZNVAULT_API_KEY": "znv_xxx_your_api_key"
      }
    }
  }
}
```

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "znvault": {
      "command": "npx",
      "args": ["@zincapp/znvault-mcp-server"],
      "env": {
        "ZNVAULT_URL": "${ZNVAULT_URL}",
        "ZNVAULT_API_KEY": "${ZNVAULT_API_KEY}"
      }
    }
  }
}
```

Then set the environment variables in your shell or `.env` file.

## Available Tools

### `get_secret`

Get secret metadata by alias or ID. Returns metadata only, not the actual secret value.

**Parameters:**
- `name` (string, required): Secret alias or UUID

**Example:**
```
Get the metadata for secret "api/production/database"
```

### `decrypt_secret`

Decrypt and retrieve the actual secret data. This is a sensitive operation logged in the audit trail.

**Parameters:**
- `id` (string, required): Secret ID (UUID)

**Example:**
```
Decrypt secret with ID "abc123-def456..."
```

### `list_secrets`

List secrets with optional filtering.

**Parameters:**
- `type` (string, optional): Filter by type (`opaque`, `credential`, `setting`)
- `aliasPrefix` (string, optional): Filter by alias prefix
- `tags` (array, optional): Filter by tags
- `page` (number, default: 1): Page number
- `pageSize` (number, default: 20, max: 100): Results per page

**Example:**
```
List all secrets with prefix "api/"
```

### `create_secret`

Create a new secret in the vault.

**Parameters:**
- `alias` (string, required): Unique alias
- `type` (string, required): Secret type
- `subType` (string, optional): Sub-type for categorization
- `data` (object, required): Secret data (encrypted at rest)
- `tags` (array, optional): Tags for categorization
- `expiresAt` (string, optional): Expiration date (ISO 8601)

**Example:**
```
Create a new API key secret at "api/production/stripe"
```

### `health_check`

Check vault server health and connectivity.

**Example:**
```
Check if the vault is healthy
```

## Security Considerations

1. **API Key Security**: Store your API key securely. Never commit it to version control.

2. **Minimal Permissions**: Create an API key with only the permissions needed:
   ```
   secret:read, secret:list, secret:create
   ```

3. **TLS Verification**: Keep `ZNVAULT_INSECURE` disabled in production.

4. **Audit Trail**: All operations are logged in the vault's audit log.

## Development

```bash
# Clone the repository
git clone https://github.com/zincware/zn-vault.git
cd zn-vault/zn-vault-mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run locally
ZNVAULT_URL=https://localhost:8443 \
ZNVAULT_API_KEY=your_key \
ZNVAULT_INSECURE=true \
node dist/index.js
```

## Debugging

Use the MCP Inspector to test the server:

```bash
npx @modelcontextprotocol/inspector npx @zincapp/znvault-mcp-server
```

Check logs (Claude Desktop):
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

## License

MIT
