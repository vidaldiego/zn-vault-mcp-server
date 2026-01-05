// Path: zn-vault-mcp-server/src/server.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, type VaultConfig } from "./client.js";
import { registerSecretTools } from "./tools/secrets.js";
import { registerHealthTools } from "./tools/health.js";

const SERVER_NAME = "znvault";
const SERVER_VERSION = "1.0.0";

/**
 * Creates and configures the MCP server with all tools registered.
 */
export function createServer(config: VaultConfig): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const client = createClient(config);

  // Register all tool modules
  registerSecretTools(server, client);
  registerHealthTools(server, client);

  return server;
}
