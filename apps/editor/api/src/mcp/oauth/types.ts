import type { OAuthStore } from "./store";

export interface OAuthOptions {
  /** 발급자 = 이 서비스의 공개 origin(끝 `/` 없음). MCP URL은 `<issuer>/mcp` */
  issuer: string;
  store: OAuthStore;
}
