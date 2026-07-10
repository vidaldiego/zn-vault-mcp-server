# ZnVault MCP Server

MCP (Model Context Protocol) server for ZnVault secrets management. Enables AI assistants like Claude, Cursor, and other MCP-compatible tools to work with your vault.

## AI-safe by default

**Your AI assistant sees secret names, fields, and metadata. Never values.**

As of v2.0.0, the server registers only metadata-and-audit tools out of the box — no tool that returns a decrypted secret value exists on the MCP surface unless you explicitly opt in. This is enforced on two layers, not just one: (1) the value-exposing tools (`decrypt_secret`, `create_secret`) are never registered with the MCP SDK unless `ZNVAULT_ALLOW_VALUES=true` is set, so the model cannot call what it cannot see; and (2) independently, the API key you hand the server should itself be scoped server-side to metadata-only permissions, so even a misconfigured or compromised client is rejected by the vault. Every access — successful or denied — is recorded in the vault's audit trail regardless of mode.

## Installation

```bash
npm install -g @zincapp/znvault-mcp-server
```

Or run directly with npx:

```bash
npx @zincapp/znvault-mcp-server
```

## Available Tools

### Safe tools (always registered)

| Tool | Description |
|------|--------------|
| `get_secret` | Get secret metadata by alias or ID — never the value |
| `list_secrets` | List secrets with filtering by type, tags, or alias prefix — metadata only |
| `get_secret_fields` | List a secret's field (key) names only — never values, in any mode |
| `can_decrypt` | Preflight whether the configured credential *could* decrypt a secret (incl. its reference graph), without decrypting anything. Returns a verdict — `allowed`/`denied`/`conditional`/`indeterminate`. A `denied` verdict is a normal result, not an error |
| `health_check` | Check vault server health and connectivity |
| `run_security_audit` | Run a security advisor audit for a tenant; findings + recommendations, optional AI summary |
| `list_security_rules` | List the security rules the advisor checks against |
| `suggest_secret_config` | Get AI-powered suggestions for naming/configuring a *new* secret (no existing values involved) |
| `check_llm_status` | Check whether AI/LLM features are configured for the advisor |

### Value tools (opt-in)

Gated behind `ZNVAULT_ALLOW_VALUES=true`. Not registered — and therefore invisible and uncallable by the model — unless that variable is set.

| Tool | Description |
|------|--------------|
| `decrypt_secret` | Decrypt and retrieve the actual secret data. Logged in the audit trail |
| `create_secret` | Create a new secret in the vault (data is encrypted at rest) |

## Configuration

### Scoped-key setup (recommended for AI-safe mode)

Create a dedicated API key that is metadata-only at the server, so it cannot decrypt even if a client is misconfigured:

```bash
# Create a metadata-only API key — it cannot decrypt, enforced server-side:
znvault apikey create ai-assistant \
  --permissions secret:read:metadata,secret:list:metadata
```

> Verified against `znvault apikey create --help`: the key name is a **positional** argument (not `--name`), and permissions are passed via `-p`/`--permissions` as a comma-separated list.

**Do not** grant `secret:read:value` (or any value-decrypt permission) to keys used with this MCP server in AI-safe mode. Keeping the key metadata-only gives you the second enforcement layer described above — even if `ZNVAULT_ALLOW_VALUES` were accidentally set, a metadata-only key still can't decrypt.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ZNVAULT_URL` | Yes | Vault server URL (e.g., `https://vault.example.com`) |
| `ZNVAULT_API_KEY` | Yes | API key for authentication |
| `ZNVAULT_INSECURE` | No | Set to `true` to skip TLS verification |
| `ZNVAULT_ALLOW_VALUES` | No | `true` registers `decrypt_secret`/`create_secret`. Default: unset (AI-safe) |

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

### Cursor

Add to `.cursor/mcp.json` in your project (or the global Cursor MCP config):

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

### Continue / VS Code

Add an MCP server entry to your Continue config (`config.json` or the VS Code Continue extension settings):

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

## Migration: 1.x → 2.0.0

**Breaking change:** `decrypt_secret` and `create_secret` are no longer registered by default. If you upgrade from 1.x and your assistant relied on either tool, set `ZNVAULT_ALLOW_VALUES=true` in the server's env to restore them.

Before doing that, consider whether you need it at all: most workflows that "needed" `decrypt_secret` were really trying to confirm *that* a secret exists and is decryptable, or to inspect *which* fields it has — not to see the value in the model's context. For those cases, stay on AI-safe mode (the default) and use:

- `can_decrypt` — confirms decrypt authorization (including reference-graph checks) without exposing a value.
- `get_secret_fields` — lists a secret's field names without exposing values.

Only enable `ZNVAULT_ALLOW_VALUES` when the assistant genuinely needs the plaintext value in its context (e.g., generating a `.env` file on request), and pair it with a scoped API key as described above.

## Security Considerations

1. **API Key Security**: Store your API key securely. Never commit it to version control.

2. **Minimal Permissions**: For AI-safe mode, scope the key to metadata-only permissions:
   ```
   secret:read:metadata, secret:list:metadata
   ```
   Only add `secret:read:value` / `secret:create` if you intentionally run with `ZNVAULT_ALLOW_VALUES=true` and understand the assistant will see plaintext secret data.

3. **TLS Verification**: Keep `ZNVAULT_INSECURE` disabled in production.

4. **Audit Trail**: All operations — including denied `can_decrypt` checks — are logged in the vault's audit log.

## Development

```bash
# Clone the repository
git clone https://github.com/vidaldiego/zn-vault-mcp-server.git
cd zn-vault-mcp-server

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

## Releasing

Releases are automated via GitHub Actions with npm OIDC trusted publishing (no tokens needed).

### Setup (one-time)

1. **npm Trusted Publisher** must be configured at npmjs.com:
   - Package Settings → Trusted Publishers
   - Repository: `vidaldiego/zn-vault-mcp-server`
   - Workflow: `publish.yml`

2. **GitHub Actions workflow** (`.github/workflows/publish.yml`) requires:
   - `id-token: write` permission for OIDC
   - `npm install -g npm@latest` to ensure OIDC support
   - Trigger on tag push (`push: tags: - 'v*'`)

### Publishing a new version

```bash
# Bump version (creates commit)
npm version patch   # 2.0.0 → 2.0.1
# or: npm version minor  # 2.0.0 → 2.1.0
# or: npm version major  # 2.0.0 → 3.0.0

# Push commit and tag (triggers publish)
git push && git push --tags
```

The workflow will automatically:
1. Install dependencies
2. Run typecheck
3. Build
4. Publish to npm with provenance attestation

### Manual publish (if needed)

```bash
npm login
npm publish --access public --provenance
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
