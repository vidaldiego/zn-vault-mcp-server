// Path: zn-vault-mcp-server/src/tools/health.ts

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZnVaultClient } from "@zincapp/znvault-sdk";

/**
 * Registers health check tools with the MCP server.
 */
export function registerHealthTools(
  server: McpServer,
  client: ZnVaultClient
): void {
  // Tool: health_check - Check vault connectivity and status
  server.tool(
    "health_check",
    "Check the vault server health and connectivity. Returns server status, version, and component health.",
    {},
    async () => {
      try {
        const health = await client.health.check();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: health.status,
                  version: health.version,
                  uptime: health.uptime,
                  timestamp: health.timestamp,
                  checks: health.checks,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "error",
                  error: error instanceof Error ? error.message : String(error),
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
