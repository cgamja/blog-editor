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
const DEFAULT_ROOT = ".data";
const DEFAULT_WORKSPACE_ID = "default";
// 1단계 워크스페이스 설정의 초깃값 — 사이트 BLOG_CATEGORIES와 같다(설정 API는 다음 이슈)
const DEFAULT_CATEGORIES = ["studio", "parenting", "parenting-assistant"] as const;
const DEFAULT_IMAGE_BASE_URL = "https://simsimeestudio.com";

const port = Number(process.env.PORT ?? DEFAULT_PORT);
const root = process.env.POST_STORE_ROOT ?? DEFAULT_ROOT;

const app = createApp({
  store: createFilePostStore({ root, workspaceId: DEFAULT_WORKSPACE_ID }),
  categories: DEFAULT_CATEGORIES,
  imageBaseUrl: process.env.IMAGE_BASE_URL ?? DEFAULT_IMAGE_BASE_URL,
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api: http://localhost:${info.port} (저장 루트 ${root})`);
});
