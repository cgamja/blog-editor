/**
 * `/api` 계약을 코드에서 내보낸다(api-contract, 가이드 §5-2) — `node apps/editor/api/src/contract/write-openapi.ts`
 * 뒤에 `pnpm exec prettier --write api/openapi.json`. 계약 테스트가 파일과 코드가 같은지 본다.
 * Node는 확장자 없는 상대 import를 풀지 못해 serve.ts와 같은 해석 훅을 먼저 건다(의존성 없이).
 */
import { writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";

const RELATIVE = /^\.{1,2}\//;

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const notFound = (error as { code?: string }).code === "ERR_MODULE_NOT_FOUND";
      if (notFound && RELATIVE.test(specifier)) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const { buildOpenApiDocument } = await import("./openapi");

const OPENAPI_FILE = new URL("../../../../../api/openapi.json", import.meta.url);
const INDENT = 2;

await writeFile(OPENAPI_FILE, `${JSON.stringify(buildOpenApiDocument(), null, INDENT)}\n`);
console.log(`계약을 썼다: ${OPENAPI_FILE.pathname}`);
