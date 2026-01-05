#!/usr/bin/env node
// Path: zn-vault-mcp-server/src/index.ts

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

/**
 * ZN-Vault MCP Server
 *
 * Enables AI assistants (Claude, Cursor, etc.) to securely access
 * secrets from ZN-Vault via the Model Context Protocol.
 *
 * Environment variables:
 * - ZNVAULT_URL: Vault server URL (required)
 * - ZNVAULT_API_KEY: API key for authentication (required)
 * - ZNVAULT_INSECURE: Set to "true" to skip TLS verification (optional)
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

  // Create and connect MCP server
  const server = createServer({
    url,
    apiKey,
    insecure,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error(`ZN-Vault MCP server connected to ${url}`);
}

main().catch((error) => {
  console.error("Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
