import type { AuthorizationCode, IssuedToken, OAuthClient, OAuthStore } from "./store";

/**
 * 등록(`/register`)은 인증 없이 열려 있다 — 누가 계속 등록해도 메모리가 끝없이 늘지 않게 상한을 둔다.
 * 계정 1개 본인용이라 claude.ai · Claude Code 연결 몇 번이면 충분하다.
 */
const DEFAULT_MAX_CLIENTS = 100;

function take<T>(map: Map<string, T>, key: string): T | null {
  const value = map.get(key) ?? null;
  map.delete(key);
  return value;
}

/** 재시작하면 모두 사라진다 — 클라이언트는 401을 받고 다시 연결한다(영속은 M4) */
export function createMemoryOAuthStore(options: { maxClients?: number } = {}): OAuthStore {
  const maxClients = options.maxClients ?? DEFAULT_MAX_CLIENTS;
  const clients = new Map<string, OAuthClient>();
  const codes = new Map<string, AuthorizationCode>();
  const accessTokens = new Map<string, IssuedToken>();
  const refreshTokens = new Map<string, IssuedToken>();
  return {
    async saveClient(client) {
      clients.set(client.clientId, client);
      // Map은 넣은 순서를 지킨다 — 맨 앞이 가장 오래된 클라이언트다
      for (const oldest of clients.keys()) {
        if (clients.size <= maxClients) break;
        clients.delete(oldest);
      }
    },
    async findClient(clientId) {
      return clients.get(clientId) ?? null;
    },
    async saveCode(codeHash, code) {
      codes.set(codeHash, code);
    },
    async takeCode(codeHash) {
      return take(codes, codeHash);
    },
    async saveAccessToken(tokenHash, token) {
      accessTokens.set(tokenHash, token);
    },
    async findAccessToken(tokenHash) {
      return accessTokens.get(tokenHash) ?? null;
    },
    async saveRefreshToken(tokenHash, token) {
      refreshTokens.set(tokenHash, token);
    },
    async takeRefreshToken(tokenHash) {
      return take(refreshTokens, tokenHash);
    },
  };
}
