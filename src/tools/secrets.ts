// Path: zn-vault-mcp-server/src/tools/secrets.ts

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZnVaultClient } from "@zincapp/znvault-sdk";

/**
 * Registers secret management tools with the MCP server.
 */
export function registerSecretTools(
  server: McpServer,
  client: ZnVaultClient
): void {
  // Tool: get_secret - Get secret metadata by alias or ID
  server.tool(
    "get_secret",
    "Get secret metadata by alias or ID. Returns metadata only, not the actual secret value.",
    {
      name: z.string().min(1).describe("Secret alias (e.g., 'api/production/db') or UUID"),
    },
    async ({ name }) => {
      try {
        // Try by alias first, then by ID
        let secret;
        try {
          secret = await client.secrets.getByAlias(name);
        } catch {
          secret = await client.secrets.get(name);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: secret.id,
                  alias: secret.alias,
                  type: secret.type,
                  subType: secret.subType,
                  version: secret.version,
                  tags: secret.tags,
                  fileName: secret.fileName,
                  expiresAt: secret.expiresAt,
                  createdAt: secret.createdAt,
                  updatedAt: secret.updatedAt,
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
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Shared alias-or-id resolution (same idiom as get_secret)
  async function resolveSecretRef(name: string): Promise<{ id: string; alias: string }> {
    try {
      const s = await client.secrets.getByAlias(name);
      return { id: s.id, alias: s.alias };
    } catch {
      const s = await client.secrets.get(name);
      return { id: s.id, alias: s.alias };
    }
  }

  // Tool: get_secret_fields - field NAMES only, never values
  server.tool(
    "get_secret_fields",
    "List a secret's field (key) names by alias or ID. Returns ONLY key names — never values. Safe for AI use: values are not exposed through this tool in any mode.",
    {
      name: z.string().min(1).describe("Secret alias (e.g., 'api/production/db') or UUID"),
    },
    async ({ name }) => {
      try {
        const ref = await resolveSecretRef(name);
        const { fields } = await client.secrets.getFields(ref.id);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ alias: ref.alias, fields }, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: can_decrypt - decrypt-authorization preflight (self-check), never decrypts
  server.tool(
    "can_decrypt",
    "Preflight whether the configured credential could decrypt a secret (including its reference graph), WITHOUT decrypting anything. Returns a verdict: allowed, denied, conditional, or indeterminate. A denied verdict is a normal result, not an error.",
    {
      name: z.string().min(1).describe("Secret alias (e.g., 'api/production/db') or UUID"),
    },
    async ({ name }) => {
      try {
        const ref = await resolveSecretRef(name);
        const result = await client.secrets.canDecrypt(ref.id);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: list_secrets - List secrets with filtering
  server.tool(
    "list_secrets",
    "List secrets with optional filtering by type, tags, or alias prefix. Returns metadata only.",
    {
      type: z
        .enum(["opaque", "credential", "setting"])
        .optional()
        .describe("Filter by secret type"),
      aliasPrefix: z
        .string()
        .optional()
        .describe("Filter by alias prefix (e.g., 'api/' for all API secrets)"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Filter by tags (all must match)"),
      page: z.number().int().positive().default(1).describe("Page number"),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Results per page (max 100)"),
    },
    async ({ type, aliasPrefix, tags, page, pageSize }) => {
      try {
        // The SDK's SecretFilter/PaginatedResponse (v4.x) use limit/offset and a
        // nested `pagination` object rather than page/pageSize/total/totalPages.
        // Translate here so the tool's page/pageSize input surface stays stable.
        // Note: `tags` filtering is not supported server-side (the SDK itself
        // ignores it in list()), so it is accepted but not forwarded.
        void tags;
        const offset = (page - 1) * pageSize;
        const result = await client.secrets.list({
          type,
          aliasPrefix,
          limit: pageSize,
          offset,
        });

        const { total, limit, offset: resultOffset } = result.pagination;
        const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
        const currentPage = limit > 0 ? Math.floor(resultOffset / limit) + 1 : page;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  total,
                  page: currentPage,
                  pageSize: limit,
                  totalPages,
                  secrets: result.items.map((s) => ({
                    id: s.id,
                    alias: s.alias,
                    type: s.type,
                    subType: s.subType,
                    version: s.version,
                    tags: s.tags,
                    expiresAt: s.expiresAt,
                  })),
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
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Value-exposing tools — only registered with ZNVAULT_ALLOW_VALUES=true.
 * In AI-safe mode (default) these are never registered, so MCP clients
 * cannot see or call them.
 */
export function registerSecretValueTools(
  server: McpServer,
  client: ZnVaultClient
): void {
  // Tool: decrypt_secret - Decrypt and retrieve secret data
  server.tool(
    "decrypt_secret",
    "Decrypt and retrieve the actual secret data. This is a sensitive operation that will be logged in the audit trail.",
    {
      id: z.string().min(1).describe("Secret ID (UUID)"),
    },
    async ({ id }) => {
      try {
        const secret = await client.secrets.decrypt(id);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: secret.id,
                  alias: secret.alias,
                  type: secret.type,
                  version: secret.version,
                  data: secret.data,
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
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: create_secret - Create a new secret
  server.tool(
    "create_secret",
    "Create a new secret in the vault. Supports various types including credentials, settings, and opaque data.",
    {
      alias: z
        .string()
        .min(1)
        .describe("Unique alias for the secret (e.g., 'api/production/db')"),
      type: z
        .enum(["opaque", "credential", "setting"])
        .describe("Secret type"),
      subType: z
        .enum([
          "password",
          "api_key",
          "token",
          "certificate",
          "private_key",
          "keypair",
          "ssh_key",
          "file",
          "generic",
          "json",
          "yaml",
          "env",
          "properties",
          "toml",
        ])
        .optional()
        .describe("Secret sub-type for more specific categorization"),
      data: z
        .record(z.unknown())
        .describe("Secret data as key-value pairs (will be encrypted)"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
      expiresAt: z
        .string()
        .optional()
        .describe("Expiration date in ISO 8601 format"),
    },
    async ({ alias, type, subType, data, tags, expiresAt }) => {
      try {
        const secret = await client.secrets.create({
          alias,
          type,
          subType,
          data,
          tags,
          expiresAt,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  id: secret.id,
                  alias: secret.alias,
                  type: secret.type,
                  version: secret.version,
                  createdAt: secret.createdAt,
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
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
