/**
 * OAuth 상태 저장소 계약(mcp-oauth design 6). 코드 · 토큰은 원문이 아니라 SHA-256으로만 찾는다.
 * `take*`는 찾는 즉시 지운다 — 코드는 1회용, refresh는 쓰면 회전한다.
 */
export interface OAuthClient {
  clientId: string;
  clientName: string;
  redirectUris: readonly string[];
}

/** 인가 한 번이 남기는 권한 — 코드 · 액세스 · refresh가 같은 값을 물려받는다 */
export interface OAuthGrant {
  clientId: string;
  accountId: string;
  /** 토큰을 쓸 대상(RFC 8707) — 이 서버의 MCP URL */
  resource: string;
  scope: string;
  /** 초안 출처 `token:<이름>`의 이름 — redirect 종류로 정한다(design 5) */
  sourceName: string;
}

export interface AuthorizationCode extends OAuthGrant {
  redirectUri: string;
  codeChallenge: string;
  /** epoch 초 */
  expiresAt: number;
}

export interface IssuedToken extends OAuthGrant {
  /** epoch 초 */
  expiresAt: number;
}

export interface OAuthStore {
  saveClient(client: OAuthClient): Promise<void>;
  findClient(clientId: string): Promise<OAuthClient | null>;
  saveCode(codeHash: string, code: AuthorizationCode): Promise<void>;
  takeCode(codeHash: string): Promise<AuthorizationCode | null>;
  saveAccessToken(tokenHash: string, token: IssuedToken): Promise<void>;
  findAccessToken(tokenHash: string): Promise<IssuedToken | null>;
  saveRefreshToken(tokenHash: string, token: IssuedToken): Promise<void>;
  takeRefreshToken(tokenHash: string): Promise<IssuedToken | null>;
}
