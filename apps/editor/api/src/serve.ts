/**
 * 로컬 Node 진입점(D12 · adr-014) — `pnpm --filter @blog-editor/api dev`.
 * Node는 타입을 벗겨 TS를 바로 돌리지만 확장자 없는 상대 import(`./app`)는 풀지 못한다.
 * 의존성을 더하지 않고 해석 훅 하나로 `.ts`를 붙인다. Lambda 진입점(M4)은 번들되므로 이 훅이 필요 없다.
 * 훅이 먼저 걸려야 하므로 앱 모듈은 정적 import가 아니라 훅 등록 뒤 동적 import로 불러온다.
 *
 * 필수 env(없으면 시작하지 않는다):
 *   SESSION_SECRET       세션 쿠키 HMAC 키, 32바이트 이상 — `openssl rand -base64 48`
 *   ADMIN_EMAIL          시드 계정 email
 *   ADMIN_PASSWORD_HASH  `node apps/editor/api/src/hash-password.ts`에 비밀번호를 표준 입력으로 넣어 만든 값
 */
import { registerHooks } from "node:module";

const RELATIVE = /^\.{1,2}\//;

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      // `./fixtures.posts`처럼 점이 든 이름도 있어 모양으로 고르지 않고, 못 찾았을 때만 `.ts`를 붙여 다시 푼다
      const notFound = (error as { code?: string }).code === "ERR_MODULE_NOT_FOUND";
      if (notFound && RELATIVE.test(specifier)) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const { serve } = await import("@hono/node-server");
const { createApp } = await import("./app");
const { createFilePostStore } = await import("./file-store");
const { createMemoryAccountStore } = await import("./memory-account-store");
const { isValidPasswordHash } = await import("./password");

const DEFAULT_PORT = 8787;
// TLS 없는 로컬 개발 서버다 — 로그인 비밀번호와 세션 쿠키가 평문으로 오가므로 같은 네트워크의 다른 기기에 열지 않는다
const HOSTNAME = "127.0.0.1";
const MAX_PORT = 65535;
const DEFAULT_ROOT = ".data";
const DEFAULT_WORKSPACE_ID = "default";
// 1단계 워크스페이스 설정의 초깃값 — 사이트 BLOG_CATEGORIES와 같다(설정 API는 다음 이슈)
const DEFAULT_CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
const DEFAULT_IMAGE_BASE_URL = "https://simsimeestudio.com";
const SEED_ACCOUNT_ID = "owner";
/** 1단계 계정 시드(adr-007) · 세션 서명 키. 해시는 `node apps/editor/api/src/hash-password.ts`로 만든다 */
const REQUIRED_ENV = ["SESSION_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD_HASH"] as const;

/**
 * 병렬 worktree마다 PORT를 따로 준다(CLAUDE.md strictPort 가정). 빈 값 · 숫자 아님을 0(임의 포트)이나
 * NaN으로 흘려보내면 조용히 다른 포트에 뜨거나 알 수 없는 오류가 나므로 여기서 멈춘다.
 */
function readPort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_PORT;
  const port = Number(raw);
  if (raw.trim() === "" || !Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(`PORT는 1~${MAX_PORT} 정수여야 한다 — 받은 값: "${raw}"`);
  }
  return port;
}

/** 빠진 값이 있으면 기본값으로 뜨지 않는다 — 비밀이 빈 채로 도는 서버는 로그인이 없는 서버와 같다 */
function readRequiredEnv(): Record<(typeof REQUIRED_ENV)[number], string> {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `환경 변수가 없다: ${missing.join(", ")} — apps/editor/api/src/serve.ts 머리 주석 참고`,
    );
  }
  const env = Object.fromEntries(
    REQUIRED_ENV.map((name) => [name, process.env[name] ?? ""]),
  ) as Record<(typeof REQUIRED_ENV)[number], string>;
  // 틀린 해시로 뜨면 로그인만 영원히 401이다 — 원인이 보이는 시작 시점에 멈춘다
  if (!isValidPasswordHash(env.ADMIN_PASSWORD_HASH)) {
    throw new Error("ADMIN_PASSWORD_HASH 형식이 틀렸다 — hash-password.ts로 다시 만든다");
  }
  return env;
}

const env = readRequiredEnv();
const port = readPort(process.env.PORT);
const root = process.env.POST_STORE_ROOT ?? DEFAULT_ROOT;

const app = createApp({
  store: createFilePostStore({ root, workspaceId: DEFAULT_WORKSPACE_ID }),
  categories: DEFAULT_CATEGORIES,
  imageBaseUrl: process.env.IMAGE_BASE_URL ?? DEFAULT_IMAGE_BASE_URL,
  accounts: createMemoryAccountStore([
    {
      id: SEED_ACCOUNT_ID,
      email: env.ADMIN_EMAIL,
      passwordHash: env.ADMIN_PASSWORD_HASH,
      workspaceId: DEFAULT_WORKSPACE_ID,
    },
  ]),
  sessionSecret: env.SESSION_SECRET,
});

serve({ fetch: app.fetch, port, hostname: HOSTNAME }, (info) => {
  console.log(`api: http://${HOSTNAME}:${info.port} (저장 루트 ${root})`);
});
