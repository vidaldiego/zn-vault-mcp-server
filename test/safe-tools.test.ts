// Path: zn-vault-mcp-server/test/safe-tools.test.ts
import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerSecretTools } from "../src/tools/secrets.js";
import type { ZnVaultClient } from "@zincapp/znvault-sdk";

function makeStubClient() {
  return {
    secrets: {
      getByAlias: vi.fn(),
      get: vi.fn(),
      getFields: vi.fn(),
      canDecrypt: vi.fn(),
      list: vi.fn(),
    },
  } as unknown as ZnVaultClient;
}

async function connect(stub: ZnVaultClient) {
  const server = new McpServer({ name: "t", version: "0" });
  registerSecretTools(server, stub);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "t", version: "0" });
  await Promise.all([client.connect(ct), server.connect(st)]);
  return client;
}

describe("get_secret_fields", () => {
  it("resolves alias -> id, returns keys only", async () => {
    const stub = makeStubClient();
    (stub.secrets.getByAlias as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sec-1", alias: "db/prod" });
    (stub.secrets.getFields as ReturnType<typeof vi.fn>).mockResolvedValue({ fields: ["host", "password"] });
    const client = await connect(stub);
    const result = await client.callTool({ name: "get_secret_fields", arguments: { name: "db/prod" } });
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(stub.secrets.getFields).toHaveBeenCalledWith("sec-1");
    expect(JSON.parse(text)).toEqual({ alias: "db/prod", fields: ["host", "password"] });
    await client.close();
  });

  it("returns isError result on vault failure (no throw)", async () => {
    const stub = makeStubClient();
    (stub.secrets.getByAlias as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("nf"));
    (stub.secrets.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Secret not found"));
    const client = await connect(stub);
    const result = await client.callTool({ name: "get_secret_fields", arguments: { name: "nope" } });
    expect(result.isError).toBe(true);
    await client.close();
  });
});

describe("can_decrypt", () => {
  it("returns the verdict object; denied is a SUCCESS result", async () => {
    const stub = makeStubClient();
    (stub.secrets.getByAlias as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "sec-1", alias: "db/prod" });
    (stub.secrets.canDecrypt as ReturnType<typeof vi.fn>).mockResolvedValue({
      verdict: "denied",
      simulatedIdentity: { kind: "self", id: null },
      secret: { id: "sec-1", alias: "db/prod", subType: null, hasReferences: true },
      self: { verdict: "denied", reason: "missing secret:read:value" },
      targets: [],
      firstDenial: null,
    });
    const client = await connect(stub);
    const result = await client.callTool({ name: "can_decrypt", arguments: { name: "db/prod" } });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(parsed.verdict).toBe("denied");
    await client.close();
  });
});
