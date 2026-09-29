/**
 * 배포 번들(ADR-046) — `src/edge.ts`를 ESM 한 파일로 묶는다. CSS · 형식 가이드는 text 모듈로 번들 안에 넣고,
 * playwright-core는 배포 진입점이 import하지 않아 들어가지 않는다.
 * 직접 실행(`pnpm --filter @blog-editor/api build:edge`)하면 레포 `supabase/functions/editor/app.js`에 쓴다 —
 * 그 폴더의 `index.ts`(Deno 입구)가 `./app.js`를 부른다. node가 타입만 벗겨 돌리므로 상대 import를 쓰지 않는다.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

export interface BuildEdgeResult {
  /** 쓴 파일 절대 경로들 */
  files: string[];
}

const ENTRY = fileURLToPath(new URL("../src/edge.ts", import.meta.url));
const FUNCTION_DIR = fileURLToPath(
  new URL("../../../../supabase/functions/editor", import.meta.url),
);
// supabase/functions/editor/index.ts의 import와 같은 이름
const BUNDLE_FILE = "app.js";

/**
 * rolldown JS API(`rolldown(input)` → `write(output)` — node_modules/rolldown 1.2.9 타입 기준).
 * platform node: Deno가 `node:` 내장을 지원한다. codeSplitting false: 동적 import까지 한 파일에 넣는다.
 */
export async function buildEdge(options: { outDir: string }): Promise<BuildEdgeResult> {
  const bundle = await rolldown({
    input: ENTRY,
    platform: "node",
    moduleTypes: { ".css": "text", ".md": "text" },
  });
  try {
    const { output } = await bundle.write({
      dir: options.outDir,
      format: "esm",
      entryFileNames: BUNDLE_FILE,
      codeSplitting: false,
    });
    return { files: output.map((item) => resolve(options.outDir, item.fileName)) };
  } finally {
    await bundle.close();
  }
}

if (import.meta.main) {
  const { files } = await buildEdge({ outDir: FUNCTION_DIR });
  console.log(`edge 번들: ${files.join(", ")}`);
}
