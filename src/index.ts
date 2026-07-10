#!/usr/bin/env node
// Path: zn-vault-mcp-server/src/index.ts

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

/**
 * ZnVault MCP Server
 *
 * Enables AI assistants (Claude, Cursor, etc.) to securely access
 * secrets from ZnVault via the Model Context Protocol.
 *
 * Environment variables:
 * - ZNVAULT_URL: Vault server URL (required)
 * - ZNVAULT_API_KEY: API key for authentication (required)
 * - ZNVAULT_INSECURE: Set to "true" to skip TLS verification (optional)
 * - ZNVAULT_ALLOW_VALUES: Set to "true" to register value-exposing tools
 *   (decrypt_secret, create_secret). Default: AI-safe mode — metadata only.
 */

async function main(): Promise<void> {
  // Validate required environment variables
  const url = process.env.ZNVAULT_URL;
  const apiKey = process.env.ZNVAULT_API_KEY;

  if (!url) {
    console.error("Error: ZNVAULT_URL environment variable is required");
    process.exit(1);
  }

  if (!apiKey) {
    console.error("Error: ZNVAULT_API_KEY environment variable is required");
    process.exit(1);
  }

  const insecure = process.env.ZNVAULT_INSECURE === "true";
  const allowValues = process.env.ZNVAULT_ALLOW_VALUES === "true";

  // Create and connect MCP server
  const server = createServer({
    url,
    apiKey,
    insecure,
    allowValues,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error(
    `ZnVault MCP server connected to ${url} (${allowValues ? "VALUES ENABLED" : "AI-safe mode: metadata only"})`
  );
}

main().catch((error) => {
  console.error("Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
