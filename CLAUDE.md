# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

ZnVault MCP Server (`@zincapp/znvault-mcp-server`) is a Model Context Protocol server that enables AI assistants (Claude Desktop, Cursor, etc.) to securely access secrets from ZnVault.

### Relationship to ZnVault Server

This MCP server is part of the ZnVault ecosystem. The parent directory (`../`) contains the main ZnVault server - see `../CLAUDE.md` for server documentation.

```
zn-vault/                    # Parent - Vault server
├── src/                     # Server source code
├── zn-vault-mcp-server/     # THIS REPO - MCP Server
├── zn-vault-sdk-node/       # Node.js SDK (used internally)
├── zn-vault-agent/          # Agent for certificate/secret sync
├── znvault-cli/             # Admin CLI
└── ...
```

## Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Type checking
npm run typecheck

# Run locally
ZNVAULT_URL=https://localhost:8443 \
ZNVAULT_API_KEY=your_key \
ZNVAULT_INSECURE=true \
node dist/index.js

# Test with MCP Inspector
npx @modelcontextprotocol/inspector npx @zincapp/znvault-mcp-server
```

## Architecture

```
src/
├── index.ts              # MCP server entry point
├── tools/                # Tool implementations
│   ├── get-secret.ts
│   ├── decrypt-secret.ts
│   ├── list-secrets.ts
│   ├── create-secret.ts
│   └── health-check.ts
└── vault-client.ts       # ZnVault API client wrapper
```

## Release Process

**Publishing is handled automatically by GitHub Actions CI/CD.**

### Steps to Release

1. Update version:
   ```bash
   npm version patch  # or minor/major
   ```

2. Push commit and tag:
   ```bash
   git push && git push --tags
   ```

3. GitHub Actions automatically:
   - Runs typecheck
   - Builds the package
   - Publishes to npm using OIDC trusted publishing

### npm Package

- **Package:** `@zincapp/znvault-mcp-server`
- **Registry:** https://www.npmjs.com/package/@zincapp/znvault-mcp-server

### Verification

```bash
# Check published version
npm view @zincapp/znvault-mcp-server version

# Install latest
npm install -g @zincapp/znvault-mcp-server
```

### CI/CD Configuration

The GitHub Actions workflow (`.github/workflows/publish.yml`) handles:
- Publishing to npm on version tags (`v*`)
- OIDC-based npm trusted publishing (no token needed)
- Provenance attestation enabled

### npm Trusted Publisher Setup (One-Time)

Configure at npmjs.com:
- Package Settings → Trusted Publishers
- Repository: `vidaldiego/zn-vault-mcp-server`
- Workflow: `publish.yml`

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `get_secret` | Get secret metadata by alias or ID |
| `decrypt_secret` | Decrypt and retrieve secret data |
| `list_secrets` | List secrets with filtering |
| `create_secret` | Create a new secret |
| `health_check` | Check vault connectivity |

## Code Standards

- **TypeScript**: Strict mode
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **Dependencies**: Uses `@zincapp/znvault-sdk` internally
