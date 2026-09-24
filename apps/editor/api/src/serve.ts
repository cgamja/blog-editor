/**
 * 로컬 Node 진입점(D12 · adr-014) — `pnpm --filter @blog-editor/api dev`.
 * Node는 타입을 벗겨 TS를 바로 돌리지만 확장자 없는 상대 import(`./app`)는 풀지 못한다.
 * 의존성을 더하지 않고 해석 훅 하나로 `.ts`를 붙인다. Lambda 진입점(M4)은 번들되므로 이 훅이 필요 없다.
 * 훅이 먼저 걸려야 하므로 앱 모듈은 정적 import가 아니라 훅 등록 뒤 동적 import로 불러온다.
 *
 * env — 레포 루트 `.env`(gitignore됨)가 있으면 읽고, 셸에 이미 있는 값이 이긴다:
 *   ADMIN_PASSWORD       시드 계정 비밀번호(평문, 시작할 때 해시) — 필수, 기본값 없음
 *   ADMIN_PASSWORD_HASH  또는 해시(`hash-password.ts`로 만든 값) — ADMIN_PASSWORD와 둘 중 하나만
 *   ADMIN_USERNAME       시드 계정 아이디, 없으면 admin
 *   SESSION_SECRET       세션 쿠키 HMAC 키(32바이트 이상), 없으면 시작할 때 만든다(재시작하면 세션이 끊긴다)
 *   PORT · POST_STORE_ROOT · IMAGE_BASE_URL
 * `.env`에서 `#` · 공백이 든 값은 큰따옴표로 감싼다 — 따옴표 없으면 `#` 뒤가 주석으로 잘린다
 * (Node 26 실측: `ADMIN_PASSWORD=12#34` → "12").
 * 로컬 전용이라 짧은 비밀번호를 받는다(local-config.ts) — 배포(M4) 진입점은 이 경로를 쓰지 않는다.
 */
import { fileURLToPath } from "node:url";
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
const { readLocalConfig } = await import("./local-config");

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
// dev 스크립트는 apps/editor/api에서 돌므로 작업 디렉터리가 아니라 이 파일 기준으로 레포 루트를 찾는다
const ENV_FILE = fileURLToPath(new URL("../../../../.env", import.meta.url));

/** `.env`는 선택이다 — 없으면 셸 env만으로 뜬다. 파일이 있는데 못 읽는 것은 숨기지 않는다 */
function loadEnvFileIfPresent(path: string): void {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}

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

loadEnvFileIfPresent(ENV_FILE);
const config = await readLocalConfig(process.env);
const port = readPort(process.env.PORT);
const root = process.env.POST_STORE_ROOT ?? DEFAULT_ROOT;

const app = createApp({
  store: createFilePostStore({ root, workspaceId: DEFAULT_WORKSPACE_ID }),
  categories: DEFAULT_CATEGORIES,
  imageBaseUrl: process.env.IMAGE_BASE_URL ?? DEFAULT_IMAGE_BASE_URL,
  accounts: createMemoryAccountStore([
    {
      id: SEED_ACCOUNT_ID,
      username: config.username,
      passwordHash: config.passwordHash,
      workspaceId: DEFAULT_WORKSPACE_ID,
    },
  ]),
  sessionSecret: config.sessionSecret,
});

serve({ fetch: app.fetch, port, hostname: HOSTNAME }, (info) => {
  console.log(
    `api: http://${HOSTNAME}:${info.port} (저장 루트 ${root}, 아이디 ${config.username})`,
  );
  if (config.generatedSecret) {
    console.log("SESSION_SECRET이 없어 새로 만들었다 — 재시작하면 로그인이 끊긴다");
  }
});
