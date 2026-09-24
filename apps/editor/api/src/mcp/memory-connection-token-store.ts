import type { ConnectionToken, ConnectionTokenStore } from "./connection-tokens";

export function createMemoryConnectionTokenStore(
  tokens: readonly ConnectionToken[],
): ConnectionTokenStore {
  const byHash = new Map(tokens.map((token) => [token.tokenHash, token]));
  return {
    async findByHash(tokenHash) {
      return byHash.get(tokenHash) ?? null;
    },
  };
}
