import { defineConfig } from "vitest/config";

/**
 * 순수 함수 층(05 Harness)은 전부 node 환경에서 돈다.
 * contentEditable은 jsdom에서 제대로 돌지 않으므로 에디터 동작은 Playwright(실브라우저) 몫이다.
 * 화면(apps/editor/web)이 생기면 그 패키지만 jsdom 프로젝트로 분리한다.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["packages/*/src/**/*.test.ts", "apps/editor/*/src/**/*.test.{ts,tsx}"],
  },
});
