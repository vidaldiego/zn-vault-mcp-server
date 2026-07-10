// Path: zn-vault-mcp-server/src/tools/advisor.ts

import { z } from "zod";
import https from "node:https";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface VaultConfig {
  url: string;
  apiKey: string;
  insecure?: boolean;
}

// Types for advisor API responses
interface Finding {
  ruleId: string;
  ruleName: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "security" | "organization" | "compliance";
  status: "open" | "acknowledged" | "resolved";
  description: string;
  resourceType: string;
  resourceId: string;
  recommendation: string;
  foundAt: string;
}

interface AuditResult {
  auditId: string;
  tenantId: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
  };
  findings: Finding[];
  aiSummary?: string;
}

interface Rule {
  id: string;
  name: string;
  description: string;
  category: "security" | "organization" | "compliance";
  severity: "critical" | "high" | "medium" | "low";
  enabled: boolean;
}

interface LLMStatus {
  configured: boolean;
  enabled: boolean;
  provider: string | null;
  model: string | null;
}

interface SuggestionResult {
  alias: string;
  alternativeAliases?: string[];
  type: string;
  subType?: string;
  tags: string[];
  expiresInDays?: number;
  rotationRecommendation?: string;
  warnings?: string[];
  confidence: number;
  reasoning: string;
}

/**
 * Make an HTTP request to the vault server
 */
async function request<T>(
  config: VaultConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = new URL(config.url);

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.apiKey,
      },
      rejectUnauthorized: !config.insecure,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(parsed.message || `Request failed with status ${res.statusCode}`)
            );
          } else {
            resolve(parsed as T);
          }
        } catch {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Request failed with status ${res.statusCode}`));
          } else {
            resolve(data as unknown as T);
          }
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Registers advisor tools with the MCP server.
 */
export function registerAdvisorTools(server: McpServer, config: VaultConfig): void {
  // Tool: run_security_audit - Run a security audit for a tenant
  server.tool(
    "run_security_audit",
    "Run a security audit for a tenant. Returns findings, recommendations, and optionally an AI-generated summary.",
    {
      tenant: z.string().min(1).describe("Tenant ID to audit"),
      categories: z
        .array(z.enum(["security", "organization", "compliance"]))
        .optional()
        .describe("Filter by categories"),
      severity: z
        .array(z.enum(["critical", "high", "medium", "low"]))
        .optional()
        .describe("Filter by severity levels"),
      includeAiSummary: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include AI-generated summary (requires LLM configuration)"),
    },
    async ({ tenant, categories, severity, includeAiSummary }) => {
      try {
        const body: Record<string, unknown> = {};
        if (categories) body.categories = categories;
        if (severity) body.severity = severity;
        if (includeAiSummary) body.includeAiSummary = true;

        const response = await request<{ success: boolean; data: AuditResult }>(
          config,
          "POST",
          `/v1/advisor/${encodeURIComponent(tenant)}/audit`,
          body
        );

        const result = response.data;

        // Format findings summary
        let summaryText = `## Security Audit Results\n\n`;
        summaryText += `**Tenant:** ${result.tenantId}\n`;
        summaryText += `**Status:** ${result.status}\n`;
        summaryText += `**Total Findings:** ${result.summary.total}\n\n`;

        if (result.summary.total > 0) {
          summaryText += `### By Severity\n`;
          for (const [sev, count] of Object.entries(result.summary.bySeverity)) {
            if (count > 0) {
              summaryText += `- **${sev.toUpperCase()}:** ${count}\n`;
            }
          }
          summaryText += `\n`;

          summaryText += `### Top Findings\n`;
          for (const finding of result.findings.slice(0, 10)) {
            summaryText += `- [${finding.severity.toUpperCase()}] **${finding.ruleId}**: ${finding.description}\n`;
            summaryText += `  - Resource: ${finding.resourceType}:${finding.resourceId}\n`;
            summaryText += `  - Recommendation: ${finding.recommendation}\n\n`;
          }

          if (result.findings.length > 10) {
            summaryText += `\n_...and ${result.findings.length - 10} more findings_\n`;
          }
        } else {
          summaryText += `\n✅ No security findings detected!\n`;
        }

        if (result.aiSummary) {
          summaryText += `\n### AI Summary\n${result.aiSummary}\n`;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: summaryText,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error running audit: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: list_security_rules - List available security rules
  server.tool(
    "list_security_rules",
    "List available security rules that the advisor checks against.",
    {
      category: z
        .enum(["security", "organization", "compliance"])
        .optional()
        .describe("Filter by category"),
      severity: z
        .enum(["critical", "high", "medium", "low"])
        .optional()
        .describe("Filter by severity"),
    },
    async ({ category, severity }) => {
      try {
        const query: string[] = [];
        if (category) query.push(`category=${category}`);
        if (severity) query.push(`severity=${severity}`);

        const path = query.length > 0 ? `/v1/advisor/rules?${query.join("&")}` : "/v1/advisor/rules";

        const response = await request<{ success: boolean; data: { rules: Rule[]; total: number } }>(
          config,
          "GET",
          path
        );

        let text = `## Security Rules (${response.data.total} total)\n\n`;

        for (const rule of response.data.rules) {
          text += `### ${rule.id}: ${rule.name}\n`;
          text += `- **Category:** ${rule.category}\n`;
          text += `- **Severity:** ${rule.severity.toUpperCase()}\n`;
          text += `- **Enabled:** ${rule.enabled ? "Yes" : "No"}\n`;
          text += `- ${rule.description}\n\n`;
        }

        return {
          content: [
            {
              type: "text" as const,
              text,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing rules: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: suggest_secret_config - Get AI suggestions for a new secret
  server.tool(
    "suggest_secret_config",
    "Get AI-powered suggestions for naming and configuring a new secret. Requires LLM to be configured.",
    {
      tenant: z.string().min(1).describe("Tenant ID"),
      description: z.string().min(1).describe("Description of the secret you want to create"),
      environment: z.string().optional().describe("Environment (prod, staging, dev)"),
      service: z.string().optional().describe("Service name"),
      team: z.string().optional().describe("Team name"),
    },
    async ({ tenant, description, environment, service, team }) => {
      try {
        const body: Record<string, unknown> = { description };
        const hints: Record<string, string> = {};
        if (environment) hints.environment = environment;
        if (service) hints.service = service;
        if (team) hints.team = team;
        if (Object.keys(hints).length > 0) body.hints = hints;

        const response = await request<{ success: boolean; data: SuggestionResult }>(
          config,
          "POST",
          `/v1/advisor/${encodeURIComponent(tenant)}/suggest`,
          body
        );

        const result = response.data;

        let text = `## Secret Configuration Suggestion\n\n`;
        text += `**Suggested Alias:** \`${result.alias}\`\n`;

        if (result.alternativeAliases && result.alternativeAliases.length > 0) {
          text += `**Alternatives:** ${result.alternativeAliases.map((a) => `\`${a}\``).join(", ")}\n`;
        }

        text += `**Type:** ${result.type}\n`;
        if (result.subType) text += `**Sub-Type:** ${result.subType}\n`;
        text += `**Tags:** ${result.tags.length > 0 ? result.tags.join(", ") : "none"}\n`;

        if (result.expiresInDays) {
          text += `**Suggested Expiry:** ${result.expiresInDays} days\n`;
        }

        if (result.rotationRecommendation) {
          text += `**Rotation:** ${result.rotationRecommendation}\n`;
        }

        text += `**Confidence:** ${Math.round(result.confidence * 100)}%\n`;
        text += `\n**Reasoning:** ${result.reasoning}\n`;

        if (result.warnings && result.warnings.length > 0) {
          text += `\n⚠️ **Warnings:**\n`;
          for (const warning of result.warnings) {
            text += `- ${warning}\n`;
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting suggestions: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: check_llm_status - Check if AI features are available
  server.tool(
    "check_llm_status",
    "Check if AI/LLM features are configured and available for the advisor.",
    {},
    async () => {
      try {
        const response = await request<{ success: boolean; data: LLMStatus }>(
          config,
          "GET",
          "/v1/advisor/llm/status"
        );

        const status = response.data;

        let text = `## AI Advisor Status\n\n`;
        text += `**Configured:** ${status.configured ? "✅ Yes" : "❌ No"}\n`;
        text += `**Enabled:** ${status.enabled ? "✅ Yes" : "❌ No"}\n`;

        if (status.provider) {
          text += `**Provider:** ${status.provider}\n`;
        }

        if (status.model) {
          text += `**Model:** ${status.model}\n`;
        }

        if (!status.configured) {
          text += `\n_AI features require LLM configuration. Contact your vault administrator._\n`;
        }

        return {
          content: [
            {
              type: "text" as const,
              text,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error checking LLM status: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
