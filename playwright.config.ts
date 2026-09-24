import { createHash } from "node:crypto";
import { createServer, type AddressInfo, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { E2E_ACCOUNT } from "./e2e/account.test.helpers";

/**
 * 실브라우저 층(plan 05 · adr-024) — api와 web dev 서버를 테스트 전용 포트 · 계정 · 빈 저장 루트로 띄운다.
 * `pnpm verify`가 이 층을 돌리므로 병렬 worktree의 verify가 동시에 돈다 — 고정 포트면 서로 부딪히므로
 * E2E_WEB_PORT · E2E_API_PORT가 없으면 빈 포트를 골라 env에 적는다(워커 프로세스는 이 env를 물려받아 같은 값을 읽는다).
 * 이미 잡힌 포트의 서버는 재사용하지 않는다 — 사람의 dev 서버(다른 계정 · 다른 저장소)에 붙으면 결과가 조용히 틀린다.
 */
const MAX_PORT = 65535;
const SERVER_START_TIMEOUT_MS = 60_000;
// 화면이 오류 경계로 떨어지면 기다릴 것이 없다 — 테스트 시간(30초)까지 끌지 않고 빨리 실패한다
const ACTION_TIMEOUT_MS = 10_000;
const STORE_ROOT_HASH_LENGTH = 12;
const WEB_PORT_ENV = "E2E_WEB_PORT";
const API_PORT_ENV = "E2E_API_PORT";

function parsePort(name: string, raw: string): number {
  const port = Number(raw);
  if (raw.trim() === "" || !Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(`${name}는 1~${MAX_PORT} 정수여야 한다 — 받은 값: "${raw}"`);
  }
  return port;
}

async function listenOnFreePort(): Promise<Server> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

/** 두 포트를 동시에 잡은 채 번호를 읽고 함께 놓는다 — 따로 잡았다 놓으면 운영체제가 같은 번호를 다시 줄 수 있다 */
async function twoFreePorts(): Promise<[number, number]> {
  const servers = await Promise.all([listenOnFreePort(), listenOnFreePort()]);
  const ports = servers.map((server) => (server.address() as AddressInfo).port);
  await Promise.all(
    servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
  return [ports[0] ?? 0, ports[1] ?? 0];
}

const [freeWebPort, freeApiPort] = await twoFreePorts();
const rawWebPort = process.env[WEB_PORT_ENV];
const rawApiPort = process.env[API_PORT_ENV];
const webPort = rawWebPort === undefined ? freeWebPort : parsePort(WEB_PORT_ENV, rawWebPort);
const apiPort = rawApiPort === undefined ? freeApiPort : parsePort(API_PORT_ENV, rawApiPort);
// 설정 파일은 워커 프로세스마다 다시 읽힌다 — 고른 포트를 env에 적어 두어야 워커가 새로 고르지 않는다
process.env[WEB_PORT_ENV] = String(webPort);
process.env[API_PORT_ENV] = String(apiPort);

// worktree마다 한 곳을 두고 서버를 띄울 때마다 비운다 — 병렬 worktree끼리, 이전 실행과 글이 섞이지 않는다
const worktreeKey = createHash("sha256")
  .update(import.meta.dirname)
  .digest("hex")
  .slice(0, STORE_ROOT_HASH_LENGTH);
const storeRoot = join(tmpdir(), `blog-editor-e2e-${worktreeKey}`);

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  // 로컬 pre-push에서도 test.only가 남은 채로 나가지 않게 늘 막는다
  forbidOnly: true,
  reporter: process.env.CI === undefined ? "list" : [["list"], ["github"]],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure",
    actionTimeout: ACTION_TIMEOUT_MS,
  },
  // WebKit은 뺐다(adr-024 · #118) — http 루프백에서 Secure 세션 쿠키(__Host-)를 저장하지 않아 로그인이 안 된다
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // webServer.env는 process.env 위에 얹힌다(Playwright 1.63 runner) — 덮어쓸 키만 적는다
  webServer: [
    {
      name: "api",
      command: `rm -rf "${storeRoot}" && pnpm --filter @blog-editor/api dev`,
      url: `http://127.0.0.1:${apiPort}/api/session`,
      env: {
        PORT: String(apiPort),
        POST_STORE_ROOT: storeRoot,
        ADMIN_USERNAME: E2E_ACCOUNT.username,
        ADMIN_PASSWORD: E2E_ACCOUNT.password,
        // 레포 루트 .env에 해시가 있어도 셸 값이 이기므로 빈 값으로 끈다(serve.ts — 둘 중 하나만 받는다)
        ADMIN_PASSWORD_HASH: "",
      },
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
    },
    {
      name: "web",
      command: "pnpm --filter @blog-editor/web dev",
      url: `http://127.0.0.1:${webPort}`,
      env: { PORT: String(webPort), API_PORT: String(apiPort) },
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
    },
  ],
});
