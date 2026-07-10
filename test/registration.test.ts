// Path: zn-vault-mcp-server/test/registration.test.ts
import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

const BASE_CONFIG = { url: "https://vault.test", apiKey: "znv_test_key" };

async function listToolNames(config: Parameters<typeof createServer>[0]): Promise<string[]> {
  const server = createServer(config);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  const { tools } = await client.listTools();
  await client.close();
  return tools.map((t) => t.name).sort();
}

const SAFE_TOOLS = [
  "can_decrypt",
  "check_llm_status",
  "get_secret",
  "get_secret_fields",
  "health_check",
  "list_secrets",
  "list_security_rules",
  "run_security_audit",
  "suggest_secret_config",
].sort();

describe("registration gating (safe by default)", () => {
  it("default mode registers ONLY the safe tool set — no decrypt/create", async () => {
    const names = await listToolNames(BASE_CONFIG);
    expect(names).toEqual(SAFE_TOOLS);
    expect(names).not.toContain("decrypt_secret");
    expect(names).not.toContain("create_secret");
  });

  it("allowValues:true additionally registers decrypt_secret + create_secret", async () => {
    const names = await listToolNames({ ...BASE_CONFIG, allowValues: true });
    expect(names).toEqual([...SAFE_TOOLS, "create_secret", "decrypt_secret"].sort());
  });
});
