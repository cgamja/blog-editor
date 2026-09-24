/** `GET /api/settings`의 `connector`(api/openapi.json `Settings`) */
export interface ConnectorInfo {
  enabled: boolean;
  url: string | null;
}

/** ready: 주소를 복사해 연결할 수 있다 · no-public-url: `/mcp`는 켜졌지만 claude.ai가 닿는 주소가 없다 · off: `/mcp`가 꺼졌다 */
export type ConnectorState = "ready" | "no-public-url" | "off";
