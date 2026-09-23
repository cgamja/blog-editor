/**
 * 로컬 Node 진입점(D12 · adr-014) — `pnpm --filter @blog-editor/api dev`.
 * Node는 타입을 벗겨 TS를 바로 돌리지만 확장자 없는 상대 import(`./app`)는 풀지 못한다.
 * 의존성을 더하지 않고 해석 훅 하나로 `.ts`를 붙인다. Lambda 진입점(M4)은 번들되므로 이 훅이 필요 없다.
 * 훅이 먼저 걸려야 하므로 앱 모듈은 정적 import가 아니라 훅 등록 뒤 동적 import로 불러온다.
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

const DEFAULT_PORT = 8787;
// 세션(다음 이슈) 전까지 /api/*에 인증이 없다 — 같은 네트워크의 다른 기기가 못 부르게 루프백에만 연다
const HOSTNAME = "127.0.0.1";
const MAX_PORT = 65535;
const DEFAULT_ROOT = ".data";
const DEFAULT_WORKSPACE_ID = "default";
// 1단계 워크스페이스 설정의 초깃값 — 사이트 BLOG_CATEGORIES와 같다(설정 API는 다음 이슈)
const DEFAULT_CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
const DEFAULT_IMAGE_BASE_URL = "https://simsimeestudio.com";

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

const port = readPort(process.env.PORT);
const root = process.env.POST_STORE_ROOT ?? DEFAULT_ROOT;

const app = createApp({
  store: createFilePostStore({ root, workspaceId: DEFAULT_WORKSPACE_ID }),
  categories: DEFAULT_CATEGORIES,
  imageBaseUrl: process.env.IMAGE_BASE_URL ?? DEFAULT_IMAGE_BASE_URL,
});

serve({ fetch: app.fetch, port, hostname: HOSTNAME }, (info) => {
  console.log(`api: http://${HOSTNAME}:${info.port} (저장 루트 ${root})`);
});
