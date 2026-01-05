// Path: zn-vault-mcp-server/src/client.ts

import { ZnVaultClient } from "@zincapp/znvault-sdk";

/**
 * Configuration for the vault client.
 */
export interface VaultConfig {
  /** Vault server URL */
  url: string;
  /** API key for authentication */
  apiKey: string;
  /** Skip TLS certificate verification */
  insecure?: boolean;
}

/**
 * Creates a configured ZN-Vault client instance.
 */
export function createClient(config: VaultConfig): ZnVaultClient {
  return ZnVaultClient.builder()
    .baseUrl(config.url)
    .apiKey(config.apiKey)
    .rejectUnauthorized(!config.insecure)
    .retries(3)
    .timeout(30000)
    .build();
}
