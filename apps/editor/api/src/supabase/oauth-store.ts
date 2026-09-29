import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MAX_CLIENTS, UNCONNECTED_CLIENT_GRACE_SECONDS } from "../mcp/oauth/constants";
import type { AuthorizationCode, IssuedToken, OAuthStore, RefreshToken } from "../mcp/oauth/store";

const OAUTH_CLIENTS = "oauth_clients";

/** 코드 · 토큰 표 — 해시가 키, grant 필드는 `data`, 만료는 `expires_at`(epoch 초) */
interface ExpiringTable {
  name: string;
  key: string;
}

const CODES: ExpiringTable = { name: "oauth_codes", key: "code_hash" };
const ACCESS_TOKENS: ExpiringTable = { name: "oauth_access_tokens", key: "token_hash" };
const REFRESH_TOKENS: ExpiringTable = { name: "oauth_refresh_tokens", key: "token_hash" };

interface ExpiringRow {
  data: Record<string, unknown>;
  expires_at: number;
}

interface ClientRow {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  registered_at: number;
}

/**
 * 배포용 OAuth 상태 저장소(mcp-oauth · ADR-044) — 함수가 새로 켜져도 연결이 남는다. 상한 · 유예는 메모리 구현과
 * 같은 값이고, 세기 · 밀어내기 · 넣기는 DB 함수 `oauth_save_client`가 잠금 하나로 묶는다. `take*`는
 * `delete … returning` 한 문장이라 동시에 두 번 꺼내면 하나만 받는다.
 */
export function createSupabaseOAuthStore(options: {
  client: SupabaseClient;
  maxClients?: number;
}): OAuthStore {
  const { client, maxClients = DEFAULT_MAX_CLIENTS } = options;

  async function save(table: ExpiringTable, hash: string, value: { expiresAt: number }) {
    const { expiresAt, ...data } = value;
    await client
      .from(table.name)
      .upsert({ [table.key]: hash, data, expires_at: expiresAt }, { onConflict: table.key })
      .throwOnError();
  }

  async function remove(table: ExpiringTable, hash: string) {
    await client.from(table.name).delete().eq(table.key, hash).throwOnError();
  }

  /** 만료된 행은 돌려주지 않는다(메모리 구현 findLive와 같은 의미) */
  function live<T>(row: ExpiringRow | undefined | null, nowSeconds: number): T | null {
    if (row === undefined || row === null || row.expires_at <= nowSeconds) return null;
    return { ...row.data, expiresAt: row.expires_at } as T;
  }

  async function find<T>(table: ExpiringTable, hash: string, nowSeconds: number) {
    const { data } = await client
      .from(table.name)
      .select("data, expires_at")
      .eq(table.key, hash)
      .maybeSingle()
      .throwOnError();
    const row = data as ExpiringRow | null;
    const value = live<T>(row, nowSeconds);
    if (row !== null && value === null) await remove(table, hash);
    return value;
  }

  async function take<T>(table: ExpiringTable, hash: string, nowSeconds: number) {
    const { data } = await client
      .from(table.name)
      .delete()
      .eq(table.key, hash)
      .select("data, expires_at")
      .throwOnError();
    return live<T>((data as ExpiringRow[])[0], nowSeconds);
  }

  return {
    async saveClient(oauthClient, nowSeconds) {
      const { data } = await client
        .rpc("oauth_save_client", {
          p_client_id: oauthClient.clientId,
          p_client_name: oauthClient.clientName,
          p_redirect_uris: oauthClient.redirectUris,
          p_registered_at: oauthClient.registeredAt,
          p_now: nowSeconds,
          p_max_clients: maxClients,
          p_grace_seconds: UNCONNECTED_CLIENT_GRACE_SECONDS,
        })
        .throwOnError();
      return data === true;
    },
    async findClient(clientId) {
      const { data } = await client
        .from(OAUTH_CLIENTS)
        .select("client_id, client_name, redirect_uris, registered_at")
        .eq("client_id", clientId)
        .maybeSingle()
        .throwOnError();
      const row = data as ClientRow | null;
      if (row === null) return null;
      return {
        clientId: row.client_id,
        clientName: row.client_name,
        redirectUris: row.redirect_uris,
        registeredAt: row.registered_at,
      };
    },
    async markClientConnected(clientId) {
      await client
        .from(OAUTH_CLIENTS)
        .update({ connected: true })
        .eq("client_id", clientId)
        .throwOnError();
    },
    saveCode: (codeHash, code) => save(CODES, codeHash, code),
    takeCode: (codeHash, nowSeconds) => take<AuthorizationCode>(CODES, codeHash, nowSeconds),
    saveAccessToken: (tokenHash, token) => save(ACCESS_TOKENS, tokenHash, token),
    findAccessToken: (tokenHash, nowSeconds) =>
      find<IssuedToken>(ACCESS_TOKENS, tokenHash, nowSeconds),
    deleteAccessToken: (tokenHash) => remove(ACCESS_TOKENS, tokenHash),
    saveRefreshToken: (tokenHash, token) => save(REFRESH_TOKENS, tokenHash, token),
    takeRefreshToken: (tokenHash, nowSeconds) =>
      take<RefreshToken>(REFRESH_TOKENS, tokenHash, nowSeconds),
  };
}
