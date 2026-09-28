/**
 * 배포(Supabase Edge Function) 진입점의 env 해석(edge-deploy). 로컬(local-config.ts)과 달리 해시 · 비밀만 받고,
 * 빠진 것이 있으면 새로 만들지 않고 멈춘다 — 요청마다 켜지는 함수에서 만든 값은 다음 요청에 남지 않는다.
 * 이름 · 값의 원천은 docs/deploy-supabase.md 2절(함수 시크릿)이다.
 */
import { isValidPasswordHash } from "./password";
import { readConnectionTokenName, readIssuer } from "./mcp/env";
import { DEFAULT_IMAGE_BASE_URL, DEFAULT_USERNAME } from "./seed";
// 앱(session.ts)도 같은 하한으로 막지만, 무엇을 고칠지(env 이름)는 설정을 읽는 여기서 알린다
import { MIN_SESSION_SECRET_BYTES } from "./session-constants";

export interface EdgeConfig {
  username: string;
  passwordHash: string;
  sessionSecret: string;
  publicBaseUrl: string;
  editorBaseUrl: string;
  imageBaseUrl: string;
  supabaseUrl: string;
  supabaseSecretKey: string;
  /** 연결용 토큰 해시 — 없으면 `/mcp`는 OAuth 토큰만 받는다 */
  connection: { name: string; tokenHash: string } | null;
}

type Env = Record<string, string | undefined>;

/** hashConnectionToken(SHA-256 hex)의 모양 */
const CONNECTION_TOKEN_HASH = /^[0-9a-f]{64}$/;

function present(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

/** 빠진 필수 값은 이름을 알리고 멈춘다 — 로컬처럼 새로 만들지 않는다 */
function required(env: Env, name: string): string {
  const value = env[name];
  if (!present(value)) throw new Error(`배포 설정에 ${name}이 없다 — docs/deploy-supabase.md 2절`);
  return value;
}

/** 평문 비밀은 함수 시크릿에 남기지 않는다 — 주면 해시 이름을 알리며 멈춘다(보호 대상) */
function rejectPlain(env: Env, plainName: string, hashName: string, howTo: string): void {
  if (present(env[plainName])) {
    throw new Error(
      `배포 설정은 ${plainName}(평문)을 받지 않는다 — ${hashName}로 해시만 받는다 — ${howTo}`,
    );
  }
}

function readPasswordHash(env: Env): string {
  rejectPlain(env, "ADMIN_PASSWORD", "ADMIN_PASSWORD_HASH", "hash-password.ts");
  const hash = required(env, "ADMIN_PASSWORD_HASH");
  // 틀린 해시로 뜨면 로그인만 영원히 401이다 — 원인이 보이는 시작 시점에 멈춘다
  if (!isValidPasswordHash(hash)) {
    throw new Error("ADMIN_PASSWORD_HASH 형식이 틀렸다 — hash-password.ts로 다시 만든다");
  }
  return hash;
}

function readSessionSecret(env: Env): string {
  const secret = required(env, "SESSION_SECRET");
  if (new TextEncoder().encode(secret).length < MIN_SESSION_SECRET_BYTES) {
    throw new Error(
      `SESSION_SECRET은 ${MIN_SESSION_SECRET_BYTES}바이트 이상이다 — openssl rand -base64 48`,
    );
  }
  return secret;
}

/** OAuth 발급자 · MCP 주소 — 로컬과 같은 origin 규칙(readIssuer)에 https만 더한다(Secure 쿠키 · claude.ai) */
function readPublicBaseUrl(env: Env): string {
  const issuer = readIssuer(required(env, "PUBLIC_BASE_URL"));
  if (issuer === null || new URL(issuer).protocol !== "https:") {
    throw new Error(`PUBLIC_BASE_URL은 https origin이다 — 받은 값: "${env.PUBLIC_BASE_URL}"`);
  }
  return issuer;
}

function readConnection(env: Env): EdgeConfig["connection"] {
  rejectPlain(env, "MCP_CONNECTION_TOKEN", "MCP_CONNECTION_TOKEN_HASH", "shasum -a 256의 앞 64자");
  const tokenHash = env.MCP_CONNECTION_TOKEN_HASH;
  if (!present(tokenHash)) return null;
  if (!CONNECTION_TOKEN_HASH.test(tokenHash)) {
    throw new Error("MCP_CONNECTION_TOKEN_HASH는 SHA-256 hex 64자(소문자)다 — shasum -a 256");
  }
  return { name: readConnectionTokenName(env.MCP_CONNECTION_TOKEN_NAME), tokenHash };
}

export function readEdgeConfig(env: Env): EdgeConfig {
  const passwordHash = readPasswordHash(env);
  const sessionSecret = readSessionSecret(env);
  const publicBaseUrl = readPublicBaseUrl(env);
  const supabaseUrl = required(env, "SUPABASE_URL");
  const supabaseSecretKey = required(env, "EDITOR_SECRET_KEY");
  return {
    username: env.ADMIN_USERNAME?.trim() || DEFAULT_USERNAME,
    passwordHash,
    sessionSecret,
    publicBaseUrl,
    // 빈 문자열이어도 링크가 `/posts/...`처럼 깨지지 않게 기본값을 쓴다(mcp/env와 같은 이유)
    editorBaseUrl: env.EDITOR_BASE_URL || publicBaseUrl,
    imageBaseUrl: env.IMAGE_BASE_URL || DEFAULT_IMAGE_BASE_URL,
    supabaseUrl,
    supabaseSecretKey,
    connection: readConnection(env),
  };
}
