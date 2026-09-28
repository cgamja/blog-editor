import type {
  AuthorizationCode,
  IssuedToken,
  OAuthClient,
  OAuthStore,
  RefreshToken,
} from "./store";
import { DEFAULT_MAX_CLIENTS, UNCONNECTED_CLIENT_GRACE_SECONDS } from "./constants";

/** 만료된 항목은 돌려주지 않고 지운다 */
function findLive<T extends { expiresAt: number }>(
  map: Map<string, T>,
  key: string,
  nowSeconds: number,
): T | null {
  const value = map.get(key);
  if (value === undefined) return null;
  if (value.expiresAt <= nowSeconds) {
    map.delete(key);
    return null;
  }
  return value;
}

function takeLive<T extends { expiresAt: number }>(
  map: Map<string, T>,
  key: string,
  nowSeconds: number,
): T | null {
  const value = findLive(map, key, nowSeconds);
  map.delete(key);
  return value;
}

/** 재시작하면 모두 사라진다 — 클라이언트는 401을 받고 다시 연결한다(로컬 전용 · 배포는 supabase/oauth-store.ts) */
export function createMemoryOAuthStore(options: { maxClients?: number } = {}): OAuthStore {
  const maxClients = options.maxClients ?? DEFAULT_MAX_CLIENTS;
  const clients = new Map<string, OAuthClient>();
  const connectedClientIds = new Set<string>();
  const codes = new Map<string, AuthorizationCode>();
  const accessTokens = new Map<string, IssuedToken>();
  const refreshTokens = new Map<string, RefreshToken>();

  /** Map은 넣은 순서를 지킨다 — 앞쪽이 오래된 클라이언트다 */
  const oldestEvictable = (nowSeconds: number): string | null => {
    for (const client of clients.values()) {
      const pastGrace = client.registeredAt + UNCONNECTED_CLIENT_GRACE_SECONDS <= nowSeconds;
      if (pastGrace && !connectedClientIds.has(client.clientId)) return client.clientId;
    }
    return null;
  };

  return {
    async saveClient(client, nowSeconds) {
      if (clients.size >= maxClients) {
        const evicted = oldestEvictable(nowSeconds);
        if (evicted === null) return false;
        clients.delete(evicted);
      }
      clients.set(client.clientId, client);
      return true;
    },
    async findClient(clientId) {
      return clients.get(clientId) ?? null;
    },
    async markClientConnected(clientId) {
      connectedClientIds.add(clientId);
    },
    async saveCode(codeHash, code) {
      codes.set(codeHash, code);
    },
    async takeCode(codeHash, nowSeconds) {
      return takeLive(codes, codeHash, nowSeconds);
    },
    async saveAccessToken(tokenHash, token) {
      accessTokens.set(tokenHash, token);
    },
    async findAccessToken(tokenHash, nowSeconds) {
      return findLive(accessTokens, tokenHash, nowSeconds);
    },
    async deleteAccessToken(tokenHash) {
      accessTokens.delete(tokenHash);
    },
    async saveRefreshToken(tokenHash, token) {
      refreshTokens.set(tokenHash, token);
    },
    async takeRefreshToken(tokenHash, nowSeconds) {
      return takeLive(refreshTokens, tokenHash, nowSeconds);
    },
  };
}
