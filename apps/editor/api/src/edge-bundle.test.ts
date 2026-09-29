import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { buildEdge } from "../scripts/build-edge";
import type { BuildEdgeResult } from "../scripts/build-edge";
import { VALID_ENV } from "./edge-env.test.helpers";
import { hashPassword } from "./password";
import { supabaseSuiteName, supabaseTestEnv } from "./supabase/test-env.test.helpers";

// 번들러가 앱 전체를 묶는다 — 기본 5초를 넘을 수 있다
const BUILD_TIMEOUT_MS = 60_000;
// Deno를 처음 받으면(npx 캐시가 비었을 때) 수십 초가 걸린다
const DENO_TIMEOUT_MS = 180_000;
// Supabase Edge Runtime과 같은 주 버전(ADR-046 스파이크) — 올릴 때 같이 맞춘다
const DENO = "deno@2.9.6";
// 함수는 중계가 붙인 시크릿 헤더가 있어야 앱에 넘긴다(editor-relay)
const EDGE_RELAY_SECRET = "edge-bundle-relay-secret";

let built: Promise<BuildEdgeResult> | undefined;
/** 두 테스트가 같은 번들을 본다 — 한 번만 묶는다 */
function buildOnce(): Promise<BuildEdgeResult> {
  built ??= mkdtemp(join(tmpdir(), "edge-bundle-")).then((outDir) => buildEdge({ outDir }));
  return built;
}

type EdgeModule = {
  createEdgeHandler(env: Record<string, string | undefined>): (req: Request) => Promise<Response>;
};

describe("edge-deploy — 배포 번들", () => {
  it(
    "WHEN 배포 번들을 만들면 THEN 어느 출력 파일에도 playwright-core가 들어 있지 않다",
    async () => {
      const { files } = await buildOnce();
      const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));

      expect(files.length).toBeGreaterThan(0);
      for (const content of contents) {
        expect(content).not.toMatch(/playwright-core|coreBundle/);
      }
    },
    BUILD_TIMEOUT_MS,
  );
});

// edge.ts는 본문 CSS · 형식 가이드를 text 모듈로 import해 vitest가 직접 못 부른다 — 묶은 번들로 부른다
describe("editor-relay — 함수는 중계를 거친 요청만 받는다 (보호 대상 — 고쳐서 통과시키지 않는다)", () => {
  it(
    "WHEN X-Relay-Secret 없이 함수의 GET /public/posts를 부르면 THEN 403이다",
    async () => {
      const { files } = await buildOnce();
      const entry = files.find((file) => /\.m?js$/.test(file));
      if (entry === undefined) throw new Error(`번들 JS가 없다: ${files.join(", ")}`);
      const { createEdgeHandler } = (await import(pathToFileURL(entry).href)) as EdgeModule;
      const handle = createEdgeHandler(VALID_ENV);

      const response = await handle(
        new Request("https://ref.supabase.co/functions/v1/editor/public/posts"),
      );

      expect(response.status).toBe(403);
    },
    BUILD_TIMEOUT_MS,
  );
});

describe.skipIf(supabaseTestEnv === null)(
  supabaseSuiteName("edge-deploy — 번들 핸들러(시험 프로젝트)"),
  () => {
    it(
      "WHEN 번들된 핸들러에 /editor/public/posts와 /editor/public/post.css를 GET 하면 THEN 공개 목록 JSON과 text/css 본문 CSS가 나온다",
      async () => {
        const env = supabaseTestEnv;
        if (env === null) throw new Error("시험 키 없음");
        const { files } = await buildOnce();
        const entry = files.find((file) => /\.m?js$/.test(file));
        if (entry === undefined) throw new Error(`번들 JS가 없다: ${files.join(", ")}`);
        const { createEdgeHandler } = (await import(pathToFileURL(entry).href)) as EdgeModule;
        const handle = createEdgeHandler({
          ADMIN_PASSWORD_HASH: await hashPassword("edge-bundle-password-long", { N: 1024 }),
          SESSION_SECRET: "edge-bundle-session-secret-32-bytes!!",
          PUBLIC_BASE_URL: "https://editor.example.test",
          SUPABASE_URL: env.url,
          EDITOR_SECRET_KEY: env.secretKey,
          RELAY_SECRET: EDGE_RELAY_SECRET,
        });
        const relayed = { headers: { "X-Relay-Secret": EDGE_RELAY_SECRET } };

        const posts = await handle(new Request("http://x/editor/public/posts", relayed));
        const css = await handle(new Request("http://x/editor/public/post.css", relayed));

        expect(posts.status).toBe(200);
        expect((await posts.json()) as unknown).toMatchObject({ posts: expect.any(Array) });
        expect(css.status).toBe(200);
        expect(css.headers.get("content-type")).toMatch(/^text\/css/);
      },
      BUILD_TIMEOUT_MS,
    );
  },
);

/**
 * 배포 함수는 Node가 아니라 Deno다 — 번들을 Deno로 불러 로그인 · 공개 조회 · `/mcp` tools/list를 부른다
 * (edge-deploy "번들은 Deno에서 뜬다"). 스모크 스크립트는 임시 폴더에 쓰고 결과만 JSON으로 받는다.
 */
const DENO_SMOKE = `
const [entry, envJson, password, token] = Deno.args;
const { createEdgeHandler } = await import(entry);
const env = JSON.parse(envJson);
const handle = createEdgeHandler(env);
const json = { "content-type": "application/json" };
const relay = { "X-Relay-Secret": env.RELAY_SECRET };
const login = await handle(new Request("https://editor.example.test/editor/api/session", {
  method: "POST", headers: { ...json, ...relay, origin: "https://editor.example.test" },
  body: JSON.stringify({ username: "admin", password }),
}));
const posts = await handle(new Request("https://editor.example.test/editor/public/posts", { headers: relay }));
const tools = await handle(new Request("https://editor.example.test/editor/mcp", {
  method: "POST",
  headers: { ...json, ...relay, accept: "application/json, text/event-stream", authorization: "Bearer " + token },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
}));
const toolsText = await tools.text();
console.log(JSON.stringify({
  login: login.status,
  cookie: (login.headers.get("set-cookie") ?? "").split("=")[0],
  posts: posts.status,
  tools: tools.status,
  hasCreateDraft: toolsText.includes("create_draft"),
}));
`;

describe.skipIf(supabaseTestEnv === null)(
  supabaseSuiteName("edge-deploy — 번들은 Deno에서 뜬다(시험 프로젝트)"),
  () => {
    it(
      "WHEN 배포 번들을 Deno로 불러 로그인 · 공개 조회 · /mcp tools/list를 부르면 THEN 셋 다 성공한다",
      async () => {
        const env = supabaseTestEnv;
        if (env === null) throw new Error("시험 키 없음");
        const { files } = await buildOnce();
        const entry = files.find((file) => /\.m?js$/.test(file));
        if (entry === undefined) throw new Error(`번들 JS가 없다: ${files.join(", ")}`);
        const dir = await mkdtemp(join(tmpdir(), "edge-deno-"));
        const script = join(dir, "smoke.ts");
        await writeFile(script, DENO_SMOKE);
        const password = "edge-deno-password-long";
        const token = "edge-deno-connection-token-0123456789abcdef";
        const edgeEnv = {
          ADMIN_PASSWORD_HASH: await hashPassword(password, { N: 1024 }),
          SESSION_SECRET: "edge-deno-session-secret-32-bytes!!!",
          PUBLIC_BASE_URL: "https://editor.example.test",
          SUPABASE_URL: env.url,
          EDITOR_SECRET_KEY: env.secretKey,
          RELAY_SECRET: EDGE_RELAY_SECRET,
          MCP_CONNECTION_TOKEN_HASH: createHash("sha256").update(token).digest("hex"),
        };

        const { stdout } = await promisify(execFile)(
          "npx",
          [
            "-y",
            DENO,
            "run",
            "-A",
            script,
            pathToFileURL(entry).href,
            JSON.stringify(edgeEnv),
            password,
            token,
          ],
          { timeout: DENO_TIMEOUT_MS },
        );
        const lastLine = stdout.trim().split("\n").at(-1) ?? "";

        expect(JSON.parse(lastLine)).toEqual({
          login: 204,
          cookie: "__Host-session",
          posts: 200,
          tools: 200,
          hasCreateDraft: true,
        });
      },
      DENO_TIMEOUT_MS,
    );
  },
);
