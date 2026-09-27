/**
 * `pnpm start` — 로컬 API와 백오피스 화면(web)을 한 번에 띄운다. 둘 다 `PORT`를 읽으므로
 * pnpm 한 줄(`--parallel`)로는 포트를 따로 줄 수 없어 프로세스 두 개를 각자의 env로 띄운다.
 * 포트는 `API_PORT`(기본 8787) · `WEB_PORT`(기본 5173). 하나가 끝나면 다른 하나도 멈춘다.
 */
import { spawn, type ChildProcess } from "node:child_process";

const apiPort = process.env.API_PORT ?? "8787";
const webPort = process.env.WEB_PORT ?? "5173";

function run(filter: string, port: string): ChildProcess {
  return spawn("pnpm", ["--filter", filter, "dev"], {
    stdio: "inherit",
    env: { ...process.env, PORT: port, API_PORT: apiPort },
  });
}

const children = [run("@blog-editor/api", apiPort), run("@blog-editor/web", webPort)];

// 사람이 멈춘 종료(Ctrl-C)는 실패가 아니다 — 자식 종료 코드는 먼저 스스로 끝난 쪽만 따른다
let stopping = false;

function stopAll(): void {
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
}

for (const child of children) {
  child.on("exit", (code) => {
    if (!stopping) process.exitCode = code ?? 1;
    stopAll();
  });
}
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

console.log(`start: 화면 http://127.0.0.1:${webPort} · API http://127.0.0.1:${apiPort}`);
