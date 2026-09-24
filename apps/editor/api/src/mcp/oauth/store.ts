/**
 * OAuth 상태 저장소 계약(mcp-oauth design 6). 코드 · 토큰은 원문이 아니라 SHA-256으로만 찾는다.
 * `take*`는 찾는 즉시 지운다 — 코드는 1회용, refresh는 쓰면 회전한다. 찾기 · 꺼내기는 만료된 항목을
 * 돌려주지 않고 지운다(`nowSeconds`는 epoch 초).
 */
export interface OAuthClient {
  clientId: string;
  clientName: string;
  redirectUris: readonly string[];
  /** 등록 시각(epoch 초) — 막 등록한 클라이언트는 밀어내기에서 잠시 보호된다 */
  registeredAt: number;
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

export interface RefreshToken extends IssuedToken {
  /** 함께 발급한 액세스 토큰 — 회전할 때 같이 지운다 */
  accessTokenHash: string;
}

export interface OAuthStore {
  /**
   * 꽉 차면 토큰을 받은 적 없고 등록한 지 유예 시간이 지난 클라이언트만 오래된 순으로 버린다. 버릴 것이
   * 없으면 저장하지 않고 false — 등록은 인증 없이 열려 있어서, 연결된 클라이언트도 막 등록해 로그인 중인
   * 클라이언트도 등록 폭주에 밀려나지 않게.
   */
  saveClient(client: OAuthClient, nowSeconds: number): Promise<boolean>;
  findClient(clientId: string): Promise<OAuthClient | null>;
  /** 토큰을 한 번이라도 받은 클라이언트 — 밀어내기 대상에서 빠진다 */
  markClientConnected(clientId: string): Promise<void>;
  saveCode(codeHash: string, code: AuthorizationCode): Promise<void>;
  takeCode(codeHash: string, nowSeconds: number): Promise<AuthorizationCode | null>;
  saveAccessToken(tokenHash: string, token: IssuedToken): Promise<void>;
  findAccessToken(tokenHash: string, nowSeconds: number): Promise<IssuedToken | null>;
  deleteAccessToken(tokenHash: string): Promise<void>;
  saveRefreshToken(tokenHash: string, token: RefreshToken): Promise<void>;
  takeRefreshToken(tokenHash: string, nowSeconds: number): Promise<RefreshToken | null>;
}
